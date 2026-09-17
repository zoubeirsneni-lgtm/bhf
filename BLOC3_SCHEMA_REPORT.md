# BEBBA Healthy Food — BLOC 3 : Schéma MySQL Cible

## A. DDL Complet

Le script SQL complet se trouve dans : `mysql_schema_bebba.sql`

---

## B. Tableau du Schéma (19 tables : 17 métier + 2 infrastructure migration)

| # | Table | Colonne | Type | NULL | PK | FK | UNIQUE | Index |
|---|-------|---------|------|------|----|----|--------|-------|
| 1 | **bebba_categories** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | name | VARCHAR(128) | NO | | | | |
| | | slug | VARCHAR(128) | NO | | | | idx |
| | | icon | VARCHAR(64) | YES | | | | |
| | | image | VARCHAR(512) | YES | | | | |
| | | image_url | VARCHAR(512) | YES | | | | |
| | | description | TEXT | YES | | | | |
| | | active | TINYINT(1) | NO | | | | idx |
| | | sort_order | INT | NO | | | | idx |
| | | legacy_order | INT | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 2 | **bebba_suppliers** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | name | VARCHAR(128) | NO | | | | idx |
| | | phone | VARCHAR(32) | YES | | | | |
| | | email | VARCHAR(128) | YES | | | | |
| | | address | VARCHAR(255) | YES | | | | |
| | | supplied_ingredient_legacy_ids | JSON | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 3 | **bebba_ingredients** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | name | VARCHAR(128) | NO | | | | |
| | | unit | ENUM('g','ml','piece','portion') | YES | | | | |
| | | stock_quantity | DECIMAL(12,2) | YES | | | | |
| | | min_threshold | DECIMAL(12,2) | YES | | | | |
| | | purchase_cost | DECIMAL(10,4) | YES | | | | |
| | | supplier_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | supplier_legacy_id | VARCHAR(64) | YES | | | | |
| | | supplier_name_snapshot | VARCHAR(128) | YES | | | | |
| | | category | VARCHAR(64) | YES | | | | idx |
| | | active | TINYINT(1) | NO | | | | idx |
| | | legacy_active_raw | TINYINT(1) | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 4 | **bebba_supplements** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | name | VARCHAR(128) | NO | | | | |
| | | description | TEXT | YES | | | | |
| | | price | DECIMAL(10,2) | NO | | | | |
| | | ingredient_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | ingredient_legacy_id | VARCHAR(64) | YES | | | | |
| | | ingredient_name_snapshot | VARCHAR(128) | NO | | | | |
| | | quantity_consumed | DECIMAL(12,2) | NO | | | | |
| | | legacy_quantity | DECIMAL(12,2) | YES | | | | |
| | | unit | VARCHAR(16) | NO | | | | |
| | | available | TINYINT(1) | NO | | | | idx (composite) |
| | | is_available | TINYINT(1) | YES | | | | |
| | | active | TINYINT(1) | NO | | | | idx (composite) |
| | | sort_order | INT | NO | | | | idx |
| | | legacy_order | INT | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 5 | **bebba_drivers** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | name | VARCHAR(128) | NO | | | | |
| | | phone | VARCHAR(32) | NO | | | | idx |
| | | vehicle | VARCHAR(128) | YES | | | | |
| | | active | TINYINT(1) | NO | | | | idx |
| | | total_deliveries | INT UNSIGNED | NO | | | | |
| | | rating | DECIMAL(3,2) | YES | | | | |
| | | legacy_user_id | VARCHAR(64) | YES | | | ✓ | |
| | | user_id | BIGINT UNSIGNED | YES | | ✓ (wp_users) | ✓ | idx |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 6 | **bebba_products** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | category_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | category_legacy_id | VARCHAR(64) | YES | | | | |
| | | name | VARCHAR(128) | NO | | | | |
| | | description | TEXT | YES | | | | |
| | | base_price | DECIMAL(10,2) | NO | | | | |
| | | image_url | VARCHAR(512) | YES | | | | |
| | | image | VARCHAR(512) | YES | | | | |
| | | calories | INT UNSIGNED | YES | | | | |
| | | protein_grams | DECIMAL(8,2) | YES | | | | |
| | | carbs_grams | DECIMAL(8,2) | YES | | | | |
| | | fat_grams | DECIMAL(8,2) | YES | | | | |
| | | active | TINYINT(1) | NO | | | | idx (composite) |
| | | is_available | TINYINT(1) | NO | | | | idx (composite) |
| | | available | TINYINT(1) | YES | | | | |
| | | is_popular | TINYINT(1) | NO | | | | idx |
| | | sort_order | INT | NO | | | | idx |
| | | legacy_order | INT | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 7 | **bebba_product_ingredients** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | product_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | ingredient_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | ingredient_legacy_id | VARCHAR(64) | NO | | | ✓ (composite) | |
| | | ingredient_name_snapshot | VARCHAR(128) | NO | | | | |
| | | position | INT UNSIGNED | NO | | | ✓ (composite) | |
| | | quantity | DECIMAL(12,2) | NO | | | | |
| | | unit | VARCHAR(16) | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 8 | **bebba_product_options** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | product_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | option_type | ENUM('protein','veggies','base') | NO | | | | |
| | | position | INT UNSIGNED | NO | | | ✓ (composite) | |
| | | label | VARCHAR(128) | NO | | | | |
| | | extra_price | DECIMAL(10,2) | NO | | | | |
| | | extra_grams | DECIMAL(12,2) | YES | | | | |
| | | sort_order | INT | NO | | | | idx |
| | | is_default | TINYINT(1) | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 9 | **bebba_product_supplements** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | product_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | supplement_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | supplement_legacy_id | VARCHAR(64) | NO | | | ✓ (composite) | |
| | | sort_order | INT | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 10 | **bebba_orders** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | order_number | VARCHAR(32) | NO | | | ✓ | |
| | | tracking_token | VARCHAR(64) | NO | | | ✓ | |
| | | placed_at | DATETIME | NO | | | | idx |
| | | customer_name | VARCHAR(128) | NO | | | | |
| | | customer_phone | VARCHAR(32) | NO | | | | |
| | | delivery_address | VARCHAR(512) | NO | | | | |
| | | customer_notes | TEXT | YES | | | | |
| | | wp_customer_id | BIGINT UNSIGNED | YES | | | | idx |
| | | subtotal | DECIMAL(10,2) | YES | | | | |
| | | delivery_fee | DECIMAL(10,2) | NO | | | | |
| | | total_amount | DECIMAL(10,2) | YES | | | | |
| | | status | ENUM(7 valeurs) | NO | | | | idx |
| | | payment_status | ENUM('to_collect','paid') | NO | | | | idx |
| | | payment_method | ENUM('cash_on_delivery') | NO | | | | |
| | | driver_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | driver_legacy_id | VARCHAR(64) | YES | | | | |
| | | driver_name_snapshot | VARCHAR(128) | YES | | | | |
| | | stock_consumed | TINYINT(1) | YES | | | | CHECK |
| | | idempotency_key | VARCHAR(128) | YES | | | ✓ | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 11 | **bebba_order_items** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | order_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | product_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | product_legacy_id | VARCHAR(64) | NO | | | | idx |
| | | product_name_snapshot | VARCHAR(128) | NO | | | | |
| | | unit_price | DECIMAL(10,2) | YES | | | | |
| | | quantity | INT UNSIGNED | NO | | | | |
| | | protein_option_label | VARCHAR(128) | YES | | | | |
| | | protein_option_extra_price | DECIMAL(10,2) | YES | | | | |
| | | protein_option_extra_grams | DECIMAL(12,2) | YES | | | | |
| | | veggies_option_label | VARCHAR(128) | YES | | | | |
| | | veggies_option_extra_price | DECIMAL(10,2) | YES | | | | |
| | | veggies_option_extra_grams | DECIMAL(12,2) | YES | | | | |
| | | base_choice_label | VARCHAR(128) | YES | | | | |
| | | base_choice_extra_price | DECIMAL(10,2) | YES | | | | |
| | | options_raw_json | JSON | YES | | | | |
| | | special_instructions | TEXT | YES | | | | |
| | | item_total_price | DECIMAL(10,2) | YES | | | | |
| | | summary_lines_json | JSON | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 12 | **bebba_order_item_supplements** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | order_item_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | supplement_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | supplement_legacy_id | VARCHAR(64) | NO | | | ✓ (composite) | |
| | | supplement_name_snapshot | VARCHAR(128) | NO | | | | |
| | | price | DECIMAL(10,2) | NO | | | | |
| | | quantity | INT UNSIGNED | NO | | | | |
| | | ingredient_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | ingredient_legacy_id | VARCHAR(64) | YES | | | | |
| | | ingredient_name_snapshot | VARCHAR(128) | YES | | | | |
| | | quantity_consumed | DECIMAL(12,2) | NO | | | | |
| | | unit | VARCHAR(16) | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 13 | **bebba_order_item_prep** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | order_item_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | ingredient_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | ingredient_legacy_id | VARCHAR(64) | NO | | | ✓ (composite) | |
| | | ingredient_name_snapshot | VARCHAR(128) | NO | | | | |
| | | total_quantity | DECIMAL(12,2) | NO | | | | |
| | | unit | VARCHAR(16) | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 14 | **bebba_order_status_history** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | order_id | BIGINT UNSIGNED | NO | | ✓ | | idx |
| | | position | INT UNSIGNED | NO | | | ✓ (composite) | |
| | | status | ENUM(7 valeurs) | NO | | | | idx |
| | | label | VARCHAR(128) | NO | | | | |
| | | timestamp | DATETIME(3) | NO | | | | idx |
| | | note | TEXT | YES | | | | |
| | | updated_by | VARCHAR(128) | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 15 | **bebba_stock_movements** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ | |
| | | ingredient_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | ingredient_legacy_id | VARCHAR(64) | NO | | | | |
| | | ingredient_name_snapshot | VARCHAR(128) | NO | | | | |
| | | movement_type | ENUM(7 valeurs) | NO | | | | idx |
| | | quantity | DECIMAL(12,2) | NO | | | | |
| | | unit | VARCHAR(16) | YES | | | | |
| | | order_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | order_legacy_id | VARCHAR(64) | YES | | | | |
| | | order_number_snapshot | VARCHAR(32) | YES | | | | |
| | | notes | TEXT | YES | | | | |
| | | performed_by | VARCHAR(128) | YES | | | | |
| | | timestamp | DATETIME | NO | | | | idx |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 16 | **bebba_order_idempotency** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | idempotency_key | VARCHAR(128) | NO | | | ✓ | |
| | | caller_id | VARCHAR(128) | NO | | | | idx |
| | | request_hash | CHAR(64) | NO | | | | |
| | | order_id | BIGINT UNSIGNED | YES | | ✓ | | idx |
| | | order_legacy_id | VARCHAR(64) | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 17 | **bebba_counters** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | counter_name | VARCHAR(64) | NO | | | ✓ | |
| | | current_value | BIGINT UNSIGNED | NO | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |

