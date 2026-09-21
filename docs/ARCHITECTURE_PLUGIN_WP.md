# Architecture — Plugin WordPress `bebba-core`

> Version : 1.0 · Date : 2026-09-21 · Auteur : Super Z
> Ce document REMPLACE le mapping « User → wp_users » gelé en BLOC 1 (contradiction
> résolue sur exigence propriétaire : les utilisateurs bebba sont distincts des
> utilisateurs WordPress).

---

## 1. Vue d'ensemble

```
Navigateur (client / cuisine / livreur / admin)
        │  HTTPS — SPA React buildée (existante, adaptée)
        ▼
WordPress (même origine)  ── shortcode [bebba_app] sur une page
        │  /wp-json/bebba/v1/*  +  Authorization: Bearer <JWT bebba>
        ▼
Plugin bebba-core (PHP 8.0+)
  ├─ REST controllers (portage 1:1 de server.ts)
  ├─ Bebba_Auth  : JWT HS256 maison + bcrypt + RBAC bebba
  ├─ Bebba_DB    : wpdb, tables bebba_* (préfixées), transactions
  └─ Bebba_Install : CREATE TABLE IF NOT EXISTS + versionnage schéma
        ▼
MySQL : wp_* (WordPress, INCHANGÉ) + bebba_* (métier, ISOLÉ)
```

Principes non négociables :

- **Isolation totale** : le plugin n'appelle jamais `wp_insert_user`, `wp_authenticate`,
  `is_user_logged_in`, `wp_set_current_user`, et ne crée aucun rôle WP.
- Les tables WordPress (`wp_users`, `wp_posts`, `wp_options` métier WP) restent
  strictement inchangées pendant tout le cycle de vie de l'app bebba.
- Une compromission d'un compte WP n'ouvre aucun droit bebba, et inversement.
- Le seul point de contact avec WP : `$wpdb` (accès MySQL), `rest_api_init`,
  l'activation/désactivation, et l'enqueue des assets.

## 2. Modèle utilisateurs bebba (`bebba_users`)

Une table unique pour les 5 rôles (identique au modèle actuel de `server.ts`) :

| Rôle | Identifiant de connexion | Particularités |
|------|--------------------------|----------------|
| `client` | téléphone (8 derniers chiffres) + mot de passe | auto-inscription publique |
| `kitchen` | username + mot de passe | créé par admin |
| `driver` | username + mot de passe | lié 1:1 à un profil livreur |
| `admin` | username + mot de passe | tous droits |
| `admin_readonly` | username + mot de passe | lecture seule (stats, suivi) |

### DDL de référence (à préfixer dynamiquement avec `$wpdb->prefix`)

```sql
CREATE TABLE IF NOT EXISTS `{prefix}bebba_users` (
    `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `legacy_id`        VARCHAR(64)  NULL COMMENT 'ID Firestore original (traçabilité migration)',
    `username`         VARCHAR(60)  NULL COMMENT 'Staff uniquement (NULL pour clients)',
    `name`             VARCHAR(160) NOT NULL,
    `email`            VARCHAR(190) NULL,
    `phone`            VARCHAR(32)  NULL COMMENT 'Tel brut saisi par le client',
    `phone_normalized` VARCHAR(8)   NULL COMMENT '8 derniers chiffres (normalizePhoneNumber)',
    `address`          VARCHAR(255) NULL,
    `password_hash`    VARCHAR(255) NOT NULL COMMENT 'bcrypt cost 10 (compatible bcryptjs $2a/$2b)',
    `role`             ENUM('client','kitchen','driver','admin','admin_readonly') NOT NULL DEFAULT 'client',
    `driver_id`        BIGINT UNSIGNED NULL COMMENT 'FK bebba_drivers.id (rôle driver uniquement, 1:1)',
    `active`           TINYINT(1) NOT NULL DEFAULT 1,
    `last_login_at`    DATETIME NULL,
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_bebba_users_username`   (`username`),
    UNIQUE KEY `uk_bebba_users_phone_norm` (`phone_normalized`),
    UNIQUE KEY `uk_bebba_users_legacy_id`  (`legacy_id`),
    UNIQUE KEY `uk_bebba_users_driver_id`  (`driver_id`),
    KEY `idx_bebba_users_role`   (`role`),
    KEY `idx_bebba_users_active` (`active`),
    CONSTRAINT `fk_bebba_users_driver` FOREIGN KEY (`driver_id`)
        REFERENCES `{prefix}bebba_drivers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Notes de conception :

- `username` UNIQUE mais NULLable — MySQL accepte plusieurs NULL dans un index UNIQUE.
- `phone_normalized` matérialise la fonction `normalizePhoneNumber` (8 derniers chiffres)
  : l'unicité devient garantie par la BDD et la recherche par téléphone est indexée.
- `password_hash` : PHP `password_hash($pw, PASSWORD_BCRYPT, ['cost' => 10])` produit
  des hashes compatibles avec `bcryptjs` → les comptes existants pourront être migrés
  sans réinitialisation des mots de passe.
