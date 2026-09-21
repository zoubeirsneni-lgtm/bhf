<?php
/**
 * Authentification bebba — systeme INDEPENDANT de WordPress.
 *
 * - Comptes dans bebba_users uniquement (clients: telephone + mot de passe ; staff: username + mot de passe).
 * - Mots de passe : password_hash PASSWORD_BCRYPT cost 10 — compatible avec les hachages bcryptjs $2a$/$2b$
 *   issus de la version Express (les comptes migres se connectent sans reinitialisation).
 * - Jeton JWT HS256 signe sans dependance externe, duree 24 h (aligne sur l'existant).
 * - Anti-force-brute : 5 tentatives / 15 min par (IP + identifiant) via transients.
 *
 * INTERDITS (controle de relecture) : wp_insert_user, wp_authenticate, is_user_logged_in,
 * current_user_can, cookies de session WordPress.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Auth {

	const TOKEN_TTL    = DAY_IN_SECONDS; // 24 h, identique a JWT_EXPIRES_IN de l'ancien serveur.
	const RATE_LIMIT   = 5;              // tentatives
	const RATE_WINDOW  = 15 * MINUTE_IN_SECONDS;

	public const ROLES = array( 'client', 'kitchen', 'driver', 'admin', 'admin_readonly' );

	/* ------------------------------------------------------------------ secret */

	public static function get_secret(): string {
		if ( defined( 'BEBBA_JWT_SECRET' ) && BEBBA_JWT_SECRET ) {
			return BEBBA_JWT_SECRET;
		}
		$secret = get_option( 'bebba_hf_jwt_secret', '' );
		if ( ! is_string( $secret ) || strlen( $secret ) < 32 ) {
			// Ne doit arriver qu'avant l'activation — le secret est genere dans l'activator.
			$secret = wp_generate_password( 64, true, true );
			update_option( 'bebba_hf_jwt_secret', $secret, true );
		}
		return $secret;
	}

	/* ------------------------------------------------------------------ JWT HS256 */

	private static function b64url_encode( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	private static function b64url_decode( string $data ): string {
		return base64_decode( strtr( $data, '-_', '+/' ) . str_repeat( '=', ( 4 - strlen( $data ) % 4 ) % 4 ), true ) ?: '';
	}

	public static function issue_token( array $user ): string {
		$header  = array( 'alg' => 'HS256', 'typ' => 'JWT' );
		$payload = array(
			'sub'   => (int) $user['id'],
			'role'  => (string) $user['role'],
			'tv'    => (int) ( $user['token_version'] ?? 0 ),
			'iat'   => time(),
			'exp'   => time() + self::TOKEN_TTL,
		);
		if ( ! empty( $user['username'] ) ) {
			$payload['username'] = $user['username'];
		}
		if ( ! empty( $user['phone'] ) ) {
			$payload['phone'] = $user['phone'];
		}
		if ( ! empty( $user['driver_id'] ) ) {
			$payload['driverId'] = (int) $user['driver_id'];
		}

		$segments = array(
			self::b64url_encode( wp_json_encode( $header ) ),
			self::b64url_encode( wp_json_encode( $payload ) ),
		);
		$signature = hash_hmac( 'sha256', $segments[0] . '.' . $segments[1], self::get_secret(), true );
		$segments[] = self::b64url_encode( $signature );

		return implode( '.', $segments );
	}

	/** Verifie signature + expiration. Renvoie le payload ou null. */
	public static function verify_token( string $token ): ?array {
		$parts = explode( '.', $token );
		if ( count( $parts ) !== 3 ) {
			return null;
		}
		list( $h, $p, $s ) = $parts;
		$expected = hash_hmac( 'sha256', $h . '.' . $p, self::get_secret(), true );
		if ( ! hash_equals( $expected, self::b64url_decode( $s ) ) ) {
			return null;
		}
		$payload = json_decode( self::b64url_decode( $p ), true );
		if ( ! is_array( $payload ) || empty( $payload['sub'] ) || empty( $payload['exp'] ) ) {
			return null;
		}
		if ( time() >= (int) $payload['exp'] ) {
			return null;
		}
		return $payload;
	}

	/* ------------------------------------------------------------------ comptes */

	/** Normalisation identique a normalizePhoneNumber (server.ts) : chiffres seuls, 8 minimum. */
	public static function normalize_phone( string $phone ): ?string {
		$digits = preg_replace( '/[^0-9]/', '', $phone );
		if ( strlen( $digits ) < 8 || strlen( $digits ) > 15 ) {
			return null;
		}
		return $digits;
	}

	public static function hash_password( string $password ): string {
		return password_hash( $password, PASSWORD_BCRYPT, array( 'cost' => 10 ) );
	}

	/** Recharge un compte actif depuis la BDD (source de verite a chaque requete). */
	public static function find_user_by_id( int $id ): ?array {
		global $wpdb;
		$table = Bebba_HF_DB::users_table();
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d AND active = 1", $id ),
			ARRAY_A
		);
		return $row ?: null;
	}

	/* ------------------------------------------------------------------ login */

	/**
	 * Tentative de connexion. Renvoie array{token, user} ou WP_Error.
	 * $identifier : telephone (client) OU username (staff) — decidable par le champ 'mode'.
	 */
	public static function login( string $identifier, string $password, string $mode ) {
		$identifier = trim( $identifier );
		if ( '' === $identifier || '' === $password ) {
			return new WP_Error( 'bebba_bad_request', 'Identifiant et mot de passe requis.', array( 'status' => 400 ) );
		}
		if ( ! in_array( $mode, array( 'client', 'staff' ), true ) ) {
			return new WP_Error( 'bebba_bad_request', 'Mode de connexion invalide.', array( 'status' => 400 ) );
		}

		// Anti-force-brute avant toute lecture BDD.
		$rl_key = 'bebba_rl_' . md5( ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : 'cli' ) . '|' . strtolower( $identifier ) );
		$attempts = (int) get_transient( $rl_key );
		if ( $attempts >= self::RATE_LIMIT ) {
			return new WP_Error( 'bebba_rate_limited', 'Trop de tentatives. Reessayez plus tard.', array( 'status' => 429 ) );
		}

		global $wpdb;
		$table = Bebba_HF_DB::users_table();

		if ( 'client' === $mode ) {
			$phone = self::normalize_phone( $identifier );
			if ( null === $phone ) {
				return new WP_Error( 'bebba_invalid_credentials', 'Identifiants invalides.', array( 'status' => 401 ) );
			}
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE phone = %s AND role = 'client' LIMIT 1", $phone ),
				ARRAY_A
			);
		} else {
			// Le staff ne se connecte JAMAIS par telephone (regle existante conservee).
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE username = %s AND username <> '' LIMIT 1", $identifier ),
				ARRAY_A
			);
		}

		if ( ! $row || 1 !== (int) $row['active'] || ! password_verify( $password, $row['password_hash'] ) ) {
			set_transient( $rl_key, $attempts + 1, self::RATE_WINDOW );
			// Message generique : ne pas reveler si l'identifiant existe.
			return new WP_Error( 'bebba_invalid_credentials', 'Identifiants invalides.', array( 'status' => 401 ) );
		}

		// Re-hachage opportuniste (regle 3.2 de la spec).
		if ( password_needs_rehash( $row['password_hash'], PASSWORD_BCRYPT, array( 'cost' => 10 ) ) ) {
			$wpdb->update(
				$table,
				array( 'password_hash' => self::hash_password( $password ) ),
				array( 'id' => (int) $row['id'] ),
				array( '%s' ),
				array( '%d' )
			);
		}

		$wpdb->update(
			$table,
			array( 'last_login_at' => Bebba_HF_DB::now() ),
			array( 'id' => (int) $row['id'] ),
			array( '%s' ),
			array( '%d' )
		);

		delete_transient( $rl_key );
		unset( $row['password_hash'] );

		return array(
			'token' => self::issue_token( $row ),
			'user'  => self::safe_user( $row ),
		);
	}

	/* ------------------------------------------------------------------ RBAC REST */

	/** Extrait le JWT de l'entete Authorization: Bearer (repli: X-BEBBA-Token). */
	public static function get_bearer_token(): ?string {
		$header = isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) ) : '';
		if ( '' === $header && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$header = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
		}
		if ( preg_match( '/^Bearer\s+(\S+)$/i', $header, $m ) ) {
			return $m[1];
		}
		if ( isset( $_SERVER['HTTP_X_BEBBA_TOKEN'] ) && '' !== $_SERVER['HTTP_X_BEBBA_TOKEN'] ) {
			return sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_BEBBA_TOKEN'] ) );
		}
		return null;
	}

	/**
	 * Gate d'acces : jeton valide + compte actif + role autorise.
	 * A utiliser comme permission_callback, puis dans le handler pour req.user.
	 * Renvoie array user (sans hash) ou WP_Error 401/403.
	 */
	public static function require_role( array $allowed_roles ) {
		$token = self::get_bearer_token();
		if ( null === $token || '' === $token ) {
			return new WP_Error( 'bebba_unauthenticated', "Acces non autorise : jeton d'authentification manquant.", array( 'status' => 401 ) );
		}
		$payload = self::verify_token( $token );
		if ( null === $payload ) {
			return new WP_Error( 'bebba_unauthenticated', "Acces non autorise : jeton invalide ou expire.", array( 'status' => 401 ) );
		}
		$user = self::find_user_by_id( (int) $payload['sub'] );
		if ( ! $user ) {
			return new WP_Error( 'bebba_unauthenticated', "Acces non autorise : utilisateur inexistant ou desactive.", array( 'status' => 401 ) );
		}
		// Revocation globale d'un compte (token_version incremente).
		if ( isset( $payload['tv'] ) && (int) $payload['tv'] !== (int) $user['token_version'] ) {
			return new WP_Error( 'bebba_unauthenticated', "Acces non autorise : jeton revoque.", array( 'status' => 401 ) );
		}
		if ( ! in_array( $user['role'], $allowed_roles, true ) ) {
			return new WP_Error(
				'bebba_forbidden',
				sprintf( "Acces refuse : le role '%s' n'a pas les permissions requises.", $user['role'] ),
				array( 'status' => 403 )
			);
		}
		return self::safe_user( $user );
	}

	/** Projection publique d'un compte — JAMAIS de password_hash (equivalent sanitizeUser). */
	public static function safe_user( array $row ): array {
		return array(
			'id'            => (int) $row['id'],
			'username'      => $row['username'] ?? null,
			'name'          => $row['name'],
			'phone'         => $row['phone'] ?? null,
			'address'       => $row['address'] ?? null,
			'role'          => $row['role'],
			'driverId'      => $row['driver_id'] ? (int) $row['driver_id'] : null,
			'active'        => (bool) $row['active'],
			'createdAt'     => $row['created_at'] ?? null,
			'updatedAt'     => $row['updated_at'] ?? null,
			'lastLoginAt'   => $row['last_login_at'] ?? null,
		);
	}
}
