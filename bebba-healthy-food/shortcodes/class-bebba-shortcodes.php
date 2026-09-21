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
		add_shortcode( 'bebba_catalogue', array( __CLASS__, 'render_catalogue' ) );
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

		/* ------------------------------------------------- vitrine catalogue (LOT 2.1) */

		/**
		* [bebba_catalogue] — vitrine technique du catalogue, rendu serveur (sans React).
		* Preuve visible du LOT 2 dans WordPress ; l'application complète (panier, commandes,
		* suivi) sera intégrée au LOT 6. Attributs : title="Notre carte" supplements="yes|no".
		*/
		public static function render_catalogue( $atts = array() ): string {
				$atts = shortcode_atts(
						array(
								'title'       => 'Notre carte',
								'supplements' => 'yes',
						),
						$atts,
						'bebba_catalogue'
				);

				if ( ! class_exists( 'Bebba_HF_Catalog' ) ) {
						return '<div class="bebba-vitrine"><p><strong>BEBBA :</strong> classe métier introuvable.</p></div>';
				}

				$categories  = Bebba_HF_Catalog::list_categories( true );
				$products    = Bebba_HF_Catalog::list_products( null, true, true );
				$supplements = Bebba_HF_Catalog::list_supplements( true, true );

				$out   = array();
				$out[] = '<div class="bebba-vitrine">';
				$out[] = self::vitrine_styles();
				$out[] = '<div class="bv-head">';
				$out[] = '<h2 class="bv-title">' . esc_html( (string) $atts['title'] ) . '</h2>';
				$out[] = '<p class="bv-sub">Vitrine technique BEBBA Healthy Food · plugin v' . esc_html( BEBBA_HF_VERSION ) . ' · API <code>' . esc_html( rest_url( 'bebba/v1' ) ) . '</code></p>';
				$out[] = '</div>';

				if ( empty( $categories ) && empty( $products ) ) {
						$out[] = '<div class="bv-empty"><p><strong>Catalogue vide.</strong> Importez <code>docs/demo_seed_lot2.sql</code> dans phpMyAdmin (base <code>bebba_bhf</code>) pour afficher les données de démonstration.</p></div>';
				}

				$grouped = array();
				$orphans = array();
				foreach ( $products as $product ) {
						$cid = isset( $product['categoryId'] ) ? (string) $product['categoryId'] : '';
						if ( '' !== $cid ) {
								$grouped[ $cid ][] = $product;
						} else {
								$orphans[] = $product;
						}
				}

				foreach ( $categories as $category ) {
						$cid   = (string) $category['id'];
						$items = isset( $grouped[ $cid ] ) ? $grouped[ $cid ] : array();
						unset( $grouped[ $cid ] );

						$out[] = '<section class="bv-cat">';
						$icon  = isset( $category['icon'] ) ? trim( (string) $category['icon'] ) : '';
						$out[] = '<h3 class="bv-cat-title">' . ( '' !== $icon ? esc_html( $icon ) . ' ' : '' ) . esc_html( (string) $category['name'] ) . '</h3>';
						if ( ! empty( $category['description'] ) ) {
								$out[] = '<p class="bv-cat-desc">' . esc_html( (string) $category['description'] ) . '</p>';
						}
						if ( empty( $items ) ) {
								$out[] = '<p class="bv-cat-desc">Aucun produit disponible dans cette catégorie pour le moment.</p>';
						} else {
								$out[] = '<div class="bv-grid">';
								foreach ( $items as $item ) {
										$out[] = self::vitrine_product_card( $item );
								}
								$out[] = '</div>';
						}
						$out[] = '</section>';
				}

				if ( ! empty( $grouped ) || ! empty( $orphans ) ) {
						$out[] = '<section class="bv-cat"><h3 class="bv-cat-title">Autres produits</h3><div class="bv-grid">';
						foreach ( $grouped as $items ) {
								foreach ( $items as $item ) {
										$out[] = self::vitrine_product_card( $item );
								}
						}
						foreach ( $orphans as $item ) {
								$out[] = self::vitrine_product_card( $item );
						}
						$out[] = '</div></section>';
				}

				if ( 'yes' === (string) $atts['supplements'] && ! empty( $supplements ) ) {
						$out[] = '<section class="bv-cat"><h3 class="bv-cat-title">Suppléments</h3><p class="bv-cat-desc">Ajouts optionnels proposés à la personnalisation des plats.</p><div class="bv-grid">';
						foreach ( $supplements as $sup ) {
								$name  = isset( $sup['name'] ) ? (string) $sup['name'] : '';
								$desc  = isset( $sup['description'] ) ? (string) $sup['description'] : '';
								$price = isset( $sup['price'] ) ? (float) $sup['price'] : 0.0;
								$out[] = '<div class="bv-card bv-card-sup"><div class="bv-card-body"><h4 class="bv-name">' . esc_html( $name ) . '</h4>'
										. ( '' !== $desc ? '<p class="bv-desc">' . esc_html( $desc ) . '</p>' : '' )
										. '</div><div class="bv-price">' . self::price_fr( $price ) . '</div></div>';
						}
						$out[] = '</div></section>';
				}

				$out[] = '<p class="bv-foot">Vitrine technique (LOT 2) — panier, commandes et suivi arrivent avec l\'application complète au LOT 6.</p>';
				$out[] = '</div>';

				return implode( "\n", $out );
		}

		/** Carte produit — mêmes données que l'API publique (badges, macros, personnalisation). */
		private static function vitrine_product_card( array $product ): string {
				$name  = isset( $product['name'] ) ? (string) $product['name'] : '';
				$desc  = isset( $product['description'] ) ? (string) $product['description'] : '';
				$price = isset( $product['basePrice'] ) ? (float) $product['basePrice'] : 0.0;

				$badges = array();
				if ( ! empty( $product['isPopular'] ) ) {
						$badges[] = '<span class="bv-badge bv-badge-hot">Populaire</span>';
				}
				if ( ! empty( $product['hasInactiveIngredient'] ) ) {
						$badges[] = '<span class="bv-badge bv-badge-warn">Ingrédient momentanément indisponible</span>';
				}
				$customization = isset( $product['customization'] ) && is_array( $product['customization'] ) ? $product['customization'] : array();
				if ( ! empty( $customization['allowsProteinChoice'] ) || ! empty( $customization['allowsVeggiesChoice'] ) || ! empty( $customization['allowsBaseChoice'] ) ) {
						$badges[] = '<span class="bv-badge bv-badge-custom">Personnalisable</span>';
				}

				$macros = array();
				if ( isset( $product['calories'] ) && is_numeric( (string) $product['calories'] ) ) {
						$macros[] = (string) $product['calories'] . ' kcal';
				}
				if ( isset( $product['proteinGrams'] ) && is_numeric( (string) $product['proteinGrams'] ) ) {
						$macros[] = (string) $product['proteinGrams'] . ' g de protéines';
				}

				if ( ! empty( $product['imageUrl'] ) ) {
						$thumb = '<div class="bv-thumb"><img src="' . esc_url( (string) $product['imageUrl'] ) . '" alt="' . esc_attr( $name ) . '" loading="lazy" /></div>';
				} else {
						$thumb = '<div class="bv-thumb bv-thumb-empty"></div>';
				}

				return '<article class="bv-card">' . $thumb
						. '<div class="bv-card-body"><h4 class="bv-name">' . esc_html( $name ) . '</h4>'
						. ( '' !== $desc ? '<p class="bv-desc">' . esc_html( $desc ) . '</p>' : '' )
						. ( ! empty( $badges ) ? '<div class="bv-badges">' . implode( ' ', $badges ) . '</div>' : '' )
						. ( ! empty( $macros ) ? '<p class="bv-macros">' . esc_html( implode( ' · ', $macros ) ) . '</p>' : '' )
						. '</div><div class="bv-card-foot"><span class="bv-price">' . self::price_fr( $price ) . '</span></div></article>';
		}

		/** Prix formaté marché tunisien : 14,50 DT (sortie numérique sûre, non échappée). */
		private static function price_fr( float $value ): string {
				return number_format( $value, 2, ',', ' ' ) . '&nbsp;DT';
		}

		/** CSS de la vitrine — scoper sous .bebba-vitrine pour ne pas fuiter dans le thème. */
		private static function vitrine_styles(): string {
				static $done = false;
				if ( $done ) {
						return '';
				}
				$done = true;

				return '<style>'
						. '.bebba-vitrine{--bv-accent:#16a34a;--bv-ink:#111827;--bv-muted:#6b7280;--bv-line:#e5e7eb;max-width:1080px;margin:0 auto;padding:8px 4px 20px;color:var(--bv-ink);font-size:16px;line-height:1.55}'
						. '.bebba-vitrine *{box-sizing:border-box}'
						. '.bv-head{margin:0 0 20px}'
						. '.bv-title{font-size:30px;font-weight:700;margin:0 0 4px;letter-spacing:-.02em}'
						. '.bv-sub{margin:0;color:var(--bv-muted);font-size:13.5px}'
						. '.bv-sub code{background:#eef2ff;padding:1px 6px;border-radius:6px;font-size:12px;word-break:break-all}'
						. '.bv-cat{margin:0 0 28px}'
						. '.bv-cat-title{font-size:21px;font-weight:700;margin:0 0 2px}'
						. '.bv-cat-desc{margin:0 0 12px;color:var(--bv-muted);font-size:14px}'
						. '.bv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}'
						. '.bv-card{background:#fff;border:1px solid var(--bv-line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(15,23,42,.06)}'
						. '.bv-thumb{aspect-ratio:16/10;background:linear-gradient(135deg,#d1fae5,#ecfdf5)}'
						. '.bv-thumb img{width:100%;height:100%;object-fit:cover;display:block}'
						. '.bv-card-body{padding:12px 14px 8px;flex:1}'
						. '.bv-name{font-size:16.5px;font-weight:700;margin:0 0 4px}'
						. '.bv-desc{margin:0 0 8px;color:var(--bv-muted);font-size:13.5px}'
						. '.bv-badges{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 10px}'
						. '.bv-badge{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:#f1f5f9;color:#334155}'
						. '.bv-badge-hot{background:#fee2e2;color:#b91c1c}'
						. '.bv-badge-warn{background:#fef3c7;color:#92400e}'
						. '.bv-badge-custom{background:#dcfce7;color:#166534}'
						. '.bv-macros{color:var(--bv-muted);font-size:12.5px;margin:0 0 10px}'
						. '.bv-card-foot{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--bv-line)}'
						. '.bv-price{font-weight:800;color:var(--bv-accent);font-size:17px}'
						. '.bv-card-sup{flex-direction:row;align-items:center;gap:10px;padding:12px 14px}'
						. '.bv-card-sup .bv-card-body{padding:0;flex:1}'
						. '.bv-empty{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;margin:0 0 18px}'
						. '.bv-foot{color:var(--bv-muted);font-size:12.5px;margin:22px 0 6px;text-align:center}'
						. '</style>';
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
