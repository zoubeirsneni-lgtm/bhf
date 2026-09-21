<?php
/**
 * Shortcodes d'affichage de l'application React embarquee.
 * [bebba_app]   — application complete (client + vues staff selon role bebba connecte)
 * [bebba_staff] — point d'entree equipe (rend le meme DOM ; utile pour une page dediee)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Shortcodes {

	public static function register(): void {
		add_shortcode( 'bebba_app', array( __CLASS__, 'render_app' ) );
		add_shortcode( 'bebba_staff', array( __CLASS__, 'render_app' ) );
	}

	public static function render_app( $atts = array() ): string {
		$atts = shortcode_atts(
			array( 'view' => 'auto' ),
			$atts,
			'bebba_app'
		);

		$entry = self::entry_asset();
		if ( null === $entry ) {
			return '<div class="bebba-dev-notice"><p><strong>BEBBA Healthy Food :</strong> le build React n\'est pas encore presente dans <code>public/</code>. Il sera ajoute a la Phase 6 (integration React).</p></div>';
		}

		wp_enqueue_style(
			'bebba-hf-app',
			$entry['css_url'],
			array(),
			$entry['css_ver']
		);
		wp_enqueue_script(
			'bebba-hf-app',
			$entry['js_url'],
			array(),
			$entry['js_ver'],
			true
		);
		// Base API + configuration passees a l'app React (regle 7.2 de la spec).
		wp_localize_script(
			'bebba-hf-app',
			'BEBBA_CONFIG',
			array(
				'apiBase' => esc_url_raw( rest_url( 'bebba/v1' ) ),
				'view'    => sanitize_key( $atts['view'] ),
			)
		);

		return '<div id="root"></div>';
	}

	/** Localise l'entree du build (index-*.js / index-*.css) dans public/. */
	private static function entry_asset(): ?array {
		static $cache = null;
		if ( null !== $cache ) {
			return $cache;
		}

		$js_path = glob( BEBBA_HF_PATH . 'public/assets/index-*.js' );
		$css_path = glob( BEBBA_HF_PATH . 'public/assets/index-*.css' );
		if ( empty( $js_path ) ) {
			$cache = null;
			return null;
		}

		$js  = $js_path[0];
		$css = ! empty( $css_path ) ? $css_path[0] : null;

		$cache = array(
			'js_url'  => BEBBA_HF_URL . 'public/assets/' . rawurlencode( basename( $js ) ),
			'js_ver'  => (string) filemtime( $js ),
			'css_url' => $css ? BEBBA_HF_URL . 'public/assets/' . rawurlencode( basename( $css ) ) : '',
			'css_ver' => $css ? (string) filemtime( $css ) : '',
		);
		return $cache;
	}
}