### Tables d'infrastructure / migration (hors périmètre métier strict)

| # | Table | Colonne | Type | NULL | PK | FK | UNIQUE | Index |
|---|-------|---------|------|------|----|----|--------|-------|
| 18 | **bebba_migration_map** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_type | VARCHAR(64) | NO | | | ✓ (composite) | idx |
| | | legacy_id | VARCHAR(64) | NO | | | ✓ (composite) | |
| | | target_table | VARCHAR(64) | NO | | | | idx |
| | | target_id | BIGINT UNSIGNED | YES | | | | idx |
| | | batch_id | VARCHAR(64) | NO | | | | idx |
| | | status | ENUM(4 valeurs) | NO | | | | idx |
| | | raw_json | JSON | YES | | | | |
| | | error_message | TEXT | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |
| 19 | **bebba_migration_quarantine** | id | BIGINT UNSIGNED | NO | ✓ | | | |
| | | legacy_type | VARCHAR(64) | NO | | | | idx |
| | | legacy_id | VARCHAR(64) | NO | | | | idx |
| | | legacy_user_id | VARCHAR(64) | YES | | | | idx |
| | | legacy_driver_id | VARCHAR(64) | YES | | | | idx |
| | | field | VARCHAR(64) | NO | | | | |
| | | source_value | TEXT | YES | | | | |
| | | target_value | TEXT | YES | | | | |
| | | anomaly_type | ENUM(8 valeurs) | NO | | | | idx |
| | | status | ENUM('open','pending_review','in_review','resolved','ignored') | NO | | | | idx |
| | | decision | TEXT | YES | | | | |
| | | decided_by | VARCHAR(128) | YES | | | | |
| | | decided_at | DATETIME | YES | | | | |
| | | batch_id | VARCHAR(64) | NO | | | | idx |
| | | raw_json | JSON | YES | | | | |
| | | legacy_created_at | DATETIME | YES | | | | |
| | | legacy_updated_at | DATETIME | YES | | | | |
| | | created_at | DATETIME | NO | | | | |
| | | updated_at | DATETIME | NO | | | | |

