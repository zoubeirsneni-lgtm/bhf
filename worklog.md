# BEBBA — Journal de travail partagé (worklog)

> **Protocole** : ce fichier est la mémoire du projet entre les sessions (Super Z ↔ Claude Code ↔ Zoubeir).
> Chaque agent ajoute SA section À LA FIN, sans jamais modifier les sections précédentes.
> Format : `---` / `Task ID:` / `Agent:` / `Task:` / `Work Log:` / `Stage Summary:`

---
Task ID: 1
Agent: Super Z (architecte & revue)
Task: Cartographier le dépôt bhf et cadrer la migration vers plugin WordPress

Work Log:
- Clonage et lecture du dépôt `https://github.com/zoubeirsneni-lgtm/bhf` (branche main, HEAD 9e9ae3f)
- Analyse de la stack : React 19 + Vite + TS (SPA), Express (server.ts, 1295 lignes, ~50 routes REST), JWT 24h, bcryptjs, Firestore actuel + db.json local
- Analyse de `src/types.ts` : entités complètes (Category, Product, Ingredient, StockMovement, Supplement, Order, OrderItem, Supplier, Driver, User, rôles client/kitchen/driver/admin/admin_readonly)
- Analyse de `server/auth.ts` : JWT HS256, bcrypt cost 10, authenticateUser (Bearer), requireRole, isValidStatusTransition (workflow strict des statuts commande)
- Analyse de `server.ts` login : clients par téléphone (normalisation 8 derniers chiffres), staff par username, réponses génériques anti-énumération
- Lecture de `mysql_schema_bebba.sql` (BLOC 3 gelé, 18 tables bebba_*) : ⚠️ contient un mapping User → wp_users (bebba_drivers.user_id FK wp_users, bebba_orders.wp_customer_id)
- Constat : ce mapping CONTRADICT la nouvelle exigence → révision architecturale nécessaire
- Découverte du workflow .opencode précédent (prompts/skills d'audit BLOC 1-5)

Stage Summary:
- Décision d'architecture actée : table `bebba_users` DÉDIÉE, zéro dépendance à wp_users/wp_roles/wp_auth
- 3 modifications du schéma BLOC 3 documentées dans docs/ARCHITECTURE_PLUGIN_WP.md
- Livrables produits : ROADMAP.md, docs/ARCHITECTURE_PLUGIN_WP.md, docs/INSTRUCTIONS_LOT_1.md
- Prochaine étape : exécution du LOT 1 par Claude Code (socle plugin + schéma + auth)

---
Task ID: 1-b
Agent: Super Z (architecte & revue)
Task: Réconcilier les livrables de la session perdue avec le nouveau cadrage et rédiger les instructions LOT 1

Work Log:
- Découverte des livrables antérieurs dans download/ : spec de migration complète (PDF+md), squelette plugin fonctionnel (bebba-plugin-skeleton.zip), delta SQL (bebba_schema_delta_users.sql)
- Inspection du squelette : auth JWT complète avec token_version, rate limiting 5/15 min, seed admin bebba_admin_XXXX, /bebba/v1/health, routes /auth/*, dbDelta (2 tables créées seulement)
- Alignement effectué : nom du plugin = bebba-healthy-food, DDL bebba_users = delta SQL (fait foi), création de tables = dbDelta + FK ALTER, secret JWT = option WP auto-générée (constante prioritaire en prod)
- Squelette intégré au dépôt (bebba-healthy-food/) + delta SQL (mysql_schema_delta_users.sql)
- Mise à jour ARCHITECTURE_PLUGIN_WP.md en v1.1 (alignée squelette + delta)
- Réécriture de ROADMAP.md (8 phases alignées sur la spec, état des actifs livrés)
- Réécriture de docs/INSTRUCTIONS_LOT_1.md : portage des 17 tables restantes + achèvement auth (password_needs_rehash, must_change_password, /auth/change-password) + 12 critères d'acceptation

Stage Summary:
- Source de vérité unique : ARCHITECTURE v1.1 + delta SQL + spec (phases/critères)
- LOT 1 prêt à transférer à Claude Code : docs/INSTRUCTIONS_LOT_1.md
- Dépôt commité localement (docs + squelette + delta SQL) — push à faire depuis la machine de Zoubeir

---
Task ID: LOT-1
Agent: Claude Code
Task: Lot 1 — Socle complet du plugin bebba-healthy-food : 17 tables, auth avancée, tests d'acceptation

Work Log:
- Branche créée : wordpress-migration depuis main (commit 820bc08)
- T1 (class-bebba-activator.php) : 17 tables ajoutées en syntaxe dbDelta stricte, FK posées par ALTER TABLE après dbDelta avec vérification idempotente dans information_schema.TABLE_CONSTRAINTS. Révisions R1 (bebba_drivers sans user_id, uniquement legacy_user_id), R2 (bebba_orders avec bebba_customer_id FK bebba_users), R3 (toutes les tables prefixées via $wpdb->prefix). Ordre de création respecté des dépendances. InnoDB utf8mb4_unicode_ci. Option bebba_hf_schema_version mis à jour à 0.2.0. uninstall.php étendu aux 20 tables.
- T2 (class-bebba-auth.php + class-bebba-rest.php) : password_needs_rehash actif dans login (rehash transparent vers bcrypt cost 10), must_change_password exposé dans safe_user() comme mustChangePassword, nouvel endpoint POST /auth/change-password (authentifié Bearer, currentPassword vérifié → 401 si faux, newPassword min 8 car., hachage + reset must_change_password + incrémentation token_version + nouveau JWT), rate limit sur change-password (5/15min).
- T3 (qualité) : php -l sans erreur sur 8 fichiers PHP, grep wp_users/wp_insert_user/wp_authenticate/is_user_logged_in/wp_set_current_user/wp_signon/add_role → aucun résultat dans le métier (hors commentaires). ABSPATH check présent dans tous les fichiers PHP. Requêtes paramétrées via $wpdb->prepare, entiers via absint().
- Tests d'acceptation (12) exécutés via cmd.exe curl côté Windows (WSL→Windows port 80) :
  1. Activation sans erreur : /bebba/v1/health répond 200 ✓
  2. 20 tables bebba_* présentes ✓ (information_schema)
  3. Aucune référence wp_users dans le DDL (0 FK vers wp_users) ✓
  4. /bebba/v1/health répond sans auth ✓
  5. WP admin cookie → /auth/me → 401 (séparation prouvée) ✓
  6. 6 échecs login → 429 ✓ (rate limit 5/15min)
  7. password_hash n'apparaît dans AUCUNE réponse ✓
  8. Hash bcrypt $2y$ cost 10 vérifiable (admin hash commence par $2y$) ✓
  9. Inscription client OK (JWT émis, mustChangePassword:false) ✓
  10. must_change_password=1 → login expose mustChangePassword:true → change-password OK → nouveau token + flag=false ✓
  11. wp_users count=1, wp_user_roles inchangé ✓
  12. change-password avec mauvais currentPassword → 401 ✓
- Déploiement : rsync bebba-healthy-food/ vers /mnt/c/wamp64/www/bebbabhf/wp-content/plugins/bebba-healthy-food/

Stage Summary:
- LOT 1 complet : 3 commits feat(lot-1): T1 (17 tables), T2 (auth avancée), T3 (qualité)
- 20 tables bebba_* créées, InnoDB, préfixées wp_, FK isolées (0 vers wp_users)
- Auth bebba 100% fonctionnelle (JWT HS256, bcrypt, RBAC, rate limiting, token_version)
- 12/12 critères d'acceptation validés
- wp_users et wp_user_roles strictement inchangés
- À faire : rapport final à remettre à Super Z

