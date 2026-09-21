# RAPPORT LOT 2 — Catalogue public + suivi public (v0.2.0)

> **Auteur du code** : Super Z (Option A) · **Branche** : `wordpress-migration`
> **Date** : 2026-09-21

---

## 1. Périmètre porté

Portage 1:1 des routes **publiques** de `server.ts` (décision D3), namespace `/wp-json/bebba/v1` :

| Route Express d'origine | Route plugin | Statut |
|---|---|---|
| GET `/api/categories` (+ `?activeOnly=true` / `?active=true`) | GET `/categories` | ✓ |
| GET `/api/categories/:id` | GET `/categories/{id}` | ✓ |
| GET `/api/products` (+ `categoryId`, `activeOnly/active`, `availableOnly/available`) | GET `/products` | ✓ |
| GET `/api/products/:id` | GET `/products/{id}` | ✓ |
| GET `/api/supplements` (+ filtres) | GET `/supplements` | ✓ |
| GET `/api/supplements/:id` | GET `/supplements/{id}` | ✓ |
| GET `/api/orders/track/:token` (+ `/api/orders/track?token=`) | GET `/orders/track/{token}` + `/orders/track` | ✓ |
| POST `/api/orders/track-lookup` (rate limit 5 échecs/10 min) | POST `/orders/track-lookup` | ✓ |

## 2. Fichiers

```
Nouveau  bebba-healthy-food/includes/class-bebba-catalog.php   (métier catalogue + tracking, ~560 l.)
Modifié  bebba-healthy-food/api/class-bebba-rest.php           (8 routes + 11 handlers)
Modifié  bebba-healthy-food/bebba-healthy-food.php             (version 0.2.0 + require)
Nouveau  docs/demo_seed_lot2.sql                               (données de démonstration)
Nouveau  docs/demo_cleanup_lot2.sql                            (purge des données de démo — pour LOT 7)
```

## 3. Décisions d'implémentation

1. **IDs « métier » en chaîne** : le front React (D5, conservé) manipule des IDs **string** Firestore
   (`src/types.ts : id: string`). Chaque réponse expose donc `id` = `legacy_id` (ID Firestore conservé
   par la migration LOT 7), sinon l'ID numérique en chaîne. Le champ `legacyId` (numérique d'origine)
   reste exposé. Les filtres `?categoryId=` acceptent les deux formes ; les ressources `:id` aussi
   (`WHERE legacy_id = X OR id = X`).
2. **Format d'erreur Express `{"error": "..."}`** pour les routes publiques (identique à server.ts,
   messages exacts inclus : « Catégorie non trouvée. », « Lien de suivi invalide ou commande
   introuvable. », etc.).
3. **Enrichissements 1:1** : `hasInactiveIngredient` (produits, via jointure ingredients) ;
   `ingredientActive` (suppléments, LEFT JOIN ingredients) ; `customization` reconstituée depuis
   `bebba_product_options` (allowsXChoice = présence d'options du type X).
4. **Dates ISO 8601 UTC** (`T...Z`) — identique à `toISOString()` de l'ancienne API ; les
   millisecondes de `status_history.timestamp` (DATETIME(3)) sont préservées.
5. **Rate limit track-lookup** : 5 échecs / fenêtre 10 min par IP (transients WP), blocage 10 min,
   message 429 avec minutes restantes — même sémantique que `lookupRateLimiter` de server.ts.
   Un succès réinitialise le compteur.
6. **Confidentialité du tracking** : masquage nom (`Prénom N.`), téléphone (`+216 xx ••• •yy`),
   adresse (`••••••, quartier`) et prénom livreur révélé **uniquement** en `delivering`/`delivered`
   — portage strict des fonctions `mask*` / `formatSafeDriverName`.
7. **Performance** : relations produits chargées en 3 requêtes groupées (pas de N+1).
8. **Version plugin 0.2.0** : le champ `version` du `/health` sert de preuve visuelle de déploiement.

## 4. Critères d'acceptation (à exécuter côté utilisateur)

> Pré-requis : plugin v0.2.0 activé + `demo_seed_lot2.sql` importé dans `bebba_bhf`.
> Commande type (Windows) : `cmd.exe /c "curl -s http://localhost/bebbabhf/wp-json/bebba/v1/categories"`

1. GET `/health` → `"version":"0.2.0"`
2. GET `/categories` → tableau de 2 catégories (Bowls avant Jus)
3. GET `/categories?activeOnly=true` → 2 catégories
4. GET `/categories/cat-bowls` → objet unique `slug:"bowls"`
5. GET `/categories/99999` → 404 `{"error":"Catégorie non trouvée."}`
6. GET `/products` → 2 produits, `baseIngredients` et `customization` remplis
7. GET `/products?categoryId=cat-bowls` → 1 produit (Poulet Bowl)
8. GET `/products/prod-chicken-bowl` → détail avec 4 `baseIngredients`, 2 `proteinOptions`
9. GET `/supplements` → 2 suppléments avec `ingredientActive:true`
10. GET `/supplements?availableOnly=true` → 2
11. GET `/supplements/xxx` → 404 `{"error":"Supplément non trouvé."}`
12. GET `/orders/track/abc` → 404 (token trop court)
13. GET `/orders/track/tk_inconnu_long` → 404 `Lien de suivi invalide ou commande introuvable.`
14. POST `/orders/track-lookup` `{}` → 400
15. POST `/orders/track-lookup` `{"orderNumber":"1100","phone":"21612345678"}` → 404 (aucune commande)
16. Isolation WP : `wp_users` inchangé pendant tous les tests

## 5. Limites connues / suite

- Les tables `bebba_orders` sont vides : le tracking renverra 404 jusqu'au LOT 3 (création de
  commandes) puis LOT 7 (reprise des vraies commandes Firestore).
- Les routes `POST/PUT/DELETE` du catalogue (back-office) sont réservées au LOT 4.
