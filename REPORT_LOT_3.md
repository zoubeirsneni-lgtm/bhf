# RAPPORT LOT 3 — Passage de commande transactionnel (v0.3.0)

> **Auteur du code** : Super Z (Option A) · **Branche** : `wordpress-migration`
> **Date** : 2026-09-22

---

## 1. Périmètre porté

Portage 1:1 des routes **commandes client** de `server.ts` + `server/db.ts` (création transactionnelle incluse) :

| Route Express d'origine | Route plugin | Statut |
|---|---|---|
| POST `/api/orders` (invité + client authentifié, idempotence stricte) | POST `/orders` | ✓ |
| GET `/api/orders/:id` (admin/kitchen/driver/client + IDOR) | GET `/orders/{id}` | ✓ |
| GET `/api/client/orders` (client) | GET `/client/orders` | ✓ |

Les transitions de statut (`PATCH /orders/:id/status`, assign-driver, payment) restent en PHASE 5
conformément à la carte des routes. Le tracking public (`/orders/track...`, LOT 2) fonctionne dès
maintenant avec les commandes réellement créées.

## 2. Fichiers

```
Nouveau  bebba-healthy-food/includes/class-bebba-orders.php   (moteur transactionnel, ~800 l.)
Modifié  bebba-healthy-food/api/class-bebba-rest.php           (3 routes + 3 handlers + order_error)
Modifié  bebba-healthy-food/includes/class-bebba-catalog.php   (get_product_full : produit + row brute)
Modifié  bebba-healthy-food/bebba-healthy-food.php             (version 0.3.0 + require orders)
Normalisé (whitespace) : catalog + rest + main passés en tabulations comme le reste du plugin
```

## 3. Garanties transactionnelles (identiques à l'original)

1. **Prix = autorité serveur** : `basePrice` + options (résolues contre `bebba_product_options`,
   comparaison insensible à la casse) + suppléments (résolus contre `bebba_supplements`).
   Les prix envoyés par le client sont ignorés — seule la structure (labels, quantités) est lue.
2. **Transaction MySQL** (`START TRANSACTION` / `COMMIT` / `ROLLBACK`) couvrant : commande,
   lignes, suppléments de lignes, fiche de préparation, historique de statut, décrément stock,
   mouvements de stock, clé d'idempotence. Toute erreur = ROLLBACK total, zéro trace partielle.
3. **Toutes les lectures avant la première écriture** (comme la transaction Firestore) :
   produits, relations, suppléments, ingrédients — puis calcul, puis écritures.
4. **Stock strict** : cumul par ingrédient sur TOUTE la commande, arrondi 0.1 ; si manque → 409
   `Stock insuffisant : <nom> (requis : X g, disponible : Y g, manquant : Z g), ...` + `details[]`
   au format exact `InsufficientStockDetail`.
5. **Numérotation** : compteur `orders` verrouillé `SELECT ... FOR UPDATE`, initialisé paresseusement
   à 1100 → 1ʳᵉ commande = **BEBBA-1101** (équivalent `nextOrderSeq: 1101`), puis 1102, ...
6. **Idempotence** (header `Idempotency-Key`) :
   - même clé + même émetteur (`client:{id}` ou `guest:{tel8}`) + même hash canonique SHA-256
     (portage `buildDeterministicOrderHash` : items triés, suppléments triés, adresse/téléphone normalisés)
     → **200** avec la commande existante (aucun doublon, compteur non consommé) ;
   - même clé + autre émetteur → **403** ; même clé + contenu différent → **422** ;
   - course concurrente (double-clic) : collision d'unicité capturée → la 2ᵉ requête renvoie
     proprement la commande de la 1ʳᵉ (200).
7. **Anti-spoofing** : le champ `clientId` du body est **totalement ignoré** ; seul un jeton
   Bearer valide (rôle `client` actif) rattache la commande à un compte (`bebba_customer_id`).
8. **IDOR** (GET `/orders/{id}`) : livreur → uniquement ses commandes assignées ; client →
   uniquement les siennes ; admin/admin_readonly → toutes ; kitchen → toutes (comme l'original).
9. **Format de réponse 1:1** avec `Order` de `src/types.ts` (items, preparationSheet, statusHistory,
   masques non appliqués ici — le tracking public les applique déjà côté LOT 2) et erreurs
   `{"error": "...", "details"?}` (forme Express, cohérente avec le LOT 2).
10. **Traçabilité** : snapshots (noms produits/suppléments/ingrédients), `options_raw_json`,
    `summary_lines_json`, fiche de préparation par ligne (`total_quantity` = qté × unitaire),
    mouvements `order_consumption` négatifs signés, `performed_by` = `Système BEBBA`.

## 4. Écarts documentés (volontaires)

- **Suppléments dupliqués dans une même ligne** : fusionnés (somme des quantités) avant calcul —
  la table `bebba_order_item_supplements` a une clé unique (order_item_id, supplement_legacy_id) ;
  l'original accumulait l'ingrédient mais écrivait des lignes dupliquées.
- **`SystemNotReadyError` non porté** : pas d'état « migration en cours » dans le plugin (le flag
  Firestore `meta/system` n'a pas d'équivalent ; sera couvert par la maintenance LOT 7 si besoin).
