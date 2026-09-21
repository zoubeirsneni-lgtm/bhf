-- ============================================================
-- BEBBA — LOT 2 : donnees de DEMONSTRATION pour tester le catalogue public
-- A importer via phpMyAdmin (base : bebba_bhf).
--
-- NB : ces donnees simulent une migration Firestore (legacy_id remplis).
-- Elles seront SUPPRIMEES au LOT 7 avant l'import des vraies donnees
-- (fichier demo_cleanup_lot2.sql fourni a cote).
--
-- Si votre prefixe de tables n'est pas "wp_", remplacez wp_bebba_ par
-- votre_prefixe_bebba_ avant d'importer.
-- ============================================================

-- ---------- 1. Fournisseur ----------
INSERT IGNORE INTO `wp_bebba_suppliers`
  (legacy_id, name, phone, email, address, supplied_ingredient_legacy_ids)
VALUES
  ('sup-1', 'Marché Central Tunis', '71900000', 'contact@marche-central.tn', 'Rue de Marseille, Tunis', '["ing-poulet","ing-legumes","ing-riz","ing-quinoa","ing-sauce-yaourt"]');

-- ---------- 2. Ingredients ----------
INSERT IGNORE INTO `wp_bebba_ingredients`
  (legacy_id, name, unit, stock_quantity, min_threshold, purchase_cost, supplier_id, supplier_legacy_id, supplier_name_snapshot, category, active)
VALUES
  ('ing-poulet',        'Poulet fermier',   'g',      8000.00, 2000.00, 12.5000, (SELECT id FROM `wp_bebba_suppliers` WHERE legacy_id='sup-1'), 'sup-1', 'Marché Central Tunis', 'Protéines', 1),
  ('ing-legumes',       'Légumes frais',    'g',     12000.00, 3000.00,  4.2000, (SELECT id FROM `wp_bebba_suppliers` WHERE legacy_id='sup-1'), 'sup-1', 'Marché Central Tunis', 'Légumes',   1),
  ('ing-riz',           'Riz complet',      'g',      6000.00, 1500.00,  3.8000, (SELECT id FROM `wp_bebba_suppliers` WHERE legacy_id='sup-1'), 'sup-1', 'Marché Central Tunis', 'Féculents', 1),
  ('ing-quinoa',        'Quinoa',           'g',      3000.00,  800.00,  9.5000, (SELECT id FROM `wp_bebba_suppliers` WHERE legacy_id='sup-1'), 'sup-1', 'Marché Central Tunis', 'Féculents', 1),
  ('ing-sauce-yaourt',  'Sauce yaourt',     'ml',     2500.00,  500.00,  5.0000, (SELECT id FROM `wp_bebba_suppliers` WHERE legacy_id='sup-1'), 'sup-1', 'Marché Central Tunis', 'Sauces',    1);

-- ---------- 3. Categories ----------
INSERT IGNORE INTO `wp_bebba_categories`
  (legacy_id, name, slug, icon, image_url, description, active, sort_order, legacy_order)
VALUES
  ('cat-bowls',  'Bowls équilibrés', 'bowls',  '🥗', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400', 'Nos bowls complets riches en protéines', 1, 1, 1),
  ('cat-juices', 'Jus détox',        'juices', '🍹', 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400', 'Jus frais pressés du jour',              1, 2, 2);

-- ---------- 4. Supplements ----------
INSERT IGNORE INTO `wp_bebba_supplements`
  (legacy_id, name, description, price, ingredient_id, ingredient_legacy_id, ingredient_name_snapshot, quantity_consumed, legacy_quantity, unit, available, is_available, active, sort_order, legacy_order)
VALUES
  ('sup-poulet-extra', 'Poulet supplémentaire', '100g de poulet fermier en plus', 3.50, (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-poulet'),       'ing-poulet',       'Poulet fermier',   100.00, 100.00, 'g',  1, 1, 1, 1, 1),
  ('sup-avocado',      'Avocat extra',          'Demi-avocat frais',              2.00, (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-legumes'),      'ing-legumes',      'Légumes frais',     60.00,  60.00, 'g',  1, 1, 1, 2, 2);

-- ---------- 5. Produits ----------
INSERT IGNORE INTO `wp_bebba_products`
  (legacy_id, category_id, category_legacy_id, name, description, base_price, image_url, calories, protein_grams, carbs_grams, fat_grams, active, is_available, available, is_popular, sort_order, legacy_order)
VALUES
  ('prod-chicken-bowl', (SELECT id FROM `wp_bebba_categories` WHERE legacy_id='cat-bowls'),  'cat-bowls',  'Poulet Bowl', 'Riz complet, poulet fermier grillé, légumes de saison et sauce yaourt légère', 14.50, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600', 520, 38.00, 55.00, 12.00, 1, 1, 1, 1, 1, 1),
  ('prod-detox-juice',  (SELECT id FROM `wp_bebba_categories` WHERE legacy_id='cat-juices'), 'cat-juices', 'Jus Détox Vert', 'Concombre, pomme verte, menthe fraîche et citron pressé', 6.50, 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600', 120, 2.00, 28.00, 0.50, 1, 1, 1, 0, 2, 2);

-- ---------- 6. Base ingredients des produits ----------
INSERT IGNORE INTO `wp_bebba_product_ingredients`
  (product_id, ingredient_id, ingredient_legacy_id, ingredient_name_snapshot, position, quantity, unit)
VALUES
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-riz'),           'ing-riz',       'Riz complet',    0, 100.00, 'g'),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-poulet'),        'ing-poulet',    'Poulet fermier', 1, 150.00, 'g'),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-legumes'),       'ing-legumes',   'Légumes frais',  2,  80.00, 'g'),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-sauce-yaourt'),  'ing-sauce-yaourt', 'Sauce yaourt', 3,  30.00, 'ml'),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-detox-juice'),  (SELECT id FROM `wp_bebba_ingredients` WHERE legacy_id='ing-legumes'),       'ing-legumes',   'Légumes frais',  0, 250.00, 'g');

-- ---------- 7. Options de personnalisation ----------
INSERT IGNORE INTO `wp_bebba_product_options`
  (product_id, option_type, position, label, extra_price, extra_grams, sort_order, is_default)
VALUES
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), 'protein', 0, 'Portion sportive (+100g)', 3.00, 100.00, 0, 0),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), 'protein', 1, 'Portion normale (0g)',     0.00,   0.00, 1, 1),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), 'veggies', 0, 'Double légumes (+50g)',    1.50,  50.00, 0, 0),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), 'base',    0, 'Base quinoa',              1.00, NULL,   0, 0),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), 'base',    1, 'Base riz complet',         0.00, NULL,   1, 1);

-- ---------- 8. Supplements autorises par produit ----------
INSERT IGNORE INTO `wp_bebba_product_supplements`
  (product_id, supplement_id, supplement_legacy_id, sort_order)
VALUES
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_supplements` WHERE legacy_id='sup-poulet-extra'), 'sup-poulet-extra', 0),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-chicken-bowl'), (SELECT id FROM `wp_bebba_supplements` WHERE legacy_id='sup-avocado'),      'sup-avocado',      1),
  ((SELECT id FROM `wp_bebba_products` WHERE legacy_id='prod-detox-juice'),  (SELECT id FROM `wp_bebba_supplements` WHERE legacy_id='sup-avocado'),      'sup-avocado',      0);