---

## C. Graphe des Dépendances (Ordre de Création)

```
NIVEAU 1 — Tables sans FK (indépendantes)
├── bebba_categories
├── bebba_suppliers
├── bebba_drivers
└── bebba_counters

NIVEAU 2 — Tables référentielles (dépendent du NIVEAU 1)
├── bebba_ingredients        → bebba_suppliers (SET NULL)
├── bebba_supplements        → bebba_ingredients (SET NULL)
└── bebba_products           → bebba_categories (SET NULL)

NIVEAU 3 — Tables de composition (dépendent du NIVEAU 2)
├── bebba_product_ingredients → bebba_products (CASCADE) + bebba_ingredients (SET NULL)
├── bebba_product_options     → bebba_products (CASCADE)
└── bebba_product_supplements → bebba_products (CASCADE) + bebba_supplements (SET NULL)

NIVEAU 4 — Commandes (tête)
└── bebba_orders              → bebba_drivers (SET NULL)

NIVEAU 5 — Lignes de commande (dépendent du NIVEAU 4 + NIVEAU 2/3)
├── bebba_order_items         → bebba_orders (CASCADE) + bebba_products (SET NULL)
├── bebba_order_item_supplements → bebba_order_items (CASCADE) + bebba_supplements (SET NULL) + bebba_ingredients (SET NULL)
└── bebba_order_item_prep     → bebba_order_items (CASCADE) + bebba_ingredients (SET NULL)

NIVEAU 6 — Historiques (dépendent du NIVEAU 4/5)
├── bebba_order_status_history → bebba_orders (CASCADE)
└── bebba_stock_movements      → bebba_ingredients (SET NULL) + bebba_orders (SET NULL)

NIVEAU 7 — Infrastructure migration
├── bebba_order_idempotency    → bebba_orders (SET NULL)
├── bebba_migration_map        (aucune FK)
└── bebba_migration_quarantine (aucune FK)
```

