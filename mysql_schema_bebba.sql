-- ============================================================================
-- BEBBA Healthy Food — Schéma MySQL Cible (BLOC 3)
-- Architecture : WordPress + MySQL dédié
-- Tables métier : bebba_* (pas de wp_posts / WooCommerce comme moteur principal)
-- Moteur : InnoDB | Charset : utf8mb4 | Collation : utf8mb4_unicode_ci
-- Version MySQL : 8.x
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. TABLES SANS FK (Indépendantes)
-- ============================================================================

-- --------------------------------------------------------
-- bebba_categories
-- --------------------------------------------------------
CREATE TABLE `bebba_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: cat-healthy)',
    `name` VARCHAR(128) NOT NULL,
    `slug` VARCHAR(128) NOT NULL,
    `icon` VARCHAR(64) NULL,
    `image` VARCHAR(512) NULL,
    `image_url` VARCHAR(512) NULL,
    `description` TEXT NULL,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `legacy_order` INT NULL COMMENT 'Champ legacy "order" conservé pour traçabilité',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_categories_legacy_id` (`legacy_id`),
    UNIQUE KEY `uk_bebba_categories_slug` (`slug`),
    KEY `idx_bebba_categories_active` (`active`),
    KEY `idx_bebba_categories_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catégories de produits BEBBA';

-- --------------------------------------------------------
-- bebba_suppliers
-- --------------------------------------------------------
CREATE TABLE `bebba_suppliers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: sup-1)',
    `name` VARCHAR(128) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `email` VARCHAR(128) NULL,
    `address` VARCHAR(255) NULL,
    `supplied_ingredient_legacy_ids` JSON NULL COMMENT 'Array d\'IDs legacy ingrédients fournis',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_suppliers_legacy_id` (`legacy_id`),
    KEY `idx_bebba_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fournisseurs BEBBA';

-- --------------------------------------------------------
-- bebba_ingredients
-- --------------------------------------------------------
CREATE TABLE `bebba_ingredients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: ing-poulet)',
    `name` VARCHAR(128) NOT NULL,
    `unit` ENUM('g','ml','piece','portion') NOT NULL DEFAULT 'g',
    `stock_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Stock actuel (snapshot à la migration)',
    `min_threshold` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `purchase_cost` DECIMAL(10,4) NOT NULL DEFAULT 0.0000 COMMENT 'Coût unitaire en DT',
    `supplier_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_suppliers (NULL si orphelin legacy)',
    `supplier_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy fournisseur si FK non résolue',
    `supplier_name_snapshot` VARCHAR(128) NULL COMMENT 'Nom fournisseur au moment de la migration',
    `category` VARCHAR(64) NULL COMMENT 'Catégorie métier (ex: Protéines, Légumes, Sauces)',
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_ingredients_legacy_id` (`legacy_id`),
    KEY `idx_bebba_ingredients_supplier_id` (`supplier_id`),
    KEY `idx_bebba_ingredients_active` (`active`),
    KEY `idx_bebba_ingredients_category` (`category`),
    CONSTRAINT `fk_bebba_ingredients_supplier` FOREIGN KEY (`supplier_id`)
        REFERENCES `bebba_suppliers` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ingrédients / Matières premières BEBBA';

-- --------------------------------------------------------
-- bebba_supplements
-- --------------------------------------------------------
CREATE TABLE `bebba_supplements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: sup-poulet-extra)',
    `name` VARCHAR(128) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix en DT',
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
    `ingredient_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy ingrédient si FK non résolue',
    `ingredient_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la migration',
    `quantity_consumed` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Quantité consommée par supplément',
    `unit` VARCHAR(16) NOT NULL DEFAULT 'g',
    `available` TINYINT(1) NOT NULL DEFAULT 1,
    `is_available` TINYINT(1) NULL COMMENT 'Champ legacy isAvailable',
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `legacy_order` INT NULL COMMENT 'Champ legacy "order"',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_supplements_legacy_id` (`legacy_id`),
    KEY `idx_bebba_supplements_ingredient_id` (`ingredient_id`),
    KEY `idx_bebba_supplements_active_available` (`active`, `available`),
    KEY `idx_bebba_supplements_sort_order` (`sort_order`),
    CONSTRAINT `fk_bebba_supplements_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `bebba_ingredients` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Suppléments / Options payantes BEBBA';