- **Supplément inconnu d'un item** : ignoré silencieusement (1:1 avec l'original).
- **`stock_quantity` NULL** traité comme 0 (bloque la commande si un ingrédient requis n'a pas
  de stock connu — décision conservatrice ; à confirmer au LOT 7 avec les vraies données).

## 5. Critères d'acceptation (à exécuter côté utilisateur)

> Pré-requis : plugin v0.3.0 activé + seed LOT 2 importé (stocks : poulet 8000 g, légumes 12000 g,
> riz 6000 g, quinoa 3000 g, sauce 2500 ml). Les commandes curl se font dans cmd (règle LOT 2).

**A. Commande invité complète (la référence)**

1. POST `/orders` avec body :
   ```json
   {"client":{"name":"Zoubeir Test","phone":"+216 22 333 444","deliveryAddress":"12 rue du Lac, Tunis","notes":"Sans oignons"},
    "items":[{"productId":"prod-chicken-bowl","quantity":1,
      "proteinOption":{"label":"Portion sportive (+100g)"},
      "veggiesOption":{"label":"Double légumes (+50g)"},
      "baseChoice":{"label":"Base quinoa"},
      "supplements":[{"id":"sup-poulet-extra","quantity":1}],
      "specialInstructions":"Bien croustillant"}]}
   ```
   → **201** avec : `orderNumber:"BEBBA-1101"`, `trackingToken:"tk_..."`, `subtotal:23.5`,
   `deliveryFee:2.5`, `totalAmount:26`, `status:"received"`, `paymentStatus:"to_collect"`,
   `stockConsumed:true`, `clientId:null`, 1 item `unitPrice:23.5`,
   `preparationSheet.summaryLines` = 4 lignes (Poulet fermier 350 g, Légumes frais 130 g,
   Quinoa royal aux graines 100 g, Sauce yaourt 30 ml) + ligne `⚠️ NOTE CLIENT`.
2. **phpMyAdmin** : `wp_bebba_ingredients` → poulet 7650.00, légumes 11870.00, riz 6000.00
   (inchangé — substitution quinoa), quinoa 2900.00, sauce 2470.00 ;
   `wp_bebba_stock_movements` → 4 lignes `order_consumption` (−350, −130, −100, −30) ;
   `wp_bebba_counters` → ligne `orders` = 1101.

**B. Idempotence**

3. Même requête avec header `Idempotency-Key: test-key-1` → **201** BEBBA-1102.
4. Re-jouer EXACTEMENT la même requête + même clé → **200** (même `orderNumber` BEBBA-1102,
   aucune 2ᵉ commande, compteur resté à 1102).
5. Même clé + autre émetteur (sans le même téléphone) → **403**.
6. Même clé + même émetteur + 1 item modifié → **422**.

**C. Validation & stock**

7. POST `{"client":{...},"items":[]}` → 400 `Le panier est vide.`
8. POST sans `deliveryAddress` → 400 `Veuillez renseigner le nom, téléphone et adresse de livraison.`
9. `productId:"inconnu"` → 400 `Produit #inconnu introuvable.`
10. `proteinOption:{"label":"Option pirate"}` → 400 `L'option de portion de protéine "Option pirate" n'est pas autorisée pour le plat "Poulet Bowl".`
11. `quantity:150` → 400 `La quantité pour le plat "..." doit être un nombre entier compris entre 1 et 100 (reçu: 150).`
12. `quantity:5` du Poulet Bowl (350 g poulet × 5 = 1750 g < 7650 ok) — puis relancer jusqu'à
    épuisement : la requête qui dépasse le stock → **409** `Stock insuffisant : ...` avec `details[]`.

**D. Client authentifié**

13. POST `/auth/register-client` `{name, phone, password}` → token ; POST `/orders` AVEC
    `Authorization: Bearer <token>` (même panier) → **201** avec `clientId:"{id}"`.
