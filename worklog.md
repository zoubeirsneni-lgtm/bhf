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