### Justification des règles ON DELETE / ON UPDATE

| FK | ON DELETE | ON UPDATE | Justification |
|----|-----------|-----------|---------------|
| `bebba_ingredients.supplier_id` | SET NULL | CASCADE | Un ingrédient ne doit pas disparaître si son fournisseur est supprimé ; l'historique est préservé |
| `bebba_supplements.ingredient_id` | SET NULL | CASCADE | Idem, supplément orphelin reste traçable |
| `bebba_products.category_id` | SET NULL | CASCADE | Produit sans catégorie reste valide (catalogue) |
| `bebba_product_ingredients.product_id` | CASCADE | CASCADE | Suppression produit = suppression composition |
| `bebba_product_ingredients.ingredient_id` | SET NULL | CASCADE | Ingrédient orphelin : composition garde snapshot |
| `bebba_product_options.product_id` | CASCADE | CASCADE | Options liées au produit |
| `bebba_product_supplements.product_id` | CASCADE | CASCADE | Liaison produit-supplément |
| `bebba_product_supplements.supplement_id` | SET NULL | CASCADE | Supplément orphelin : liaison garde legacy_id |
| `bebba_orders.driver_id` | SET NULL | CASCADE | Commande garde snapshot driver_name si driver supprimé |
| `bebba_order_items.order_id` | CASCADE | CASCADE | Ligne sans commande n'a pas de sens |
| `bebba_order_items.product_id` | SET NULL | CASCADE | Historique commande préservé même si produit supprimé |
| `bebba_order_item_supplements.order_item_id` | CASCADE | CASCADE | Supplément de ligne suit la ligne |
| `bebba_order_item_supplements.supplement_id` | SET NULL | CASCADE | Snapshot conservé |
| `bebba_order_item_supplements.ingredient_id` | SET NULL | CASCADE | Traçabilité stock préservée |
| `bebba_order_item_prep.order_item_id` | CASCADE | CASCADE | Préparation suit la ligne |
| `bebba_order_item_prep.ingredient_id` | SET NULL | CASCADE | Recette historique préservée |
| `bebba_order_status_history.order_id` | CASCADE | CASCADE | Historique lié à la commande |
| `bebba_stock_movements.ingredient_id` | SET NULL | CASCADE | Mouvement orphelin : snapshot ingrédient conservé |
| `bebba_stock_movements.order_id` | SET NULL | CASCADE | Mouvement peut exister sans commande (réappro manuel) |
| `bebba_order_idempotency.order_id` | SET NULL | CASCADE | Clé d'idempotence survivre à la commande |
| `bebba_drivers.user_id` | SET NULL | CASCADE | Driver survit à suppression wp_user ; mapping WordPress externe |

