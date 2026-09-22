# BEBBA — RAPPORT LOT 4 : back-office admin (plugin v0.4.2)

> **CORRECTION 1 (v0.4.1)** — après le 1er passage du harnais (4 PASS / 51 FAIL) :
> la route `/auth/login` déclarait `identifier` + `mode` en `required => true`, ce qui
> rejetait le contrat Express d'origine `{username?, phone?, password}` (server.ts
> l.81-106) avant même que le handler de compatibilité ne s'exécute
> (`rest_missing_callback_param`). Les 51 FAIL n'étaient qu'une cascade de ce rejet
> (tokens jamais obtenus -> ids vides -> `rest_no_route` sur les PUT/DELETE dont les
> routes existent bien). Fix : `identifier`/`mode` optionnels, `username`/`phone`
> déclarés (contrat legacy documenté), `password` reste requis. Le harnais passe en
> rev 2 (T1 attend 0.4.1, téléphone client aléatoire, pré-nettoyage idempotent des
> restes d'un passage avorté).
>
> **CORRECTION 2 (v0.4.2)** — après le 2e passage (50 PASS / 5 FAIL, plugin 0.4.1) :
> (1) T1 : l'ancien harnais rev 1 tournait encore à la racine WP (bien remplacer le
> fichier à chaque pack) ; (2) T12a : le harnais envoyait `ing-legumes` (unité g en
> seed) en attendant `ml` — le test utilise désormais `ing-sauce-yaourt` (Sauce
> yaourt, ml), conformément à son intention (résolution de l'unité) ; (3) T17k/T18a :
> le harnais créait la commande invitée sur `prod-poulet-bowl` qui n'existe pas (seed
> : `prod-chicken-bowl`) — corrigé, la commande existe donc l'assignation au livreur
> fonctionne et `todayOrdersCount` remonte ; (4) T18c : **vrai bug plugin** —
> `users.phone` est UNIQUE (`uk_bebba_users_phone`) et `create_user` insérait `''`
> pour un staff sans téléphone : le 2e compte créé sans phone (readonly, après
> kitchen) violait l'unicité en silence → login 401. Fix : insérer `NULL` (colonne
> nullable, NULL multiples autorisés) — Express/Firestore n'a pas cette contrainte.
> Le harnais passe en rev 3 (T1 attend 0.4.2).
>
> **CORRECTION 3 (harnais rev 4 — plugin 0.4.2 INCHANGÉ)** — après le 3e passage
> (53 PASS / 2 FAIL) : la trace `order=400` (ajoutée en rev 3) a localisé la cause —
> le payload de la commande invitée du harnais utilisait `client.'address'` alors
> que le moteur (comme Express, server.ts l.927) lit `client.'deliveryAddress'` :
> adresse vide → POST /orders 400 → aucune commande → pas d'assignation au livreur
> (T17k) et `todayOrdersCount` à 0 (T18a). Payload réaligné sur le harnais LOT 3
> (30/30) : `deliveryAddress` + `notes`, sans `paymentMethod`. Le détail de T17k
> affiche désormais aussi le message d'erreur de la création de commande.

Branche : `wordpress-migration` · Précédent : LOT 3 clôturé (v0.3.1, 30 PASS / 0 FAIL)

## 1. Périmètre livré

Portage 1:1 des **29 routes admin** de `server.ts` vers `/wp-json/bebba/v1/*`,
dans un nouveau fichier `includes/class-bebba-admin.php` (~1 380 lignes) :

| Domaine | Routes | Rôles autorisés |
|---|---|---|
| Catégories | POST, PUT /:id, DELETE /:id | admin |
| Produits | POST, PUT /:id, DELETE /:id (relations réécrites) | admin |
| Suppléments | POST, PUT /:id, DELETE /:id | admin |
| Ingrédients | GET, POST, PUT /:id | admin + kitchen |
| Ingrédients | DELETE /:id | admin |
| Stock | POST /ingredients/:id/stock | admin + kitchen |
| Mouvements | GET /stock-movements | admin + admin_readonly |
| Fournisseurs | GET, POST, PUT /:id, DELETE /:id | admin |
| Livreurs | GET | admin + kitchen |
| Livreurs | POST, PUT /:id, PATCH /:id/status, PATCH /:id/password, DELETE /:id | admin |
| Utilisateurs | GET, POST | admin |
| Stats | GET /stats | admin + admin_readonly |
| Reset | POST /reset-demo-data | admin |

Les GET catalogue publics existants (categories/products/supplements) sont inchangés.

## 2. Fidélité aux contrats Express

- **Messages d'erreur EXACTS** de `server.ts`/`db.ts`, apostrophes typographiques
  comprises (`Le nom d’utilisateur (identifiant) est obligatoire.`,
  `Ce nom d’utilisateur est déjà utilisé.`, `Impossible de supprimer cette catégorie
  car des produits y sont rattachés.`, protection de suppression livreur/ingrédient…).
