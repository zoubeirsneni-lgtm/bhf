<?php
/**
 * Catalogue public + suivi public — LOT 2.
 *
 * Portage 1:1 des routes publiques de server.ts (decisions D3/D4) :
 *   - GET /categories, /categories/:id
 *   - GET /products, /products/:id
 *   - GET /supplements, /supplements/:id
 *   - GET /orders/track/:token (+ /orders/track?token=)
 *   - POST /orders/track-lookup
 *
 * Contrats JSON identiques a Express : les identifiants metier sont des
 * chaines (legacy_id Firestore conserve a la migration, sinon id numerique
 * en chaine), les dates sont ISO 8601 UTC, les erreurs sont {"error": "..."}.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Bebba_HF_Catalog {

	/* ------------------------------------------------------------ helpers */

	/** ID metier expose au front : legacy_id Firestore sinon id numerique en chaine. */
	private static function biz_id( ?string $legacy, $numeric ): string {
		if ( $legacy !== null && $legacy !== '' ) {
			return $legacy;
		}
		return (string) $numeric;
	}

	/** 'Y-m-d H:i:s' (UTC) → 'Y-m-dTH:i:sZ' (ISO 8601, meme format que toISOString()). */
	private static function iso( ?string $dt ): ?string {
		if ( ! $dt ) {
			return null;
		}
		return str_replace( ' ', 'T', $dt ) . 'Z';
	}

	/** DATETIME(3) → ISO avec millisecondes conservees. */
	private static function iso_ms( ?string $dt ): ?string {
		if ( ! $dt ) {
			return null;
		}
		// '2026-09-21 10:30:00.123' → '2026-09-21T10:30:00.123Z'
		$dt = str_replace( ' ', 'T', $dt );
		if ( strlen( $dt ) === 23 && substr( $dt, -1 ) !== 'Z' ) {
			return $dt . 'Z';
		}
		return self::iso( $dt );
	}

	/** DECIMAL MySQL (chaine) → float|null. */
	private static function fl( $val ): ?float {
		return ( null === $val || '' === $val ) ? null : (float) $val;
	}

	/** Erreur au format Express : {"error": "..."} avec code HTTP. */
	public static function err( string $msg, int $status ): WP_REST_Response {
		return new WP_REST_Response( array( 'error' => $msg ), $status );
	}

	/* -------------------------------------------------------- categories */

	/** GET /categories — tri sort_order, filtre activeOnly (1:1 db.getCategories). */
	public static function list_categories( bool $active_only ): array {
		global $wpdb;
		$table   = Bebba_HF_DB::categories_table();
		$where   = $active_only ? 'WHERE active = 1' : '';
		$sql     = "SELECT * FROM {$table} {$where} ORDER BY sort_order ASC, id ASC";
		$rows    = $wpdb->get_results( $sql, ARRAY_A );
		$out     = array();

		foreach ( ( $rows ?: array() ) as $r ) {
			$out[] = array(
				'id'          => self::biz_id( $r['legacy_id'], $r['id'] ),
				'legacyId'    => $r['legacy_id'],
				'name'        => $r['name'],
				'slug'        => $r['slug'],
				'icon'        => $r['icon'] ?: null,
				'image'       => $r['image'] ?: null,
				'imageUrl'    => $r['image_url'] ?: null,
				'description' => $r['description'] ?? '',
				'active'      => (int) $r['active'] === 1,
				'order'       => null !== $r['legacy_order'] ? (int) $r['legacy_order'] : (int) $r['sort_order'],
				'sortOrder'   => (int) $r['sort_order'],
				'createdAt'   => self::iso( $r['created_at'] ),
				'updatedAt'   => self::iso( $r['updated_at'] ),
			);
		}
		unset( $columns );
		return $out;
	}

	/** GET /categories/:id — id metier (legacy ou numerique). */
	public static function get_category( string $biz_id ): ?array {
		global $wpdb;
		$table = Bebba_HF_DB::categories_table();

		if ( ctype_digit( $biz_id ) ) {
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE legacy_id = %s OR id = %d LIMIT 1", $biz_id, (int) $biz_id ),
				ARRAY_A
			);
		} else {
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$table} WHERE legacy_id = %s LIMIT 1", $biz_id ),
				ARRAY_A
			);
		}
		if ( ! $row ) {
			return null;
		}

		return array(
			'id'          => self::biz_id( $row['legacy_id'], $row['id'] ),
			'legacyId'    => $row['legacy_id'],
			'name'        => $row['name'],
			'slug'        => $row['slug'],
			'icon'        => $row['icon'] ?: null,
			'image'       => $row['image'] ?: null,
			'imageUrl'    => $row['image_url'] ?: null,
			'description' => $row['description'] ?? '',
			'active'      => (int) $row['active'] === 1,
			'order'       => null !== $row['legacy_order'] ? (int) $row['legacy_order'] : (int) $row['sort_order'],
			'sortOrder'   => (int) $row['sort_order'],
			'createdAt'   => self::iso( $row['created_at'] ),
			'updatedAt'   => self::iso( $row['updated_at'] ),
		);
	}

	/* ------------------------------------------------------- supplements */

	/**
	 * GET /supplements — jointure ingredients pour ingredientActive
	 * (1:1 db.getSupplements : activeOnly => active && ingredientActive ;
	 *  availableOnly => available && isAvailable !== false).
	 */
	public static function list_supplements( bool $active_only, bool $available_only ): array {
		global $wpdb;
		$s     = Bebba_HF_DB::supplements_table();
		$i     = Bebba_HF_DB::ingredients_table();
		$where = array();
		$params = array();

		if ( $active_only ) {
			$where[]  = 's.active = 1 AND i.id IS NOT NULL AND i.active = 1';
		}
		if ( $available_only ) {
			$where[]  = 's.available = 1 AND (s.is_available IS NULL OR s.is_available = 1)';
		}
		$sql = "SELECT s.*, (i.id IS NOT NULL AND i.active = 1) AS ingredient_active
				FROM {$s} s LEFT JOIN {$i} i ON s.ingredient_id = i.id"
				. ( $where ? ' WHERE ' . implode( ' AND ', $where ) : '' )
				. ' ORDER BY s.sort_order ASC, s.id ASC';

		$rows = empty( $params )
			? $wpdb->get_results( $sql, ARRAY_A )
			: $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );

		$out = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[] = self::format_supplement( $r );
		}
		return $out;
	}

	/** GET /supplements/:id. */
	public static function get_supplement( string $biz_id ): ?array {
		global $wpdb;
		$s = Bebba_HF_DB::supplements_table();
		$i = Bebba_HF_DB::ingredients_table();

		if ( ctype_digit( $biz_id ) ) {
			$sql  = "SELECT s.*, (i.id IS NOT NULL AND i.active = 1) AS ingredient_active
					FROM {$s} s LEFT JOIN {$i} i ON s.ingredient_id = i.id
					WHERE s.legacy_id = %s OR s.id = %d LIMIT 1";
			$row  = $wpdb->get_row( $wpdb->prepare( $sql, $biz_id, (int) $biz_id ), ARRAY_A );
		} else {
			$sql  = "SELECT s.*, (i.id IS NOT NULL AND i.active = 1) AS ingredient_active
					FROM {$s} s LEFT JOIN {$i} i ON s.ingredient_id = i.id
					WHERE s.legacy_id = %s LIMIT 1";
			$row  = $wpdb->get_row( $wpdb->prepare( $sql, $biz_id ), ARRAY_A );
		}
		return $row ? self::format_supplement( $row ) : null;
	}

	private static function format_supplement( array $r ): array {
		return array(
			'id'                => self::biz_id( $r['legacy_id'], $r['id'] ),
			'legacyId'          => $r['legacy_id'],
			'name'              => $r['name'],
			'description'       => $r['description'] ?? '',
			'price'             => self::fl( $r['price'] ) ?? 0.0,
			'ingredientId'      => self::biz_id( $r['ingredient_legacy_id'] ?? null, $r['ingredient_id'] ?? null ),
			'ingredientName'    => $r['ingredient_name_snapshot'],
			'quantityConsumed'  => self::fl( $r['quantity_consumed'] ) ?? 0.0,
			'quantity'          => null !== $r['legacy_quantity'] ? self::fl( $r['legacy_quantity'] ) : self::fl( $r['quantity_consumed'] ),
			'unit'              => $r['unit'],
			'available'         => (int) $r['available'] === 1,
			'isAvailable'       => null !== $r['is_available'] ? (int) $r['is_available'] === 1 : (int) $r['available'] === 1,
			'active'            => (int) $r['active'] === 1,
			'ingredientActive'  => (int) $r['ingredient_active'] === 1,
			'order'             => null !== $r['legacy_order'] ? (int) $r['legacy_order'] : (int) $r['sort_order'],
			'sortOrder'         => (int) $r['sort_order'],
			'createdAt'         => self::iso( $r['created_at'] ),
			'updatedAt'         => self::iso( $r['updated_at'] ),
		);
	}

	/* ---------------------------------------------------------- products */

	/** GET /products — (1:1 db.getProducts, enrichi hasInactiveIngredient). */
	public static function list_products( ?string $category_biz, bool $active_only, bool $available_only ): array {
		global $wpdb;
		$p     = Bebba_HF_DB::products_table();
		$where = array();
		$params = array();

		if ( $category_biz && 'all' !== $category_biz ) {
			if ( ctype_digit( $category_biz ) ) {
				$where[]  = '(p.category_legacy_id = %s OR p.category_id = %d)';
				$params[] = $category_biz;
				$params[] = (int) $category_biz;
			} else {
				$where[]  = 'p.category_legacy_id = %s';
				$params[] = $category_biz;
			}
		}
		if ( $active_only ) {
			$where[] = 'p.active = 1';
		}
		if ( $available_only ) {
			$where[] = 'p.is_available = 1 AND (p.available IS NULL OR p.available = 1)';
		}

		$sql = "SELECT p.* FROM {$p} p"
			. ( $where ? ' WHERE ' . implode( ' AND ', $where ) : '' )
			. ' ORDER BY p.sort_order ASC, p.id ASC';

		$rows = empty( $params )
			? $wpdb->get_results( $sql, ARRAY_A )
			: $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );

		if ( ! $rows ) {
			return array();
		}

		$ids          = wp_list_pluck( $rows, 'id' );
		$relations    = self::load_product_relations( $ids );
		$inactive_ids = self::inactive_ingredient_ids();

		$out = array();
		foreach ( $rows as $r ) {
			$out[] = self::format_product( $r, $relations, $inactive_ids );
		}
		return $out;
	}

	/** GET /products/:id. */
	public static function get_product( string $biz_id ): ?array {
		$full = self::get_product_full( $biz_id );
		return null === $full ? null : $full['product'];
	}

	/**
	 * Produit formaté + ligne brute (id numérique) — utilisé par le moteur de commandes (LOT 3)
	 * pour résoudre les FK numériques sans dupliquer la logique de chargement du catalogue.
	 */
	public static function get_product_full( string $biz_id ): ?array {
		global $wpdb;
		$p = Bebba_HF_DB::products_table();

		if ( ctype_digit( $biz_id ) ) {
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$p} WHERE legacy_id = %s OR id = %d LIMIT 1", $biz_id, (int) $biz_id ),
				ARRAY_A
			);
		} else {
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM {$p} WHERE legacy_id = %s LIMIT 1", $biz_id ),
				ARRAY_A
			);
		}
		if ( ! $row ) {
			return null;
		}

		$relations    = self::load_product_relations( array( $row['id'] ) );
		$inactive_ids = self::inactive_ingredient_ids();
		return array(
			'row'     => $row,
			'product' => self::format_product( $row, $relations, $inactive_ids ),
		);
	}

	/** IDs (int) des ingredients inactifs — sert au calcul hasInactiveIngredient. */
	private static function inactive_ingredient_ids(): array {
		global $wpdb;
		$i    = Bebba_HF_DB::ingredients_table();
		$rows = $wpdb->get_col( "SELECT id FROM {$i} WHERE active = 0" );
		return array_map( 'intval', $rows ?: array() );
	}

	/**
	 * Charge en 3 requetes les relations de plusieurs produits :
	 * ['ing' => par product_id, 'opt' => par product_id, 'sup' => par product_id]
	 */
	private static function load_product_relations( array $product_ids ): array {
		global $wpdb;
		$pi = Bebba_HF_DB::product_ingredients_table();
		$po = Bebba_HF_DB::product_options_table();
		$ps = Bebba_HF_DB::product_supplements_table();

		$placeholders = implode( ',', array_fill( 0, count( $product_ids ), '%d' ) );
		$ids          = array_map( 'intval', $product_ids );

		$ing_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$pi} WHERE product_id IN ({$placeholders}) ORDER BY position ASC", ...$ids ),
			ARRAY_A
		);
		$opt_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$po} WHERE product_id IN ({$placeholders}) ORDER BY position ASC", ...$ids ),
			ARRAY_A
		);
		$sup_rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$ps} WHERE product_id IN ({$placeholders}) ORDER BY sort_order ASC, id ASC", ...$ids ),
			ARRAY_A
		);

		$grouped = array( 'ing' => array(), 'opt' => array(), 'sup' => array() );
		foreach ( ( $ing_rows ?: array() ) as $r ) {
			$grouped['ing'][ (int) $r['product_id'] ][] = $r;
		}
		foreach ( ( $opt_rows ?: array() ) as $r ) {
			$grouped['opt'][ (int) $r['product_id'] ][] = $r;
		}
		foreach ( ( $sup_rows ?: array() ) as $r ) {
			$grouped['sup'][ (int) $r['product_id'] ][] = $r;
		}
		return $grouped;
	}

	/** Format Product de src/types.ts (camelCase, customization reconstituee). */
	private static function format_product( array $r, array $relations, array $inactive_ids ): array {
		$pid   = (int) $r['id'];
		$ings  = $relations['ing'][ $pid ] ?? array();
		$opts  = $relations['opt'][ $pid ] ?? array();
		$supps = $relations['sup'][ $pid ] ?? array();

		$has_inactive = false;
		$base_ingredients = array();
		foreach ( $ings as $bi ) {
			$ing_id_int = ( $bi['ingredient_id'] ?? null ) !== null ? (int) $bi['ingredient_id'] : null;
			if ( null !== $ing_id_int && in_array( $ing_id_int, $inactive_ids, true ) ) {
				$has_inactive = true;
			}
			$base_ingredients[] = array(
				'ingredientId'   => self::biz_id( $bi['ingredient_legacy_id'] ?? null, $bi['ingredient_id'] ?? null ),
				'ingredientName' => $bi['ingredient_name_snapshot'],
				'quantity'       => self::fl( $bi['quantity'] ) ?? 0.0,
				'unit'           => $bi['unit'],
			);
		}

		$protein  = array();
		$veggies  = array();
		$base     = array();
		foreach ( $opts as $o ) {
			$entry = array(
				'label'      => $o['label'],
				'extraPrice' => self::fl( $o['extra_price'] ) ?? 0.0,
				'extraGrams' => self::fl( $o['extra_grams'] ?? null ),
			);
			if ( 'protein' === $o['option_type'] ) {
				$protein[] = $entry;
			} elseif ( 'veggies' === $o['option_type'] ) {
				$veggies[] = $entry;
			} else {
				$base[] = array(
					'label'      => $o['label'],
					'extraPrice' => self::fl( $o['extra_price'] ) ?? 0.0,
				);
			}
		}

		$allowed_supplements = array();
		foreach ( $supps as $ps ) {
			$allowed_supplements[] = self::biz_id( $ps['supplement_legacy_id'] ?? null, $ps['supplement_id'] ?? null );
		}

		return array(
			'id'                    => self::biz_id( $r['legacy_id'], $r['id'] ),
			'legacyId'              => $r['legacy_id'],
			'name'                  => $r['name'],
			'description'           => $r['description'] ?? '',
			'categoryId'            => self::biz_id( $r['category_legacy_id'] ?? null, $r['category_id'] ?? null ),
			'basePrice'             => self::fl( $r['base_price'] ) ?? 0.0,
			'imageUrl'              => $r['image_url'] ?: ( $r['image'] ?: '' ),
			'image'                 => $r['image'] ?: null,
			'calories'              => $r['calories'] !== null ? (int) $r['calories'] : null,
			'proteinGrams'          => self::fl( $r['protein_grams'] ?? null ),
			'carbsGrams'            => self::fl( $r['carbs_grams'] ?? null ),
			'fatGrams'              => self::fl( $r['fat_grams'] ?? null ),
			'active'                => (int) $r['active'] === 1,
			'isAvailable'           => (int) $r['is_available'] === 1,
			'available'             => null !== $r['available'] ? (int) $r['available'] === 1 : (int) $r['is_available'] === 1,
			'isPopular'             => (int) $r['is_popular'] === 1,
			'hasInactiveIngredient' => $has_inactive,
			'order'                 => null !== $r['legacy_order'] ? (int) $r['legacy_order'] : (int) $r['sort_order'],
			'sortOrder'             => (int) $r['sort_order'],
			'createdAt'             => self::iso( $r['created_at'] ),
			'updatedAt'             => self::iso( $r['updated_at'] ),
			'baseIngredients'       => $base_ingredients,
			'customization'         => array(
				'allowsProteinChoice'  => count( $protein ) > 0,
				'proteinOptions'       => $protein,
				'allowsVeggiesChoice'  => count( $veggies ) > 0,
				'veggiesOptions'       => $veggies,
				'allowsBaseChoice'     => count( $base ) > 0,
				'baseChoices'          => $base,
				'allowedSupplementIds' => $allowed_supplements,
			),
		);
	}

	/* ---------------------------------------------------------- tracking */

	/** GET /orders/track/:token — commande formatee publiquement ou null. */
	public static function find_order_by_token( string $token ): ?array {
		global $wpdb;
		$o = Bebba_HF_DB::orders_table();

		$order = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$o} WHERE tracking_token = %s LIMIT 1", $token ),
			ARRAY_A
		);
		return $order ? self::format_public_order( $order ) : null;
	}

	/**
	 * POST /orders/track-lookup — (1:1 db.getOrderByOrderNumberAndPhone)
	 * : # retire, uppercase, si pur numerique → prefixe BEBBA- ;
	 * telephone compare sur les 8 derniers chiffres.
	 */
	public static function find_order_by_number_and_phone( string $order_number, string $phone ): ?array {
		global $wpdb;
		$o = Bebba_HF_DB::orders_table();

		$clean = strtoupper( preg_replace( '/^#/', '', trim( $order_number ) ) );
		if ( '' === $clean ) {
			return null;
		}
		if ( ctype_digit( $clean ) ) {
			$clean = 'BEBBA-' . $clean;
		}

		$digits = preg_replace( '/\D/', '', $phone );
		if ( strlen( $digits ) < 8 ) {
			return null;
		}
		$last8 = substr( $digits, -8 );

		$order = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$o} WHERE order_number = %s LIMIT 1", $clean ),
			ARRAY_A
		);
		if ( ! $order ) {
			return null;
		}

		$stored_digits = preg_replace( '/\D/', '', $order['customer_phone'] );
		if ( strlen( $stored_digits ) >= 8 && substr( $stored_digits, -8 ) === $last8 ) {
			return self::format_public_order( $order );
		}
		return null;
	}

	/** Projection publique (1:1 formatPublicOrder de server.ts — confidentialite stricte). */
	private static function format_public_order( array $order ): array {
		$items = self::order_items_public( (int) $order['id'] );

		return array(
			'orderNumber'    => $order['order_number'],
			'trackingToken'  => $order['tracking_token'],
			'createdAt'      => self::iso( $order['placed_at'] ),
			'status'         => $order['status'],
			'paymentStatus'  => $order['payment_status'],
			'paymentMethod'  => $order['payment_method'],
			'totalAmount'    => self::fl( $order['total_amount'] ),
			'deliveryFee'    => self::fl( $order['delivery_fee'] ) ?? 0.0,
			'subtotal'       => self::fl( $order['subtotal'] ),
			'client'         => array(
				'name'            => self::mask_client_name( $order['customer_name'] ),
				'phone'           => self::mask_client_phone( $order['customer_phone'] ),
				'deliveryAddress' => self::mask_delivery_address( $order['delivery_address'] ),
			),
			'items'          => $items,
			'statusHistory'  => self::order_status_history( (int) $order['id'] ),
			'assignedDriverName' => self::safe_driver_name( $order['driver_name_snapshot'] ?? null, $order['status'] ),
		);
	}

	private static function order_items_public( int $order_id ): array {
		global $wpdb;
		$oi = Bebba_HF_DB::order_items_table();
		$os = Bebba_HF_DB::order_item_supplements_table();

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$oi} WHERE order_id = %d ORDER BY id ASC", $order_id ),
			ARRAY_A
		);
		if ( ! $rows ) {
			return array();
		}

		$out = array();
		foreach ( $rows as $item ) {
			$sup_rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT supplement_name_snapshot FROM {$os} WHERE order_item_id = %d ORDER BY id ASC", (int) $item['id'] ),
				ARRAY_A
			);
			$sup_names = array();
			foreach ( ( $sup_rows ?: array() ) as $s ) {
				if ( '' !== (string) $s['supplement_name_snapshot'] ) {
					$sup_names[] = (string) $s['supplement_name_snapshot'];
				}
			}

			$unit_price      = self::fl( $item['unit_price'] );
			$quantity        = (int) $item['quantity'];
			$item_total      = self::fl( $item['item_total_price'] );
			$fallback_total  = ( null !== $unit_price ? $unit_price * $quantity : 0 );

			$entry = array(
				'productName'  => $item['product_name_snapshot'] ?: 'Article',
				'quantity'     => $quantity ?: 1,
				'unitPrice'    => $unit_price ?? 0,
				'itemTotalPrice' => null !== $item_total ? $item_total : $fallback_total,
				'proteinOption' => $item['protein_option_label'] ?: null,
				'veggiesOption' => $item['veggies_option_label'] ?: null,
				'baseChoice'   => $item['base_choice_label'] ?: null,
				'supplements'  => $sup_names,
			);
			if ( ! empty( $item['special_instructions'] ) ) {
				$entry['specialInstructions'] = $item['special_instructions'];
			}
			$out[] = $entry;
		}
		return $out;
	}

	private static function order_status_history( int $order_id ): array {
		global $wpdb;
		$h = Bebba_HF_DB::order_status_history_table();

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT status, label, timestamp FROM {$h} WHERE order_id = %d ORDER BY position ASC", $order_id ),
			ARRAY_A
		);

		$out = array();
		foreach ( ( $rows ?: array() ) as $r ) {
			$out[] = array(
				'status'    => $r['status'],
				'label'     => $r['label'] ?: $r['status'],
				'timestamp' => self::iso_ms( $r['timestamp'] ),
			);
		}
		return $out;
	}

	/* -------------------------------------------------- masques publics */

	private static function mask_client_name( ?string $full_name ): string {
		if ( ! $full_name || '' === trim( $full_name ) ) {
			return 'Client';
		}
		$parts = preg_split( '/\s+/u', trim( $full_name ) ) ?: array();
		if ( count( $parts ) === 1 ) {
			return $parts[0];
		}
		$first       = $parts[0];
		$last        = $parts[ count( $parts ) - 1 ];
		$last_initial = mb_strtoupper( mb_substr( $last, 0, 1 ) );
		return $first . ' ' . $last_initial . '.';
	}

	private static function mask_client_phone( ?string $phone ): string {
		if ( ! $phone ) {
			return '';
		}
		$digits = preg_replace( '/\D/', '', $phone );
		if ( strlen( $digits ) < 4 ) {
			return '••••';
		}
		if ( 0 === strpos( $digits, '216' ) && strlen( $digits ) >= 11 ) {
			$local = substr( $digits, 3 );
			return '+216 ' . substr( $local, 0, 2 ) . ' ••• •' . substr( $local, -2 );
		}
		if ( strlen( $digits ) === 8 ) {
			return substr( $digits, 0, 2 ) . ' ••• •' . substr( $digits, -2 );
		}
		return substr( $digits, 0, 2 ) . ' •••• ' . substr( $digits, -2 );
	}

	private static function mask_delivery_address( ?string $address ): string {
		if ( ! $address || '' === trim( $address ) ) {
			return '';
		}
		$trimmed = trim( $address );
		$parts   = array_values( array_filter( array_map( 'trim', explode( ',', $trimmed ) ), fn( $p ) => '' !== $p ) );
		if ( count( $parts ) > 1 ) {
			$public_area = count( $parts ) > 2
				? implode( ', ', array_slice( $parts, -2 ) )
				: $parts[ count( $parts ) - 1 ];
			return '••••••, ' . $public_area;
		}
		if ( mb_strlen( $trimmed ) > 10 ) {
			return '•••••• ' . mb_substr( $trimmed, -6 );
		}
		return '••••••';
	}

	private static function safe_driver_name( ?string $driver_name, string $status ): ?string {
		if ( ! $driver_name || '' === trim( $driver_name ) ) {
			return null;
		}
		if ( 'delivering' !== $status && 'delivered' !== $status ) {
			return null;
		}
		$parts = preg_split( '/\s+/u', trim( $driver_name ) ) ?: array();
		return $parts[0] ?? null;
	}
}
