# INSTRUCTIONS LOT 1 — Socle complet du plugin `bebba-healthy-food`

> **Destinataire** : Claude Code (machine locale de Zoubeir)
> **Émetteur** : Super Z (architecte) · **Date** : 2026-09-21
> **Couverture** : Phase 0 (fin) + Phase 1 (fin) de la spec de migration
>
> **Documents de référence** (à lire AVANT de coder) :
> 1. `docs/ARCHITECTURE_PLUGIN_WP.md` (v1.1) — autorité sur toute décision
> 2. `ROADMAP.md` — phases et décisions D1–D8
> 3. Spec de migration §3 (users), §4 (delta schéma), §9 (checklist sécurité), §10
>    (critères d'acceptation Phase 0/1), §12 (10 pièges WordPress) —
>    source : `download/spec_migration_plugin_wordpress_bebba.md`
> 4. `mysql_schema_bebba.sql` (schéma BLOC 3, source des 17 tables à porter)
> 5. `mysql_schema_delta_users.sql` (delta FAIT FOI pour bebba_users)
> 6. `server/auth.ts` + `server.ts` lignes 78–205 (comportement auth à respecter)
>
> En cas de contradiction : ARCHITECTURE_PLUGIN_WP.md > delta SQL > spec > autre.
> Signale toute contradiction détectée dans ton rapport.

---

## Contexte (résumé auto-porteur)

BEBBA Healthy Food (app de livraison de repas, Tunisie, paiement cash) migre d'un
serveur Express + Firestore vers un **plugin WordPress**. Le squelette du plugin est
déjà intégré au dépôt (`bebba-healthy-food/`) et **fonctionne** : auth JWT complète,
rate limiting, seed admin, `/bebba/v1/health`, routes `/auth/*`.

Règle d'or : **les comptes bebba vivent dans `bebba_users` et n'ont AUCUN lien avec
WordPress** — jamais `wp_insert_user`, `is_user_logged_in()`, `current_user_can()`,
aucun rôle WP, aucun cookie WP dans le métier.

Ce LOT 1 finalise le socle :
1. Porter les **17 tables restantes** du schéma BLOC 3 dans l'activator.
2. Acheter l'auth : `password_needs_rehash`, `must_change_password`, endpoint
   `POST /auth/change-password`.
3. Exécuter tous les tests d'acceptation Phase 0 + Phase 1.

## Prérequis — LOT 0 (à faire/valider avant de coder)

1. **Environnement WordPress local** : WP 6.4+, PHP 8.1+, MySQL 8.x (Local WP,
   XAMPP/Laragon ou Docker — au choix de Zoubeir).
2. Dans le clone du dépôt `bhf` : créer la branche `wordpress-migration` depuis `main`.
3. Déployer le plugin : copier le dossier `bebba-healthy-food/` du dépôt dans
   `wp-content/plugins/` (copie simple, symlink ou script de déploiement — documenter
   le choix dans le rapport).
4. Activer le plugin et vérifier que `/wp-json/bebba/v1/health` répond 200
   (`{"status":"ok","brand":"BEBBA Healthy Food",...}`).
5. Noter dans le rapport : accès `wp` (wp-cli) dispo ou non, préfixe de tables WP réel
   (ex : `wp_`), URL du site local.

## Tâches

### T1. Porter les 17 tables restantes — `includes/class-bebba-activator.php`

Dans `create_tables()`, à la suite de `bebba_users` et `bebba_counters` :

1. Porter les 17 tables de `mysql_schema_bebba.sql` en **syntaxe dbDelta stricte** :
   - pas de backticks sur les définitions de colonnes, un champ par ligne,
   - `PRIMARY KEY  (id)` (deux espaces), `KEY` (jamais `INDEX`), index sans nom de
     contrainte, pas de `CONSTRAINT ... FOREIGN KEY` dans le dbDelta,
   - chaque table nommée via `Bebba_HF_DB::table('<nom-sans-prefixe>')`.
2. Appliquer les **révisions R1–R3** (voir ARCHITECTURE §3) :
   - R1 : `bebba_drivers` **sans** les colonnes `user_id` ni FK wp_users
     (garder `legacy_user_id` VARCHAR(64) UNIQUE pour traçabilité) ;
   - R2 : `bebba_orders` avec `bebba_customer_id BIGINT UNSIGNED NULL` (pas de
     `wp_customer_id`, pas de FK vers wp_*) ;
   - R3 : tout préfixé via `$wpdb->prefix`.
3. Ordre de création (dépendances) : categories, suppliers, ingredients, supplements,
   drivers, products, product_ingredients, product_options, product_supplements, users
   (déjà là), orders, order_items, order_item_supplements, order_item_prep,
   order_status_history, stock_movements, counters (déjà là), order_idempotency,
   migration_map, migration_quarantine.
4. **Après** le dbDelta : poser les clés étrangères par `ALTER TABLE ... ADD CONSTRAINT`
   via `$wpdb->query()`, dans l'ordre de dépendance, en vérifiant d'abord leur absence
   dans `information_schema.TABLE_CONSTRAINTS` (idempotent). FK à poser :
   - ingredients.supplier_id → suppliers.id (SET NULL CASCADE)
   - supplements.ingredient_id → ingredients.id (SET NULL CASCADE)
   - products.category_id → categories.id (SET NULL CASCADE)
   - bebba_users.driver_id → drivers.id (SET NULL CASCADE) — déjà dans le delta
   - orders.bebba_customer_id → users.id (SET NULL CASCADE)
   - order_items / order_item_* / status_history / stock_movements → leurs parents
     (reprendre les FK du schéma BLOC 3 en remplaçant `wp_users` par `bebba_users`)
5. Incrémenter l'option `bebba_hf_schema_version` (ex : `0.2.0`) après succès.
6. Idempotence : activer → désactiver → réactiver ne doit ni échouer, ni dupliquer,
   ni perdre de données.

### T2. Achever l'authentification — `includes/class-bebba-auth.php` + `api/class-bebba-rest.php`

1. **`password_needs_rehash`** : après un login réussi, si
   `password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => 10])` → rehacher et
   mettre à jour `password_hash` (transition transparente, y compris pour les comptes
   migrés de bcryptjs).
2. **`must_change_password`** :
   - la réponse de `/auth/login` inclut `"mustChangePassword": true|false` dans `user` ;
   - `/auth/me` l'inclut aussi ;
   - quand `must_change_password = 1`, le reste de l'API reste accessible (pas de
     verrouillage global en V1) mais le front affichera l'écran de changement (LOT 6).