- `ENUM` aligné exactement sur `UserRole` de `src/types.ts`.

## 3. Révisions du schéma BLOC 3 (`mysql_schema_bebba.sql`)

Le schéma existant (18 tables, InnoDB, utf8mb4) est conservé à l'exception de :

| Révision | Table | Avant (BLOC 3) | Après (v2) |
|----------|-------|-----------------|------------|
| R1 | `bebba_drivers` | `user_id` FK → `wp_users.ID` | **Colonne supprimée.** Liaison inversée : `bebba_users.driver_id` → `bebba_drivers.id` (voir §2) |
| R2 | `bebba_orders` | `wp_customer_id` BIGINT NULL (FK wp_users) | **Renommée `bebba_customer_id`** BIGINT UNSIGNED NULL, FK → `bebba_users(id)` ON DELETE SET NULL. NULL = commande invité |
| R3 | toutes | tables non préfixées par le préfixe WP | création via `$wpdb->prefix` (ex : `wp7a_bebba_orders`) |

Le reste (colonnes, index, `legacy_id`, tables de migration `bebba_migration_map`,
`bebba_migration_quarantine`, `bebba_counters`, `bebba_order_idempotency`) est
**gelé et inchangé**.

## 4. Authentification bebba (portage strict de `server/auth.ts`)

| Élément | Implémentation Express actuelle | Portage plugin |
|---|---|---|
| Hachage | bcryptjs cost 10 | `password_hash(PASSWORD_BCRYPT, cost 10)` — compatible |
| JWT | `jsonwebtoken` HS256, TTL 24 h | Classe `Bebba_Jwt` pur PHP (HS256, `hash_hmac('sha256')`), TTL 24 h |
| Payload | `{ id, username?, phone?, role, driverId? }` | identique |
| Secret | `process.env.JWT_SECRET` obligatoire | `BEBBA_JWT_SECRET` défini dans `wp-config.php` — **obligatoire**, l'API auth renvoie 503 si absent |
| Middleware | `authenticateUser` (Bearer → user actif → req.user) | `Bebba_Auth::authenticate($request)` utilisé comme `permission_callback` |
| RBAC | `requireRole(...roles)` | `Bebba_Auth::require_role('admin', 'kitchen')` (factory de permission_callback) |
| Sanitisation | `sanitizeUser` (retrait passwordHash) | `Bebba_Auth::sanitize_user()` |
| Anti-énumération | erreurs génériques « Identifiants invalides. » | conservé à l'identique |
| Rate limit login | absent (dette) | **ajout** : transient `bebba_rl_{ip}` — 5 tentatives / 15 min / IP, 429 au-delà |

