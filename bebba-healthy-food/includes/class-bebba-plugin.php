<?php
/**
 * Bootstrap du plugin : REST, shortcodes, assets, notice d'activation.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Plugin {

	private static ?Bebba_HF_Plugin $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( 'Bebba_HF_Rest', 'register_routes' ) );
		add_action( 'init', array( 'Bebba_HF_Shortcodes', 'register' ) );
		add_action( 'admin_notices', array( $this, 'seed_admin_notice' ) );
		add_filter( 'rest_pre_serve_request', array( $this, 'no_store_on_bebba_routes' ), 10, 4 );
	}

	/** Notice unique : identifiants admin semes a l'activation. */
	public function seed_admin_notice(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return; // Notice WordPress (ecran admin), pas de metier bebba ici.
		}
		$notice = get_option( 'bebba_hf_seed_notice' );
		if ( ! is_array( $notice ) ) {
			return;
		}
		printf(
			'<div class="notice notice-warning"><p><strong>BEBBA Healthy Food :</strong> compte admin bebba cree — identifiant <code>%s</code>, mot de passe <code>%s</code>. Notez-le puis changez-le a la premiere connexion ; cette notice disparaitra ensuite.</p></div>',
			esc_html( $notice['username'] ),
			esc_html( $notice['password'] )
		);
	}

	/**
	 * Aucun cache sur les routes bebba authentifiees (regle 9 / piege 9 de la spec).
	 * Les caches page ne doivent pas non plus servir /wp-json/bebba/v1.
	 */
	public function no_store_on_bebba_routes( $served, $result, $request ) {
		if ( strpos( (string) $request->get_route(), '/bebba/v1' ) === 0 ) {
			header( 'Cache-Control: no-store' );
		}
		return $served;
	}
}
