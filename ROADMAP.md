# BEBBA — Feuille de route : migration vers plugin WordPress

> **Objectif** : porter BEBBA Healthy Food (React + Express + Firestore) vers un
> **plugin WordPress autonome** (`bebba-core`), avec un système d'utilisateurs bebba
> **totalement séparé** de WordPress (pas de `wp_users`, pas de rôles WP).
> Le front React existant est conservé et servi par le plugin.
> L'API Express actuelle est ré-implémentée en REST API WordPress (`/wp-json/bebba/v1/*`).

---

## Décisions fondatrices (gelées)

| # | Décision | Détail |
|---|----------|--------|
| D1 | Comptes bebba séparés | Table `bebba_users` dédiée. Aucune écriture dans `wp_users`. Aucun rôle WP. Aucun cookie WP utilisé par l'app. |
| D2 | Auth bebba | JWT HS256 (24 h, bcrypt cost 10), émis par le plugin, transporté via `Authorization: Bearer`. Secret obligatoire : `BEBBA_JWT_SECRET` dans `wp-config.php`. |
| D3 | API | Namespace REST `bebba/v1` — portage 1:1 des routes de `server.ts`. |
| D4 | Tables | Préfixe `bebba_*` (devant le préfixe WP), moteur InnoDB, utf8mb4. Base = schéma BLOC 3 existant + 3 révisions (voir architecture doc). |
| D5 | Frontend | SPA React existante buildée (Vite, base relative), montée via shortcode `[bebba_app]`. Aucune gestion métier dans wp-admin. |
| D6 | Workflow statuts | Portage strict de `isValidStatusTransition` (aucun saut d'étape, aucun retour arrière). |
| D7 | PHP | Compatible PHP 8.0+, sans dépendance Composer (JWT auto-implémenté en pur PHP). |

## Révisions du schéma BLOC 3 (contradiction résolue)

1. **NOUVELLE TABLE `bebba_users`** — source de vérité unique des comptes (client, kitchen, driver, admin, admin_readonly).
2. `bebba_drivers` : suppression de `user_id`/FK `wp_users` → la liaison devient `bebba_users.driver_id → bebba_drivers.id` (UNIQUE, 1:1).
3. `bebba_orders` : `wp_customer_id` → renommée `bebba_customer_id`, FK vers `bebba_users(id)`, NULL pour les invités.

## Phases

| Phase | Lot | Contenu | Statut |
|-------|-----|---------|--------|
| 0 | LOT 0 | Prérequis locaux : WP 6.4+ / PHP 8.1 / MySQL 8, branche `wordpress-migration`, dossier plugin | ⏳ |
| 1 | LOT 1 | **Socle plugin** : bootstrap, schéma complet (18+1 tables), JWT + bcrypt, endpoints `/auth/*`, rate-limit login, seed admin | ⏳ |
| 2 | LOT 2 | Catalogue : CRUD catégories, produits (+customisation), suppléments, lecture publique | ⏳ |
| 3 | LOT 3 | Stock & achats : ingrédients, mouvements de stock, fournisseurs | ⏳ |
| 4 | LOT 4 | Commandes : création publique, suivi token, workflow statuts, assignation livreur, paiement, commandes client | ⏳ |
| 5 | LOT 5 | Administration bebba : CRUD utilisateurs (4 rôles), stats dashboard, reset données démo | ⏳ |
| 6 | LOT 6 | Frontend : build Vite, shortcode, enqueue assets, adaptation baseURL API, tests UI | ⏳ |
| 7 | LOT 7 | Sécurité & QA : audit OWASP du plugin, rate limiting global, durcissement CORS, tests bout-en-bout par rôle | ⏳ |
| 8 | LOT 8 | Migration données : Firestore → MySQL via migrateur BLOC 5B adapté, puis déploiement en ligne | ⏳ |

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
- Migration des données Firestore effectuée et vérifiée (dry-run puis réel).
