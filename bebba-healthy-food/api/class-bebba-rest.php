<?php
/**
 * REST API bebba — namespace /wp-json/bebba/v1
 *
 * PHASE 0 : routes health + auth (fonctionnelles dans ce squelette).
 * PHASES 2-5 : completer selon la cartographie de la spec (section 5) — voir CARTE DES ROUTES ci-dessous.
 *
 * Contrat de relecture :
 * - CHAQUE route declare un permission_callback explicite (jamais __return_true sur une route protegee).
 * - Les routes protegees utilisent Bebba_HF_Auth::require_role( array( ...roles... ) ).
 * - Les entrees sont sanitisees ; les reponses n'exposent jamais password_hash.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Rest {

	const NAMESPACE_V1 = 'bebba/v1';

	public static function register_routes(): void {

		/* ------------------------------------------------ health (public) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/health',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true', // Route de diagnostic, volontairement publique.
				'callback'            => array( __CLASS__, 'health' ),
			)
		);

		/* ------------------------------------------------ auth (public + roles) */
		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/login',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => '__return_true', // Public, protege par anti-force-brute.
				'callback'            => array( __CLASS__, 'login' ),
				'args'                => array(
					'identifier' => array( 'required' => true, 'type' => 'string' ),
					'password'   => array( 'required' => true, 'type' => 'string' ),
					'mode'       => array( 'required' => true, 'type' => 'string', 'enum' => array( 'client', 'staff' ) ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/register-client',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => '__return_true', // Public, throttle applicatif a ajouter en Phase 1.
				'callback'            => array( __CLASS__, 'register_client' ),
				'args'                => array(
					'name'     => array( 'required' => true, 'type' => 'string' ),
					'phone'    => array( 'required' => true, 'type' => 'string' ),
					'password' => array( 'required' => true, 'type' => 'string' ),
					'address'  => array( 'required' => false, 'type' => 'string' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/me',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				},
				'callback'            => array( __CLASS__, 'me' ),
			)
		);

		register_rest_route(
			self::NAMESPACE_V1,
			'/auth/logout',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => function () {
					return Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
				},
				'callback'            => array( __CLASS__, 'logout' ),
			)
		);

		/* ================================================================
		 * CARTE DES ROUTES RESTANTES (spec section 5) — a declarer ici :
		 *
		 * PHASE 2 (catalogue public) :
		 *   GET  /categories          public
		 *   GET  /categories/(?P<id>\d+)  public
		 *   GET  /products            public
		 *   GET  /products/(?P<id>\d+)    public
		 *   GET  /supplements         public
		 *   GET  /supplements/(?P<id>\d+) public
		 *   GET  /orders/track/(?P<token>[A-Za-z0-9]+)  public
		 *   POST /orders/track-lookup public (throttle)
		 *
		 * PHASE 3 (commandes) :
		 *   POST /orders              public|client (transaction stock + idempotence)
		 *   GET  /orders/(?P<id>\d+)  admin|kitchen|driver|client (anti-IDOR)
		 *   GET  /client/orders       client
		 *
		 * PHASE 4 (back-office) :
		 *   POST/PUT/DELETE /categories|products|supplements[/:id]  admin
		 *   GET/POST/PUT /ingredients  admin|kitchen ; DELETE /ingredients/:id  admin
		 *   POST /ingredients/:id/stock  admin|kitchen
		 *   GET  /stock-movements      admin|admin_readonly
		 *   CRUD /suppliers            admin
		 *   GET  /drivers              admin|kitchen ; POST /drivers  admin
		 *   PUT /drivers/:id ; PATCH /drivers/:id/status ; PATCH /drivers/:id/password ; DELETE /drivers/:id  admin
		 *   GET/POST /users            admin (POST refuse role=client)
		 *   GET  /stats                admin|admin_readonly
		 *   POST /admin/reset-demo     admin (reglage ON/OFF, OFF en prod)
		 *
		 * PHASE 5 (cuisine + livreur) :
		 *   PATCH /orders/:id/status        admin|kitchen|driver (matrice spec 6.1)
		 *   PATCH /orders/:id/assign-driver admin
		 *   PATCH /orders/:id/payment       admin|driver
		 * ================================================================ */
	}

	/* ---------------------------------------------------------------- handlers */

	public static function health(): WP_REST_Response {
		global $wpdb;
		$db_ok = (int) $wpdb->get_var( 'SELECT 1' ) === 1;
		return new WP_REST_Response(
			array(
				'ok'                   => true,
				'version'              => BEBBA_HF_VERSION,
				'db'                   => $db_ok,
				'authorization_header' => '' !== ( isset( $_SERVER['HTTP_AUTHORIZATION'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) ) : '' ),
			),
			200
		);
	}

	/** Compatibilite : le frontend actuel envoie {username, phone, password}. */
	public static function login( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$mode       = (string) $request->get_param( 'mode' );
		$identifier = (string) ( $request->get_param( 'identifier' ) ?? '' );
		$password   = (string) ( $request->get_param( 'password' ) ?? '' );

		// Format historique du frontend : {username?, phone?, password}.
		if ( '' === $identifier ) {
			$username = trim( (string) $request->get_param( 'username' ) );
			$phone    = trim( (string) $request->get_param( 'phone' ) );
			if ( '' !== $phone && ! $username ) {
				$mode       = 'client';
				$identifier = $phone;
			} elseif ( '' !== $username ) {
				$mode       = 'staff';
				$identifier = $username;
			}
		}

		$result = Bebba_HF_Auth::login( $identifier, $password, $mode );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return new WP_REST_Response( $result, 200 );
	}

	public static function register_client( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$name     = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$phone    = Bebba_HF_Auth::normalize_phone( (string) $request->get_param( 'phone' ) );
		$password = (string) $request->get_param( 'password' );
		$address  = sanitize_text_field( (string) ( $request->get_param( 'address' ) ?? '' ) );

		if ( '' === $name ) {
			return new WP_Error( 'bebba_bad_request', 'Le nom est obligatoire.', array( 'status' => 400 ) );
		}
		if ( null === $phone ) {
			return new WP_Error( 'bebba_bad_request', 'Numéro de téléphone invalide (au moins 8 chiffres requis).', array( 'status' => 400 ) );
		}
		if ( strlen( $password ) < 6 ) {
			return new WP_Error( 'bebba_bad_request', 'Le mot de passe doit contenir au moins 6 caracteres.', array( 'status' => 400 ) );
		}

		// Throttle inscription (regle 3.4 de la spec).
		$rl_key = 'bebba_rlreg_' . md5( ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : 'cli' ) );
		$hits   = (int) get_transient( $rl_key );
		if ( $hits >= 10 ) {
			return new WP_Error( 'bebba_rate_limited', 'Trop de tentatives. Reessayez plus tard.', array( 'status' => 429 ) );
		}
		set_transient( $rl_key, $hits + 1, 15 * MINUTE_IN_SECONDS );

		$table = Bebba_HF_DB::users_table();

		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE phone = %s AND role = 'client' LIMIT 1", $phone )
		);
		if ( (int) $exists > 0 ) {
			return new WP_Error( 'bebba_phone_taken', 'Un compte client avec ce numéro de téléphone existe déjà.', array( 'status' => 400 ) );
		}

		$ok = $wpdb->insert(
			$table,
			array(
				'name'          => $name,
				'phone'         => $phone,
				'address'       => $address,
				'password_hash' => Bebba_HF_Auth::hash_password( $password ),
				'role'          => 'client',
				'active'        => 1,
				'created_at'    => Bebba_HF_DB::now(),
				'updated_at'    => Bebba_HF_DB::now(),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' )
		);
		if ( false === $ok ) {
			return new WP_Error( 'bebba_server_error', 'Erreur interne.', array( 'status' => 500 ) );
		}

		$user = Bebba_HF_Auth::find_user_by_id( (int) $wpdb->insert_id );
		if ( ! $user ) {
			return new WP_Error( 'bebba_server_error', 'Erreur interne.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'token' => Bebba_HF_Auth::issue_token( $user ),
				'user'  => Bebba_HF_Auth::safe_user( $user ),
			),
			201
		);
	}

	public static function me( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$user = Bebba_HF_Auth::require_role( Bebba_HF_Auth::ROLES );
		if ( is_wp_error( $user ) ) {
			return $user;
		}
		return new WP_REST_Response( $user, 200 );
	}

	/** La deconnexion est cote client (suppression du token) ; reponse conservee pour compatibilite. */
	public static function logout(): WP_REST_Response {
		return new WP_REST_Response( array( 'message' => 'Déconnecté.' ), 200 );
	}
}
