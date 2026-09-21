<?php
/**
 * Activation : creation des tables (dbDelta), generation du secret JWT, semis du compte admin.
 *
 * PHASE 0 (a completer par AI Studio) : porter les 17 autres tables de mysql_schema_bebba.sql
 * ici, en syntaxe dbDelta (pas de backticks, pas de CONSTRAINT nomme, deux espaces apres
 * PRIMARY KEY, un champ par ligne), puis appliquer le delta bebba_schema_delta_users.sql.
 * Les cles etrangeres ne sont PAS posees par dbDelta : elles seront ajoutees par une requete
 * ALTER directe une fois toutes les tables creees.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Activator {

	public static function activate(): void {
		self::create_tables();
		self::ensure_jwt_secret();
		self::seed_admin();
	}

	private static function create_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$users    = Bebba_HF_DB::users_table();
		$counters = Bebba_HF_DB::counters_table();

		$sql = array();

		$sql[] = "CREATE TABLE {$users} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NULL,
			username VARCHAR(64) NULL,
			phone VARCHAR(20) NULL,
			name VARCHAR(128) NOT NULL,
			address VARCHAR(255) NULL,
			password_hash VARCHAR(255) NOT NULL,
			role ENUM('client','kitchen','driver','admin','admin_readonly') NOT NULL,
			driver_id BIGINT UNSIGNED NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			token_version INT UNSIGNED NOT NULL DEFAULT 0,
			must_change_password TINYINT(1) NOT NULL DEFAULT 0,
			last_login_at DATETIME NULL,
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_users_legacy_id (legacy_id),
			UNIQUE KEY uk_bebba_users_username (username),
			UNIQUE KEY uk_bebba_users_phone (phone),
			KEY idx_bebba_users_role (role),
			KEY idx_bebba_users_driver_id (driver_id),
			KEY idx_bebba_users_active (active)
		) {$charset}";

		$sql[] = "CREATE TABLE {$counters} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			counter_name VARCHAR(64) NOT NULL,
			current_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_counters_name (counter_name)
		) {$charset}";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}

		update_option( 'bebba_hf_schema_version', BEBBA_HF_VERSION, true );
	}

	private static function ensure_jwt_secret(): void {
		$secret = get_option( 'bebba_hf_jwt_secret', '' );
		if ( ! is_string( $secret ) || strlen( $secret ) < 32 ) {
			add_option( 'bebba_hf_jwt_secret', wp_generate_password( 64, true, true ), '', true );
		}
	}

	/**
	 * Seme un compte admin provisoire si aucun compte admin n'existe.
	 * Le mot de passe genere est conserve UNE SEULE FOIS dans une option non-autoloaded
	 * et doit etre affiche a l'admin puis supprime (cf. page de reglages, Phase 4).
	 */
	private static function seed_admin(): void {
		global $wpdb;
		$table = Bebba_HF_DB::users_table();

		$exists = $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE role = 'admin' LIMIT 1" );
		if ( (int) $exists > 0 ) {
			return;
		}

		$username = 'bebba_admin_' . wp_rand( 1000, 9999 );
		$password = wp_generate_password( 20, true, true );

		$wpdb->insert(
			$table,
			array(
				'username'             => $username,
				'name'                 => 'Administrateur BEBBA',
				'password_hash'        => Bebba_HF_Auth::hash_password( $password ),
				'role'                 => 'admin',
				'active'               => 1,
				'must_change_password' => 1,
				'created_at'           => Bebba_HF_DB::now(),
				'updated_at'           => Bebba_HF_DB::now(),
			),
			array( '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' )
		);

		// Affichage unique : la notice est supprimee apres lecture (regle 9.6 de la spec).
		update_option(
			'bebba_hf_seed_notice',
			array(
				'username' => $username,
				'password' => $password,
			),
			false
		);
	}
}
