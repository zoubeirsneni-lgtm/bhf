# Squelette plugin — BEBBA Healthy Food

## Installation locale (test)

1. Copier le dossier `bebba-healthy-food/` dans `wp-content/plugins/`.
2. Activer le plugin dans l'administration WordPress.
3. Noter les identifiants admin bebba affiches dans la notice (uniques).
4. Verifier : `GET https://<site>/wp-json/bebba/v1/health` doit repondre
   `{ "ok": true, "version": "0.1.0", "db": true, ... }`.

## Contenu du squelette

| Fichier | Role |
|---|---|
| `bebba-healthy-food.php` | En-tete plugin, constantes, chargement |
| `includes/class-bebba-plugin.php` | Bootstrap (REST, shortcodes, notice, no-cache) |
| `includes/class-bebba-activator.php` | Tables dbDelta + secret JWT + compte admin semé |
| `includes/class-bebba-auth.php` | JWT HS256, bcrypt, RBAC, anti-force-brute, telephone |
| `includes/class-bebba-db.php` | Acces $wpdb prepare, transactions, compteurs |
| `api/class-bebba-rest.php` | Routes /bebba/v1 (health + auth) + carte des routes suivantes |
| `shortcodes/class-bebba-shortcodes.php` | [bebba_app] / [bebba_staff] |
| `uninstall.php` | Purge tables + options |

## A faire par phase (spec de migration)

- **Phase 0** : porter les 17 tables restantes de `mysql_schema_bebba.sql` dans
  `class-bebba-activator.php` (syntaxe dbDelta) + delta `bebba_schema_delta_users.sql`.
- **Phase 1** : completer auth (must_change_password, tests bcryptjs $2b$).
- **Phases 2-5** : declarer les routes selon la carte dans `api/class-bebba-rest.php`.
- **Phase 6** : poser le build React dans `public/assets/` (base Vite `./`).

## Regles non negociables

1. Les comptes bebba vivent dans `bebba_users` — jamais `wp_users`.
2. `$wpdb->prepare` sur toute requete parametree.
3. `permission_callback` explicite sur chaque route REST.
4. Aucun `password_hash` dans les reponses.
5. Secrets generes a l'activation, jamais committés.