3. **Nouvel endpoint `POST /auth/change-password`** (authentifié Bearer) :
   - body `{ currentPassword, newPassword }` ;
   - vérifie `currentPassword` (401 « Identifiants invalides. » sinon) ;
   - newPassword : minimum 8 caractères désormais pour les changements explicites
     (l'inscription client garde son seuil historique de 4 pour compat) ;
   - hache, met à jour `must_change_password = 0`, **incrémente `token_version`**
     (révoque tous les autres jetons), émet un NOUVEAU token → 200 `{ token, user }` ;
   - rate limité comme le login.
4. **Vérification anti-fuite** : `safe_user()` ne doit exposer ni `password_hash`,
   ni `token_version`, ni `must_change_password` en brut... SAUF `mustChangePassword`
   en camelCase qui EST exposé volontairement (point 2).
5. Vérifier que `/auth/login` refuse bien un rôle `client` passé par `username`
   (mode staff) — comportement server.ts conservé.

### T3. Qualité

- `php -l` sans erreur sur chaque fichier PHP modifié.
- `grep -rn "wp_users\|wp_insert_user\|is_user_logged_in\|current_user_can\|wp_signon\|add_role" bebba-healthy-food/` → aucun résultat dans le métier (hors commentaires interdiction).
- Toute requête paramétrée passe par `$wpdb->prepare` ; entiers via `absint()`.
- `ABSPATH` check en tête de chaque fichier PHP.

## Critères d'acceptation (tests à exécuter et reporter)

**Phase 0 (fin) :**

1. Activation sans erreur sur WP 6.4+ / PHP 8.1 ; désactivation puis réactivation sans doublon ni perte.
2. Les 20 tables `bebba_*` présentes (`SHOW TABLES LIKE '%bebba_%'`) avec leurs index et FK (`information_schema`).
3. Aucune référence à `wp_users` dans le DDL créé (contrôle : `grep` + `information_schema`).
4. `/bebba/v1/health` répond sans authentification.

**Phase 1 (fin) :**

5. Un client WP connecté à wp-login ne peut PAS obtenir de token bebba : appeler
   `/auth/me` avec les cookies WP d'un admin WP connecté → 401. (Séparation prouvée.)
6. 6 tentatives de login échouées → 429 avec message générique ; le compteur expire
   après 15 min (prouver avec un test transient ou attendre/ajuster la fenêtre en test).
7. `password_hash` n'apparaît dans AUCUNE réponse (contrôle sur /login, /me,
   /auth/change-password).
8. Hachage bcrypt cost 10 vérifiable (`$2y$` en sortie PHP) ; `password_needs_rehash`
   actif : insérer manuellement un hash cost 6, se connecter, constater le rehash cost 10.
9. Un hachage bcryptjs `$2b$` existant est vérifié avec succès : créer un compte de
   test avec un hash bcryptjs pré-généré (fournir le hash utilisé dans le rapport),
   login OK.
10. `must_change_password` : forcer à 1 en BDD → login expose `mustChangePassword: true`
    → `POST /auth/change-password` OK → nouveaux token + flag à false → l'ancien token
    est révoqué (401 avec l'ancien Bearer).
11. Isolation WP : `SELECT COUNT(*) FROM wp_users` et contenu de l'option
    `wp_user_roles` inchangés avant/après tous les tests.
12. `POST /auth/change-password` avec mauvais `currentPassword` → 401, compteur
    d'échecs incrémenté.

## Livrables du rapport (à rendre à Zoubeir → Super Z)

1. Liste des fichiers modifiés/créés + `git diff --stat` (branche `wordpress-migration`).
2. Sortie des 12 tests (copier les réponses curl, en masquant mots de passe et secrets).
3. `SHOW CREATE TABLE` de `bebba_users`, `bebba_drivers`, `bebba_orders` (preuves R1–R3).
4. `git log --oneline` des commits du lot (convention : `feat(lot-1): ...`).
5. Décisions prises en cas d'ambiguïté + contradictions détectées entre documents.
6. Questions ouvertes / blocages.
7. Section `worklog.md` ajoutée à la FIN du fichier (format : `---` / `Task ID: LOT-1`
   / `Agent: Claude Code` / `Task:` / `Work Log:` / `Stage Summary:`).

## Interdictions explicites

- NE PAS implémenter les routes métier (catalogue, commandes, stock…) — lots suivants.
- NE PAS modifier le front React, `server.ts`, ni les scripts de migration Firestore.
- NE PAS toucher aux tables/options/utilisateurs WordPress (lecture seule).
- NE PAS installer de dépendance Composer/npm dans le plugin.
- NE PAS committer d'identifiants, de secrets JWT, ni de mots de passe de test réels.