Flux : `POST /wp-json/bebba/v1/auth/login` → 200 `{ token, user }` → le front
stocke le token (comme aujourd'hui) → chaque appel en `Authorization: Bearer`.

**Aucun cookie, aucune session PHP, aucun nonce WP** pour l'app bebba — le JWT
porte toute l'authentification, exactement comme l'Express actuel.

## 5. API REST (`/wp-json/bebba/v1`)

Portage 1:1 des ~50 routes de `server.ts`. Codes HTTP, messages d'erreur en
français, et contrats JSON conservés à l'identique (le front ne devra changer
QUE l'URL de base).

| Groupe | Routes (méthodes portées) |
|--------|---------------------------|
| Système | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/register-client`, `GET /auth/me`, `POST /auth/logout` |
| Catalogue | CRUD `/categories`, `/products`, `/supplements` (GET publics, écritures admin) |
| Stock | `/ingredients` (admin+kitchen, DELETE admin), `/ingredients/{id}/stock`, `/stock-movements` (admin+readonly), CRUD `/suppliers` (admin) |
| Livreurs | `/drivers` (GET admin+kitchen), CRUD admin, `/drivers/{id}/status`, `/drivers/{id}/password` |
| Utilisateurs | `/users` GET/POST (admin) — **les 4 profils bebba gérés ici** |
| Commandes | `POST /orders` (public), GET `/orders` (admin/kitchen/driver filtré par rôle), GET `/orders/{id}` (+client propriétaire), `POST /orders/track-lookup`, GET `/orders/track/{token}` (public), `PATCH /orders/{id}/status` (workflow strict), `PATCH /orders/{id}/assign-driver` (admin), `PATCH /orders/{id}/payment` (admin/kitchen), GET `/client/orders` (client) |
| Stats | `GET /stats` (admin, admin_readonly) |
| Démo | `POST /reset-demo-data` (admin) — conservé en dev, neutralisé en prod |

Décisions REST WP :

- `permission_callback` obligatoire sur **chaque** route (jamais `__return_true`
  sur une route protégée) — c'est l'équivalent du middleware Express.
- Réponses : `WP_REST_Response` (200/201) ou `WP_Error` (400/401/403/404/409/429/500)
  avec `message` en français identique à server.ts.
- `show_in_index` : le namespace reste listable (utile au debug local).

## 6. Structure du plugin

```
bebba-core/
├── bebba-core.php                  # Bootstrap : header, constantes, hooks, autoloader
├── uninstall.php                   # Option : purge tables+options (constante BEBBA_KEEP_DATA)
├── includes/
│   ├── class-bebba-plugin.php      # Orchestrateur (singleton) : charge les modules
│   ├── class-bebba-install.php     # Activation : CREATE TABLE IF NOT EXISTS + versionnage
│   ├── class-bebba-db.php          # wpdb helper : préfixes, prepared statements, transactions
│   ├── class-bebba-jwt.php         # HS256 encode/decode pur PHP (pas de Composer)
│   ├── class-bebba-auth.php        # bcrypt, tokens, authenticate/require_role, sanitize
│   ├── class-bebba-users-repo.php  # Repositoire users : getById, getByUsername,
│   │                               #   getClientByPhone (normalisé), createClient, lastLogin
│   ├── class-bebba-workflow.php    # isValidStatusTransition (portage intégral)
│   ├── class-bebba-ratelimit.php   # Transients anti-bruteforce login
│   └── rest/
│       ├── class-bebba-rest.php    # register_rest_route pour tout le namespace
│       ├── class-auth-controller.php
│       ├── class-catalog-controller.php
│       ├── class-stock-controller.php
│       ├── class-order-controller.php
│       ├── class-driver-controller.php
│       ├── class-user-controller.php
│       └── class-stats-controller.php
├── assets/                         # (LOT 6) build React + css
└── languages/
```

Règles de code : syntaxe PHP 8.0 max (pas d'enum, pas de readonly property),
namespace `Bebba\` ou préfixe de classe `Bebba_`, **100 % requêtes préparées**
(`$wpdb->prepare`), aucune interpolation de variable SQL, `absint`/`sanitize_text_field`
sur les entrées, sorties `wp_json_encode` via l'API REST.

## 7. Activation & versionnage du schéma

- Hook `register_activation_hook` → `Bebba_Install::activate()` :
  1. Vérifie PHP ≥ 8.0 et MySQL ≥ 8.0 (sinon erreur d'activation lisible).
  2. Exécute les `CREATE TABLE IF NOT EXISTS` (§2 + schéma BLOC 3 révisé) via `$wpdb`.
     (dbDelta est écarté : son parser ne gère ni ENUM ni FK ni JSON de façon fiable.)
  3. `update_option('bebba_db_version', BEBBA_CORE_DB_VERSION)` — routine `upgrade()`
     comparera la version à chaque chargement admin pour les migrations futures.
  4. Seed : si `bebba_users` est vide → création du compte `admin` (rôle admin,
     mot de passe aléatoire 16 caractères, écrit une seule fois dans
     `wp-content/uploads/bebba/initial-admin-credentials.txt`, chmod 0600, + admin_notice).
- Hook `register_deactivation_hook` : aucune destruction de données.
- `uninstall.php` : suppression des tables/options **uniquement** si la constante
  `BEBBA_DROP_DATA_ON_UNINSTALL` est `true` dans wp-config (sécurité par défaut).

## 8. Frontend (LOT 6, aperçu)

- Build Vite de l'actuelle SPA avec `base: './'` → 2 bundles (client + app complète)
  servis par le plugin (`wp_enqueue_script`).
- Shortcode `[bebba_app]` : `<div id="bebba-root"></div>` + `wp_localize_script` qui
  injecte `window.BEBBA_CONFIG = { restUrl, version, healthUrl }`.
- Côté front, seul le client HTTP change : `/api/…` → `${BEBBA_CONFIG.restUrl}/…`
  (le mécanisme Bearer existe déjà dans le code React actuel).
- Routage SPA conservé (vues Client / StaffLogin / Kitchen / Driver / Admin) ;
  les vues staff restent protégées par l'auth bebba, côté serveur.

## 9. Matrice des risques & parades

| Risque | Parade |
|---|---|
| Collision de préfixes de tables | préfixe `bebba_` fixé + `$wpdb->prefix` dynamique ; vérif à l'activation |
| Secret JWT absent/faible | refus de l'API auth (503) + admin_notice ; longueur min 32 vérifiée |
| Bruteforce login | rate limiting transient (5/15 min/IP) + erreurs génériques |
| Énumération de comptes | message unique « Identifiants invalides. » |
| Injection SQL | `$wpdb->prepare` systématique + revue Super Z à chaque lot |
| Fuite de passwordHash | `sanitize_user` en sortie de chaque endpoint + tests |
| Régression workflow statuts | `Bebba_Workflow` = copie strictement égale à `isValidStatusTransition` + tests de transition |
| Divergence schéma/BLOC 3 | ce doc = référence ; toute dérive → quarantaine `bebba_migration_quarantine` lors de la migration |
