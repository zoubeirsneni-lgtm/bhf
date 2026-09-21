<?php
/**
 * Activation : creation des tables (dbDelta), generation du secret JWT, semis du compte admin.
 *
 * LOT 1 : porter les 17 tables restantes de mysql_schema_bebba.sql en syntaxe dbDelta
 * stricte (pas de backticks sur les defs de colonnes, un champ par ligne,
 * PRIMARY KEY  (id) avec deux espaces, KEY sans nom, pas de CONSTRAINT FOREIGN KEY).
 * Les cles etrangeres sont posees apres par ALTER TABLE avec verification idempotente.
 *
 * Repetitions appliquees :
 *   R1 : bebba_drivers sans colonne user_id (FK wp_users supprimee) ; legacy_user_id conservé.
 *   R2 : bebba_orders avec bebba_customer_id (FK bebba_users) pas wp_customer_id.
 *   R3 : toutes les tables prefixees par $wpdb->prefix via Bebba_HF_DB::table().
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
		$prefix  = $wpdb->prefix;

		$sql = array();

		/* ================================================================
		 * 1. bebba_users (réintégrée : table racine du squelette v0.1, perdue lors du LOT 1)
		 *    Conforme au delta mysql_schema_delta_users.sql : AUCUNE colonne ni FK vers wp_users.
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_users (
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

		/* ================================================================
		 * 2. bebba_counters (réintégrée : séquences de numérotation des commandes)
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_counters (
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

		/* ================================================================
		 * 3. bebba_categories
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_categories (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: cat-healthy)',
			name VARCHAR(128) NOT NULL,
			slug VARCHAR(128) NOT NULL,
			icon VARCHAR(64) NULL,
			image VARCHAR(512) NULL,
			image_url VARCHAR(512) NULL,
			description TEXT NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			sort_order INT NOT NULL DEFAULT 0,
			legacy_order INT NULL COMMENT 'Champ legacy \"order\" conservé pour traçabilité',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_categories_legacy_id (legacy_id),
			KEY idx_bebba_categories_slug (slug),
			KEY idx_bebba_categories_active (active),
			KEY idx_bebba_categories_sort_order (sort_order)
		) {$charset}";

		/* ================================================================
		 * 4. bebba_suppliers
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_suppliers (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: sup-1)',
			name VARCHAR(128) NOT NULL,
			phone VARCHAR(32) NULL,
			email VARCHAR(128) NULL,
			address VARCHAR(255) NULL,
			supplied_ingredient_legacy_ids JSON NULL COMMENT 'Array d\'IDs legacy ingrédients fournis',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_suppliers_legacy_id (legacy_id),
			KEY idx_bebba_suppliers_name (name)
		) {$charset}";

		/* ================================================================
		 * 5. bebba_ingredients
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_ingredients (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: ing-poulet)',
			name VARCHAR(128) NOT NULL,
			unit ENUM('g','ml','piece','portion') NULL COMMENT 'Unité de mesure (NULLable: legacy peut être absent)',
			stock_quantity DECIMAL(12,2) NULL COMMENT 'Stock actuel (snapshot à la migration, NULL si absent legacy)',
			min_threshold DECIMAL(12,2) NULL COMMENT 'Seuil minimal (NULLable: legacy peut être absent)',
			purchase_cost DECIMAL(10,4) NULL COMMENT 'Coût unitaire en DT (NULLable: legacy peut être absent)',
			supplier_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_suppliers (NULL si orphelin legacy)',
			supplier_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy fournisseur si FK non résolue',
			supplier_name_snapshot VARCHAR(128) NULL COMMENT 'Nom fournisseur au moment de la migration',
			category VARCHAR(64) NULL COMMENT 'Catégorie métier (ex: Protéines, Légumes, Sauces)',
			active TINYINT(1) NOT NULL DEFAULT 1,
			legacy_active_raw TINYINT(1) NULL COMMENT 'Valeur brute legacy \"active\" (NULL = champ absent, 0 = false, 1 = true)',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_ingredients_legacy_id (legacy_id),
			KEY idx_bebba_ingredients_supplier_id (supplier_id),
			KEY idx_bebba_ingredients_active (active),
			KEY idx_bebba_ingredients_category (category)
		) {$charset}";

		/* ================================================================
		 * 6. bebba_supplements
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_supplements (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: sup-poulet-extra)',
			name VARCHAR(128) NOT NULL,
			description TEXT NULL,
			price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix en DT',
			ingredient_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
			ingredient_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy ingrédient si FK non résolue',
			ingredient_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la migration',
			quantity_consumed DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Quantité consommée par supplément (valeur métier normalisée)',
			legacy_quantity DECIMAL(12,2) NULL COMMENT 'Champ legacy \"quantity\" brute (trace: les deux champs existaient historiquement)',
			unit VARCHAR(16) NOT NULL DEFAULT 'g',
			available TINYINT(1) NOT NULL DEFAULT 1,
			is_available TINYINT(1) NULL COMMENT 'Champ legacy isAvailable',
			active TINYINT(1) NOT NULL DEFAULT 1,
			sort_order INT NOT NULL DEFAULT 0,
			legacy_order INT NULL COMMENT 'Champ legacy \"order\"',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_supplements_legacy_id (legacy_id),
			KEY idx_bebba_supplements_ingredient_id (ingredient_id),
			KEY idx_bebba_supplements_active_available (active, available),
			KEY idx_bebba_supplements_sort_order (sort_order)
		) {$charset}";

		/* ================================================================
		 * 7. bebba_drivers (R1 : pas de user_id, pas de FK wp_users)
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_drivers (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: drv-1)',
			name VARCHAR(128) NOT NULL COMMENT 'Nom du livreur (source de vérité pour les snapshots commandes, Driver.name)',
			phone VARCHAR(32) NOT NULL,
			vehicle VARCHAR(128) NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			total_deliveries INT UNSIGNED NOT NULL DEFAULT 0,
			rating DECIMAL(3,2) NULL COMMENT 'Note sur 5 (ex: 4.90)',
			legacy_user_id VARCHAR(64) NULL COMMENT 'ID legacy User (ex: usr-driver-1), conservé pour traçabilité BLOC 1',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_drivers_legacy_id (legacy_id),
			UNIQUE KEY uk_bebba_drivers_legacy_user_id (legacy_user_id),
			KEY idx_bebba_drivers_phone (phone),
			KEY idx_bebba_drivers_active (active)
		) {$charset}";

		/* ================================================================
		 * 8. bebba_products
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_products (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: prod-poulet-bowl)',
			category_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_categories (NULL si orphelin legacy)',
			category_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy catégorie si FK non résolue',
			name VARCHAR(128) NOT NULL,
			description TEXT NULL,
			base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix de base en DT',
			image_url VARCHAR(512) NULL,
			image VARCHAR(512) NULL COMMENT 'Champ legacy \"image\"',
			calories INT UNSIGNED NULL,
			protein_grams DECIMAL(8,2) NULL,
			carbs_grams DECIMAL(8,2) NULL,
			fat_grams DECIMAL(8,2) NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			is_available TINYINT(1) NOT NULL DEFAULT 1,
			available TINYINT(1) NULL COMMENT 'Champ legacy \"available\"',
			is_popular TINYINT(1) NOT NULL DEFAULT 0,
			sort_order INT NOT NULL DEFAULT 0,
			legacy_order INT NULL COMMENT 'Champ legacy \"order\"',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_products_legacy_id (legacy_id),
			KEY idx_bebba_products_category_id (category_id),
			KEY idx_bebba_products_active_available (active, is_available),
			KEY idx_bebba_products_sort_order (sort_order),
			KEY idx_bebba_products_is_popular (is_popular)
		) {$charset}";

		/* ================================================================
		 * 9. bebba_product_ingredients
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_product_ingredients (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			product_id BIGINT UNSIGNED NOT NULL,
			ingredient_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
			ingredient_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
			ingredient_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la migration',
			position INT UNSIGNED NOT NULL COMMENT 'Position originale dans le tableau baseIngredients legacy',
			quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
			unit VARCHAR(16) NOT NULL DEFAULT 'g',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_product_ingredients_product_legacy (product_id, ingredient_legacy_id),
			UNIQUE KEY uk_bebba_product_ingredients_product_position (product_id, position),
			KEY idx_bebba_product_ingredients_ingredient_id (ingredient_id)
		) {$charset}";

		/* ================================================================
		 * 10. bebba_product_options
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_product_options (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			product_id BIGINT UNSIGNED NOT NULL,
			option_type ENUM('protein','veggies','base') NOT NULL COMMENT 'Type d\'option',
			position INT UNSIGNED NOT NULL COMMENT 'Position originale dans le tableau legacy (ordre de déclaration)',
			label VARCHAR(128) NOT NULL COMMENT 'Label affiché (ex: Portion sportive (+100g de poulet))',
			extra_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Supplément prix en DT',
			extra_grams DECIMAL(12,2) NULL COMMENT 'Grammes supplémentaires (NULL pour type base)',
			sort_order INT NOT NULL DEFAULT 0,
			is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Option par défaut technique/conservée (prix 0, grams 0) — champ legacy isDefault',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_product_options_product_type_position (product_id, option_type, position),
			KEY idx_bebba_product_options_product_type (product_id, option_type),
			KEY idx_bebba_product_options_sort_order (sort_order)
		) {$charset}";

		/* ================================================================
		 * 11. bebba_product_supplements
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_product_supplements (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			product_id BIGINT UNSIGNED NOT NULL,
			supplement_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_supplements (NULL si orphelin legacy)',
			supplement_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy supplément (toujours conservé)',
			sort_order INT NOT NULL DEFAULT 0,
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_product_supplements_product_legacy (product_id, supplement_legacy_id),
			KEY idx_bebba_product_supplements_supplement_id (supplement_id)
		) {$charset}";

		/* ================================================================
		 * 12. bebba_orders (R2 : bebba_customer_id pas wp_customer_id)
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_orders (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: ord-1788531857440)',
			order_number VARCHAR(32) NOT NULL COMMENT 'Numéro humain (ex: BEBBA-1100)',
			tracking_token VARCHAR(64) NOT NULL COMMENT 'Token de suivi public (ex: tk_e355ed9dd33a)',
			placed_at DATETIME(3) NOT NULL COMMENT 'Date/heure de la commande (legacy createdAt, millisecondes)',
			customer_name VARCHAR(128) NOT NULL,
			customer_phone VARCHAR(32) NOT NULL,
			delivery_address VARCHAR(512) NOT NULL,
			customer_notes TEXT NULL,
			bebba_customer_id BIGINT UNSIGNED NULL COMMENT 'FK bebba_users.id (role=client) — NULL pour commandes invité',
			client_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy User Firestore du client (traçabilité migration)',
			subtotal DECIMAL(10,2) NULL COMMENT 'Sous-total HT (peut être NULL si legacy absent)',
			delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 2.50,
			total_amount DECIMAL(10,2) NULL COMMENT 'Total TTC (peut être NULL si legacy absent)',
			status ENUM('received','preparing','ready','waiting_for_driver','delivering','delivered','cancelled') NOT NULL DEFAULT 'received',
			payment_status ENUM('to_collect','paid') NOT NULL DEFAULT 'to_collect',
			payment_method ENUM('cash_on_delivery') NOT NULL DEFAULT 'cash_on_delivery',
			driver_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_drivers (NULL si non assigné ou orphelin)',
			driver_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy driver si FK non résolue',
			driver_name_snapshot VARCHAR(128) NULL COMMENT 'Nom livreur au moment de l\'assignation (snapshot historique)',
			stock_consumed TINYINT(1) NULL COMMENT 'TRUE/FALSE/NULL (3 états possibles legacy)',
			idempotency_key VARCHAR(128) NULL COMMENT 'Clé d\'idempotence si fournie (UNIQUE, NULL multiples autorisés)',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_orders_legacy_id (legacy_id),
			UNIQUE KEY uk_bebba_orders_order_number (order_number),
			UNIQUE KEY uk_bebba_orders_tracking_token (tracking_token),
			UNIQUE KEY uk_bebba_orders_idempotency_key (idempotency_key),
			KEY idx_bebba_orders_placed_at (placed_at),
			KEY idx_bebba_orders_status (status),
			KEY idx_bebba_orders_payment_status (payment_status),
			KEY idx_bebba_orders_driver_id (driver_id),
			KEY idx_bebba_orders_bebba_customer_id (bebba_customer_id)
		) {$charset}";

		/* ================================================================
		 * 13. bebba_order_items
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_order_items (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id BIGINT UNSIGNED NOT NULL,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original de la ligne (ex: item-sy9o9hc)',
			product_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_products (NULL si orphelin legacy)',
			product_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy produit (toujours conservé)',
			product_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom produit au moment de la commande',
			unit_price DECIMAL(10,2) NULL COMMENT 'Prix unitaire au moment de la commande (peut être NULL)',
			quantity INT UNSIGNED NOT NULL DEFAULT 1,
			protein_option_label VARCHAR(128) NULL COMMENT 'Label option protéine choisie (snapshot)',
			protein_option_extra_price DECIMAL(10,2) NULL,
			protein_option_extra_grams DECIMAL(12,2) NULL,
			veggies_option_label VARCHAR(128) NULL COMMENT 'Label option légumes choisie (snapshot)',
			veggies_option_extra_price DECIMAL(10,2) NULL,
			veggies_option_extra_grams DECIMAL(12,2) NULL,
			base_choice_label VARCHAR(128) NULL COMMENT 'Label choix base choisi (snapshot)',
			base_choice_extra_price DECIMAL(10,2) NULL,
			options_raw_json JSON NULL COMMENT 'Snapshot complet des options pour traçabilité',
			special_instructions TEXT NULL,
			item_total_price DECIMAL(10,2) NULL COMMENT 'Total ligne (peut être NULL si legacy absent)',
			summary_lines_json JSON NULL COMMENT 'Lignes récapitulatives préparation (JSON array)',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_order_items_legacy_id (legacy_id),
			KEY idx_bebba_order_items_order_id (order_id),
			KEY idx_bebba_order_items_product_id (product_id),
			KEY idx_bebba_order_items_product_legacy_id (product_legacy_id)
		) {$charset}";

		/* ================================================================
		 * 14. bebba_order_item_supplements
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_order_item_supplements (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_item_id BIGINT UNSIGNED NOT NULL,
			supplement_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_supplements (NULL si orphelin legacy)',
			supplement_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy supplément (toujours conservé)',
			supplement_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom supplément au moment de la commande',
			price DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix unitaire au moment de la commande',
			quantity INT UNSIGNED NOT NULL DEFAULT 1,
			ingredient_id BIGINT UNSIGNED NULL COMMENT 'FK ingrédient pour traçabilité stock',
			ingredient_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy ingrédient',
			ingredient_name_snapshot VARCHAR(128) NULL COMMENT 'Nom ingrédient au moment de la commande',
			quantity_consumed DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Qté totale consommée (qté * quantity_consumed)',
			unit VARCHAR(16) NOT NULL DEFAULT 'g',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_order_item_supplements_item_legacy (order_item_id, supplement_legacy_id),
			KEY idx_bebba_order_item_supplements_order_item_id (order_item_id),
			KEY idx_bebba_order_item_supplements_supplement_id (supplement_id),
			KEY idx_bebba_order_item_supplements_ingredient_id (ingredient_id)
		) {$charset}";

		/* ================================================================
		 * 15. bebba_order_item_prep
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_order_item_prep (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_item_id BIGINT UNSIGNED NOT NULL,
			ingredient_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
			ingredient_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
			ingredient_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la préparation',
			total_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Quantité totale pour cette ligne (qté * qté commande)',
			unit VARCHAR(16) NOT NULL DEFAULT 'g',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_order_item_prep_item_legacy (order_item_id, ingredient_legacy_id),
			KEY idx_bebba_order_item_prep_order_item_id (order_item_id),
			KEY idx_bebba_order_item_prep_ingredient_id (ingredient_id),
			KEY idx_bebba_order_item_prep_ingredient_legacy_id (ingredient_legacy_id)
		) {$charset}";

		/* ================================================================
		 * 16. bebba_order_status_history
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_order_status_history (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id BIGINT UNSIGNED NOT NULL,
			position INT UNSIGNED NOT NULL COMMENT 'Position séquentielle dans l\'historique (ordre original du tableau legacy)',
			status ENUM('received','preparing','ready','waiting_for_driver','delivering','delivered','cancelled') NOT NULL,
			label VARCHAR(128) NOT NULL COMMENT 'Libellé humain du statut',
			timestamp DATETIME(3) NOT NULL COMMENT 'Horodatage précis du changement (millisecondes conservées)',
			note TEXT NULL COMMENT 'Note associée au changement',
			updated_by VARCHAR(128) NULL COMMENT 'Acteur : \"Système Client\", \"Administrateur BEBBA (Admin)\", \"Sami Trabelsi (Livreur)\", etc.',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_order_status_history_order_position (order_id, position),
			KEY idx_bebba_order_status_history_order_id (order_id),
			KEY idx_bebba_order_status_history_timestamp (timestamp),
			KEY idx_bebba_order_status_history_status (status)
		) {$charset}";

		/* ================================================================
		 * 17. bebba_stock_movements
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_stock_movements (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: mov-1788443298340-zgk3)',
			ingredient_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
			ingredient_legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
			ingredient_name_snapshot VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment du mouvement',
			movement_type ENUM('order_consumption','replenishment','inventory_correction','manual_out','manual_in','waste','order_cancellation_restore') NOT NULL,
			quantity DECIMAL(12,2) NOT NULL COMMENT 'Signé : négatif = sortie, positif = entrée (conserve signe original)',
			unit VARCHAR(16) NULL COMMENT 'Unité (NULLable: legacy peut être absent)',
			order_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_orders si lié à une commande',
			order_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy commande',
			order_number_snapshot VARCHAR(32) NULL COMMENT 'Numéro commande au moment du mouvement',
			notes TEXT NULL,
			performed_by VARCHAR(128) NULL COMMENT 'Acteur : \"Cuisine BEBBA\", \"Administrateur BEBBA (Admin)\", etc.',
			timestamp DATETIME NOT NULL COMMENT 'Horodatage précis du mouvement',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_stock_movements_legacy_id (legacy_id),
			KEY idx_bebba_stock_movements_ingredient_id (ingredient_id),
			KEY idx_bebba_stock_movements_order_id (order_id),
			KEY idx_bebba_stock_movements_timestamp (timestamp),
			KEY idx_bebba_stock_movements_type (movement_type)
		) {$charset}";

		/* ================================================================
		 * 18. bebba_order_idempotency
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_order_idempotency (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			idempotency_key VARCHAR(128) NOT NULL COMMENT 'Clé fournie par le client',
			caller_id VARCHAR(128) NOT NULL COMMENT 'Identifiant appelant (client:xxx ou guest:phone)',
			request_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex du contenu canonique de la commande',
			order_id BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_orders (rempli après création)',
			order_legacy_id VARCHAR(64) NULL COMMENT 'ID legacy commande si FK non résolue',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_order_idempotency_key (idempotency_key),
			KEY idx_bebba_order_idempotency_caller (caller_id),
			KEY idx_bebba_order_idempotency_order_id (order_id)
		) {$charset}";

		/* ================================================================
		 * 19. bebba_migration_map
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_migration_map (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_type VARCHAR(64) NOT NULL COMMENT 'Type entité legacy: category, supplier, ingredient, supplement, product, driver, order, order_item, stock_movement, user, counter',
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy source (Firestore / db.json)',
			target_table VARCHAR(64) NOT NULL COMMENT 'Table cible MySQL (ex: bebba_products)',
			target_id BIGINT UNSIGNED NULL COMMENT 'PK MySQL créée (NULL si échec/quarantaine)',
			batch_id VARCHAR(64) NOT NULL COMMENT 'Identifiant du lot de migration',
			status ENUM('pending','migrated','failed','quarantined') NOT NULL DEFAULT 'pending',
			raw_json JSON NULL COMMENT 'Données legacy brutes complètes pour audit',
			error_message TEXT NULL COMMENT 'Message d\'erreur si échec',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY uk_bebba_migration_map_legacy (legacy_type, legacy_id),
			KEY idx_bebba_migration_map_batch (batch_id),
			KEY idx_bebba_migration_map_status (status),
			KEY idx_bebba_migration_map_target (target_table, target_id)
		) {$charset}";

		/* ================================================================
		 * 20. bebba_migration_quarantine
		 * ================================================================ */
		$sql[] = "CREATE TABLE {$prefix}bebba_migration_quarantine (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			legacy_type VARCHAR(64) NOT NULL COMMENT 'Type entité legacy concernée',
			legacy_id VARCHAR(64) NOT NULL COMMENT 'ID legacy source',
			legacy_user_id VARCHAR(64) NULL COMMENT 'ID user legacy si applicable (ex: usr-driver-1)',
			legacy_driver_id VARCHAR(64) NULL COMMENT 'ID driver legacy si applicable (ex: drv-1)',
			field VARCHAR(64) NOT NULL COMMENT 'Champ en anomalie (ex: name, phone, driverId)',
			source_value TEXT NULL COMMENT 'Valeur source (Firestore / db.json)',
			target_value TEXT NULL COMMENT 'Valeur cible proposée / alternative',
			anomaly_type ENUM('identity_conflict','missing_fk','orphan_reference','data_mismatch','duplicate_key','null_not_allowed','format_invalid','other') NOT NULL,
			status ENUM('open','pending_review','in_review','resolved','ignored') NOT NULL DEFAULT 'open',
			decision TEXT NULL COMMENT 'Décision métier prise (ex: \"Conserver Yassine Ben Amor comme nom driver\")',
			decided_by VARCHAR(128) NULL COMMENT 'Qui a tranché',
			decided_at DATETIME NULL COMMENT 'Quand la décision a été prise',
			batch_id VARCHAR(64) NOT NULL COMMENT 'Lot de migration concerné',
			raw_json JSON NULL COMMENT 'Contexte complet pour analyse',
			legacy_created_at DATETIME NULL,
			legacy_updated_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_bebba_migration_quarantine_legacy (legacy_type, legacy_id),
			KEY idx_bebba_migration_quarantine_batch (batch_id),
			KEY idx_bebba_migration_quarantine_status (status),
			KEY idx_bebba_migration_quarantine_anomaly_type (anomaly_type),
			KEY idx_bebba_migration_quarantine_legacy_user (legacy_user_id),
			KEY idx_bebba_migration_quarantine_legacy_driver (legacy_driver_id)
		) {$charset}";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}

		/* ================================================================
		 * Clés étrangères post-dbDelta (idempotentes)
		 * ================================================================ */
		self::add_foreign_keys();

		update_option( 'bebba_hf_schema_version', BEBBA_HF_VERSION, true );
	}

	/**
	 * Pose les clés étrangères par ALTER TABLE avec vérification idempotente
	 * dans information_schema.TABLE_CONSTRAINTS.
	 */
	private static function add_foreign_keys(): void {
		global $wpdb;

		$prefix = $wpdb->prefix;

		/* Liste des FK : [table, constraint_name, sql] */
		$fks = array(
			/* ingredients.supplier_id → suppliers.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_ingredients ADD CONSTRAINT fk_bebba_ingredients_supplier FOREIGN KEY (supplier_id) REFERENCES {$prefix}bebba_suppliers (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* supplements.ingredient_id → ingredients.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_supplements ADD CONSTRAINT fk_bebba_supplements_ingredient FOREIGN KEY (ingredient_id) REFERENCES {$prefix}bebba_ingredients (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* products.category_id → categories.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_products ADD CONSTRAINT fk_bebba_products_category FOREIGN KEY (category_id) REFERENCES {$prefix}bebba_categories (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* bebba_users.driver_id → drivers.id (déjà dans le delta, mais on la pose ici aussi) */
			sprintf(
				"ALTER TABLE {$prefix}bebba_users ADD CONSTRAINT fk_bebba_users_driver FOREIGN KEY (driver_id) REFERENCES {$prefix}bebba_drivers (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* orders.bebba_customer_id → users.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_orders ADD CONSTRAINT fk_bebba_orders_client FOREIGN KEY (bebba_customer_id) REFERENCES {$prefix}bebba_users (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_items.order_id → orders.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_items ADD CONSTRAINT fk_bebba_order_items_order FOREIGN KEY (order_id) REFERENCES {$prefix}bebba_orders (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* order_items.product_id → products.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_items ADD CONSTRAINT fk_bebba_order_items_product FOREIGN KEY (product_id) REFERENCES {$prefix}bebba_products (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_item_supplements.order_item_id → order_items.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_item_supplements ADD CONSTRAINT fk_bebba_order_item_supplements_order_item FOREIGN KEY (order_item_id) REFERENCES {$prefix}bebba_order_items (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* order_item_supplements.supplement_id → supplements.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_item_supplements ADD CONSTRAINT fk_bebba_order_item_supplements_supplement FOREIGN KEY (supplement_id) REFERENCES {$prefix}bebba_supplements (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_item_supplements.ingredient_id → ingredients.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_item_supplements ADD CONSTRAINT fk_bebba_order_item_supplements_ingredient FOREIGN KEY (ingredient_id) REFERENCES {$prefix}bebba_ingredients (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_item_prep.order_item_id → order_items.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_item_prep ADD CONSTRAINT fk_bebba_order_item_prep_order_item FOREIGN KEY (order_item_id) REFERENCES {$prefix}bebba_order_items (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* order_item_prep.ingredient_id → ingredients.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_item_prep ADD CONSTRAINT fk_bebba_order_item_prep_ingredient FOREIGN KEY (ingredient_id) REFERENCES {$prefix}bebba_ingredients (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_status_history.order_id → orders.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_status_history ADD CONSTRAINT fk_bebba_order_status_history_order FOREIGN KEY (order_id) REFERENCES {$prefix}bebba_orders (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* stock_movements.ingredient_id → ingredients.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_stock_movements ADD CONSTRAINT fk_bebba_stock_movements_ingredient FOREIGN KEY (ingredient_id) REFERENCES {$prefix}bebba_ingredients (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* stock_movements.order_id → orders.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_stock_movements ADD CONSTRAINT fk_bebba_stock_movements_order FOREIGN KEY (order_id) REFERENCES {$prefix}bebba_orders (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* order_idempotency.order_id → orders.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_order_idempotency ADD CONSTRAINT fk_bebba_order_idempotency_order FOREIGN KEY (order_id) REFERENCES {$prefix}bebba_orders (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* product_ingredients.product_id → products.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_product_ingredients ADD CONSTRAINT fk_bebba_product_ingredients_product FOREIGN KEY (product_id) REFERENCES {$prefix}bebba_products (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* product_ingredients.ingredient_id → ingredients.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_product_ingredients ADD CONSTRAINT fk_bebba_product_ingredients_ingredient FOREIGN KEY (ingredient_id) REFERENCES {$prefix}bebba_ingredients (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
			/* product_options.product_id → products.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_product_options ADD CONSTRAINT fk_bebba_product_options_product FOREIGN KEY (product_id) REFERENCES {$prefix}bebba_products (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* product_supplements.product_id → products.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_product_supplements ADD CONSTRAINT fk_bebba_product_supplements_product FOREIGN KEY (product_id) REFERENCES {$prefix}bebba_products (id) ON DELETE CASCADE ON UPDATE CASCADE",
			),
			/* product_supplements.supplement_id → supplements.id */
			sprintf(
				"ALTER TABLE {$prefix}bebba_product_supplements ADD CONSTRAINT fk_bebba_product_supplements_supplement FOREIGN KEY (supplement_id) REFERENCES {$prefix}bebba_supplements (id) ON DELETE SET NULL ON UPDATE CASCADE",
			),
		);

		foreach ( $fks as $sql ) {
			/* Vérifier si la contrainte existe déjà pour idempotence */
			$constraint_name = preg_replace(
				'/.*ADD CONSTRAINT (\S+) .*/',
				'$1',
				$sql
			);
			$check = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = %s AND TABLE_SCHEMA = DATABASE()",
					$constraint_name
				)
			);
			if ( (int) $check === 0 ) {
				$wpdb->query( $sql );
			}
		}
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