14. GET `/client/orders` avec le token → tableau contenant la commande (la plus récente d'abord).
15. GET `/orders/{legacy_id}` avec le token client → 200 ; GET d'une commande guest → 403.
16. GET `/orders/{id}` SANS token → 401.

**E. Suivi public + isolation**

17. GET `/orders/track/{trackingToken}` de la commande créée → 200 avec le suivi public masqué
    (le LOT 2 fonctionne sur des commandes réelles).
18. POST `/orders/track-lookup` `{orderNumber:"BEBBA-1101", phone:"22333444"}` → 200.
19. `wp_users` inchangé pendant tous les tests (isolation bebba).

## 6. Limites connues / suite

- Les transitions de statut (cuisine/livreur) arrivent au LOT 5 — une commande créée reste
  `received` pour l'instant ; le suivi public affiche donc « reçue ».
- L'annulation client (restauration de stock, constat C2 de l'audit) sera traitée avec le flux
  cuisine/livreur pour respecter la matrice des transitions.
- Les routes back-office (LOT 4) permettront de réapprovisionner le stock et voir les mouvements.

---

## 7. FIX 1 — v0.3.1 (25 PASS / 5 FAIL constatés sur WAMP → 30 attendus)

Retour du premier déploiement réel chez l'utilisateur (harnais : 25 PASS / 5 FAIL). Analyse cause par cause :
**2 vrais bugs plugin, 2 bugs du harnais lui-même, 1 écart de fidélité découvert au passage.**

### 7.1 T18 — crash 500 track-lookup : constante `ARRAY_C` (BUG PLUGIN, bloquant)
`order_items_public()` (class-bebba-catalog.php:522) appelait `$wpdb->get_results( $sql, ARRAY_C )`.
`ARRAY_C` n'existe pas dans WordPress (seuls `OBJECT`, `OBJECT_K`, `ARRAY_A`, `ARRAY_N` existent) →
`Uncaught Error: Undefined constant "ARRAY_C"` → 500 sur toute la projection publique d'items.
Correction : `ARRAY_A` + extraction des noms de suppléments filtrés (vide exclu),
1:1 avec `formatPublicOrder` de server.ts (`supplements` = tableau de chaînes, `.filter(Boolean)`).

### 7.2 T2d + T3 — substitution de base ignorée (BUG PLUGIN)
Le portage reprenait 1:1 la détection **sensible à la casse** de l'original
(`label.includes('Quinoa')`), qui ne fonctionne qu'avec des étiquettes Firestore du type « Base Quinoa ».
Le seed de démo utilise « Base quinoa » (q minuscule) → `strpos(..., 'Quinoa')` ne matchait jamais →
riz conservé au lieu du quinoa (fiche de préparation ET décrément de stock, qui lisent la même carte
d'ingrédients). Correction : `stripos` (insensible à la casse) pour les 3 substitutions
(Quinoa / Patates douces / 100% Légumes) — couvre le seed ET les futures vraies données (LOT 7).

### 7.3 T2a — regex token trop stricte (BUG HARNAIS)
Le harnais exigeait `tk_` + 24 hexa ; le contrat d'origine est
`'tk_' + crypto.randomBytes(6).toString('hex')` = **12 hexa** (server/db.ts:1339), et le plugin
produit bien 12 hexa (`rand_hex(12)`). Correction du harnais : `{24}` → `{12}`.

### 7.4 T2e — assertion `?? false` sur une valeur `null` (BUG HARNAIS)
`null === ( $order['clientId'] ?? false )` est **toujours faux** : l'opérateur `??` s'appuie sur
`isset()`, qui renvoie faux pour une valeur `null` présente → l'expression retombe sur `false`,
jamais sur `null`. La réponse du plugin (`"clientId":null` pour un invité) était correcte.
Correction du harnais : `array_key_exists( 'clientId', (array) $order ) && null === $order['clientId']`.

### 7.5 Fidélité bonus — `createdAt` en millisecondes
Constaté sur la sortie réelle : `createdAt` en `.000Z` alors que `statusHistory[0].timestamp` garde
les ms (`.505Z`). Cause : colonne `placed_at DATETIME` (sans fraction) + insertion seconde-précision,
alors que le contrat d'origine expose des millisecondes. Correction : colonne `placed_at DATETIME(3)`
(dbDelta altère le type à la réactivation) + insertion de `now_ms()`.
À noter : les mouvements de stock restent en seconde-précision (non exposés par l'API ; à aligner au
LOT 4 si l'admin les affiche).

### 7.6 Critère d'acceptation FIX 1
19. Harnais rejoué après remplacement du plugin : **30 PASS / 0 FAIL** (dont T2d avec
    « Quinoa royal aux graines: 100 g », T3 avec deltas −350/−130/0/−100/−30, T18 à 200).
20. `curl -s http://localhost/bebbabhf/wp-json/bebba/v1/health` → `"version":"0.3.1"`.
21. Fiche de suivi publique (token ET numéro+téléphone) : `supplements` = noms en clair, pas d'erreur 500.