-- --------------------------------------------------------
-- bebba_drivers
-- --------------------------------------------------------
CREATE TABLE `bebba_drivers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: drv-1)',
    `name` VARCHAR(128) NOT NULL COMMENT 'Nom du livreur (source de vérité pour les snapshots commandes)',
    `phone` VARCHAR(32) NOT NULL,
    `vehicle` VARCHAR(128) NULL,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `total_deliveries` INT UNSIGNED NOT NULL DEFAULT 0,
    `rating` DECIMAL(3,2) NULL COMMENT 'Note sur 5 (ex: 4.90)',
    `wp_user_id` BIGINT UNSIGNED NULL COMMENT 'ID wp_users si lié (résolu lors migration)',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_drivers_legacy_id` (`legacy_id`),
    KEY `idx_bebba_drivers_phone` (`phone`),
    KEY `idx_bebba_drivers_active` (`active`),
    KEY `idx_bebba_drivers_wp_user_id` (`wp_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Livreurs BEBBA';

-- ============================================================================
-- 2. TABLES RÉFÉRENTIELLES (Produits dépendent de catégories)
-- ============================================================================

-- --------------------------------------------------------
-- bebba_products
-- --------------------------------------------------------
CREATE TABLE `bebba_products` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: prod-poulet-bowl)',
    `category_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_categories (NULL si orphelin legacy)',
    `category_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy catégorie si FK non résolue',
    `name` VARCHAR(128) NOT NULL,
    `description` TEXT NULL,
    `base_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix de base en DT',
    `image_url` VARCHAR(512) NULL,
    `image` VARCHAR(512) NULL COMMENT 'Champ legacy "image"',
    `calories` INT UNSIGNED NULL,
    `protein_grams` DECIMAL(8,2) NULL,
    `carbs_grams` DECIMAL(8,2) NULL,
    `fat_grams` DECIMAL(8,2) NULL,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `is_available` TINYINT(1) NOT NULL DEFAULT 1,
    `available` TINYINT(1) NULL COMMENT 'Champ legacy "available"',
    `is_popular` TINYINT(1) NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `legacy_order` INT NULL COMMENT 'Champ legacy "order"',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_products_legacy_id` (`legacy_id`),
    KEY `idx_bebba_products_category_id` (`category_id`),
    KEY `idx_bebba_products_active_available` (`active`, `is_available`),
    KEY `idx_bebba_products_sort_order` (`sort_order`),
    KEY `idx_bebba_products_is_popular` (`is_popular`),
    CONSTRAINT `fk_bebba_products_category` FOREIGN KEY (`category_id`)
        REFERENCES `bebba_categories` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Produits / Plats du catalogue BEBBA';

-- --------------------------------------------------------
-- bebba_product_ingredients (Composition de base des produits)
-- --------------------------------------------------------
CREATE TABLE `bebba_product_ingredients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
    `ingredient_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
    `ingredient_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la migration',
    `quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `unit` VARCHAR(16) NOT NULL DEFAULT 'g',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_product_ingredients_product_legacy` (`product_id`, `ingredient_legacy_id`),
    KEY `idx_bebba_product_ingredients_ingredient_id` (`ingredient_id`),
    CONSTRAINT `fk_bebba_product_ingredients_product` FOREIGN KEY (`product_id`)
        REFERENCES `bebba_products` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_product_ingredients_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `bebba_ingredients` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Composition ingrédients de base par produit';

-- --------------------------------------------------------
-- bebba_product_options (Options de personnalisation : protéines, légumes, base)
-- --------------------------------------------------------
CREATE TABLE `bebba_product_options` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `option_type` ENUM('protein','veggies','base') NOT NULL COMMENT 'Type d\'option',
    `label` VARCHAR(128) NOT NULL COMMENT 'Label affiché (ex: Portion sportive (+100g de poulet))',
    `extra_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Supplément prix en DT',
    `extra_grams` DECIMAL(12,2) NULL COMMENT 'Grammes supplémentaires (NULL pour type base)',
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_default` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Option par défaut (prix 0, grams 0)',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bebba_product_options_product_type` (`product_id`, `option_type`),
    KEY `idx_bebba_product_options_sort_order` (`sort_order`),
    CONSTRAINT `fk_bebba_product_options_product` FOREIGN KEY (`product_id`)
        REFERENCES `bebba_products` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Options de personnalisation par produit (protéines, légumes, base)';

-- --------------------------------------------------------
-- bebba_product_supplements (Suppléments autorisés par produit)
-- --------------------------------------------------------
CREATE TABLE `bebba_product_supplements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT UNSIGNED NOT NULL,
    `supplement_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_supplements (NULL si orphelin legacy)',
    `supplement_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy supplément (toujours conservé)',
    `sort_order` INT NOT NULL DEFAULT 0,
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_product_supplements_product_legacy` (`product_id`, `supplement_legacy_id`),
    KEY `idx_bebba_product_supplements_supplement_id` (`supplement_id`),
    CONSTRAINT `fk_bebba_product_supplements_product` FOREIGN KEY (`product_id`)
        REFERENCES `bebba_products` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_product_supplements_supplement` FOREIGN KEY (`supplement_id`)
        REFERENCES `bebba_supplements` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Suppléments autorisés par produit (liaison many-to-many)';

-- ============================================================================
-- 3. TABLES DE COMMANDES
-- ============================================================================

-- --------------------------------------------------------
-- bebba_orders
-- --------------------------------------------------------
CREATE TABLE `bebba_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: ord-1788531857440)',
    `order_number` VARCHAR(32) NOT NULL COMMENT 'Numéro humain (ex: BEBBA-1100)',
    `tracking_token` VARCHAR(64) NOT NULL COMMENT 'Token de suivi public (ex: tk_e355ed9dd33a)',
    `placed_at` DATETIME NOT NULL COMMENT 'Date/heure de la commande (legacy createdAt)',
    `customer_name` VARCHAR(128) NOT NULL,
    `customer_phone` VARCHAR(32) NOT NULL,
    `delivery_address` VARCHAR(512) NOT NULL,
    `customer_notes` TEXT NULL,
    `wp_customer_id` BIGINT UNSIGNED NULL COMMENT 'ID wp_users client si résolu (NULL pour guests)',
    `subtotal` DECIMAL(10,2) NULL COMMENT 'Sous-total HT (peut être NULL si legacy absent)',
    `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 2.50,
    `total_amount` DECIMAL(10,2) NULL COMMENT 'Total TTC (peut être NULL si legacy absent)',
    `status` ENUM('received','preparing','ready','waiting_for_driver','delivering','delivered','cancelled') NOT NULL DEFAULT 'received',
    `payment_status` ENUM('to_collect','paid') NOT NULL DEFAULT 'to_collect',
    `payment_method` ENUM('cash_on_delivery') NOT NULL DEFAULT 'cash_on_delivery',
    `driver_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_drivers (NULL si non assigné ou orphelin)',
    `driver_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy driver si FK non résolue',
    `driver_name_snapshot` VARCHAR(128) NULL COMMENT 'Nom livreur au moment de l\'assignation (snapshot historique)',
    `stock_consumed` TINYINT(1) NULL COMMENT 'TRUE/FALSE/NULL (3 états possibles legacy)',
    `idempotency_key` VARCHAR(128) NULL COMMENT 'Clé d\'idempotence si fournie',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_orders_legacy_id` (`legacy_id`),
    UNIQUE KEY `uk_bebba_orders_order_number` (`order_number`),
    UNIQUE KEY `uk_bebba_orders_tracking_token` (`tracking_token`),
    KEY `idx_bebba_orders_placed_at` (`placed_at`),
    KEY `idx_bebba_orders_status` (`status`),
    KEY `idx_bebba_orders_payment_status` (`payment_status`),
    KEY `idx_bebba_orders_driver_id` (`driver_id`),
    KEY `idx_bebba_orders_wp_customer_id` (`wp_customer_id`),
    KEY `idx_bebba_orders_idempotency_key` (`idempotency_key`),
    CONSTRAINT `fk_bebba_orders_driver` FOREIGN KEY (`driver_id`)
        REFERENCES `bebba_drivers` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `chk_bebba_orders_stock_consumed` CHECK (`stock_consumed` IN (0,1,NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Commandes BEBBA (tête de commande)';

-- --------------------------------------------------------
-- bebba_order_items (Lignes de commande avec snapshots complets)
-- --------------------------------------------------------
CREATE TABLE `bebba_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original de la ligne (ex: item-sy9o9hc)',
    `product_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_products (NULL si orphelin legacy)',
    `product_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy produit (toujours conservé)',
    `product_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom produit au moment de la commande',
    `unit_price` DECIMAL(10,2) NULL COMMENT 'Prix unitaire au moment de la commande (peut être NULL)',
    `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
    `protein_option_label` VARCHAR(128) NULL COMMENT 'Label option protéine choisie (snapshot)',
    `protein_option_extra_price` DECIMAL(10,2) NULL,
    `protein_option_extra_grams` DECIMAL(12,2) NULL,
    `veggies_option_label` VARCHAR(128) NULL COMMENT 'Label option légumes choisie (snapshot)',
    `veggies_option_extra_price` DECIMAL(10,2) NULL,
    `veggies_option_extra_grams` DECIMAL(12,2) NULL,
    `base_choice_label` VARCHAR(128) NULL COMMENT 'Label choix base choisi (snapshot)',
    `base_choice_extra_price` DECIMAL(10,2) NULL,
    `options_raw_json` JSON NULL COMMENT 'Snapshot complet des options pour traçabilité',
    `special_instructions` TEXT NULL,
    `item_total_price` DECIMAL(10,2) NULL COMMENT 'Total ligne (peut être NULL si legacy absent)',
    `summary_lines_json` JSON NULL COMMENT 'Lignes récapitulatives préparation (JSON array)',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_order_items_legacy_id` (`legacy_id`),
    KEY `idx_bebba_order_items_order_id` (`order_id`),
    KEY `idx_bebba_order_items_product_id` (`product_id`),
    KEY `idx_bebba_order_items_product_legacy_id` (`product_legacy_id`),
    CONSTRAINT `fk_bebba_order_items_order` FOREIGN KEY (`order_id`)
        REFERENCES `bebba_orders` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_order_items_product` FOREIGN KEY (`product_id`)
        REFERENCES `bebba_products` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lignes de commande avec snapshots historiques complets';

-- --------------------------------------------------------
-- bebba_order_item_supplements (Suppléments par ligne de commande)
-- --------------------------------------------------------
CREATE TABLE `bebba_order_item_supplements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_item_id` BIGINT UNSIGNED NOT NULL,
    `supplement_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_supplements (NULL si orphelin legacy)',
    `supplement_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy supplément (toujours conservé)',
    `supplement_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom supplément au moment de la commande',
    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix unitaire au moment de la commande',
    `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'FK ingrédient pour traçabilité stock',
    `ingredient_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy ingrédient',
    `ingredient_name_snapshot` VARCHAR(128) NULL COMMENT 'Nom ingrédient au moment de la commande',
    `quantity_consumed` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Qté totale consommée (qté * quantity_consumed)',
    `unit` VARCHAR(16) NOT NULL DEFAULT 'g',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bebba_order_item_supplements_order_item_id` (`order_item_id`),
    KEY `idx_bebba_order_item_supplements_supplement_id` (`supplement_id`),
    KEY `idx_bebba_order_item_supplements_ingredient_id` (`ingredient_id`),
    CONSTRAINT `fk_bebba_order_item_supplements_order_item` FOREIGN KEY (`order_item_id`)
        REFERENCES `bebba_order_items` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_order_item_supplements_supplement` FOREIGN KEY (`supplement_id`)
        REFERENCES `bebba_supplements` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_order_item_supplements_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `bebba_ingredients` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Suppléments choisis par ligne de commande (snapshot historique)';

-- --------------------------------------------------------
-- bebba_order_item_prep (Fiche de préparation exécutée par ligne de commande)
-- --------------------------------------------------------
CREATE TABLE `bebba_order_item_prep` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_item_id` BIGINT UNSIGNED NOT NULL,
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
    `ingredient_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
    `ingredient_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment de la préparation',
    `total_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Quantité totale pour cette ligne (qté * qté commande)',
    `unit` VARCHAR(16) NOT NULL DEFAULT 'g',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bebba_order_item_prep_order_item_id` (`order_item_id`),
    KEY `idx_bebba_order_item_prep_ingredient_id` (`ingredient_id`),
    KEY `idx_bebba_order_item_prep_ingredient_legacy_id` (`ingredient_legacy_id`),
    CONSTRAINT `fk_bebba_order_item_prep_order_item` FOREIGN KEY (`order_item_id`)
        REFERENCES `bebba_order_items` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_order_item_prep_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `bebba_ingredients` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Fiche de préparation exécutée par ligne de commande (recette réelle)';

-- --------------------------------------------------------
-- bebba_order_status_history (Historique des changements de statut)
-- --------------------------------------------------------
CREATE TABLE `bebba_order_status_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('received','preparing','ready','waiting_for_driver','delivering','delivered','cancelled') NOT NULL,
    `label` VARCHAR(128) NOT NULL COMMENT 'Libellé humain du statut',
    `timestamp` DATETIME NOT NULL COMMENT 'Horodatage précis du changement',
    `note` TEXT NULL COMMENT 'Note associée au changement',
    `updated_by` VARCHAR(128) NULL COMMENT 'Acteur : "Système Client", "Administrateur BEBBA (Admin)", "Sami Trabelsi (Livreur)", etc.',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bebba_order_status_history_order_id` (`order_id`),
    KEY `idx_bebba_order_status_history_timestamp` (`timestamp`),
    KEY `idx_bebba_order_status_history_status` (`status`),
    CONSTRAINT `fk_bebba_order_status_history_order` FOREIGN KEY (`order_id`)
        REFERENCES `bebba_orders` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historique complet des changements de statut des commandes';

-- ============================================================================
-- 4. TABLES DE STOCK
-- ============================================================================

-- --------------------------------------------------------
-- bebba_stock_movements
-- --------------------------------------------------------
CREATE TABLE `bebba_stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID Firestore original (ex: mov-1788443298340-zgk3)',
    `ingredient_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_ingredients (NULL si orphelin legacy)',
    `ingredient_legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy ingrédient (toujours conservé)',
    `ingredient_name_snapshot` VARCHAR(128) NOT NULL COMMENT 'Nom ingrédient au moment du mouvement',
    `movement_type` ENUM('order_consumption','replenishment','inventory_correction','manual_out','manual_in','waste','order_cancellation_restore') NOT NULL,
    `quantity` DECIMAL(12,2) NOT NULL COMMENT 'Signé : négatif = sortie, positif = entrée (conserve signe original)',
    `unit` VARCHAR(16) NOT NULL DEFAULT 'g',
    `order_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_orders si lié à une commande',
    `order_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy commande',
    `order_number_snapshot` VARCHAR(32) NULL COMMENT 'Numéro commande au moment du mouvement',
    `notes` TEXT NULL,
    `performed_by` VARCHAR(128) NULL COMMENT 'Acteur : "Cuisine BEBBA", "Administrateur BEBBA (Admin)", etc.',
    `timestamp` DATETIME NOT NULL COMMENT 'Horodatage précis du mouvement',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_stock_movements_legacy_id` (`legacy_id`),
    KEY `idx_bebba_stock_movements_ingredient_id` (`ingredient_id`),
    KEY `idx_bebba_stock_movements_order_id` (`order_id`),
    KEY `idx_bebba_stock_movements_timestamp` (`timestamp`),
    KEY `idx_bebba_stock_movements_type` (`movement_type`),
    CONSTRAINT `fk_bebba_stock_movements_ingredient` FOREIGN KEY (`ingredient_id`)
        REFERENCES `bebba_ingredients` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_bebba_stock_movements_order` FOREIGN KEY (`order_id`)
        REFERENCES `bebba_orders` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mouvements de stock (entrées/sorties signées, historique complet)';

-- ============================================================================
-- 5. TABLES D'INFRASTRUCTURE / MIGRATION
-- ============================================================================

-- --------------------------------------------------------
-- bebba_counters (Compteurs séquentiels)
-- --------------------------------------------------------
CREATE TABLE `bebba_counters` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `counter_name` VARCHAR(64) NOT NULL COMMENT 'Nom du compteur (ex: nextOrderSeq)',
    `current_value` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_counters_name` (`counter_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Compteurs séquentiels (numéros de commande, etc.)';

-- --------------------------------------------------------
-- bebba_order_idempotency (Clés d'idempotence pour commandes)
-- --------------------------------------------------------
CREATE TABLE `bebba_order_idempotency` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `idempotency_key` VARCHAR(128) NOT NULL COMMENT 'Clé fournie par le client',
    `caller_id` VARCHAR(128) NOT NULL COMMENT 'Identifiant appelant (client:xxx ou guest:phone)',
    `request_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hex du contenu canonique de la commande',
    `order_id` BIGINT UNSIGNED NULL COMMENT 'FK vers bebba_orders (rempli après création)',
    `order_legacy_id` VARCHAR(64) NULL COMMENT 'ID legacy commande si FK non résolue',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_order_idempotency_key` (`idempotency_key`),
    KEY `idx_bebba_order_idempotency_caller` (`caller_id`),
    KEY `idx_bebba_order_idempotency_order_id` (`order_id`),
    CONSTRAINT `fk_bebba_order_idempotency_order` FOREIGN KEY (`order_id`)
        REFERENCES `bebba_orders` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registre d\'idempotence pour création de commandes (anti-doublons)';

-- --------------------------------------------------------
-- bebba_migration_map (Traçabilité migration legacy → MySQL)
-- --------------------------------------------------------
CREATE TABLE `bebba_migration_map` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_type` VARCHAR(64) NOT NULL COMMENT 'Type entité legacy: category, supplier, ingredient, supplement, product, driver, order, order_item, stock_movement, user, counter',
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy source (Firestore / db.json)',
    `target_table` VARCHAR(64) NOT NULL COMMENT 'Table cible MySQL (ex: bebba_products)',
    `target_id` BIGINT UNSIGNED NULL COMMENT 'PK MySQL créée (NULL si échec/quarantaine)',
    `batch_id` VARCHAR(64) NOT NULL COMMENT 'Identifiant du lot de migration',
    `status` ENUM('pending','migrated','failed','quarantined') NOT NULL DEFAULT 'pending',
    `raw_json` JSON NULL COMMENT 'Données legacy brutes complètes pour audit',
    `error_message` TEXT NULL COMMENT 'Message d\'erreur si échec',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_migration_map_legacy` (`legacy_type`, `legacy_id`),
    KEY `idx_bebba_migration_map_batch` (`batch_id`),
    KEY `idx_bebba_migration_map_status` (`status`),
    KEY `idx_bebba_migration_map_target` (`target_table`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Mapping de migration legacy → MySQL (traçabilité complète)';

-- --------------------------------------------------------
-- bebba_migration_quarantine (Anomalies de migration nécessitant décision métier)
-- --------------------------------------------------------
CREATE TABLE `bebba_migration_quarantine` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_type` VARCHAR(64) NOT NULL COMMENT 'Type entité legacy concernée',
    `legacy_id` VARCHAR(64) NOT NULL COMMENT 'ID legacy source',
    `legacy_user_id` VARCHAR(64) NULL COMMENT 'ID user legacy si applicable (ex: usr-driver-1)',
    `legacy_driver_id` VARCHAR(64) NULL COMMENT 'ID driver legacy si applicable (ex: drv-1)',
    `field` VARCHAR(64) NOT NULL COMMENT 'Champ en anomalie (ex: name, phone, driverId)',
    `source_value` TEXT NULL COMMENT 'Valeur source (Firestore / db.json)',
    `target_value` TEXT NULL COMMENT 'Valeur cible proposée / alternative',
    `anomaly_type` ENUM('identity_conflict','missing_fk','orphan_reference','data_mismatch','duplicate_key','null_not_allowed','format_invalid','other') NOT NULL,
    `status` ENUM('open','in_review','resolved','ignored') NOT NULL DEFAULT 'open',
    `decision` TEXT NULL COMMENT 'Décision métier prise (ex: "Conserver Yassine Ben Amor comme nom driver")',
    `decided_by` VARCHAR(128) NULL COMMENT 'Qui a tranché',
    `decided_at` DATETIME NULL COMMENT 'Quand la décision a été prise',
    `batch_id` VARCHAR(64) NOT NULL COMMENT 'Lot de migration concerné',
    `raw_json` JSON NULL COMMENT 'Contexte complet pour analyse',
    `legacy_created_at` DATETIME NULL,
    `legacy_updated_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bebba_migration_quarantine_legacy` (`legacy_type`, `legacy_id`),
    KEY `idx_bebba_migration_quarantine_batch` (`batch_id`),
    KEY `idx_bebba_migration_quarantine_status` (`status`),
    KEY `idx_bebba_migration_quarantine_anomaly_type` (`anomaly_type`),
    KEY `idx_bebba_migration_quarantine_legacy_user` (`legacy_user_id`),
    KEY `idx_bebba_migration_quarantine_legacy_driver` (`legacy_driver_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Quarantaine des anomalies de migration nécessitant décision métier';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DONNÉES INITIALES : Compteurs
-- ============================================================================
INSERT INTO `bebba_counters` (`counter_name`, `current_value`, `legacy_created_at`, `legacy_updated_at`)
VALUES ('nextOrderSeq', 1101, '2026-09-01 08:13:06', '2026-09-01 08:13:06')
ON DUPLICATE KEY UPDATE `current_value` = VALUES(`current_value`);