**Pas de CASCADE aveugle** : Toutes les FK vers des données historiques (produits, ingrédients, suppléments, drivers) utilisent `SET NULL` pour protéger l'historique des commandes contre la suppression du catalogue vivant.

---

## D. Contrôle Final — Capacité de Conservation Sans Perte

| Exigence BLOC 3 | Couverture Schéma | Preuve |
|-----------------|-------------------|--------|
| **54 commandes** | ✅ `bebba_orders` + `bebba_order_items` + `bebba_order_status_history` | UNIQUE sur legacy_id, order_number, tracking_token ; status ENUM 7 valeurs ; payment_status ENUM to_collect/paid |
| **56 lignes** | ✅ `bebba_order_items` | product_name_snapshot NOT NULL ; product_id NULLable ; options_raw_json ; summary_lines_json |
| **173 mouvements** | ✅ `bebba_stock_movements` | quantity SIGNÉ conservé ; movement_type ENUM 7 valeurs ; ingredient_id NULLable |
| **23 produits** | ✅ `bebba_products` + `bebba_product_ingredients` + `bebba_product_options` + `bebba_product_supplements` | Composition + options + suppléments autorisés fully normalisés |
| **19 ingrédients** | ✅ `bebba_ingredients` | stock_quantity snapshot NULLable ; supplier_id NULLable ; purchase_cost NULLable ; legacy_active_raw trace absence |
| **10 suppléments** | ✅ `bebba_supplements` | ingredient_id NULLable ; ingredient_name_snapshot NOT NULL ; legacy_quantity trace champ legacy |
| **9 catégories** | ✅ `bebba_categories` | slug index (pas UNIQUE : doublon historique wraps-galettes conservé) ; sort_order |
| **3 fournisseurs** | ✅ `bebba_suppliers` | supplied_ingredient_legacy_ids JSON pour traçabilité |
| **119 entrées statusHistory** | ✅ `bebba_order_status_history` | position INT UNSIGNED (ordre original) ; timestamp DATETIME(3) ms ; updated_by VARCHAR ; label |
| **Snapshots historiques** | ✅ Partout | *_snapshot columns NOT NULL ; *_legacy_id columns ; JSON raw |
| **NULL historiques** | ✅ Partout | Aucune transformation NULL→0/'' ; colonnes NULL autorisées (unit, stock_quantity, min_threshold, purchase_cost, legacy_quantity, etc.) |
| **Références orphelines** | ✅ Partout | FK SET NULL + legacy_id conservé + snapshot name |
| **Anomalies/quarantaines** | ✅ `bebba_migration_quarantine` | identity_conflict pour drv-1/Sami/Yassine ; legacy_user_id + legacy_driver_id ; status pending_review |
| **to_collect / paid** | ✅ `bebba_orders.payment_status` | ENUM strict ; AUCUN trigger delivered→paid |
| **delivered ≠ paid** | ✅ Séparation stricte | status et payment_status indépendants ; CHECK stock_consumed 3 états |

