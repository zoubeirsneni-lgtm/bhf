-- ============================================================
-- BEBBA — LOT 2 : SUPPRESSION des donnees de demonstration
-- A lancer au LOT 7 juste avant l'import des vraies donnees Firestore.
-- Base : bebba_bhf. Pre-fixe suppose : wp_.
-- ============================================================

DELETE FROM `wp_bebba_product_supplements`     WHERE supplement_legacy_id IN ('sup-poulet-extra','sup-avocado');
DELETE FROM `wp_bebba_product_options`         WHERE product_id IN (SELECT id FROM `wp_bebba_products` WHERE legacy_id IN ('prod-chicken-bowl','prod-detox-juice'));
DELETE FROM `wp_bebba_product_ingredients`     WHERE ingredient_legacy_id IN ('ing-poulet','ing-legumes','ing-riz','ing-quinoa','ing-sauce-yaourt');
DELETE FROM `wp_bebba_products`                WHERE legacy_id IN ('prod-chicken-bowl','prod-detox-juice');
DELETE FROM `wp_bebba_supplements`             WHERE legacy_id IN ('sup-poulet-extra','sup-avocado');
DELETE FROM `wp_bebba_categories`              WHERE legacy_id IN ('cat-bowls','cat-juices');
DELETE FROM `wp_bebba_ingredients`             WHERE legacy_id IN ('ing-poulet','ing-legumes','ing-riz','ing-quinoa','ing-sauce-yaourt');
DELETE FROM `wp_bebba_suppliers`               WHERE legacy_id = 'sup-1';
