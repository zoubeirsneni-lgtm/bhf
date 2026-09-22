# BEBBA — Feuille de route : migration vers plugin WordPress

> **Objectif** : porter BEBBA Healthy Food (React + Express + Firestore) vers un
> **plugin WordPress autonome** (`bebba-healthy-food`), avec un système d'utilisateurs
> bebba **totalement séparé** de WordPress (pas de `wp_users`, pas de rôles WP).
> Le front React existant est conservé et servi par le plugin.
> L'API Express actuelle est ré-implémentée en REST API WordPress (`/wp-json/bebba/v1/*`).
>
> **Référence détaillée** : spec de migration complète (PDF livré :
> `Spec_Migration_Plugin_WordPress_BEBBA.pdf` / source :
> `download/spec_migration_plugin_wordpress_bebba.md`).
> **Architecture / décisions** : `docs/ARCHITECTURE_PLUGIN_WP.md` (v1.1).

---

## Décisions fondatrices (gelées)

| # | Décision | Détail |
|---|----------|--------|
| D1 | Comptes bebba séparés | Table `bebba_users` dédiée. Aucune écriture dans `wp_users`. Aucun rôle WP. Aucun cookie WP utilisé par l'app. |
| D2 | Auth bebba | JWT HS256 (24 h, bcrypt cost 10, claim `tv` = token_version), émis par le plugin, transporté via `Authorization: Bearer`. Secret en option WP auto-générée ; constante `BEBBA_JWT_SECRET` prioritaire en prod. |
| D3 | API | Namespace REST `bebba/v1` — portage 1:1 des routes de `server.ts` (contrats JSON et messages d'erreur identiques). |
| D4 | Tables | Préfixe `bebba_*` devant le préfixe WP, InnoDB, utf8mb4. Base = schéma BLOC 3 (`mysql_schema_bebba.sql`) + delta fait foi `mysql_schema_delta_users.sql`. |
| D5 | Frontend | SPA React existante buildée (Vite, base relative), montée via shortcodes `[bebba_app]` / `[bebba_staff]`. Aucune gestion métier dans wp-admin. |
| D6 | Workflow statuts | Portage strict de `isValidStatusTransition` (aucun saut d'étape, aucun retour arrière). |
| D7 | PHP | Compatible PHP 8.1+, sans dépendance Composer (JWT pur PHP — classe `Bebba_HF_Auth`). |
| D8 | Création des tables | `dbDelta` syntaxe stricte WP + clés étrangères par `ALTER TABLE` direct (vérif `information_schema`, idempotent). |

## Révisions du schéma BLOC 3 (contradiction résolue)

1. **NOUVELLE TABLE `bebba_users`** — source de vérité unique des comptes (5 rôles),
   avec `token_version` et `must_change_password` (voir delta SQL).
2. `bebba_drivers` : suppression de la FK `wp_users` → la liaison devient
   `bebba_users.driver_id → bebba_drivers.id` (UNIQUE, 1:1).
3. `bebba_orders` : `wp_customer_id` → renommée `bebba_customer_id`, FK vers
   `bebba_users(id)`, NULL pour les invités.
4. Toutes les tables préfixées dynamiquement avec `$wpdb->prefix`.

## État des actifs déjà livrés (sessions précédentes)

- ✅ Squelette du plugin **fonctionnel** intégré au dépôt : `bebba-healthy-food/`
  (auth complète, rate limiting 5/15 min, token_version, seed admin, `/bebba/v1/health`,
  routes `/auth/*` — il ne crée pour l'instant que `bebba_users` + `bebba_counters`).
- ✅ Delta SQL fait foi : `mysql_schema_delta_users.sql`.
- ✅ Spec détaillée (phases, critères d'acceptation, checklist sécurité, 10 pièges WP).

## Phases (= lots de travail)

| Phase | Lot | Contenu | Statut |
|-------|-----|---------|--------|
| 0 | LOT 0 | Prérequis locaux : WP 6.4+ / PHP 8.1 / MySQL 8, branche `wordpress-migration`, déploiement du squelette | ✅ |
| 0+1 | LOT 1 | **Socle complet** : portage des 17 tables restantes (dbDelta) + FK ALTER, application du delta, achèvement auth (`password_needs_rehash`, `must_change_password`, `POST /auth/change-password`), tests d'isolation WP | ✅ |
| 2 | LOT 2 | Catalogue public + suivi public : GET categories/products/supplements, tracking par token, contrats camelCase conformes à `src/types.ts` | ✅ |
| 3 | LOT 3 | Création de commande (cœur transactionnel) : POST /orders, recalcul serveur des prix, stock + rollback, compteurs séquentiels, idempotence, annulation avec restauration | ✅ |
| 4 | LOT 4 | Back-office admin : CRUD catalogue/stock/fournisseurs/comptes/livreurs + stats | ✅ |
| 5 | LOT 5 | Flux cuisine et livreur : transitions de statut (matrice strict), assignation, encaissement, tests IDOR | 🚧 |
| 6 | LOT 6 | Intégration React : build Vite, shortcodes, `API_BASE`, pages WP, parcours bout-en-bout | ⏳ |
| 7 | LOT 7 | Reprise des données : import Firestore → tables plugin (hachages bcrypt préservés), runbook prod, recette finale + audit sécurité Super Z | ⏳ |

Chaque phase a ses **critères d'acceptation détaillés dans la spec** (§10) — ils font foi.

## Règles de collaboration (chaque lot)

1. Super Z rédige `docs/INSTRUCTIONS_LOT_<n>.md` (auto-porteur : contexte + tâches + critères d'acceptation + format du rapport).
2. Zoubeir transfère les instructions à Claude Code (local).
3. Claude Code exécute, teste, commite (`feat(lot-N): ...`), rédige son rapport.
4. Zoubeir remet à Super Z : le rapport + les commits + les fichiers clés modifiés.
5. Super Z relit, valide ou corrige → `docs/REVIEW_LOT_<n>.md` → lot suivant.
6. Chaque agent append sa section dans `worklog.md` (jamais de réécriture).

## Définition de "terminé" (global)

- Toutes les fonctionnalités de `server.ts` disponibles sous `/wp-json/bebba/v1/*` avec le même comportement.
- 4 interfaces opérationnelles (client, cuisine, livreur, admin) servies par le plugin.
- Zéro dépendance à `wp_users`/`wp_roles` pour l'app bebba (vérifiable : les tables WP restent inchangées pendant tous les tests).
- Audit sécurité Super Z sans critique bloquante.
- Migration des données Firestore effectuée et vérifiée (dry-run puis réel), connexions migrées sans reset de mot de passe.