---

## Points Nécessitant Décision Explicite Avant Création

| # | Point | Description | Action Requise |
|---|-------|-------------|----------------|
| 1 | **passwordHash vides** | Dans `db.json`, les passwordHash sont vides pour users staff | Vérifier si hash réels en Firestore (oui, cf PREUVE 1) ; migration depuis Firestore pas depuis db.json |
| 2 | **Charset/Collation** | `utf8mb4_unicode_ci` vs `utf8mb4_0900_ai_ci` (MySQL 8 défaut) | Confirmer collation cible (recommandé : `utf8mb4_0900_ai_ci` pour MySQL 8+) |

---

## Conclusion

Le schéma DDL présenté couvre **l'intégralité des 19 tables** (17 métier + `bebba_counters` + `bebba_order_idempotency` + `bebba_migration_map` + `bebba_migration_quarantine`).

**Toutes les règles impératives du BLOC 3 sont respectées :**
- PK `BIGINT UNSIGNED AUTO_INCREMENT` sur toutes les tables
- `legacy_id` conservé partout, jamais remplacé
- Snapshots historiques NOT NULL + FK NULLables (SET NULL)
- NULL jamais transformé en défaut (unit, stock_quantity, min_threshold, purchase_cost, legacy_quantity, etc. sont NULLable)
- ENUM stricts pour status, payment_status, movement_type, option_type, quarantine status
- Séparation livraison/encaissement (pas de trigger delivered→paid)
- JSON pour structures hétérogènes (options_raw_json, summary_lines_json, supplied_ingredient_legacy_ids)
- Mapping migration traçable (UNIQUE legacy_type+legacy_id)
- Quarantaine structurée pour anomalies (identity_conflict drv-1 documentée, status pending_review)
- Position conservée pour ordre original (status history, product options, product ingredients)
- `idempotency_key` UNIQUE (NULL multiples autorisés MySQL)
- `legacy_active_raw` pour distinguer absence/false/true
- `user_id` (pas wp_user_id) pour mapping WordPress gelé BLOC 1
- `legacy_user_id` sur bebba_drivers pour traçabilité User legacy
- MySQL 8.4 syntaxe compatible (ON DUPLICATE KEY UPDATE sans VALUES())

**ORDRE DE CRÉATION VALIDÉ** : 1→2→3→4→5→6→7→8→9→10→11→12→13→14→15→16→17→18→19

---

**STOP — Schéma produit. Aucune table créée en MySQL. Aucune migration effectuée.**