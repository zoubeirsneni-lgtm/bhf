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
