# INSTRUCTIONS LOT 1 — Socle du plugin `bebba-core`

> **Destinataire** : Claude Code (machine locale de Zoubeir)
> **Émetteur** : Super Z (architecte) · **Date** : 2026-09-21
> **Documents de référence** (à lire AVANT de coder) :
> - `docs/ARCHITECTURE_PLUGIN_WP.md` (autorité absolue sur toute décision)
> - `ROADMAP.md` (phase 1 = ce lot)
> - `server/auth.ts` (comportement d'auth à porter EXACTEMENT)
> - `mysql_schema_bebba.sql` (schéma de base, avec les 3 révisions du doc d'architecture)
> - `src/types.ts` (rôles et entités de référence)
>
> Si tu détectes une contradiction entre ces documents : `ARCHITECTURE_PLUGIN_WP.md` gagne,
> puis signale la contradiction dans ton rapport.

---

## Contexte (résumé auto-porteur)

BEBBA Healthy Food est une app de commande/livraison de repas (Tunisie, paiements cash
à la livraison) actuellement en React 19 + Express + Firestore. On la migre en plugin
WordPress `bebba-core` :

- Les **utilisateurs bebba sont 100 % indépendants de WordPress** : table `bebba_users`
  dédiée, JWT maison, AUCUN usage de `wp_users`, `wp_roles`, cookies WP ou `wp_authenticate`.
- L'API Express actuelle est ré-implémentée dans le namespace REST `/wp-json/bebba/v1/*`
  avec des contrats JSON et des messages d'erreur français identiques.
- 5 rôles bebba : `client`, `kitchen`, `driver`, `admin`, `admin_readonly`.
- Ce LOT 1 pose le socle : plugin activable, schéma complet, auth, endpoints `/auth/*`.
  Les routes métier (catalogue, commandes…) viendront dans les lots 2 à 5.

## Prérequis — LOT 0 (à faire/valider avant de coder)

1. **Environnement WordPress local** : WP 6.4+, PHP 8.1+, MySQL 8.x
   (Local WP, XAMPP/Laragon ou Docker — au choix de Zoubeir).
2. Dans le clone du dépôt `bhf` : créer la branche `wordpress-migration` depuis `main`.
3. Créer le dossier du plugin : `{wp-content}/plugins/bebba-core/` (dans l'installation WP
   locale). Si l'installation WP est dans un autre dossier que le dépôt, créer un lien
   symbolique ou un sous-module — choisir la solution la plus simple pour Zoubeir et
   le documenter dans le rapport.
4. Vérifier l'accès CLI : `wp` (wp-cli) si disponible, sinon noter dans le rapport.

## Tâches

### T1. Bootstrap du plugin

Fichier `bebba-core.php` :

- Header de plugin : `Plugin Name: BEBBA Core`, `Description: BEBBA Healthy Food — API et administration (utilisateurs bebba séparés de WordPress)`, `Version: 0.1.0`, `Requires PHP: 8.0`, `Text Domain: bebba-core`.
- Constantes : `BEBBA_CORE_VERSION`, `BEBBA_CORE_DB_VERSION = '1.0.0'`, `BEBBA_CORE_PLUGIN_DIR/URL`, namespace REST `bebba/v1`.
- **Au chargement** : vérifier que `BEBBA_JWT_SECRET` est défini dans wp-config et fait ≥ 32 caractères. Si absent → `admin_notice` d'avertissement persistant (l'activation reste possible, mais l'API auth renverra 503 tant que le secret manque) et `error_log`.
- Chargement des classes include par include (pas d'autoloader Composer).
- `register_activation_hook` → `Bebba_Install::activate()`.
- `register_deactivation_hook` → no-op (aucune perte de données).
- Hook `rest_api_init` → `Bebba_REST::register_routes()`.
- Hook `rest_pre_serve_request` → CORS : `Access-Control-Allow-Origin` = origine du site uniquement, `Access-Control-Allow-Headers: Authorization, Content-Type` (nécessaire aux appels Bearer de la SPA).

### T2. Schéma de base de données — `includes/class-bebba-install.php`

Méthode `activate()` :

1. Vérifie PHP ≥ 8.0, MySQL ≥ 8.0 (`SELECT VERSION()`), sinon `wp_die` lisible.
2. Exécute dans l'ordre (FK dépendantes en dernier) les `CREATE TABLE IF NOT EXISTS`
   via `$wpdb->query()` — **NE PAS utiliser dbDelta** (ENUM/FK/JSON mal gérés).
   - **Toutes les tables sont créées avec le préfixe WP** : `$table = "{$wpdb->prefix}bebba_users"`, etc.
   - Source : le fichier `mysql_schema_bebba.sql` du dépôt, en appliquant les révisions :
     - **R1** `bebba_drivers` : supprimer les colonnes `user_id`, `legacy_user_id` reste, supprimer `uk_bebba_drivers_user_id` et la FK `fk_bebba_drivers_user` (la liaison devient `bebba_users.driver_id`).
     - **R2** `bebba_orders` : renommer `wp_customer_id` en `bebba_customer_id` avec FK → `{prefix}bebba_users(id)` ON DELETE SET NULL ON UPDATE CASCADE.
     - **R3** préfixer dynamiquement toutes les tables et les références FK avec `$wpdb->prefix`.
   - **Ajouter** la nouvelle table `{prefix}bebba_users` (DDL complet dans
     `ARCHITECTURE_PLUGIN_WP.md` §2 — copie strictement conforme).
3. Si la table `bebba_users` vient d'être créée et est vide → **seed admin** :
   - username `admin`, name `Administrateur BEBBA`, rôle `admin`,
   - mot de passe aléatoire 16 caractères (`wp_generate_password(16, true, true)`),
   - écrire le couple dans `wp-content/uploads/bebba/initial-admin-credentials.txt`
     (créer le dossier, chmod 0600, refuser l'accès web via .htaccess « Deny from all »),
   - `admin_notice` informant que le fichier doit être supprimé après lecture.
4. `update_option('bebba_db_version', BEBBA_CORE_DB_VERSION)`.
5. Journaliser les tables créées manquantes le cas échéant (retour `$wpdb->last_error`).

Idempotence : exécuter `activate()` deux fois de suite ne doit ni échouer, ni dupliquer
le seed, ni altérer les données.

### T3. JWT pur PHP — `includes/class-bebba-jwt.php`

- `Bebba_Jwt::encode(array $payload, string $secret): string` — HS256 : header
  `{"alg":"HS256","typ":"JWT"}`, base64url (URL-safe, sans padding), signature
  `hash_hmac('sha256', "$h.$p", $secret, true)`.
- `Bebba_Jwt::decode(string $token, string $secret): ?array` — vérifie signature
  (comparaison `hash_equals`), `exp`, et `nbf` si présent. Retourne `null` en cas
  d'échec (jamais d'exception qui fuite).
- Aucune dépendance externe. Tester mentalement l'interop : le token doit être
  décodable par `jwt.io` pour validation manuelle.

### T4. Auth — `includes/class-bebba-auth.php`

Portage STRICT de `server/auth.ts` (mêmes messages, mêmes codes) :

- `hash_password(string $pw): string` → `password_hash($pw, PASSWORD_BCRYPT, ['cost' => 10])`.
- `compare_password(string $pw, string $hash): bool` → `password_verify` (compatible hashes bcryptjs existants).
- `generate_token(SafeUser $u): string` → payload `{ id, role }` + `username` si présent + `phone` si présent + `driverId` si présent, `exp = time() + 86400` (24 h), signé avec `BEBBA_JWT_SECRET` (503 si absent — même refus que `getJwtSecret()` côté Express).
- `sanitize_user(array $user): array` → retire `password_hash` (jamais de hash dans une réponse).
- `authenticate(WP_REST_Request $req): ?array` → lit `Authorization: Bearer`, décode, recharge l'utilisateur depuis `bebba_users`, refuse (401) si absent/inactif/token invalide ; retourne le user sain.
- `require_role(string ...$roles): callable` → factory retournant un `permission_callback` : 401 si non authentifié, 403 si rôle non autorisé (messages identiques à server.ts).
- `is_valid_status_transition(string $current, string $target, string $role): bool` → **copie intégrale** de `isValidStatusTransition` (inclure les tables de transition admin/kitchen/driver et le refus client/admin_readonly). Placée ici ou dans `class-bebba-workflow.php` — au choix, mais portée sans la moindre divergence.
- Anti-énumération : les messages d'échec de login sont exactement « Identifiants invalides. ».

### T5. Repositoire utilisateurs — `includes/class-bebba-users-repo.php`

Méthodes (100 % `$wpdb->prepare`, jamais de concat SQL) :

- `get_user_by_id(int $id): ?array`
- `get_user_by_username(string $username): ?array`
- `get_client_by_phone(string $phoneRaw): ?array` → normalise via `normalize_phone()`
- `normalize_phone(string $raw): ?string` → portage EXACT de `normalizePhoneNumber` : retire tout non-chiffre, refuse < 8 chiffres, retourne les **8 derniers** chiffres.
- `phone_exists(string $phoneNormalized): bool` (unicité par `phone_normalized`)
- `create_client(array $data): array` → insère client (role forcé `client`, `phone_normalized` calculé), retourne le user créé.
- `create_staff(array $data): array` → insère kitchen/driver/admin/admin_readonly avec username unique (vérif d'unicité avant insert).
- `update_last_login(int $id): void`
- Toutes les lectures retournent des tableaux snake_case alignés sur les colonnes BDD ; la couche contrôleur transformera en camelCase pour le contrat front.

### T6. Rate limiting — `includes/class-bebba-ratelimit.php`

- Clé : `bebba_rl_' . md5(IP + identifiant fourni)` via transients, fenêtre 15 min.
- Limite : 5 échecs de login consécutifs → 6ᵉ tentative renvoie `429`
  `{ "error": "Trop de tentatives. Réessayez dans quelques minutes." }`.
- Succès de login → reset du compteur. Stoker UNIQUEMENT les échecs (pas les succès).

### T7. Endpoints REST — `includes/rest/class-bebba-rest.php` + `class-auth-controller.php`

Namespace `bebba/v1`. Contrats STRICTEMENT identiques à server.ts :

| Route | Méthode | Auth | Comportement (portage server.ts lignes 80-205) |
|---|---|---|---|
| `/health` | GET | public | `{ status: 'ok', brand: 'BEBBA Healthy Food', slogan: 'Vos Plats santé en un clic' }` |
| `/auth/login` | POST | public | Body `{ username?, phone?, password }`. Client → phone (normalisé) ; staff → username (refuser un rôle client qui fournit username). Invalide/inactif → 401 générique. Rate limit avant tout. Succès → 200 `{ token, user }` + last_login. |
| `/auth/register-client` | POST | public | Valide name/phone/password (password ≥ 4 — conservé tel quel pour compat), normalise le téléphone, refuse doublon (400 « Un compte client avec ce numéro de téléphone existe déjà. »), crée, → 201 `{ token, user }`. |
| `/auth/me` | GET | Bearer | 200 `{ user }` (sanitisé) ; 401 sinon. |
| `/auth/logout` | POST | public | 200 `{ message: 'Déconnexion réussie.' }` (stateless, portage identique). |

Chaque `register_rest_route` DOIT avoir un `permission_callback` (public → closure
retournant `true` ; protégé → `Bebba_Auth::require_role(...)` ou authenticate).
Réponses d'erreur : `WP_Error` avec code HTTP correct (400/401/403/429/500) et le
message français exact de server.ts.

### T8. Qualité

- `php -l` sans erreur sur chaque fichier PHP.
- Aucune écriture WP interdite : pas de `wp_insert_user`, `add_role`, `wp_set_current_user`, `wp_signon`, `wp_create_user`.
- Toutes les requêtes SQL préparées ; aucun `$_GET`/`$_POST` brut (l'API REST WP fournit l'objet Request).
- Fichiers PHP fermés sans `?>` final ; échappement systématique dans les notices admin.

## Critères d'acceptation (tests à exécuter et reporter)

Après activation du plugin (`wp plugin activate bebba-core` ou écran admin) :

1. `ACTIVATION OK` — aucune erreur/notice PHP ; 2ᵉ activation sans effet de bord.
2. Tables présentes (adapter le préfixe) :
   `SHOW TABLES LIKE '%bebba_%'` → les 19 tables (18 du schéma + `bebba_users`).
3. `DESCRIBE wp_bebba_users` → colonnes conformes au DDL (§2 architecture).
4. Seed : `SELECT id, username, role, active FROM wp_bebba_users;` → 1 admin actif ;
   le fichier d'identifiants existe avec chmod 600.
5. **Isolation WP** : noter `SELECT COUNT(*) FROM wp_users` avant/après tous les tests
   → inchangé. `SELECT COUNT(*) FROM wp_options WHERE option_name LIKE '%bebba%'`
   → uniquement `bebba_db_version`.
6. Login staff : `curl -s -X POST {site}/wp-json/bebba/v1/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"<seed>"}'` → 200 + token + user sans `password_hash`.
7. Login client : créer via `/auth/register-client` puis login par `phone` → 200.
8. `/auth/me` avec `Authorization: Bearer <token>` → 200 ; avec token falsifié (1 char modifié) → 401 ; sans token → 401.
9. Rate limit : 6 mauvais logins d'affilée → 429 à la 6ᵉ.
10. `curl {site}/wp-json/bebba/v1/health` → 200.
11. Vérifier qu'aucun rôle WP n'a été créé (`wp cap list administrator` inchangé / table `wp_roles` — contenu de l'option `wp_user_roles` inchangé).

## Livrables du rapport (à rendre à Zoubeir → Super Z)

1. Liste des fichiers créés avec `git diff --stat` (branche `wordpress-migration`).
2. Sortie des 11 tests ci-dessus (copier les réponses curl, en masquant les secrets).
3. `git log --oneline` des commits du lot (convention : `feat(lot-1): ...`).
4. Décisions prises en cas d'ambiguïté + contradictions éventuelles détectées.
5. Questions ouvertes / blocages.
6. Section `worklog.md` ajoutée à la fin du fichier (format : `---` / Task ID: LOT-1 / Agent: Claude Code / Work Log / Stage Summary).

## Interdictions explicites

- NE PAS implémenter les routes métier (catalogue, commandes, stock…) — lots suivants.
- NE PAS modifier le front React, ni `server.ts`, ni les scripts de migration.
- NE PAS toucher aux tables/options/utilisateurs WordPress (lecture seule).
- NE PAS installer de dépendance Composer/npm dans le plugin.
- NE PAS commiter d'identifiants, de secrets, ou le fichier `initial-admin-credentials.txt`.