- **Formats camelCase de `src/types.ts`** : Ingredient, StockMovement, Supplier
  (+ suppliedIngredients décodé du JSON), Driver (+ username via jointure), SafeUser,
  DashboardStats (7 compteurs de statut, top 5 produits, jour = UTC comme `toISOString`).
- **Comportements** : slug auto (`[^a-z0-9]+ → '-'`), icône par défaut `Utensils`,
  image produit par défaut Unsplash, `sortOrder = sortOrder ?? order ?? 10`,
  `quantityConsumed = quantityConsumed ?? quantity ?? 100`, arrondi prix 0.1,
  `performedBy = "Nom (Admin|Cuisine)"`, suppression catégorie protégée si produits,
  suppression ingrédient : interdite si actif + 4 motifs de référence (recettes,
  suppléments, commandes via la fiche de préparation, mouvements),
  suppression livreur : interdite si commandes historiques, création livreur
  **atomique** (livreur + compte bcrypt cost 10 en transaction), PUT/POST suppliers
  en 200 (pas 201, comme l'original).
- POST /products réécrit intégralement `product_ingredients` / `product_options` /
  `product_supplements` en transaction (équivalent du `setDoc` du document complet).

## 3. Décisions et adaptations (documentées)

1. **Identifiants des nouvelles entités** : `legacy_id` générés sur le motif Express
   (`cat-`/`prod-`/`sup-`/`ing-` + Date.now() ; `drv-...-xxxx` et `mov-...-xxxx`
   avec suffixe aléatoire). Le contrat du plugin est conservé : l'ID métier exposé
   = `legacy_id` sinon id numérique en chaîne. Les comptes créés (users) restent
   sans legacy_id (ids numériques, cohérent avec `/auth/*`).
2. **ENUM MySQL strictes** : `movement_type` de stock invalide → 400
   `Type de mouvement de stock invalide.` ; rôle hors des 5 rôles → 400
   `Rôle invalide.` (Express acceptait tout ; MySQL refuse — messages dédiés).
3. **Reset mot de passe livreur** : en plus du 1:1 Express, `token_version` est
   incrémenté → tous les anciens JWT du livreur sont révoqués (cohérent avec
   `change-password` du plugin, sécurité renforcée).
4. **reset-demo-data adapté** : vérifications défensives (catalogue non vide, au
   moins un admin), purge transactionnelle des commandes/lignes/fiches/mouvements/
   clés d'idempotence, clients + comptes livreurs liés supprimés, **catalogue et
   comptes staff préservés**, stocks des 5 ingrédients de la seed LOT 2 restaurés,
   compteur `orders` ramené à 1100 (prochaine commande = BEBBA-1101), réponse dans
   la forme d'origine (deletedCounts/preservedCounts/nextOrderSeq + limitationNotice).

## 4. Sécurité

- Chaque route déclare un `permission_callback` explicite (matrice de rôles
  ci-dessus) ; double vérification dans le handler (401/403 propagés).
- Aucune sortie de `password_hash` (safe_user partout) ; entrées préparées
  (`$wpdb->prepare`, valeurs NULL gérées par des helpers dédiés).
- Transactions InnoDB (begin/commit/rollback) sur produits (relations), stock,
  livreurs, reset.
- Isolation `wp_users` vérifiée par le harnais (comptage inchangé).

## 5. Harnais `tests/bebba-test-lot4.php` — 55 tests

Exécution depuis la racine WP (comme LOT 3). Crée ses propres comptes (admin de
test via `$wpdb` puis REST uniquement), puis : login/RBAC (403 client, 401 sans
droit), CRUD complet des 4 familles d'entités avec relectures en base, stock +500
vérifié en base + mouvement tracé, rôle cuisine autorisé sur le stock, livreurs
(compte atomique, désactivation → login 401, reset mot de passe → ancien token
révoqué + nouveau login OK, protection historique via commande simulée, suppression
propre), stats (7 compteurs, readonly en lecture seule vérifié), reset-demo-data
(compteur 1100, stocks 8000/3000, purge), isolation wp_users.
**Le harnais FINIT par reset-demo-data** : les commandes de démonstration
précédentes (y compris LOT 3) sont supprimées, stocks et compteur restaurés.
Les 3 comptes staff de test sont supprimés en fin d'exécution.

## 6. Critères d'acceptation

1. `/bebba/v1/health` affiche `"version":"0.4.2"`.
2. Le harnais affiche **55 PASS / 0 FAIL**.
3. Après le harnais : compteur = 1100, stocks seed restaurés, aucun client/livreur
   résiduel, catalogue intact.
4. `wp_users` inchangé pendant toute la session de test.
