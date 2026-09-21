# Architecture — Plugin WordPress `bebba-core`

> Version : 1.1 · Date : 2026-09-21 · Auteur : Super Z
> Ce document REMPLACE le mapping « User → wp_users » gelé en BLOC 1 (contradiction
> résolue sur exigence propriétaire : les utilisateurs bebba sont distincts des
> utilisateurs WordPress).
> **Référence détaillée complémentaire** : `download/spec_migration_plugin_wordpress_bebba.md`
> (PDF livré) — en cas d'écart sur un détail, le présent document gagne sur les
> décisions D1–D7 et le delta SQL fait foi pour le schéma.

---

## 1. Vue d'ensemble

```
Navigateur (client / cuisine / livreur / admin)
        │  HTTPS — SPA React buildée (existante, adaptée)
        ▼
WordPress (même origine)  ── shortcode [bebba_app] sur une page
        │  /wp-json/bebba/v1/*  +  Authorization: Bearer <JWT bebba>
        ▼
Plugin bebba-healthy-food (PHP 8.1+, sans Composer)
  ├─ api/class-bebba-rest.php     : portage 1:1 des routes de server.ts
  ├─ Bebba_HF_Auth : JWT HS256 maison + bcrypt + RBAC bebba + token_version
  ├─ Bebba_HF_DB   : wpdb, tables bebba_* (préfixées), transactions, compteurs
  └─ Bebba_HF_Activator : dbDelta schéma complet + FK ALTER + seed admin
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

### DDL de référence

**Fait foi** : fichier `mysql_schema_delta_users.sql` (racine du dépôt), à appliquer
SUR le schéma BLOC 3. Points clés de `bebba_users` :

- `username` UNIQUE mais NULLable (staff uniquement ; clients = NULL).
- `phone VARCHAR(20)` : téléphone **normalisé** (portage de `normalizePhoneNumber`,
  8 derniers chiffres) — unicité garantie par la BDD, recherche indexée. Le brut
  n'est pas stocké (décision, simplifie la migration Firestore).
- `token_version INT UNSIGNED DEFAULT 0` : l'incrémenter révoque instantanément tous
  les JWT émis du compte (vérifié à chaque requête via le claim `tv`).
- `must_change_password TINYINT(1) DEFAULT 0` : force le changement de mot de passe
  au premier login des comptes semés.
- `password_hash` : PHP `password_hash(PASSWORD_BCRYPT, cost 10)` — compatible avec
  les hashes `bcryptjs $2a$/$2b$` existants → migration sans reset des mots de passe.
- `role ENUM('client','kitchen','driver','admin','admin_readonly')` aligné sur
  `UserRole` de `src/types.ts`.
- `driver_id` UNIQUE : liaison 1:1 vers `bebba_drivers.id` (sens unique, le lien vit ici).
- Le compte admin semé a un username aléatoire (`bebba_admin_XXXX`), un mot de passe
  temporaire affiché une seule fois, et `must_change_password = 1`.

## 3. Révisions du schéma BLOC 3 (`mysql_schema_bebba.sql`)

Le schéma existant (18 tables, InnoDB, utf8mb4) est conservé à l'exception de :

| Révision | Table | Avant (BLOC 3) | Après (v2) |
|----------|-------|-----------------|------------|
| R1 | `bebba_drivers` | `user_id` FK → `wp_users.ID` | **Colonne supprimée.** Liaison inversée : `bebba_users.driver_id` → `bebba_drivers.id` (voir §2) |
| R2 | `bebba_orders` | `wp_customer_id` BIGINT NULL (FK wp_users) | **Renommée `bebba_customer_id`** BIGINT UNSIGNED NULL, FK → `bebba_users(id)` ON DELETE SET NULL. NULL = commande invité |
| R3 | toutes | tables non préfixées par le préfixe WP | création via `$wpdb->prefix` (ex : `wp7a_bebba_orders`) |
| R4 | `bebba_users` | (n'existait pas) | nouvelle table — voir `mysql_schema_delta_users.sql` (fait foi) |

Le reste (colonnes, index, `legacy_id`, tables de migration `bebba_migration_map`,
`bebba_migration_quarantine`, `bebba_counters`, `bebba_order_idempotency`) est
**gelé et inchangé**.

## 4. Authentification bebba (portage strict de `server/auth.ts`)

| Élément | Implémentation Express actuelle | Portage plugin |
|---|---|---|
| Hachage | bcryptjs cost 10 | `password_hash(PASSWORD_BCRYPT, cost 10)` — compatible |
| JWT | `jsonwebtoken` HS256, TTL 24 h | `Bebba_HF_Auth` pur PHP (HS256, `hash_hmac('sha256')`), TTL 24 h, claim `tv` (token_version) |
| Payload | `{ id, username?, phone?, role, driverId? }` | identique + `tv` |
| Secret | `process.env.JWT_SECRET` obligatoire | Option `bebba_hf_jwt_secret` générée à l'activation (64 car.) ; constante `BEBBA_JWT_SECRET` (wp-config) prioritaire si définie — recommandé en prod |
| Middleware | `authenticateUser` (Bearer → user actif → req.user) | `Bebba_Auth::authenticate($request)` utilisé comme `permission_callback` |
| RBAC | `requireRole(...roles)` | `Bebba_Auth::require_role('admin', 'kitchen')` (factory de permission_callback) |
| Sanitisation | `sanitizeUser` (retrait passwordHash) | `Bebba_Auth::sanitize_user()` |
| Anti-énumération | erreurs génériques « Identifiants invalides. » | conservé à l'identique |
| Rate limit login | absent (dette) | **ajout** (déjà dans le squelette) : transients, 5 tentatives / 15 min par (IP + identifiant), 429 au-delà, reset au succès |

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

**Squelette livré et intégré au dépôt** : dossier `bebba-healthy-food/` — fonctionnel
dès l'activation (`bebba_users` + `bebba_counters`, seed admin, `/bebba/v1/health`,
routes d'auth complètes, rate limiting, révocation token_version).

```
bebba-healthy-food/
├── bebba-healthy-food.php          # Header plugin, constantes, chargement des classes
├── uninstall.php                   # Purge tables + options (sur confirmation réglage)
├── includes/
│   ├── class-bebba-plugin.php      # Bootstrap : hooks, REST, shortcodes, assets
│   ├── class-bebba-activator.php   # dbDelta tables + FK ALTER + seed admin + secret JWT
│   │                               #   (LOT 1 : porter les 17 tables restantes ici)
│   ├── class-bebba-auth.php        # JWT HS256 pur PHP, bcrypt, RBAC, anti-force-brute
│   └── class-bebba-db.php          # $wpdb (prepare obligatoire), transactions, compteurs
├── api/
│   └── class-bebba-rest.php        # Routes bebba/v1 : auth + carte des routes suivantes
├── shortcodes/
│   └── class-bebba-shortcodes.php  # [bebba_app] / [bebba_staff]
└── public/                         # Build React (rempli au LOT 6)
```

Règles de code : syntaxe PHP 8.1, préfixe de classe `Bebba_HF_`, `ABSPATH` check en tête
de chaque fichier, **100 % requêtes préparées** (`$wpdb->prepare`), aucune interpolation
de variable SQL, `absint`/`sanitize_text_field` sur les entrées, UTC partout
(`Bebba_HF_DB::now()`), transactions obligatoires pour toute écriture multi-tables.

## 7. Activation & versionnage du schéma

- Hook `register_activation_hook` → `Bebba_HF_Activator::activate()` (squelette) :
  1. `dbDelta` des tables en syntaxe stricte WordPress (pas de backticks, un champ par
     ligne, `KEY` non nommé) — les 17 tables restantes du schéma BLOC 3 sont portées
     au LOT 1, révisées selon §3, préfixées via `$wpdb->prefix`.
  2. Clés étrangères posées par `ALTER TABLE ... ADD CONSTRAINT` direct APRÈS création
     de toutes les tables, dans l'ordre de dépendance, avec vérification préalable dans
     `information_schema.TABLE_CONSTRAINTS` (idempotent).
  3. Secret JWT généré si absent (option `bebba_hf_jwt_secret`, 64 car.) ; versionnage
     via option `bebba_hf_schema_version`.
  4. Seed : si aucun admin → `bebba_admin_XXXX` (rôle admin, mot de passe aléatoire
     conservé UNE fois dans une option non-autoloaded puis affiché/supprimé,
     `must_change_password = 1`).
- Hook `register_deactivation_hook` : aucune destruction de données.
- `uninstall.php` : purge uniquement sur confirmation explicite, jamais par défaut.

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
| Secret JWT absent/faible | option auto-générée 64 car. à l'activation ; constante `BEBBA_JWT_SECRET` prioritaire en prod ; jamais committé |
| Bruteforce login | rate limiting transient (5/15 min/IP) + erreurs génériques |
| Énumération de comptes | message unique « Identifiants invalides. » |
| Injection SQL | `$wpdb->prepare` systématique + revue Super Z à chaque lot |
| Fuite de passwordHash | `sanitize_user` en sortie de chaque endpoint + tests |
| Régression workflow statuts | portage strict de `isValidStatusTransition` + tests de transition (Phase 5) |
| Bruteforce register/track-lookup | rate limiting étendu à ces routes (transients, cf. spec §3.4) |
| Divergence schéma/BLOC 3 | ce doc = référence ; toute dérive → quarantaine `bebba_migration_quarantine` lors de la migration |
