# BEBBA Healthy Food — Contre-expertise technique indépendante
## Mapping du modèle actuel (Firestore / `db.json`) vers WordPress + MySQL

**Auditeur :** deuxième IA, rôle d'auditeur indépendant
**Date :** 2026-09-17
**Commit audité :** `5e57050e9f16c8a4018c0354b5a638d60712721b` (`fix(security): secure Firestore access rules`)
**Branche de travail :** `arena/01a0ae53-bhf`
**Statut du livrable :** mapping logique uniquement — **aucune table créée, aucun SQL physique fourni**

---

## 0. Méthodologie et périmètre réel de l'audit

Conformément à la commande, je n'ai validé aucune architecture préexistante. J'ai reconstruit le modèle
**uniquement à partir des artefacts du dépôt**, puis j'ai croisé trois sources pour chaque affirmation :

| Source | Rôle dans l'audit | Fiabilité constatée |
|---|---|---|
| `data/db.json` (296 Ko, 9 137 lignes) | Données réelles persistées | **Source de vérité factuelle** — mais partielle (voir §1.3) |
| `server/db.ts` (2 211 lignes) | Comportement backend réel | **Autorité** en cas de conflit avec les types |
| `server.ts` (1 295 lignes) | Contrats HTTP, RBAC, idempotence, hash canonique | Autorité pour les règles d'accès |
| `server/auth.ts` (191 lignes) | JWT, bcrypt, matrice de transition par rôle | Autorité pour le RBAC |
| `src/types.ts` (310 lignes) | Types déclarés | **Non fiable seule** : contient des champs jamais utilisés |
| `scripts/migrate-to-firestore.ts` (288 lignes) | Migration JSON → Firestore déjà réalisée | Autorité pour `clientPhoneIndex`, `meta/*` |
| `firestore.rules`, `firebase-blueprint.json` | Inventaire des collections, règles | Le blueprint est **obsolète** (voir §6) |
| `server/seedData.ts` (1 531 lignes) | Origine d'une partie des données | Explique plusieurs incohérences |
| `src/**` (React) | Ce qui est réellement affiché/consommé | Autorité pour les champs utiles vs décoratifs |
| `security_spec.md` | Spécification déclarée | **Diverge du code** (voir §6) |

Méthode appliquée :

1. **Recensement exhaustif des clés** de chaque collection avec taux de présence et types réels
   (pas les types déclarés) — détection des champs optionnels, `null`, et des doublons sémantiques.
2. **Contrôle d'intégrité référentielle complet** de `db.json` : toutes les paires
   `X.yId → Y.id` ont été testées, dans les deux sens.
3. **Reconstruction des comportements** : lecture ligne à ligne de `computePreparationSheet`,
   `createOrder`, `updateOrderStatus`, `assignDriver`, `updatePaymentStatus`, `getClientByPhone`,
   `resetDemoData`, `buildDeterministicOrderHash`.
4. **Recherche des relations cachées dans le code** (heuristiques, constantes, `includes()` sur les IDs).
5. **Vérification de la dérivabilité** : chaque valeur « calculée » a été testée pour savoir si elle
   est reconstructible depuis les autres données (ex. `currentStock` depuis le ledger).

> **Principe retenu pour tout le rapport :** une affirmation n'est portée que si elle est
> démontrée par un fichier et une ligne. Tout ce qui ne l'est pas est marqué **À VÉRIFIER** (§7).

---

## 1. Inventaire réel des données

### 1.1 Collections réellement utilisées

L'inventaire réel est **supérieur** à celui de `db.json` et **différent** de celui de
`firebase-blueprint.json`. Voici l'inventaire consolidé, preuves à l'appui :

| # | Collection / document | Dans `db.json` ? | Preuve d'existence réelle | Volume réel |
|---|---|---|---|---|
| 1 | `categories` | ✅ | `server/db.ts:172-237` | 9 |
| 2 | `suppliers` | ✅ | `server/db.ts:240-259` | 3 |
| 3 | `ingredients` | ✅ | `server/db.ts:262-406` | 19 |
| 4 | `supplements` | ✅ | `server/db.ts:409-500` | 10 |
| 5 | `products` | ✅ | `server/db.ts:503-616` | 23 |
| 6 | `drivers` | ✅ | `server/db.ts:619-805` | 3 |
| 7 | `orders` | ✅ | `server/db.ts:1431-1693` | 54 |
| 8 | `stockMovements` | ✅ | `server/db.ts:353-406` | 173 |
| 9 | `users` | ✅ | `server/db.ts:1753-1957` | 7 (**0 client**) |
| 10 | **`clientPhoneIndex`** | ❌ **absent** | `server/db.ts:1788, 1803, 1854, 1905, 1946` ; `scripts/migrate-to-firestore.ts:113-140` | **inconnu** ( Firestore uniquement ) |
| 11 | **`orderIdempotencyKeys`** | ❌ **absent** | `server/db.ts:1154, 1408` ; `scripts/migrate-to-firestore.ts:245-250` | **inconnu** ( Firestore uniquement ) |
| 12 | **`meta/system`** (doc) | ❌ **absent** | `server/db.ts:163, 1145` ; `scripts/migrate-to-firestore.ts:76, 261, 273` | 1 document |
| 13 | **`meta/counters`** (doc) | ⚠️ partiel (`nextOrderSeq` à la racine) | `server/db.ts:1190-1192, 1419` ; `scripts/migrate-to-firestore.ts:142-151` | 1 document |

**Constat structurant n°1 — `db.json` n'est PAS la source de vérité complète.**
Trois collections techniques (`clientPhoneIndex`, `orderIdempotencyKeys`, `meta/system`) n'y figurent
pas du tout, et **aucun compte client** n'y figure (`users` = 3 `driver`, 2 `kitchen`, 1 `admin`,
1 `admin_readonly`). Les clients sont créés uniquement par `POST /api/auth/register-client`
(`server.ts:136-186` → `db.createClient`, `server/db.ts:1817`). Toute migration pilotée depuis
`db.json` seul **perdrait 100 % des comptes clients et 100 % des clés d'idempotence**.

**Constat structurant n°2 — 54 commandes, 20 téléphones clients distincts, 0 compte client.**
J'ai normalisé les téléphones des 54 commandes de `db.json` (mêmes 8 derniers chiffres que
`normalizePhoneNumber`, `server/db.ts:98-106`) : 20 numéros distincts, dont `99999999` utilisé
**12 fois avec 10 noms/adresses différents**, et `20123456` utilisé avec 2 identités différentes
(`Sami Ben Ali / Les Berges du Lac 2` et `Client Public Anonyme / Menzah 9`).
→ Le téléphone **n'est pas une clé d'identité fiable** pour fusionner des clients, et le bloc
`order.client` est un **instantané invité** qui doit rester figé par commande (§5).

### 1.2 Recensement champ par champ (taux de présence réel)

Légende : `n/N` = présent dans n documents sur N. Les champs **soulignés** sont absents de
`src/types.ts` ou déclarés optionnels alors qu'ils sont structurants.

#### `categories` (n=9)

| Champ | Présence | Types réels | Observation |
|---|---|---|---|
| `id` | 9/9 | str | 7 au format `cat-<slug>`, 2 au format `cat-<epochms>` |
| `name` | 9/9 | str | max 26 car. |
| `slug` | 9/9 | str | **toujours présent** — alors que `types.ts:11` le déclare obligatoire ✅ |
| `icon` | 9/9 | str | noms d'icônes `lucide-react` (`Salad`, `Flame`, `Baby`, `GlassWater`, `Calendar`, `Sparkles`) — **couplage fort au front React** |
| `description` | 9/9 | str | |
| `active` | 9/9 | bool | toutes à `true` |
| `order` | 9/9 | int | |
| `sortOrder` | **5/9** | int | **jamais en contradiction** avec `order` quand présent |
| `createdAt` / `updatedAt` | **5/9** | str ISO | 4 catégories n'ont **aucun** horodatage |
| `image` / `imageUrl` | **2/9** | str | **toujours `''`** — champs morts, écrits en miroir par `saveCategory` (`server/db.ts:214-215`) |

**Doublon sémantique n°1 : `order` vs `sortOrder`.** Le tri réel est
`sortOrder !== undefined ? sortOrder : (order || 0)` (`server/db.ts:181-184`). Le front n'écrit que
`sortOrder` (`src/components/admin/CategoryModal.tsx:87`). → **Une seule colonne cible**, valeur
`COALESCE(sortOrder, order, 0)`.

**Doublon sémantique n°2 : `image` vs `imageUrl`.** `saveCategory` écrit les deux dans les deux sens
(`server/db.ts:214-215`) ; le front ne lit **jamais** ni l'un ni l'autre pour les catégories.
→ **Ne pas migrer `image`.**

#### `suppliers` (n=3)

| Champ | Présence | Observation |
|---|---|---|
| `id` | 3/3 | `sup-1`, `sup-2`, `sup-3` (format séquentiel court) |
| `name`, `phone`, `email`, `address` | 3/3 | **`email` n'existe que ici** dans tout le projet |
| `suppliedIngredients` | 3/3 | tableau d'IDs d'ingrédients — **relation N-N inversée** |

**Aucun horodatage** (ni `createdAt` ni `updatedAt`) : `types.ts:238-245` n'en déclare pas non plus.
→ Perte d'auditabilité totale sur cette entité ; à créer (valeurs inconnues, `NULL`).

**Constat critique n°3 — la relation fournisseur↔ingrédient est exprimée DEUX fois et elles
se contredisent.** `ingredients.supplierId` (17/19) et `suppliers.suppliedIngredients` (3/3).
J'ai comparé les deux sens : **11 divergences**. Exemples réels :

| Ingrédient | `ingredient.supplierId` | déclaré dans `supplier.suppliedIngredients` ? |
|---|---|---|
| `ing-halloumi` | `sup-1` | ❌ non |
| `ing-sauce-healthy` | `sup-1` | ❌ non |
| `ing-dinde` | `sup-2` | ❌ non |
| `ing-saumon` | `sup-1` | ❌ non |
| `ing-betterave` | `sup-1` | ❌ non |
| `ing-eau-infusee` | `sup-1` | ❌ non |

Aucun code ne lit `suppliedIngredients` (`grep` : uniquement `types.ts`, `db.json`,
`server/seedData.ts`). **La relation authoritative réelle est `ingredients.supplierId`.**

**Constat n°4 — `supplierName` est un texte libre indépendant de la FK.**
`ing-1788825545393` a `supplierId: null` **et** `supplierName: "marché"` : un fournisseur
qui n'existe pas comme entité. → Les deux colonnes doivent survivre, avec des rôles distincts.

#### `ingredients` (n=19)

| Champ | Présence | Types réels | Observation |
|---|---|---|---|
| `id` | 19/19 | str | 17 `ing-<slug>`, 1 `ing-<epochms>`, 1 `test-ing-kitchen-<epochms>` |
| `name` | 19/19 | str | max 39 car. |
| `unit` | **18/19** | str | `g`×11, `ml`×5, `piece`×1, `portion`×1, **`null`×1** |
| `currentStock` | 19/19 | int ×18, **`null` ×1** | |
| `minThreshold` | **18/19** | int | |
| `purchaseCost` | **18/19** | float | **3 décimales** (`0.016`, `0.002`) — précision supérieure aux prix |
| `supplierId` | **17/19** | str | |
| `supplierName` | **18/19** | str | texte libre (cf. constat n°4) |
| `category` | **18/19** | str | **taxonomie libre, 8 valeurs** : `Boissons`, `Féculents`, `Légumes`, `Légumes & Fruits`, `Programmes`, `Protéines`, `Protéines & Fromages`, `Sauces` |
| `active` | **5/19** | bool | Le code teste `active === false` → **absent = actif** |
| `createdAt` | **6/19** | str | 13 ingrédients sans date de création |
| `updatedAt` | 19/19 | str | seul horodatage garanti |

**Enregistrement dégénéré réel** : `test-ing-kitchen-1788896746450` →
`unit: null`, `currentStock: null`, `minThreshold: null`, `purchaseCost: null`, `category: null`,
`active: false`. Il est **référencé par un mouvement de stock** (`mov-1788896746487-mce9`,
`manual_in`, +10, **sans champ `unit`**).
→ Toute colonne `NOT NULL` sans stratégie explicite fera **échouer l'import** ou, pire,
**inventera des zéros**. Et `addStockMovement` (`server/db.ts:376`) calcule
`Math.round((null + 10) * 10) / 10` → le code actuel produit déjà un résultat incohérent.

**Constat n°5 — `ingredient.category` n'a rien à voir avec `categories`.**
C'est une famille logistique (Protéines / Féculents / Sauces…), libre, sans entité, sans ID,
avec des variantes non normalisées (`Légumes` vs `Légumes & Fruits`, `Protéines` vs
`Protéines & Fromages`). Elle n'est lue par **aucun** code métier. → À VÉRIFIER (§7).

#### `supplements` (n=10)

| Champ | Présence | Observation |
|---|---|---|
| `id`, `name`, `description`, `price`, `ingredientId`, `ingredientName`, `quantityConsumed`, `unit`, `available`, `active` | 10/10 | noyau stable |
| `quantity` | **2/10** | **doublon exact de `quantityConsumed`** |
| `isAvailable` | **2/10** | **doublon exact de `available`** |
| `order` / `sortOrder` | **2/10** | doublon (cf. catégories) |
| `createdAt` / `updatedAt` | **2/10** | 8 suppléments sans horodatage |
| `ingredientActive` | 0/10 | **jamais stocké** — calculé à la volée (`server/db.ts:424-426, 448-450`) ✅ ne pas migrer |

`saveSupplement` (`server/db.ts:466-489`) recopie `ingredientName` **et** `unit` **depuis
l'ingrédient au moment de l'écriture** : ce sont des dénormalisations qui **dérivent** si
l'ingrédient est renommé ou change d'unité. J'ai testé la dérive sur `db.json` :
**0 divergence aujourd'hui** — mais rien ne l'empêche.

**FK orphelines réelles** : `sup-1788252897609` et `sup-1788252928282` pointent vers
`ing-4`, **qui n'existe pas**.

#### `products` (n=23)

| Champ | Présence | Observation |
|---|---|---|
| `id`, `name`, `description`, `categoryId`, `basePrice`, `imageUrl`, `active`, `isAvailable`, `isPopular`, `baseIngredients`, `customization` | 23/23 | noyau |
| `calories`, `proteinGrams`, `carbsGrams`, `fatGrams` | **22/23** | 1 produit sans valeurs nutritionnelles |
| `available` | **16/23** | **doublon de `isAvailable`** |
| `order` / `sortOrder` | **16/23** | doublon, jamais en contradiction |
| `createdAt` / `updatedAt` | **16/23** | 7 produits sans horodatage |
| `image` | **4/23** | doublon mort — le front ne lit que `imageUrl` (`ProductCard.tsx:26`, `CatalogManager.tsx:312`) |
| `hasInactiveIngredient` | 0/23 | **calculé à la volée** (`server/db.ts:517-524`) ✅ ne pas migrer |

**Constat critique n°6 — 7 produits n'ont pas le champ `available` alors que `isAvailable = true`,
et le filtre backend les exclut.** `getProducts({availableOnly:true})` teste
`p.available && p.isAvailable !== false` (`server/db.ts:531-533`). Les 7 produits concernés sont
les **produits phares** : `prod-poulet-bowl` (BEBBA Chicken Power Bowl), `prod-poulet-grille`,
`prod-boeuf-grillade`, `prod-quinoa-green-bowl`, `prod-salade-fraicheur`, `prod-jus-detox-vert`,
`prod-jus-orange-carotte`.
→ Si la migration normalise naïvement `is_available = COALESCE(available, isAvailable)`, elle
**change le comportement** de `GET /api/products?availableOnly=true` (7 produits réapparaissent).
Mitigation actuelle : **le front n'utilise jamais ce paramètre** (`grep` : aucune occurrence dans
`src/`), le bug est donc latent. Décision à trancher explicitement (§7).

**FK orphelines réelles dans le catalogue vivant** :
- `prod-1788252897607` et `prod-1788252928280` référencent `ing-1` et `ing-4` dans
  `baseIngredients` → **inexistants** ;
- les mêmes référencent `sup-1` et `sup-3` dans `customization.allowedSupplementIds` → **inexistants**.

Ces IDs (`ing-1`…`ing-6`) sont **exactement ceux codés en dur dans les heuristiques de
`computePreparationSheet`** (`server/db.ts:940, 941, 951, 961, 977, 985`). Le code contient donc
des branches mortes pointant vers un ancien schéma d'IDs.

**`prod-test-indisponible` n'a aucun `baseIngredients`** → produit commandable qui ne consomme rien.

#### `drivers` (n=3)

| Champ | Présence | Observation |
|---|---|---|
| `id`, `name`, `phone`, `vehicle`, `active`, `totalDeliveries`, `rating` | 3/3 | |
| `username` | **0/3** | **jamais stocké** — injecté par jointure (`server/db.ts:625-641`) ✅ ne pas migrer comme colonne |
| `createdAt` / `updatedAt` | **0/3** | **aucun horodatage** |

**Constat critique n°7 — `totalDeliveries` n'est PAS recalculable.**
Il est incrémenté de 1 à chaque passage à `delivered` (`server/db.ts:1624-1631`).
Or `db.json` contient `totalDeliveries` = 146 / 98 / 64 (total 308) alors qu'il n'y a que
**4 commandes `delivered`** et **10 commandes avec un `assignedDriverId`**.
→ Le compteur inclut un **historique antérieur aux commandes conservées**. Le recalculer depuis
`bebba_orders` produirait 4 au lieu de 308 : **perte sèche de 304 livraisons**.
Il faut migrer une **valeur d'ouverture** et ajouter le comptage post-migration.

**Constat n°8 — `rating` est décoratif.** Valeurs 4.9 / 4.95 / 4.8 issues de `seedData.ts:1227,1236,1245`,
`5.0` à la création (`server/db.ts:699`). **Aucun code ne le lit, ne le calcule ou ne le met à jour**
(`grep` : 0 occurrence hors seed/types). Aucune donnée de notation client n'existe.
→ Donnée **non démontrée** : à migrer comme valeur figée `NULL`-able, sans prétendre qu'elle a un sens.

#### `users` (n=7 — **0 client**)

| Champ | Présence | Observation |
|---|---|---|
| `id` | 7/7 | 6 `usr-<slug>`, 1 `usr-<epochms>` |
| `username` | 7/7 | `admin`, `cuisine`, `livreur1`, `livreur2`, `livreur3`, `agent_test_audit`, `admin_readonly` |
| `name`, `phone`, `role`, `active`, `createdAt`, `updatedAt` | 7/7 | `phone` = `''` pour `agent_test_audit` |
| `passwordHash` | 7/7 | **`''` (vide) partout dans `db.json`** — les vrais hash ne sont que dans Firestore, générés depuis l'env par `scripts/migrate-to-firestore.ts:50-72` |
| `lastLoginAt` | **5/7** | |
| `driverId` | **3/7** | uniquement les 3 comptes `driver` — **1:1 exact vérifié** avec `drivers` |
| `address` | **0/7** | déclaré dans `types.ts:230` ; n'existe que pour les clients (Firestore) |
| `email` | **0/7** | **n'existe nulle part dans le projet** hors `Supplier.email` |

**Constat critique n°9 — les mots de passe staff sont partagés par rôle, pas par compte.**
`scripts/migrate-to-firestore.ts:52-57` mappe `role → variable d'environnement` :
`admin→INITIAL_ADMIN_PASSWORD`, `kitchen→INITIAL_KITCHEN_PASSWORD`,
`driver→INITIAL_DRIVER_PASSWORD`, `admin_readonly→INITIAL_ADMIN_READONLY_PASSWORD`.
Il y a **2 comptes `kitchen` et 3 comptes `driver`** : ils partagent donc le même mot de passe.
→ La migration ne peut pas se contenter de recopier les hash : **une réinitialisation de mot de
passe est obligatoire** pour les comptes staff (et de toute façon imposée par le risque bcrypt, §7).

**Constat critique n°10 — les clients n'ont pas de `username`.**
`POST /api/auth/login` (`server.ts:81-129`) : les clients s'authentifient par
**`phone` + `password`** (`db.getClientByPhone`), le personnel par **`username` + `password`**.
Un compte `client` trouvé par `username` est **explicitement rejeté** (`server.ts:98-100`).
→ `wp_users.user_login` est **obligatoire et unique** : il faudra en **synthétiser** un pour les
clients (le téléphone normalisé est le seul candidat démontré), ce qui crée une collision de
sémantique avec le login staff. Décision structurante (§2.1, §7).

#### `orders` (n=54)

| Champ | Présence | Types réels | Observation |
|---|---|---|---|
| `id` | 54/54 | str | 51 `ord-<epochms>`, **3 `ord-1047/1048/1049`** (format séquentiel ancien) |
| `orderNumber` | 54/54 | str | `BEBBA-1047` … `BEBBA-1100`, **54 valeurs, 0 doublon, 0 trou** |
| `trackingToken` | 54/54 | str | **51 de 15 car.** (`tk_` + 12 hex, `crypto.randomBytes(6)`, `server/db.ts:1339`) et **3 de 18 car.** : `tk_bebba_1047_demo`, `tk_bebba_1048_demo`, `tk_bebba_1049_demo` — **format hétérogène** |
| `createdAt` | 54/54 | str ISO ms | **0 doublon** (tri stable possible) |
| `client` | 54/54 | objet | `{name, phone, deliveryAddress, notes}` — **présents 54/54 chacun**, `notes` = `''` quand vide |
| `items` | 54/54 | tableau | 56 lignes au total |
| `subtotal` | 54/54 | float ×20, int ×14, **`null` ×20** | |
| `deliveryFee` | 54/54 | float | **toujours `2.5`** |
| `totalAmount` | 54/54 | int ×19, float ×15, **`null` ×20** | |
| `status` | 54/54 | str | `received`×24, `preparing`×15, `delivered`×4, `delivering`×4, `ready`×3, `waiting_for_driver`×3, `cancelled`×1 |
| `paymentMethod` | 54/54 | str | **toujours `cash_on_delivery`** |
| `paymentStatus` | 54/54 | str | `to_collect`×51, `paid`×3 |
| `statusHistory` | 54/54 | tableau | **119 entrées** |
| `stockConsumed` | **28/54** | bool | `true`×20, `false`×8, **absent ×26** |
| `assignedDriverId` / `assignedDriverName` | **10/54** | str | toujours les deux ensemble |
| `clientId` | **0/54** | — | **jamais renseigné dans `db.json`** alors que `createOrder` l'écrit (`server/db.ts:1354`) |
| `phone` (racine) | 0/54 | — | lu en secours par `getOrderByOrderNumberAndPhone` (`server/db.ts:1478`) — **branche morte** |

**Constat critique n°11 — 20 commandes sur 54 (37 %) n'ont AUCUN montant.**
`subtotal`, `totalAmount`, et pour leurs lignes `unitPrice` **et** `itemTotalPrice` sont `null`.
Ce sont les commandes les plus anciennes (`2026-09-01T08:26:07Z` → `08:40:56Z`, IDs
`ord-17882511…`/`ord-17882520…`), issues de `seedData.ts`. Leurs statuts :
`received`×13, `preparing`×3, `ready`×2, `delivering`×2.
Le front se protège déjà : `(order.totalAmount ?? 0).toFixed(1)` (`DriverView.tsx:93,226,283,292,324,396`).
Le dashboard additionne silencieusement : `sum + o.totalAmount` avec `null` → `+0` (`server/db.ts:1701`).
→ **Un `DECIMAL NOT NULL DEFAULT 0` transformerait « montant inconnu » en « 0,000 DT »**,
ce qui fausserait définitivement la comptabilité et rendrait l'anomalie indétectable.
**Les colonnes monétaires des commandes doivent être `NULL`-ables.**

**Constat critique n°12 — `stockConsumed` est incohérent avec le ledger.**
10 commandes (`BEBBA-1063`…`BEBBA-1072`) ont des mouvements `order_consumption` **alors que
`stockConsumed` est absent ou `false`**. Réciproquement, `stockConsumed=true` ⟺ mouvements présents
pour les 20 autres. → Le drapeau n'est pas une source fiable : il faut le **reconstruire depuis le
ledger** pendant la migration (existence d'au moins un mouvement `order_consumption` pour la commande).

**Constat n°13 — `status='ready'` est un état atteignable uniquement par données héritées.**
`updateOrderStatus` transforme systématiquement une demande `ready` en
`status='waiting_for_driver'` avec **deux** entrées d'historique (`server/db.ts:1585-1604`).
Pourtant 3 commandes ont `status='ready'` (`BEBBA-1095`, `BEBBA-1068`, `BEBBA-1060`).
→ L'ENUM cible **doit conserver `ready`**, et le workflow cible doit trancher :
soit `ready` redevient un état persistant, soit ces 3 lignes sont recalées (décision §7).

**Constat critique n°14 — `statusHistory` n'est pas un journal fiable.**
- `BEBBA-1095` a `status='ready'` mais un historique réduit à `['received']`
  → **le statut a changé sans trace**.
- `BEBBA-1079` (annulée) a **deux entrées `preparing` consécutives**
  (`updatedBy: 'Chef Cuisine Test'` puis `'Tentative Doublon'`) → doublon non filtré.
- **6 commandes** ont des `timestamp` **duplicqués à la milliseconde** dans leur historique
  (ex. `BEBBA-1093` : `ready` et `waiting_for_driver` tous deux à `13:48:18.309Z`)
  → **une contrainte `UNIQUE(order_id, timestamp)` ferait échouer l'import**.
- **5 commandes** ont `ready` dans l'historique **sans** `waiting_for_driver`.
- `updatedBy` : **7 entrées sans ce champ**, et **20 valeurs libres distinctes** dont
  `'Deuxième tentative'`, `'Tentative Doublon'`, `'Admin Test Annulation'`, `'Système / Admin'`,
  `'Chef'`, `'Cuisine BEBBA'`, `'Yassine Ben Amor'`. **Aucune n'est un identifiant.**
- `label` : 8 valeurs distinctes, dont **3 variantes pour le même statut `received`**
  (`'Commande reçue & transmise à la cuisine'` ×51 — `server/db.ts:1372`,
  `'Commande reçue'` — `statusLabels`, `server/db.ts:1571`,
  `'Commande reçue & enregistrée'` ×3 — seed).
  → `label` est un **instantané textuel**, non dérivable du statut.
- L'historique contient des événements **qui ne sont pas des changements de statut** :
  `assignDriver` pousse une entrée avec le **statut courant inchangé** et le label
  `'Livreur affecté : <nom>'` (`server/db.ts:1668-1674`).

**Constat critique n°15 — l'annulation NE RESTAURE PAS le stock.**
`order_cancellation_restore` est déclaré dans `src/types.ts:46` et **nulle part ailleurs**
(`grep` sur tout le dépôt : 1 seule occurrence). `updateOrderStatus` ne crée **aucun** mouvement
pour `cancelled`. Preuve sur données réelles — `BEBBA-1079`, annulée, `stockConsumed=true` :

| ingrédient | mouvement |
|---|---|
| `ing-poulet` | −500 |
| `ing-patate-douce` | −360 |
| `ing-legumes` | −300 |
| `ing-sauce-miel-moutarde` | −80 |
| **mouvement de restitution** | **aucun** |

→ 1 240 unités ont été **définitivement perdues** pour une commande annulée. Ce n'est pas un
problème de mapping : c'est un **défaut métier à corriger pendant la migration**, sinon le stock
MySQL hérite d'un passif faux.

#### `orders[].items` (n=56)

| Champ | Présence | Observation |
|---|---|---|
| `id` | 56/56 | `item-<7 car. aléatoires>` — **non unique par construction** (`Math.random().toString(36).substring(2,9)`, `server/db.ts:1272`) ; 0 collision constatée |
| `productId`, `productName` | 56/56 | **2 orphelins** : `prod-1788252958886` (`BEBBA-1071`), `prod-1788252974684` (`BEBBA-1072`) → **produits supprimés** |
| `unitPrice` | 56/56 | float ×24, int ×12, **`null` ×20** |
| `quantity` | 56/56 | int, 1…100 (bornes imposées par `server/db.ts:1256-1264`) |
| `itemTotalPrice` | 56/56 | **`null` ×20** |
| `supplements` | 56/56 | 12 entrées au total ; **1 orphelin** : `sup-1788252974687` |
| `preparationSheet` | 56/56 | `{totalIngredients, summaryLines}` |
| `baseChoice` | **26/56** | objet `{label, extraPrice}` |
| `proteinOption` | **11/56** | objet `{label, extraPrice, extraGrams}` |
| `veggiesOption` | **7/56** | objet `{label, extraPrice, extraGrams}` |
| `specialInstructions` | **1/56** | `'Sauce servie à part svp. Pas de piment.'` |

**Constat critique n°16 — `preparationSheet` contient un ingrédient fantôme.**
`BEBBA-1086` référence **`ing-fantome-inconnu`** dans `preparationSheet.totalIngredients`,
ingrédient qui **n'existe pas** dans `ingredients`.
→ **Une FK `NOT NULL` de `bebba_order_item_ingredients.ingredient_id` vers `bebba_ingredients`
ferait échouer l'import d'une commande historique réelle.** C'est la preuve décisive que les
tables historiques doivent porter des **FK `NULL`-ables + instantanés textuels**, et non des
références dures.

**Constat critique n°17 — `preparationSheet` mélange quantités unitaires et totales.**
Cas réel `BEBBA-1084`, `prod-poulet-grille`, `quantity = 2` :

| Source | Poulet | Patates douces | Légumes | Sauce |
|---|---|---|---|---|
| recette (`baseIngredients`) | 250 g | 180 g | 150 g | 40 ml |
| `preparationSheet.totalIngredients` | **250** | 180 | 150 | 40 |
| `preparationSheet.summaryLines` | **« 250 g »** | 180 g | 150 g | 40 ml |
| **mouvements de stock réels** | **−500** | −360 | −300 | −80 |

`computePreparationSheet` produit `totalIngredients` **par unité** (`server/db.ts:1043-1048`) et
`ingredientConsumptions` **multiplié par la quantité** (`server/db.ts:1050-1055`) ; or
`createOrder` ne persiste que `totalIngredients` et multiplie lui-même pour le stock
(`server/db.ts:1298-1300`). Le champ nommé **`totalIngredients` n'est donc PAS un total.**
Pire : `summaryLines` est multiplié par la quantité dans le code (`server/db.ts:1077`) mais
**ne l'est pas dans les données seed** (250 g pour une quantité de 2) →
**la même colonne a deux sémantiques selon l'origine de la commande.**
→ `summaryLines` est une **chaîne d'affichage dénormalisée, contradictoire, non fiable**.
Elle ne doit **pas** devenir une colonne authoritative. Le modèle cible doit séparer
explicitement `quantity_per_unit` et `quantity_total`.

**Constat n°18 — `item.id` n'a aucune valeur métier.** Il n'est référencé nulle part
(aucun mouvement, aucun historique ne le cite). → PK technique seule.

#### `orders[].items[].supplements` (n=12)

`supplementId`, `name`, `price`, `quantity`, `ingredientId`, `ingredientName`,
`quantityConsumed`, `unit` — **8/8 champs présents sur 12/12 lignes**.
C'est le **meilleur instantané historique du projet** : prix, nom, ingrédient, quantité consommée
et unité sont tous figés.
⚠️ Ambiguïté de nom : ici `quantityConsumed` = `supDef.quantityConsumed × itemSup.quantity`
(**total**, `server/db.ts:1013`), alors que dans `supplements` c'est une **valeur unitaire**.
Même nom, deux sémantiques → **renommer dans le modèle cible**.

#### `orders[].statusHistory` (n=119)

`status` 119/119, `label` 119/119, `timestamp` 119/119, `note` 119/119 (chaîne, `''` si vide),
`updatedBy` **112/119**. Distribution des statuts : `received`×54, `preparing`×31, `ready`×13,
`waiting_for_driver`×8, `delivering`×8, `delivered`×4, `cancelled`×1.

#### `stockMovements` (n=173)

| Champ | Présence | Observation |
|---|---|---|
| `id` | 173/173 | 170 `mov-<epochms>-<rand4>`, **3 `mov-1`/`mov-2`/`mov-3`** |
| `ingredientId` | 173/173 | **0 orphelin** |
| `ingredientName` | 173/173 | instantané |
| `type` | 173/173 | **seulement 2 valeurs réelles** : `order_consumption`×171, `manual_in`×2 |
| `quantity` | 173/173 | **signée** : 171 négatives, 2 positives |
| `unit` | **172/173** | manquant sur `mov-1788896746487-mce9` |
| `orderId` / `orderNumber` | **171/173** | toujours les deux ensemble, **0 orphelin** |
| `notes` | 173/173 | texte libre, max 69 car. |
| `timestamp` | 173/173 | str ISO ms |
| `performedBy` | 173/173 | **9 valeurs libres**, **aucun ID** : `BEBBA KDS Moteur Automatique`, `Chef`, `Chef Cuisine`, `Chef Cuisine Test`, `Chef Gestionnaire`, `Chef Test`, `Chef de Cuisine BEBBA (Cuisine)`, `Cuisine BEBBA`, `Système Automatique BEBBA` |

**Constat critique n°19 — 5 des 7 types de mouvements déclarés ne sont JAMAIS produits.**

| Type déclaré (`src/types.ts:39-46`) | Utilisé dans le code ? | Présent dans les données ? |
|---|---|---|
| `order_consumption` | ✅ `server/db.ts:1400`, `1547` | ✅ 171 |
| `manual_in` | ⚠️ **valeur par défaut** de l'API (`server.ts:436`) | ✅ 2 |
| `replenishment` | ✅ `src/components/admin/AdminView.tsx:273` | ❌ 0 |
| `inventory_correction` | ❌ **aucune occurrence** | ❌ 0 |
| `manual_out` | ❌ **aucune occurrence** | ❌ 0 |
| `waste` | ❌ **aucune occurrence** | ❌ 0 |
| `order_cancellation_restore` | ❌ **aucune occurrence** | ❌ 0 |

De plus, **`POST /api/ingredients/:id/stock` ne valide PAS le `type`** (`server.ts:424-445`) :
`type: type || 'manual_in'` accepte **n'importe quelle chaîne**, et `quantity` n'est validée que
comme `number` — **aucun contrôle de cohérence signe/type**. `addStockMovement` additionne
aveuglément (`server/db.ts:376`). → L'ENUM n'est **pas garanti par le système actuel** ;
le modèle cible doit l'imposer (ENUM + règle de signe par type).

**Constat critique n°20 — le stock n'est PAS reconstructible depuis le ledger.**
Somme algébrique des mouvements vs `currentStock` réel :

| ingrédient | `currentStock` | Σ mouvements |
|---|---|---|
| `ing-poulet` | 8 230 | **+4 430** |
| `ing-boeuf` | 8 340 | −860 |
| `ing-riz` | 20 500 | −4 650 |
| `ing-quinoa` | 7 200 | −600 |
| `ing-patate-douce` | 9 540 | −2 460 |

**Aucun mouvement d'ouverture n'existe.** Le ledger est donc **incomplet par construction** :
`currentStock` est un état autonome, pas une vue du journal.
→ La migration **doit** fabriquer un mouvement `opening_balance` par ingrédient, sinon le nouveau
système démarre avec un journal incapable d'expliquer son propre stock (et tout futur audit
de rapprochement échouera).

**Constat n°21 — un numéro de bon fournisseur est enfoui dans un texte libre.**
Le seul mouvement `replenishment`-like réel porte la note :
`'Réception livraison fournisseur Volailles du Terroir (Bon #4891)'`.
→ Il existe une notion de **bon de livraison / réception fournisseur** (`#4891`) qui n'a
**aucune entité, aucune table, aucune relation**. Donnée oubliée par excellence (§2.4, §7).

**Constat n°22 — seconde source de vérité du stock, codée en dur.**
`resetDemoData` contient `OFFICIAL_INGREDIENTS_STOCK` (`server/db.ts:2065-2083`) : les **17 valeurs
nominales** des ingrédients officiels, en dur dans le code. C'est une référence métier réelle
(stock de départ contractuel) qui n'existe dans aucune donnée.

#### `nextOrderSeq` (racine de `db.json`)

`data/db.json:9137` → `"nextOrderSeq": 1101`. Cohérent : dernière commande `BEBBA-1100`.
Dans Firestore, cette valeur vit dans `meta/counters.nextOrderSeq` (+ `updatedAt`),
**structure différente** de `db.json`. Trois valeurs par défaut divergentes dans le code :
- `createOrder` : fallback **1101** (`server/db.ts:1192`) ;
- `scripts/migrate-to-firestore.ts:143-146` : exige **exactement 1101**, sinon erreur bloquante ;
- `resetDemoData` : réinitialise à **1001** (`server/db.ts:2091-2094`).

**Constat critique n°23 — risque démontré de duplication de `orderNumber`.**
`resetDemoData` remet le compteur à **1001** mais `firestore.rules:173` impose
`allow delete: if false` sur `orders` : les suppressions **échouent silencieusement**
(comptabilisées dans `rulesBlockedDeletionCount`, `server/db.ts:2117-2124, 2203-2206`).
→ Scénario réel : commandes `BEBBA-1047…1100` **conservées**, compteur **ramené à 1001**
⇒ les 54 prochains `orderNumber` **entrent en collision**.
Aucune contrainte d'unicité n'existe côté Firestore.
→ En MySQL : `UNIQUE(order_number)` **obligatoire**, et la séquence doit être initialisée à
`MAX(order_seq) + 1`, jamais à une constante codée en dur.

### 1.3 Structures et comportements qui n'existent QUE dans le code

Ce sont les « relations cachées » demandées. **Aucune n'est exprimée par les données** —
une migration naïve les perd toutes.

#### (a) La substitution d'ingrédient par choix de base — codée en dur

`computePreparationSheet`, `server/db.ts:973-995` :

```
si baseChoice.label contient 'Quinoa'          → supprimer ing-riz (ou ing-6),
                                                 ajouter ing-quinoa (même qté, unité 'g' imposée)
si baseChoice.label contient 'Patates douces'  → supprimer ing-riz (ou ing-6),
                                                 ajouter ing-patate-douce (même qté, unité 'g' imposée)
si baseChoice.label contient '100% Légumes'    → supprimer ing-riz / ing-6 / ing-patate-douce,
                                                 ajouter cette qté à ing-legumes (ou ing-5)
```

Quatre IDs d'ingrédients (`ing-riz`, `ing-6`, `ing-quinoa`, `ing-patate-douce`, `ing-legumes`,
`ing-5`) et **trois motifs textuels** sont codés en dur. `createOrder` va jusqu'à **pré-charger
ces ingrédients par défaut** dans sa transaction (`server/db.ts:1218-1221`).
→ **La recette réelle d'un plat dépend du texte d'une option.** C'est la relation cachée la plus
grave du projet : elle n'est ni dans `products`, ni dans `customization`, ni dans `baseIngredients`.

**Preuve de casse réelle.** J'ai évalué ces règles sur les 23 produits :

- **19 labels de `baseChoices` distincts** dans le catalogue. **8 ne sont pas reconnus par le code** :
  `Double légumes (sans féculents)` (sémantiquement identique à `100% Légumes`, mais non reconnu),
  `Galette Sans Gluten au Maïs`, `Galette de Blé Complet`,
  `Riz Basmati Complet`, `Riz Basmati complet`, `Riz basmati complet`, `Riz basmati doux`,
  `Riz complet basmati`.
- **4 labels différents mappent sur le MÊME ingrédient avec le MÊME nom codé en dur** :
  `Quinoa royal`, `Quinoa royal (+1.5 DT)`, `Quinoa royal aux graines (+1.5 DT)`,
  `Quinoa aux fines herbes` → tous injectent `ing-quinoa` avec le nom figé
  `'Quinoa royal aux graines'` (`server/db.ts:981`). Un client qui choisit
  **« Quinoa aux fines herbes » reçoit une fiche cuisine libellée « Quinoa royal aux graines »**.
- **8 cas réels de substitution silencieusement impossible** (source `ing-riz` absente du plat) :
  `prod-quinoa-green-bowl` (Quinoa royal, Patates douces), `prod-saumon-zen-bowl` (Quinoa royal,
  Mix 100% Légumes sans féculent), `prod-bowl-vegetal-mediterraneen` (Quinoa royal, Patates douces rôties),
  `prod-1788693673602` (Quinoa aux fines herbes).

#### (b) L'affectation des grammes supplémentaires — par sous-chaîne d'ID

`server/db.ts:935-971` :

```
extraGrams protéine → premier baseIngredient dont l'ID contient
   'poulet' | 'boeuf' | 'dinde' | 'saumon' | 'halloumi' | 'ing-1' | 'ing-2' | 'ing-3'
extraGrams légumes  → premier baseIngredient dont l'ID contient 'legumes' | 'ing-4' | 'ing-5'
```

Aucun lien déclaratif option → ingrédient. Conséquences démontrées :

1. **Silencieux** : `if (proteinBase) { … if (existing) existing.quantity += … }` — si rien ne
   correspond, **rien ne se passe, aucune erreur**. Le client **paie** l'option, le stock
   **n'est pas** consommé.
2. **Dépend de l'ordre du tableau** : `prod-mix-grill-fitness` contient **`ing-poulet` (150 g) ET
   `ing-boeuf` (150 g)**. `find()` renvoie le **premier** match. L'option
   `'Maxi Duo (+100g Poulet)'` (+3 DT, +100 g) ajoute 100 g **au poulet uniquement parce qu'il est
   listé en premier**. Inverser l'ordre de `baseIngredients` détournerait 100 g vers le bœuf,
   sans aucune erreur.
3. **Cas réel de perte** : `prod-1788693673602` (« test plat 1 ») vend
   `'Extra Légumes Croquants (+60g)'` à **+2,5 DT** avec `extraGrams: 60`, mais ne contient aucun
   ingrédient `legumes`/`ing-4`/`ing-5` → **+2,5 DT encaissés, 60 g jamais consommés**.
4. **Aucune cohérence d'unité** : `extraGrams` est ajouté à la quantité de l'ingrédient **quelle que
   soit son unité** (`g`, `ml`, `piece`, `portion`). Ajouter « 100 g » à un ingrédient en `piece`
   est possible ; seul le hasard des IDs l'évite aujourd'hui (`ing-oeuf` n'est pas dans la liste).

#### (c) Le prix est encodé dans le libellé

`'Quinoa royal aux graines (+1.5 DT)'`, `'Patates douces rôties (+1.0 DT)'`,
`'Portion sportive (+100g de poulet)'`, `'Légumes supplémentaires (+100g)'` :
le **libellé duplique `extraPrice` et `extraGrams`**. J'ai vérifié la cohérence :
**1 seule contradiction** — `prod-mix-grill-fitness`, `'Duo Standard (150g Poulet + 150g Bœuf)'`
avec `extraGrams: 0` (ici volontaire, l'option est la portion standard ; mais le libellé décrit
une **double protéine 150 g + 150 g** que le modèle ne sait pas exprimer : `extraGrams` ne cible
qu'**un seul** ingrédient).
→ Le libellé est un **contrat affiché au client** ; le modèle cible doit le rendre **non porteur de
donnée** (ou ajouter une validation de cohérence).

#### (d) Constantes métier codées en dur, sans entité

| Constante | Valeur | Emplacements | Statut |
|---|---|---|---|
| Frais de livraison | **`2.5` DT** | `server/db.ts:1341`, `src/components/client/CartDrawer.tsx:33`, `src/components/client/CheckoutModal.tsx:144`, `server/seedData.ts:1304,1406,1477` | **6 endroits, 0 configuration** |
| Préfixe de commande | `'BEBBA-'` | `server/db.ts:1338`, `server/db.ts:1466` (reconstruction à la volée si l'utilisateur ne saisit que des chiffres) | |
| Préfixe du token | `'tk_'` + 6 octets aléatoires | `server/db.ts:1339` | |
| Quantité par ligne | **1 à 100**, entier | `server/db.ts:1256-1264` | |
| `deliveryFee` | jamais nul, jamais variable | 54/54 à `2.5` | |
| `paymentMethod` | `'cash_on_delivery'` unique | 54/54 | **ENUM à 1 valeur** |
| Arrondi monétaire | `Math.round(x*10)/10` → **1 décimale (0,1 DT)** | `server/db.ts:481, 585, 1035, 1037, 1266, 1342, 1357, 1360` | **granularité métier réelle = 0,1 DT** |
| Arrondi quantités | `Math.round(x*10)/10` → 1 décimale | `server/db.ts:376, 1046, 1053, 1298, 1310, 1396` | mais **toutes les données sont entières** |
| Précision `purchaseCost` | **3 décimales** (`0.016`, `0.002`) | `db.json` | **supérieure à la précision monétaire** |
| Normalisation téléphone | 8 derniers chiffres | `server/db.ts:98-106`, `server.ts:939`, `scripts/migrate-to-firestore.ts:19-24` (**dupliqué 3×**) | |
| Normalisation adresse | `trim().toLowerCase()` + espaces collapses | `server/db.ts:109-113` | **utilisée uniquement pour le hash d'idempotence** |
| Motifs de masquage public | nom, téléphone, adresse, livreur | `server.ts:709-761` | présentation, non stockée ✅ |
| Rate limiting `track-lookup` | 5 échecs / 10 min / IP, **en mémoire** | `server.ts:795-800` | **non persistant** |
| Seuils de stock nominal | 17 valeurs | `server/db.ts:2065-2083` | cf. constat n°22 |
| IDs staff critiques | `usr-admin-1`, `usr-kitchen-1`, `usr-driver-1`, `usr-admin-readonly-1`, `drv-1` | `server/db.ts:1986, 1997` | garde-fou de `resetDemoData` |
| IDs de test à purger | `ing-1788825545393`, `test-ing-kitchen-1788896746450`, `test-i`, `test-u`, `test-d` | `server/db.ts:2058, 2022-2027` | |

#### (e) Matrice RBAC réelle — répartie sur 3 fichiers

Elle n'existe **dans aucune donnée** ; elle est dans `server/auth.ts` + `server.ts` +
`src/components/admin/AdminView.tsx:42-48`. Synthèse vérifiée :

| Capacité | `admin` | `admin_readonly` | `kitchen` | `driver` | `client` | anonyme |
|---|---|---|---|---|---|---|
| Lire menu (catégories/produits/suppléments) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`server.ts:209,266,325` — **public**) |
| Lire ingrédients | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (`server.ts:383`) |
| Créer/modifier ingrédient | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (`server.ts:393,403`) |
| **Supprimer** ingrédient | ✅ | ❌ | **❌** | ❌ | ❌ | ❌ (`server.ts:414`) |
| Mouvement de stock manuel | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (`server.ts:424`) |
| Lire `stockMovements` | ✅ | ✅ | **❌** | ❌ | ❌ | ❌ (`server.ts:446`) |
| Lire livreurs | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (`server.ts:457`) |
| CRUD livreurs / mot de passe | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:467,514,528,550,568`) |
| CRUD fournisseurs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:579-609`) |
| CRUD catalogue (cat/prod/suppl.) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:234,293,351`) |
| Lire/create users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:619,628`) |
| Lire toutes commandes | ✅ | ❌ | toutes **sauf `cancelled`** | **uniquement les siennes** | ❌ | ❌ (`server.ts:674-706`) |
| `received→preparing`, `preparing→ready` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (`auth.ts:167-170`) |
| `ready→waiting_for_driver` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`auth.ts:167-170`) |
| `waiting_for_driver→delivering` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `delivering→delivered` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ (`auth.ts:176-178`) |
| `*→cancelled` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Affecter un livreur | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:1174`) |
| Encaisser (`paid`) | ✅ | ❌ | ❌ | ✅ **si affecté** | ❌ | ❌ (`server.ts:1191-1247`) |
| Lire stats dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ (`server.ts:1255`) |
| `reset-demo-data` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (`server.ts:1265`) |
| Créer commande | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (`server.ts:998` — **public**) |
| Tracking public par token | — | — | — | — | — | ✅ (`server.ts:815`) |
| Recovery `orderNumber`+`phone` | — | — | — | — | — | ✅ (`server.ts:836`) |

Règles transverses vérifiées : `admin_readonly` et `client` ne peuvent **jamais** changer un statut
(`auth.ts:150-152`) ; un livreur ne peut **jamais** choisir sa commande (`auth.ts:174-175`) ;
un livreur ne peut enregistrer **que** `paid`, jamais `to_collect` (`server.ts:1240-1244`) ;
`paid` exige `status='delivered'` (`server/db.ts:1687-1689`).

⚠️ **`admin_readonly` est un rôle déclaré mais quasi-inerte** : il n'accède qu'à
`/api/stock-movements` et `/api/stats`. Il ne peut **pas** lire les commandes, les produits
(détail admin), les ingrédients ni les livreurs. À VÉRIFIER si c'est l'intention (§7).

⚠️ **`firestore.rules` est du code mort.** Toutes ses fonctions exigent
`request.auth != null` (`firestore.rules:12-13`) et testent `request.auth.token.role` /
`.driverId` / `.phone`. Or l'application **n'utilise pas Firebase Auth** : elle authentifie par
JWT maison (`server/auth.ts:52-63`) et accède à Firestore avec le **SDK client sans session
utilisateur**. `request.auth` est donc toujours `null` ⇒ **toutes les règles retombent sur
`match /{document=**} { allow read, write: if false; }` (`firestore.rules:282-284`)**.
C'est cohérent avec `rulesBlockedDeletionCount` (constat n°23). **La seule sécurité réelle est
celle d'Express.** → Les règles Firestore ne sont **pas** une source de vérité pour les
permissions WordPress ; seule la matrice ci-dessus l'est.

#### (f) Hash canonique d'idempotence — algorithme à reproduire à l'identique

`buildDeterministicOrderHash`, `server.ts:925-995`. SHA-256 sur
`JSON.stringify(canonicalPayload)` où `canonicalPayload` =
`{callerId, phoneNormalized, addressNormalized, clientName, clientNotes, items: canonicalItems}`,
avec pour chaque item `{productId, quantity, protein:{label,grams,price}, veggies:{…}, base:{label,price}, supplements:[{id,quantity}] triés par id, specialInstructions}`.
`callerId` = `client:<userId>` si authentifié, sinon `guest:<phoneNormalisé|'unknown'>`
(`server.ts:1025`). Les items sont triés par
`JSON.stringify(a).localeCompare(JSON.stringify(b))` (`server.ts:980`).

**Trois fragilités de portage PHP, toutes bloquantes pour la sémantique 422/403 :**
1. `JSON.stringify` dépend de **l'ordre d'insertion des clés** — l'ordre ci-dessus doit être
   reproduit **exactement** ;
2. `localeCompare` est **dépendant de la locale ICU** et **diffère d'un tri octet par octet**
   (`strcmp`) — deux implémentations peuvent ordonner différemment deux items, donc produire
   deux hashes différents pour la même commande ;
3. `Number(x) || 0` et `.trim()` ont des cas limites (`NaN`, `Infinity`, espaces Unicode) dont le
   comportement PHP n'est pas identique.

#### (g) Comportements transactionnels réels — ce que MySQL devra reproduire

| Opération | Transactionnel aujourd'hui ? | Détail |
|---|---|---|
| `createOrder` | ✅ **oui**, `runTransaction` unique (`server/db.ts:1142-1425`) | lit `meta/system`, la clé d'idempotence, `meta/counters`, produits, suppléments, ingrédients ; **toutes les lectures avant toute écriture** ; écrit commande + mouvements + stock + clé + compteur |
| `addStockMovement` | ✅ oui, `runTransaction` (`server/db.ts:357-397`) | lecture ingrédient → calcul → `update` + `set` mouvement |
| `updateOrderStatus` | ❌ **NON** | `getDoc` → mutation mémoire → `setDoc` (`server/db.ts:1496-1644`). **Pire** : le rattrapage de stock appelle `addStockMovement` **en boucle**, chacun ouvrant **sa propre transaction** (`server/db.ts:1544-1554`) ⇒ **consommation partielle possible** en cas d'échec à mi-parcours |
| `assignDriver` | ❌ **NON** | `getDoc` → `setDoc` (`server/db.ts:1646-1677`) |
| `updatePaymentStatus` | ❌ **NON** | `updateDoc` seul, **sans historique, sans acteur, sans date** (`server/db.ts:1679-1693`) |
| `driver.totalDeliveries++` | ❌ **NON** | read-modify-write hors transaction de la commande (`server/db.ts:1624-1631`) ⇒ **perte de mise à jour** si deux livraisons simultanées |
| `createDriverWithAccount` | ⚠️ partiel | `writeBatch` (atomique) mais le **contrôle d'unicité du `username` est hors batch** (`server/db.ts:681-685`) ⇒ race |
| `deleteDriver` | ⚠️ partiel | `writeBatch` supprime `drivers` + `users` liés, **sans vérifier les commandes affectées** (`server/db.ts:786-805`) |
| `createClient` / `updateClientProfile` | ⚠️ partiel | `writeBatch` atomique, mais le **contrôle d'unicité du téléphone est hors batch** (`server/db.ts:1830-1833`) ⇒ race |
| `deleteIngredient` | ✅ garde-fou applicatif | `isIngredientInUse` scanne produits, suppléments, **toutes les commandes** et tous les mouvements (`server/db.ts:276-315`) |
| `deleteCategory` | ✅ garde-fou | refuse si des produits sont rattachés (`server/db.ts:229-233`) |
| `deleteProduct` / `deleteSupplement` / `deleteSupplier` | ❌ **aucun garde-fou** | `deleteDoc` direct (`server/db.ts:612-616, 496-500, 255-259`) — **cause démontrée des orphelins de `BEBBA-1071`/`1072`** |

**Exigence MySQL :** toutes les opérations marquées ❌/⚠️ doivent devenir des transactions
`InnoDB` uniques. Deux points d'attention concrets :
- `runTransaction` de Firestore **réessaie automatiquement** en cas de contention ; InnoDB
  **lèvera un deadlock** (`ER_LOCK_DEADLOCK`) → prévoir une **politique de retry** ;
- pour éviter les deadlocks, **verrouiller les ingrédients dans un ordre déterministe**
  (par `ingredient_id` croissant) lors de la consommation multi-ingrédients.

### 1.4 Anomalies réelles consolidées (base de la quarantaine de migration)

Toutes mesurées sur `data/db.json` — aucune n'est hypothétique :

| # | Classe d'anomalie |Occurrences| Exemples | Impact migration |
|---|---|---|---|---|
| A1 | Commande sans aucun montant | **20 / 54** | `BEBBA-1051`…`BEBBA-1070` | `DECIMAL NOT NULL` ⇒ invention de `0,000` |
| A2 | Ligne de commande sans `unitPrice` / `itemTotalPrice` | **20 / 56** | idem | idem |
| A3 | `order.item.productId` orphelin | **2** | `BEBBA-1071`, `BEBBA-1072` | FK dure ⇒ échec d'import |
| A4 | `order.item.supplementId` orphelin | **2** | `BEBBA-1072`, `BEBBA-1071` | FK dure ⇒ échec |
| A5 | `preparationSheet.ingredientId` fantôme | **1** | `BEBBA-1086` → `ing-fantome-inconnu` | FK dure ⇒ échec |
| A6 | `product.baseIngredients.ingredientId` orphelin | **4** | `ing-1`, `ing-4` sur 2 produits | FK dure ⇒ échec |
| A7 | `product.allowedSupplementIds` orphelin | **4** | `sup-1`, `sup-3` sur 2 produits | FK dure ⇒ échec |
| A8 | `supplement.ingredientId` orphelin | **2** | `ing-4` sur 2 suppléments | FK dure ⇒ échec |
| A9 | Divergence `supplierId` ↔ `suppliedIngredients` | **11** | cf. constat n°3 | relation N-N fausse si on suit le tableau |
| A10 | `supplierName` sans `supplierId` | **1** | `ing-1788825545393` → `'marché'` | perte du fournisseur réel |
| A11 | Ingrédient dégénéré (5 champs `null`) | **1** | `test-ing-kitchen-1788896746450` | colonnes `NOT NULL` |
| A12 | Mouvement sans `unit` | **1** | `mov-1788896746487-mce9` | `NOT NULL` |
| A13 | Mouvements sans `orderId`/`orderNumber` | **2** | `mov-1788896746487-mce9`, `mov-3` | FK order |
| A14 | `stockConsumed` absent | **26 / 54** | — | drapeau non fiable (constat n°12) |
| A15 | `stockConsumed ≠ ledger` | **10** | `BEBBA-1063`…`BEBBA-1072` | incohérence à trancher |
| A16 | Historique incomplet vs statut | **1** | `BEBBA-1095` (`ready`, hist. `['received']`) | journal non reconstructible |
| A17 | Doublons d'entrées d'historique | **1** | `BEBBA-1079` (2× `preparing`) | `UNIQUE(order,status)` à proscrire |
| A18 | `timestamp` dupliqués dans l'historique | **6 commandes** | `BEBBA-1093` | `UNIQUE(order_id,timestamp)` ⇒ échec |
| A19 | Entrées d'historique sans `updatedBy` | **7 / 119** | — | acteur inconnu |
| A20 | `updatedBy` non résolvable en utilisateur | **119 / 119** | 20 valeurs libres | aucun `actor_user_id` possible sans table de correspondance |
| A21 | `performedBy` non résolvable | **173 / 173** | 9 valeurs libres | idem |
| A22 | Annulation sans restitution de stock | **1** | `BEBBA-1079` (−1 240 unités) | passif de stock faux |
| A23 | `trackingToken` hors format | **3** | `tk_bebba_10NN_demo` (18 car.) | contrainte de format ⇒ échec |
| A24 | IDs hétérogènes | toutes collections | `ord-1047`, `mov-1`, `cat-<epochms>`, `test-*` | PK naturelle impossible |
| A25 | Options payées sans effet recette/stock | **5** | cf. §1.3(b) | reprise du passif de stock |
| A26 | Substitution de base impossible (silencieuse) | **8** | cf. §1.3(a) | idem |
| A27 | Label d'option non reconnu par le code | **8 labels** | cf. §1.3(a) | comportement non reproduit |
| A28 | Produits invisibles via `availableOnly` | **7** | cf. constat n°6 | changement de comportement |
| A29 | Entités de test dans les données de prod | **≥ 8** | `test-i*`, `test-u*`, `agent_test_audit`, `prod-test-indisponible`, `prod-1788693673602` (« test plat 1 »), 3 commandes `tk_*_demo`, notes `Test A…I` | à purger **ou** à tracer |
| A30 | `totalDeliveries` non dérivable | **3 / 3** | 308 vs 4 livraisons | perte de 304 si recalculé |
| A31 | Stock non dérivable du ledger | **19 / 19** | cf. constat n°20 | mouvement d'ouverture obligatoire |
| A32 | Aucun compte client dans `db.json` | **0 client** | — | source de vérité = Firestore |
| A33 | Aucun `email` utilisateur | **0 / 7** | — | `wp_users.user_email` à synthétiser |
| A34 | `passwordHash` vide dans `db.json` | **7 / 7** | — | source = Firestore ; risque bcrypt (§7) |
| A35 | Aucun horodatage sur `drivers`/`suppliers` | **6 / 6** | — | `created_at` = `NULL` |
| A36 | Même téléphone, identités différentes | **2 numéros** | `99999999` (10 identités), `20123456` (2) | fusion de clients interdite |

---

## 2. Mapping proposé — modèle BEBBA actuel → WordPress + MySQL

### 2.0 Principes directeurs (justifiés par les constats ci-dessus)

| # | Principe | Justification par la preuve |
|---|---|---|
| P1 | **PK techniques `BIGINT UNSIGNED AUTO_INCREMENT` + `legacy_id VARCHAR(64) NULL UNIQUE`** sur toute table issue de Firestore | 4 formats d'ID incompatibles par collection (A24) ; `wp_users.ID` est déjà entier ⇒ les IDs utilisateurs **doivent** changer |
| P2 | **Aucune FK dure (`NOT NULL`) depuis une table historique vers le catalogue** | A3, A4, A5 : orphelins **réels** dans `orders`. Une FK dure bloquerait l'import de commandes clientes existantes |
| P3 | **FK dures (`RESTRICT`) à l'intérieur du catalogue vivant** | `deleteCategory` refuse déjà (`server/db.ts:229`) ; `deleteIngredient` refuse déjà (`server/db.ts:341-351`) |
| P4 | **FK `ON DELETE SET NULL` + instantané textuel** côté commandes | `deleteProduct`/`deleteSupplement`/`deleteSupplier`/`deleteDriver` n'ont **aucun** garde-fou aujourd'hui et ont déjà produit des orphelins |
| P5 | **Jamais de JSON pour une donnée interrogée, jointe, contrainte ou agrégée** | §2.7 liste précisément les 4 structures JSON actuelles à éclater |
| P6 | **Le JSON n'est acceptable que pour du texte de présentation non authoritative** | `summaryLines` (constat n°17) : déjà contradictoire, jamais interrogé |
| P7 | **`DECIMAL`, jamais `FLOAT`/`DOUBLE`** ; montants de commande **`NULL`-ables** | A1/A2 : `null` ≠ `0` ; arrondi réel à 0,1 DT ; `purchaseCost` à 3 décimales |
| P8 | **`utf8mb4` obligatoire** | emoji 4 octets réels dans `summaryLines` (🍗🥩🐟🍚🥦🥑🥚🧀🥣🌿⚠️) et accents (Œufs, Bœuf) |
| P9 | **`DATETIME(3)` en UTC** | ISO-8601 avec millisecondes partout ; 6 commandes ont des `timestamp` d'historique **identiques à la ms** (A18) |
| P10 | **Tout ce qui est lu DANS la transaction de création de commande doit être une ligne SQL, pas une option WP** | `meta/system.state` et `meta/counters.nextOrderSeq` sont lus via `transaction.get` (`server/db.ts:1145,1190`) ; `get_option()` est mis en cache et hors transaction |
| P11 | **Une anomalie détectée ⇒ une ligne de quarantaine, jamais une correction silencieuse** | 36 classes d'anomalies mesurées (§1.4) |

### 2.1 Utilisateurs, clients, rôles et permissions

#### `users` (7 documents, `db.json` + Firestore) → **WordPress natif + 2 tables métier**

| Champ actuel | Preuve | Cible | Justification |
|---|---|---|---|
| `id` (`usr-admin-1`, `cli-<ts>-<rand>`) | `server/db.ts:1837` | `wp_users.ID` (nouvel entier) **+** `bebba_staff.legacy_user_id` / `bebba_clients.legacy_user_id` | `wp_users.ID` est `BIGINT` auto-incrémenté : **impossible de conserver `usr-admin-1`**. Le `legacy_id` est indispensable car `orders.clientId`, `users.driverId`, `statusHistory.updatedBy` et `stockMovements.performedBy` référencent ces IDs |
| `username` | 7/7 staff, **0/0 client** (constat n°10) | `wp_users.user_login` | Pour le staff : reprise directe (minuscules déjà appliquées, `server/db.ts:678`). Pour les clients : **à synthétiser** ⇒ À VÉRIFIER (§7-Q1) |
| `name` | 7/7 | `wp_users.display_name` **+** `first_name`/`last_name` en `wp_usermeta` | `display_name` seul perd la structure ; le front affiche `user.name` brut (`server.ts:1130`) |
| `phone` | 7/7 staff (1 vide) ; clients via `createClient` | **staff** : `wp_usermeta.bebba_phone` — **clients** : `bebba_clients.phone_raw` + `phone_normalized` **UNIQUE** | Le téléphone staff n'est **jamais** utilisé comme clé de recherche (`getClientByPhone` filtre `role=='client'`, `server/db.ts:1801`) ⇒ `usermeta` suffit. Le téléphone client **est** une clé d'unicité et de recherche ⇒ **`wp_usermeta` est inapte** (pas de contrainte d'unicité) |
| `address` | clients uniquement (`server/db.ts:1854` n'existe pas ; `createClient` `data.address`, `server/db.ts:1848`) | `bebba_clients.default_address` (+ table d'adresses si besoin, §7-Q4) | A36 : un même téléphone porte plusieurs adresses ⇒ l'adresse de commande **ne doit pas** être lue depuis le profil |
| `passwordHash` (bcrypt, salt 10) | `server/auth.ts:38-41` | `wp_users.user_pass` | ⚠️ **risque bloquant** : bcryptjs 3.0.3 + `crypt()` PHP ⇒ §7-Q2 |
| `role` (`admin`, `admin_readonly`, `kitchen`, `driver`, `client`) | 7/7 | **rôles WordPress** créés par `add_role()` : `bebba_admin`, `bebba_admin_readonly`, `bebba_kitchen`, `bebba_driver`, `bebba_client` | La matrice RBAC de §1.3(e) devient un jeu de **capabilities**. Ne **pas** réutiliser `administrator`/`editor`/`customer` : les capacités WP par défaut (`edit_posts`, `upload_files`…) donneraient des accès non désirés |
| `active` | 7/7 | **capacité** : retirer `bebba_access` (ou `wp_usermeta.bebba_account_active`) + filtre `authenticate` / `determine_current_user` | `authenticateUser` **re-vérifie `active` à chaque requête** (`server/auth.ts:110-114`) ⇒ révocation immédiate. Un simple `user_status` WP (champ hérité, non utilisé par le core) **ne reproduirait pas** ce comportement. `wp_users.user_status` est **à proscrire** |
| `driverId` | 3/7 | **`bebba_drivers.user_id` UNIQUE** (FK vers `wp_users`) | Relation 1:1 vérifiée exactement (3 users ↔ 3 drivers). **Ne pas mettre en `usermeta`** : c'est une jointure utilisée à chaque requête livreur (`server.ts:695`, `server/db.ts:1497`) et le JWT la transporte (`server/auth.ts:59`) |
| `createdAt` / `updatedAt` | 7/7 | `wp_users.user_registered` ; `updated_at` **n'a pas d'équivalent WP** ⇒ `bebba_staff.updated_at` / `bebba_clients.updated_at` | WP ne trace pas la modification de compte |
| `lastLoginAt` | 5/7 | `wp_usermeta.bebba_last_login_at` | **Aucun équivalent natif WP**. Donnée technique de faible criticité ⇒ `usermeta` acceptable |
| — | — | **`wp_usermap` non nécessaire** ; prévoir **`bebba_id_map_user`** temporaire pendant l'import | Pour résoudre `orders.clientId` et `updatedBy` |

**Décision argumentée : `wp_usermeta` — ce qui y va, ce qui n'y va PAS.**

| Donnée | `wp_usermeta` ? | Raison |
|---|---|---|
| `wp_capabilities` (rôle) | ✅ **obligatoire** | mécanisme natif |
| `first_name`, `last_name` | ✅ | natif |
| `bebba_phone` **staff** | ✅ | jamais utilisé comme clé unique ni joint |
| `bebba_last_login_at` | ✅ | technique, non joint |
| `bebba_account_active` | ✅ (avec filtre d'authentification) | flag binaire, non agrégé |
| `bebba_phone_normalized` **client** | ❌ **NON** | **doit être UNIQUE** et indexé : `wp_usermeta.meta_value` n'est indexé qu'en préfixe (191) et **n'offre aucune contrainte d'unicité**. La race de `createClient` (`server/db.ts:1830-1833`) serait reproduite |
| `bebba_driver_id` | ❌ **NON** | jointure systématique + contrainte 1:1 à garantir ⇒ colonne `bebba_drivers.user_id UNIQUE` |
| `bebba_address` client | ❌ **NON** | A36 : multi-adresses, et l'adresse de commande doit rester un instantané |
| toute donnée de stock, prix, commande | ❌ **NON** | non indexable, non transactionnel, non contraignable |

**Ce qui NE doit PAS devenir une table WordPress :** produits, catégories, ingrédients,
suppléments, commandes, mouvements de stock, fournisseurs, livreurs (profil métier),
compteurs, idempotence. Aucun `wp_posts`, `wp_postmeta`, `wp_terms`, `wp_termmeta`,
`wp_comments` pour le métier.
*Justification :* les volumes et les accès sont transactionnels et agrégés
(`getDashboardStats` parcourt **toutes** les commandes et tous les ingrédients,
`server/db.ts:1696-1748` ; `isIngredientInUse` parcourt **toutes** les commandes,
`server/db.ts:276-315`). `wp_postmeta` est une table EAV sans contrainte de type, sans FK,
avec un index `meta_value` en préfixe — structurellement inapte.

#### `clientPhoneIndex` (collection Firestore, absente de `db.json`) → **table MySQL, plus un index**

| Champ | Preuve | Cible |
|---|---|---|
| document ID = téléphone normalisé (8 derniers chiffres) | `server/db.ts:1788`, `scripts/migrate-to-firestore.ts:127` | **n'existe plus comme entité** : devient `bebba_clients.phone_normalized CHAR(8) NOT NULL UNIQUE` |
| `userId` | `server/db.ts:1789` | `bebba_clients.user_id` (PK, FK `wp_users`) |
| `phone` (brut) | `server/db.ts:1806` | `bebba_clients.phone_raw` — **à conserver** : le format brut affiché diffère (`+216 22 111 222` vs `+216 22222222`, constat sur 12 formats réels) |
| `normalizedPhone` | `server/db.ts:1807` | redondant avec la PK ⇒ **ne pas dupliquer** |
| `name` | `server/db.ts:1808` | **dénormalisation inutile** : `wp_users.display_name` suffit. Risque de dérive (mise à jour non propagée) ⇒ **ne pas migrer** |
| `createdAt` | `server/db.ts:1809` | `wp_users.user_registered` ⇒ **ne pas migrer** |

**Pourquoi cette collection doit disparaître en tant que telle :** elle est un **index de
contournement** imposé par l'absence de requêtes non-équilibrées dans Firestore. Le code le prouve :
`getClientByPhone` fait d'abord une lecture d'index, puis **un scan complet de tous les clients**
en secours, avec **ré-écriture différée de l'index** (`server/db.ts:1800-1812`) — un mécanisme de
réparation d'un index potentiellement désynchronisé. En MySQL, un `UNIQUE INDEX` rend ce
double chemin **inutile et dangereux** (il masque les collisions).
Le script de migration actuel doit d'ailleurs **détecter manuellement les collisions**
(`scripts/migrate-to-firestore.ts:118-124`) et **réconcilier les orphelins**
(`:217-243`) : tout cela disparaît avec une contrainte SQL.

⚠️ **Piège de migration** : `clientPhoneIndex` n'est **pas dans `db.json`** et sa population réelle
est inconnue. Si des index **orphelins** existent dans Firestore (le script les cherche, donc c'est
un risque connu), les importer créerait des clients fantômes. **Ne migrer que les `users` avec
`role='client'`, et régénérer l'index par calcul** — jamais l'inverse.

#### Rôles et capabilities — mapping cible

| Rôle actuel | Rôle WP proposé | Capabilities minimales (dérivées de §1.3(e)) |
|---|---|---|
| `admin` | `bebba_admin` | `bebba_manage_catalog`, `bebba_manage_ingredients`, `bebba_delete_ingredients`, `bebba_manage_stock`, `bebba_read_stock_movements`, `bebba_manage_drivers`, `bebba_manage_suppliers`, `bebba_manage_users`, `bebba_read_all_orders`, `bebba_transition_order_status`, `bebba_assign_driver`, `bebba_cancel_order`, `bebba_collect_payment`, `bebba_read_stats`, `bebba_reset_demo`, `read` |
| `admin_readonly` | `bebba_admin_readonly` | `bebba_read_stock_movements`, `bebba_read_stats`, `read` — **et rien d'autre** (état réel du code ; À VÉRIFIER §7-Q3) |
| `kitchen` | `bebba_kitchen` | `bebba_manage_ingredients`, `bebba_manage_stock`, `bebba_read_orders_active`, `bebba_read_drivers`, `bebba_transition_kitchen` (`received→preparing`, `preparing→ready`), `read` |
| `driver` | `bebba_driver` | `bebba_read_own_orders`, `bebba_transition_delivered` (`delivering→delivered`), `bebba_collect_own_payment`, `read` |
| `client` | `bebba_client` | `bebba_place_order`, `bebba_read_own_orders`, `bebba_track_order`, `read` |
| (aucun) | — | `bebba_place_order` + `bebba_track_order` doivent aussi être accordées à un **rôle public / utilisateur non connecté**, car `POST /api/orders`, `GET /api/products`, `GET /api/categories`, `GET /api/supplements`, `GET /api/orders/track/*` sont **publics** (`server.ts:209,266,325,815,836,998`) |

**Point souvent oublié :** la matrice de transition **par rôle** (`auth.ts:145-181`) ne se réduit pas
à des capabilities booléennes — c'est une fonction `(statut_courant, statut_cible, rôle) → bool`.
Elle doit rester une **règle applicative** (table de transition lue en base ou code), pas un jeu de
capabilities. Je recommande une table `bebba_order_status_transitions` (§3) pour la rendre
auditable et configurable, **avec les 3 colonnes `from_status`, `to_status`, `required_capability`**.

### 2.2 Livreurs (`drivers`)

| Champ actuel | Preuve | Cible | Justification |
|---|---|---|---|
| `id` (`drv-1`…`drv-3`, `drv-<ts>-<rand>`) | `server/db.ts:691` | `bebba_drivers.id` (BIGINT) + `legacy_id` UNIQUE | référencé par `orders.assignedDriverId` (10), `users.driverId` (3), `statusHistory` (texte) |
| `name` | 3/3 | `bebba_drivers.name` | **ne pas** remplacer par `display_name` : `updateDriverWithAccount` synchronise les deux (`server/db.ts:739-745`) mais `orders.assignedDriverName` est un **instantané** |
| `phone` | 3/3 | `bebba_drivers.phone_raw` (+ `phone_normalized`) | formats hétérogènes |
| `vehicle` | 3/3 | `bebba_drivers.vehicle` | texte libre (`'Scooter Honda 125cc (Rapide)'`, `'Vélo Électrique Cargo'`) — **pas** d'entité véhicule dans les données ⇒ ne pas normaliser (À VÉRIFIER §7-Q5) |
| `active` | 3/3 | `bebba_drivers.is_active` | **bloquant métier** : un livreur désactivé ne peut être affecté ni passer en livraison (`server/db.ts:1509-1511`, `1662-1664`, `server.ts:1152-1157`). Doit rester **indépendant** de l'activation du compte WP (`setDriverActiveStatus` synchronise les deux, `server/db.ts:752-770`, mais ce sont deux concepts) |
| `totalDeliveries` | 3/3 | **`bebba_drivers.total_deliveries_opening`** (valeur migrée) ; total = `opening + COUNT(commandes delivered)` | A30 : 308 déclarés vs 4 livraisons tracées. Un compteur unique migré à 308 puis incrémenté **reproduirait la race actuelle** (`server/db.ts:1624-1631`, read-modify-write hors transaction) |
| `rating` | 3/3 | `bebba_drivers.rating DECIMAL(3,2) NULL` — **marqué non authoritative** | constat n°8 : jamais lu, jamais calculé. À ne **pas** exposer comme KPI sans nouvelle source |
| `username` | 0/3 (injecté) | **aucune colonne** — jointure `bebba_drivers.user_id → wp_users.user_login` | `server/db.ts:625-641` |
| `createdAt`/`updatedAt` | 0/3 | colonnes `NULL`-ables | A35 |
| — | — | `bebba_drivers.user_id BIGINT UNSIGNED NULL UNIQUE` | 1:1 vérifié ; `NULL` car `createDriverWithAccount` peut échouer partiellement et `deleteDriver` supprime le user **sans** supprimer les commandes affectées |

**Relation cachée à préserver :** `deleteDriver` supprime **aussi** le compte utilisateur lié
(`server/db.ts:798-802`) mais laisse intactes `orders.assignedDriverId` / `assignedDriverName`.
⇒ En MySQL, `bebba_orders.assigned_driver_id` doit être **`ON DELETE SET NULL`** avec
`assigned_driver_name_snapshot` **`NOT NULL`-able mais conservé**, sinon
`GET /api/orders` côté admin perdrait le nom du livreur historique et
`formatSafeDriverName` (`server.ts:753-760`) renverrait `null` sur le tracking public de commandes
déjà livrées.

### 2.3 Catalogue : catégories, produits, ingrédients, suppléments

#### `categories` → `bebba_categories`

| Actuel | Cible | Note |
|---|---|---|
| `id` | `id` BIGINT + `legacy_id` UNIQUE | |
| `name` | `name VARCHAR(191)` | max réel 26 |
| `slug` | `slug VARCHAR(191) UNIQUE` | 9/9 présents. **Ne pas** utiliser `wp_terms` : la relation produit↔catégorie est **1:N stricte** (`products.categoryId` unique, `server/db.ts:527`), pas N:N comme la taxonomie WP |
| `icon` | `icon VARCHAR(64) NULL` | ⚠️ noms d'icônes **`lucide-react`** (`Salad`, `Flame`, `Baby`, `GlassWater`, `Calendar`, `Sparkles`). En WordPress le front change ⇒ **conserver la valeur** mais prévoir une table de correspondance d'icônes. À VÉRIFIER (§7-Q6) |
| `image`, `imageUrl` | **une seule** colonne `image_url VARCHAR(500) NULL` | 2/9, toujours `''` ⇒ `NULL`. `image` **ne migre pas** |
| `description` | `description TEXT` | |
| `active` | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | |
| `order` + `sortOrder` | **une seule** colonne `sort_order INT NOT NULL DEFAULT 0` = `COALESCE(sortOrder, order, 0)` | `server/db.ts:181-184` |
| `createdAt`, `updatedAt` | `created_at DATETIME(3) NULL`, `updated_at DATETIME(3) NULL` | 5/9 seulement (A35) |

**Règle de suppression à reproduire :** `RESTRICT` depuis `bebba_products.category_id`
(`server/db.ts:229-233` refuse déjà la suppression si des produits sont rattachés).

#### `products` → `bebba_products` + 4 tables de relations

| Actuel | Cible | Note |
|---|---|---|
| `id` | `id` + `legacy_id` UNIQUE | |
| `name`, `description` | colonnes directes | max 43 / 134 car. réels |
| `categoryId` | `category_id` FK **`RESTRICT` NOT NULL** | obligatoire (`server/db.ts:571-573`) |
| `basePrice` | `base_price DECIMAL(10,3) NOT NULL` | validation `>= 0` (`server/db.ts:568-570`) ; arrondi réel à 0,1 DT mais `DECIMAL(10,3)` évite toute perte |
| `imageUrl` (+ `image`) | `image_url VARCHAR(500)` — **une seule colonne** | valeur par défaut codée en dur dans `saveProduct` (`server/db.ts:582`) : à conserver comme défaut applicatif, pas comme donnée |
| `calories`, `proteinGrams`, `carbsGrams`, `fatGrams` | 4 colonnes `SMALLINT UNSIGNED NULL` | 22/23 ; 1 produit sans valeurs ⇒ `NULL`, **pas 0** |
| `active` | `is_active BOOLEAN NOT NULL` | |
| `isAvailable` + `available` | **une seule** colonne `is_available` — **décision explicite requise** | constat n°6 / A28 : `COALESCE(available, isAvailable)` **change le comportement** de `availableOnly` pour 7 produits phares. Recommandation : `is_available = COALESCE(...)` **ET** journaliser les 7 produits en quarantaine (A28) pour décision humaine |
| `isPopular` | `is_popular BOOLEAN NOT NULL DEFAULT FALSE` | 23/23 |
| `order` + `sortOrder` | `sort_order INT NOT NULL DEFAULT 0` | jamais en contradiction (vérifié) |
| `createdAt`, `updatedAt` | `NULL`-ables | 16/23 |
| `hasInactiveIngredient` | **donnée calculée — ne pas migrer** | `server/db.ts:517-524` ; en SQL : `EXISTS (… JOIN bebba_product_ingredients … WHERE is_active = FALSE)` |
| **`baseIngredients[]`** | **table `bebba_product_ingredients`** | voir §2.7 |
| **`customization{}`** | **3 tables** : `bebba_product_option_groups`, `bebba_product_options`, `bebba_product_option_effects` + `bebba_product_supplements` | voir §2.7 |

#### `ingredients` → `bebba_ingredients`

| Actuel | Cible | Note |
|---|---|---|
| `id` | `id` + `legacy_id` UNIQUE | ⚠️ **les IDs sont porteurs de sens dans le code** (`includes('poulet')`, `ing-riz`, `ing-quinoa`…). Conserver `legacy_id` est **obligatoire** pour reconstituer `bebba_product_option_effects` (§2.7) |
| `name` | `name VARCHAR(191) NOT NULL` | max réel 39 |
| `unit` | `unit_code` FK → `bebba_units` **NULL-able** | A11 : 1 ingrédient sans unité. Valeurs réelles : `g`, `ml`, `piece`, `portion` |
| `currentStock` | `current_stock DECIMAL(12,3) NULL` | **`NULL`-able** : A11. Un `NOT NULL DEFAULT 0` rendrait `test-ing-kitchen-…` « en rupture » au lieu de « inconnu » |
| `minThreshold` | `min_threshold DECIMAL(12,3) NULL` | utilisé par `lowStockCount` (`server/db.ts:1722`) avec `<=` |
| `purchaseCost` | `purchase_cost DECIMAL(12,4) NULL` | **3 décimales réelles** (`0.016`, `0.002`) ; jamais lu par le code métier ⇒ À VÉRIFIER (§7-Q7) |
| `supplierId` | `default_supplier_id` FK **`SET NULL`** NULL-able | 17/19 ; **relation authoritative** (constat n°3) |
| `supplierName` | `supplier_name_free VARCHAR(191) NULL` — **colonne distincte** | A10 : `'marché'` sans `supplierId`. Ce n'est **pas** une dénormalisation de la FK : c'est un fournisseur non référencé |
| `category` | `ingredient_category_id` FK → `bebba_ingredient_categories` NULL-able, **+** `legacy_category_text` | 8 valeurs libres non normalisées (`Légumes` vs `Légumes & Fruits`). Non lu par le code ⇒ ne pas inventer de hiérarchie |
| `active` | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | 5/19 présents ; le code teste `active === false` ⇒ **absent = actif** (vérifié `server/db.ts:325`, `522`, `929`) |
| `createdAt` | `NULL`-able | 6/19 |
| `updatedAt` | `NOT NULL` | 19/19 |
| — | **`row_version INT UNSIGNED NOT NULL DEFAULT 0`** | **ajout recommandé** : `addStockMovement` fait un read-modify-write (`server/db.ts:376`). En MySQL, l'écriture doit être `SET current_stock = current_stock + ?` (atomique) **ou** protégée par verrou pessimiste/optimiste |
| — | **`is_tombstone BOOLEAN NOT NULL DEFAULT FALSE`** | **ajout indispensable** pour A6/A8 : `ing-1`, `ing-4` n'existent pas mais sont référencés par des produits **vivants**. Créer des lignes fantômes marquées permet de **satisfaire les FK tout en rendant l'anomalie requêtable** (`WHERE is_tombstone = TRUE`), au lieu de la cacher dans un JSON |

#### `supplements` → `bebba_supplements`

| Actuel | Cible | Note |
|---|---|---|
| `id`, `name`, `description` | colonnes directes | max 18 / 47 / ~60 |
| `price` | `price DECIMAL(10,3) NOT NULL` | validation `>= 0` (`server/db.ts:459-461`) ; arrondi à 0,1 DT (`:481`) |
| `ingredientId` | `ingredient_id` FK **`SET NULL`** NULL-able | A8 : 2 orphelins (`ing-4`) ⇒ FK dure impossible |
| `ingredientName` | `ingredient_name_snapshot VARCHAR(191) NULL` | dénormalisation **qui peut dériver** (0 divergence aujourd'hui, vérifié). Conserver car `computePreparationSheet` l'utilise en secours (`server/db.ts:1024`) |
| `quantityConsumed` + `quantity` | **une seule** colonne `quantity_per_unit DECIMAL(12,3) NOT NULL` = `COALESCE(quantityConsumed, quantity, 100)` | défaut **100** codé en dur (`server/db.ts:466`, `1013`) — à conserver comme défaut applicatif |
| `unit` | `unit_code` FK NULL-able | recopié depuis l'ingrédient à l'écriture (`server/db.ts:485`) |
| `available` + `isAvailable` | **une seule** colonne `is_available` | 10/10 `available`, 2/10 `isAvailable`, jamais en contradiction |
| `active` | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | |
| `order` + `sortOrder` | `sort_order INT NOT NULL DEFAULT 0` | défaut **10** (`server/db.ts:465`) |
| `createdAt`, `updatedAt` | `NULL`-ables | 2/10 |
| `ingredientActive` | **calculé — ne pas migrer** | `server/db.ts:424-426, 448-450` |

⚠️ **Règle métier à reproduire, facilement oubliée :** un supplément est indisponible si
**son ingrédient est inactif**, indépendamment de ses propres drapeaux
(`server/db.ts:429-431` filtre `activeOnly` sur `s.active && s.ingredientActive !== false` ;
`computePreparationSheet:1003-1006` **lève une erreur** à la commande).
⇒ C'est une **règle transitive ingrédient → supplément → produit**, qui doit exister comme
contrainte applicative **et** comme requête, pas comme colonne.

### 2.4 Fournisseurs (`suppliers`)

| Actuel | Cible | Note |
|---|---|---|
| `id`, `name`, `phone`, `address` | `bebba_suppliers.*` | |
| `email` | `bebba_suppliers.email VARCHAR(191) NULL` | **seul email du projet** (constat sur `grep email`) |
| **`suppliedIngredients[]`** | **table de liaison `bebba_supplier_ingredients`** | relation **N-N** déclarée. ⚠️ **11 divergences** avec `ingredients.supplierId` (constat n°3). La table de liaison doit porter **`source ENUM('supplier_array','ingredient_field','both')`** pour tracer l'origine de chaque ligne et permettre la réconciliation. **Ne pas** fusionner silencieusement |
| — | `created_at`, `updated_at` `NULL` | A35 : aucun horodatage aujourd'hui |
| — | **`bebba_supplier_deliveries` — À VÉRIFIER, non créée d'office** | constat n°21 : `'Bon #4891'` prouve l'existence d'une notion de réception fournisseur **sans entité**. Aucune donnée structurée n'existe ⇒ je **ne** propose **pas** de table pleine, mais je signale le besoin : sans elle, le seul `replenishment` réel restera non rapprochable |

**Règle de suppression :** `deleteSupplier` n'a **aucun** garde-fou (`server/db.ts:255-259`).
⇒ `bebba_ingredients.default_supplier_id ON DELETE SET NULL` **et** conservation de
`supplier_name_free`, sinon le nom du fournisseur disparaît des ingrédients.

### 2.5 Stock : état et mouvements

#### État actuel — `ingredients.currentStock`

Le stock est un **état mutable autonome**, pas une projection du journal (constat n°20).
Deux écritures seulement :
1. `addStockMovement` : `currentStock += quantity` (`server/db.ts:376`) — arrondi à 0,1 ;
2. `createOrder` : `currentStock -= required` (`server/db.ts:1394-1397`) — arrondi à 0,1 ;
3. `resetDemoData` : **réécriture absolue** des 17 valeurs nominales (`server/db.ts:2086-2093`).

**Cible :** `bebba_ingredients.current_stock` (état, pour la lecture rapide et le verrouillage)
**+** `bebba_stock_movements` (journal append-only) **+** mouvement `opening_balance` à l'import.

**Choix assumé et justifié :** conserver **les deux** (état + journal) plutôt que de tout dériver.
Raison : le journal actuel est **incomplet** (A31) et le code de contrôle de disponibilité lit
l'état directement dans la transaction (`server/db.ts:1310-1312`). Une dérivation pure exigerait
de rejouer 100 % des mouvements à chaque commande. En revanche, ajouter
**`balance_after DECIMAL(12,3) NULL`** sur chaque mouvement permet un **rapprochement
périodique** (`balance_after` du dernier mouvement vs `current_stock`) — impossible aujourd'hui.

#### Les 7 types de mouvements — mapping et sémantique de signe

| Type déclaré | Réel ? | Signe observé | Cible MySQL | Règle de signe à imposer |
|---|---|---|---|---|
| `order_consumption` | ✅ 171 | **toujours négatif** (171/171) | ENUM conservé | **`< 0` obligatoire** ; `order_id NOT NULL` obligatoire |
| `replenishment` | ⚠️ code uniquement (`AdminView.tsx:273`), 0 donnée | positif attendu | ENUM conservé | `> 0` ; **devrait** porter une référence fournisseur (constat n°21) |
| `manual_in` | ✅ 2 (valeur **par défaut** de l'API) | positif (2/2) | ENUM conservé | `> 0` |
| `manual_out` | ❌ jamais produit | — | ENUM conservé **pour l'avenir** | `< 0` |
| `inventory_correction` | ❌ jamais produit | — | ENUM conservé | signe libre, **`reason_code` obligatoire** |
| `waste` | ❌ jamais produit | — | ENUM conservé | `< 0` |
| `order_cancellation_restore` | ❌ **déclaré, jamais implémenté** (constat n°15) | — | ENUM conservé **+ implémentation obligatoire** | `> 0` ; `order_id NOT NULL` |
| **`opening_balance`** | — | — | **ENUM à AJOUTER** | `> 0` ou `= 0` ; **`order_id` interdit** ; une seule ligne par ingrédient à l'import |

**Pourquoi `opening_balance` est obligatoire et non optionnel :** sans lui, la somme algébrique du
journal ne peut **jamais** être comparée à `current_stock` (écart réel de +4 430 sur `ing-poulet`).
Tout futur audit de stock échouerait dès le premier jour.

**Pourquoi `order_cancellation_restore` doit être implémenté pendant la migration :**
`BEBBA-1079` a consommé 1 240 unités puis a été annulée sans restitution (constat n°15).
Si l'on migre `current_stock` tel quel, **le passif erroné est transféré**. Deux options, à trancher
(§7-Q8) : (a) migrer l'état actuel et **journaliser un écart d'ouverture documenté**, (b) recalculer
un stock corrigé en rejouant les annulations. **Ne jamais** corriger silencieusement.

#### `stockMovements` → `bebba_stock_movements`

| Actuel | Cible | Note |
|---|---|---|
| `id` (`mov-<ts>-<rand>`, `mov-1`) | `id` BIGINT + `legacy_id` UNIQUE | A24 : 2 formats |
| `ingredientId` | `ingredient_id` FK **NOT NULL** `RESTRICT` | **0 orphelin sur 173** (vérifié) ⇒ seule table où la FK dure est sûre |
| `ingredientName` | `ingredient_name_snapshot NOT NULL` | **historique à figer** : 173/173. Un ingrédient renommé ne doit pas réécrire le journal |
| `type` | `movement_type ENUM(...) NOT NULL` | **à contraindre** : l'API actuelle accepte n'importe quelle chaîne (constat n°19) |
| `quantity` | `quantity_delta DECIMAL(12,3) NOT NULL` | **signée** ; 171 négatives, 2 positives |
| `unit` | `unit_code` FK **NULL-able** | A12 : 1 mouvement sans unité |
| `orderId` | `order_id` FK **NULL-able** `SET NULL` | A13 : 2 mouvements sans commande |
| `orderNumber` | `order_number_snapshot VARCHAR(32) NULL` | **à figer** : `orderNumber` est l'identifiant **public** (utilisé par `track-lookup`, `server/db.ts:1461-1489`) |
| — | **`order_item_id` FK NULL — AJOUT recommandé** | Le mouvement actuel est agrégé **par commande et par ingrédient** (`requiredStockMap`, `server/db.ts:1240, 1296-1310`) : impossible de savoir quelle **ligne** a consommé quoi. Utile pour la restitution partielle et l'analyse de marge |
| `notes` | `notes VARCHAR(255) NULL` | max réel 69. ⚠️ contient `'Bon #4891'` (constat n°21) : à **extraire** dans `reference_document` si une entité réception est créée |
| `timestamp` | `occurred_at DATETIME(3) NOT NULL` | |
| `performedBy` | **`performed_by_label_snapshot VARCHAR(191) NOT NULL`** + **`performed_by_user_id` FK NULL** | A21 : 9 valeurs libres, **aucune** résolvable. Il faut **conserver le texte** (seule information réelle) et laisser `user_id NULL`. Ne **pas** tenter un mapping automatique : `'BEBBA KDS Moteur Automatique'`, `'Chef'`, `'Chef Test'` ne correspondent à aucun compte |
| — | **`reason_code ENUM NULL` — AJOUT recommandé** | `notes` est libre ; sans code, aucun agrégat de pertes/gaspillages n'est possible |
| — | **`balance_after DECIMAL(12,3) NULL` — AJOUT recommandé** | rapprochement journal ↔ état |
| — | `created_at DATETIME(3)` | distinguer « quand le mouvement s'est produit » de « quand il a été saisi » — aujourd'hui confondus |

**Append-only :** `firestore.rules:179-180` impose déjà `allow delete: if false` et
`allow update: if false` sur `stockMovements`. **C'est la seule règle Firestore dont la sémantique
doit être conservée** (les autres sont mortes, §1.3(e)) ⇒ en MySQL : aucun `UPDATE`/`DELETE`
applicatif, éventuellement un trigger de protection.

### 2.6 Commandes, lignes, historique, livraison, encaissement

#### `orders` → `bebba_orders`

| Actuel | Cible | Note |
|---|---|---|
| `id` | `id` BIGINT + `legacy_id` UNIQUE | A24 |
| `orderNumber` | `order_number VARCHAR(32) NOT NULL **UNIQUE**` | **54 valeurs, 0 doublon**. Contrainte indispensable (constat n°23) |
| — | **`order_seq INT UNSIGNED NOT NULL UNIQUE`** | **AJOUT indispensable** : extraire `1100` de `'BEBBA-1100'`. Permet (a) d'initialiser la séquence à `MAX+1` au lieu d'une constante codée en dur, (b) un tri numérique correct, (c) de détecter les collisions. Sans lui, le tri est lexicographique (`BEBBA-10000` < `BEBBA-9999`) |
| `trackingToken` | `tracking_token VARCHAR(64) NOT NULL UNIQUE` | A23 : 2 formats (15 et 18 car.). **Ne pas** contraindre le format — les 3 tokens `_demo` existent. C'est la **seule clé d'accès public anonyme** (`server.ts:815-834`) ⇒ UNIQUE + indexé |
| `createdAt` | `created_at DATETIME(3) NOT NULL` | 0 doublon (vérifié) |
| `clientId` | `client_user_id` FK → `wp_users` **NULL-able** `SET NULL` | **0/54 dans `db.json`** mais écrit par `createOrder` (`server/db.ts:1354`) et utilisé par `getOrdersByClientId` (`:1439-1446`) + l'anti-IDOR (`server.ts:892-…`). ⚠️ **anti-spoofing à reproduire** : le `clientId` du body est **ignoré**, seul le JWT fait foi (`server.ts:1014-1020`) |
| `client.name` | `client_name_snapshot VARCHAR(191) NOT NULL` | **figé** (§5) |
| `client.phone` | `client_phone_raw VARCHAR(32) NOT NULL` **+** `client_phone_normalized CHAR(8) NOT NULL INDEX` | 12 formats bruts réels. Le normalisé est **indispensable** à `track-lookup` (`server/db.ts:1474-1486`) : sans index, chaque recherche publique scanne toutes les commandes |
| `client.deliveryAddress` | `client_delivery_address VARCHAR(255) NOT NULL` | max réel 63 |
| `client.notes` | `client_notes TEXT NULL` | présent 54/54 (souvent `''`) ; lu par le livreur (`DriverView.tsx:254-256`) |
| — | **`client_address_normalized VARCHAR(255) NULL` — AJOUT optionnel** | `normalizeAddress` (`server/db.ts:109-113`) n'est utilisé **que** pour le hash d'idempotence (`server.ts:940`). Le stocker évite de recalculer et garantit la reproductibilité du hash |
| `items[]` | **table `bebba_order_items`** | §2.7 |
| `subtotal` | `subtotal DECIMAL(10,3) **NULL**` | A1 : 20 `null`. **`NULL` ≠ 0** |
| `deliveryFee` | `delivery_fee DECIMAL(10,3) NOT NULL` | 54/54 à `2.5`. **Doit rester une colonne de la commande**, pas une lecture de setting au moment de l'affichage : c'est un **instantané** (§5) |
| `totalAmount` | `total_amount DECIMAL(10,3) **NULL**` | A1 |
| `status` | `status ENUM(7 valeurs) NOT NULL` | **conserver `ready`** (constat n°13 : 3 commandes réelles) |
| `paymentMethod` | `payment_method ENUM('cash_on_delivery') NOT NULL` | 54/54. ENUM à 1 valeur **volontairement** : toute autre valeur est aujourd'hui impossible ; élargir serait un changement métier (À VÉRIFIER §7-Q9) |
| `paymentStatus` | `payment_status ENUM('to_collect','paid') NOT NULL` | 51/3. Conserver sur la commande pour le filtrage (`AdminView.tsx:229,240`, `DriverView.tsx:61-62`) |
| `assignedDriverId` | `assigned_driver_id` FK **NULL** `SET NULL` | 10/54. **Ne pas** lier au statut : 2 commandes ont un livreur affecté alors que `status='ready'` (vérifié) |
| `assignedDriverName` | `assigned_driver_name_snapshot VARCHAR(191) NULL` | **figé** : survit à `deleteDriver` et au renommage |
| `stockConsumed` | **`stock_state ENUM('not_consumed','consumed','restored') NOT NULL`** | A14/A15 : booléen absent 26/54 et **contredit par le ledger** 10 fois. Un ENUM à 3 états est nécessaire pour représenter la restitution d'annulation (aujourd'hui impossible à exprimer). **Valeur d'import = dérivée du ledger**, pas du drapeau |
| `statusHistory[]` | **table `bebba_order_status_history`** | §2.7 |

⚠️ **Aucune donnée de livraison structurée n'existe** : pas d'heure de prise en charge, pas d'heure
de remise, pas de zone, pas de distance, pas de preuve de livraison, pas de montant de frais
variable. Tout est **dérivable de `statusHistory`** (`delivering`, `delivered`).
⇒ Je **ne** propose **pas** de table `bebba_deliveries` : elle serait vide. Les horodatages de
livraison viennent de l'historique. **À VÉRIFIER** si le métier veut un objet livraison (§7-Q10).

⚠️ **Aucune donnée d'encaissement n'existe au-delà du drapeau.** `updatePaymentStatus`
(`server/db.ts:1679-1693`) écrit **un seul champ**, sans acteur, sans date, sans montant,
**sans entrée d'historique**. Pourtant :
- `DriverView.tsx:61-62, 371-373` calcule « encaissé aujourd'hui » / « restant à encaisser »
  **par livreur et par jour** à partir du drapeau et de `totalAmount` ;
- `getDashboardStats` calcule `totalCollectedCash` et `pendingCashToCollect` (`server/db.ts:1714-1720`) ;
- **`BEBBA-1091` est `delivered` et `to_collect`** (vérifié) : une caisse en attente non datée.

⇒ **`bebba_order_payments` est un AJOUT nécessaire, pas une migration** (rien à importer dedans,
sauf valeurs dérivées). Sans elle, la réconciliation de caisse livreur reste **impossible à auditer**
et le passage à MySQL **pérenniserait** la lacune.

#### `orders[].items` → `bebba_order_items`

| Actuel | Cible | Note |
|---|---|---|
| `id` (`item-<rand7>`) | `id` BIGINT + `legacy_id` NULL | constat n°18 : aucune valeur métier, **non unique par construction** ⇒ `legacy_id` **sans** contrainte UNIQUE, ou UNIQUE **tolérante aux collisions** (0 collision constatée sur 56, mais le risque existe) |
| position dans le tableau | **`position SMALLINT NOT NULL`** | **AJOUT indispensable** : l'ordre du tableau est **significatif** (affichage cuisine et client) et n'est aujourd'hui porté par aucune donnée |
| `productId` | `product_id` FK **NULL** `SET NULL` | A3 : 2 orphelins réels |
| `productName` | `product_name_snapshot VARCHAR(191) NOT NULL` | **figé** (§5) |
| `unitPrice` | `unit_price DECIMAL(10,3) **NULL**` | A2 : 20 `null`. ⚠️ ce n'est **pas** `product.basePrice` : c'est `basePrice + extras + suppléments` (`server/db.ts:1035`) — un **prix unitaire personnalisé**. Le nom prête à confusion ⇒ renommer `unit_price_after_options` dans le modèle cible |
| `quantity` | `quantity SMALLINT UNSIGNED NOT NULL` | bornes 1…100 (`server/db.ts:1256-1264`) |
| `itemTotalPrice` | `item_total_price DECIMAL(10,3) **NULL**` | A2 |
| `proteinOption{label,extraPrice,extraGrams}` | **3 colonnes d'instantané** + `protein_option_id` FK NULL | 11/56. **Double rôle** : `option_id` pour l'analyse, les 3 colonnes pour l'histoire. Ne **pas** garder l'objet en JSON : il est **interrogé** (masquage public `server.ts:786`, affichage cuisine `KitchenView.tsx:359`) et il entre dans le **hash d'idempotence** |
| `veggiesOption{…}` | idem | 7/56 |
| `baseChoice{label,extraPrice}` | **2 colonnes d'instantané** + `base_choice_option_id` FK NULL | 26/56 |
| `supplements[]` | **table `bebba_order_item_supplements`** | §2.7 |
| `specialInstructions` | `special_instructions TEXT NULL` | **1/56** mais **critique pour la cuisine** : `computePreparationSheet:1082-1084` l'injecte dans `summaryLines` avec un `⚠️ NOTE CLIENT` |
| `preparationSheet.totalIngredients[]` | **table `bebba_order_item_ingredients`** | §2.7 |
| `preparationSheet.summaryLines[]` | **ne pas migrer comme donnée authoritative** | constat n°17 : sémantique **contradictoire** selon l'origine. À régénérer. Archivage brut en quarantaine (§4.4) |

**Décision argumentée — colonnes fixes vs table générique d'options.**
J'ai évalué les deux. Je recommande **3 axes fixes** (`protein`, `veggies`, `base`) :
1. les données réelles ne contiennent **exactement que ces 3 axes** (26 + 11 + 7 occurrences, 0 autre) ;
2. `types.ts:141-143` **et** `buildDeterministicOrderHash` (`server.ts:955-964`) les traitent comme
   des champs **nommés et typés** — une table générique EAV **casserait la reproductibilité du hash** ;
3. `computePreparationSheet` applique un **traitement différent par axe** (grammes ajoutés vs
   substitution d'ingrédient) — une modélisation générique masquerait cette asymétrie.
**Contrepartie assumée :** ajouter un 4ᵉ axe (ex. « sauce », « cuisson ») exigera une évolution de
schéma. C'est un coût accepté, inférieur au risque sur le hash et sur la recette.

#### `orders[].items[].supplements` → `bebba_order_item_supplements`

| Actuel | Cible | Note |
|---|---|---|
| `supplementId` | `supplement_id` FK **NULL** `SET NULL` | A4 : 1 orphelin réel |
| `name` | `supplement_name_snapshot NOT NULL` | **figé** |
| `price` | `unit_price_snapshot DECIMAL(10,3) NOT NULL` | **figé** : `supDef.price` au moment de la commande (`server/db.ts:1015`) |
| `quantity` | `quantity SMALLINT UNSIGNED NOT NULL` | nombre de portions demandées |
| `ingredientId` | `ingredient_id` FK **NULL** `SET NULL` | **figé** |
| `ingredientName` | `ingredient_name_snapshot NOT NULL` | **figé** |
| `quantityConsumed` | **`quantity_consumed_total DECIMAL(12,3) NOT NULL`** — **RENOMMER** | ⚠️ ici c'est `quantityConsumed × quantity` (**total**, `server/db.ts:1013`) alors que dans `supplements` c'est unitaire. **Même nom, deux sémantiques** ⇒ le renommage est une exigence d'intégrité, pas un détail |
| `unit` | `unit_code` FK NULL | **figé** |
| `position` | `position SMALLINT NOT NULL` | **AJOUT** : l'ordre d'affichage cuisine |

#### `orders[].statusHistory` → `bebba_order_status_history`

| Actuel | Cible | Note |
|---|---|---|
| (position dans le tableau) | **`id` BIGINT AUTO_INCREMENT + `seq SMALLINT NOT NULL`, `UNIQUE(order_id, seq)`** | **AJOUT indispensable** : A18 (6 commandes avec `timestamp` identiques à la ms) rend toute contrainte sur `(order_id, timestamp)` **impossible**. L'ordre du tableau est la seule information d'ordonnancement fiable |
| `status` | `status ENUM(...) **NULL**` | A17/constat n°14 : `assignDriver` pousse une entrée **sans changer le statut** (`server/db.ts:1668-1674`). Rendre `status` non-NULL forcerait à mentir. `NULL` + `event_type` exprime la réalité |
| — | **`event_type ENUM('status_change','driver_assignment','payment_change','note','system','stock_correction') NOT NULL`** | **AJOUT indispensable** : l'historique actuel **mélange** changements de statut, affectations de livreur et (rien pour le paiement). Sans cette colonne, `'Livreur affecté : X'` est indiscernable d'une transition |
| `label` | `label VARCHAR(191) NOT NULL` | **figé** : 8 valeurs réelles dont **3 variantes pour `received`** (constat n°14). Non dérivable du statut |
| `note` | `note TEXT NULL` | 119/119 (souvent `''`) |
| `updatedBy` | **`actor_label_snapshot VARCHAR(191) NULL`** + **`actor_user_id` FK NULL** | A19 (7 absents), A20 (119/119 non résolvables, 20 valeurs libres dont `'Tentative Doublon'`). **Conserver le texte** ; `user_id` reste `NULL` sauf mapping humain validé |
| `timestamp` | `occurred_at DATETIME(3) NOT NULL` | ⚠️ **conserver la valeur d'origine**, ne pas régénérer |
| — | **`is_legacy_inconsistent BOOLEAN`** (ou quarantaine) | A16 (`BEBBA-1095`), A17 (`BEBBA-1079`) : marquer plutôt que corriger |

**Règle cible à imposer (absente aujourd'hui) :** `bebba_orders.status` doit être **égal au statut de
la dernière ligne `event_type='status_change'`**. Aujourd'hui ce n'est **pas** le cas (`BEBBA-1095`).
En MySQL, l'écriture du statut **et** de l'historique doivent être dans la **même transaction**
— ce que `updateOrderStatus` ne fait **pas** (`server/db.ts:1496-1644`, `getDoc` → `setDoc`).

#### Encaissement COD — `bebba_order_payments` (AJOUT)

| Colonne proposée | Origine | Justification |
|---|---|---|
| `id`, `order_id` FK NOT NULL | — | 1 ligne minimum par commande |
| `method ENUM('cash_on_delivery')` | `orders.paymentMethod` | |
| `amount_expected DECIMAL(10,3) NULL` | `orders.totalAmount` | **NULL-able** : A1 |
| `amount_collected DECIMAL(10,3) NULL` | **n'existe pas** | aujourd'hui implicite = `totalAmount` |
| `status ENUM('to_collect','paid')` | `orders.paymentStatus` | |
| `collected_at DATETIME(3) NULL` | **n'existe pas** | `updatePaymentStatus` ne date rien (`server/db.ts:1679-1693`) ; `DriverView` reconstruit « aujourd'hui » depuis `createdAt` de la commande, **pas** depuis l'encaissement ⇒ **faux** si l'encaissement est tardif |
| `collected_by_user_id` FK NULL, `collected_by_driver_id` FK NULL | **n'existe pas** | `server.ts:1224-1244` autorise admin **ou** livreur affecté, mais **ne trace pas qui** |
| `note` | — | |

**Règle métier à conserver :** `paid` exige `status='delivered'` (`server/db.ts:1687-1689`,
`server.ts:1231-1234`). **Donnée réelle contradictoire : aucune** (`paid but not delivered` = 0,
vérifié) — la règle tient. En revanche **1 commande `delivered` et `to_collect`** (`BEBBA-1091`) :
encaissement en suspens, non datable aujourd'hui.

### 2.7 Les 4 structures imbriquées qui NE DOIVENT PAS rester du JSON

C'est le point le plus important du mapping. `db.json` contient **4 structures imbriquées**.
Trois doivent devenir des tables ; une seule peut rester du texte.

| Structure actuelle | Volume réel | Interrogée / jointe / contrainte par le code ? | Verdict |
|---|---|---|---|
| `products[].baseIngredients[]` | 23 produits, **jusqu'à 6 lignes**, 4 orphelines (A6) | **OUI** : `isIngredientInUse` filtre dessus (`server/db.ts:290-292`), `computePreparationSheet` itère (`:925-933`), `createOrder` construit `neededIngredientIds` (`:1211-1213`) | **TABLE `bebba_product_ingredients`** |
| `products[].customization.allowedSupplementIds[]` | 23 produits, **jusqu'à 10**, 4 orphelines (A7) | **OUI** : c'est une relation **N-N** produit↔supplément, filtrée côté front | **TABLE `bebba_product_supplements`** |
| `products[].customization.{proteinOptions,veggiesOptions,baseChoices}[]` | 11 / 10 / 12 produits concernés ; **19 labels de base distincts** | **OUI** : résolution par label (`server/db.ts:864-921`), validation stricte, **et inclusion dans le hash d'idempotence** (`server.ts:955-964`) | **TABLES `bebba_product_option_groups` + `bebba_product_options`** |
| `orders[].items[].preparationSheet.totalIngredients[]` | 56 lignes, **1 fantôme** (A5) | **OUI** : `isIngredientInUse` le traverse (`server/db.ts:295-297`), `updateOrderStatus` recalcule le stock **depuis lui** (`:1531-1541`) | **TABLE `bebba_order_item_ingredients`** |
| `orders[].items[].preparationSheet.summaryLines[]` | 56 lignes, jusqu'à ~7 chaînes | **NON** : uniquement rendu (`KitchenView.tsx:335-336`) | **Ne pas migrer** comme authoritative ; régénérer |
| `orders[].items[]` / `orders[].statusHistory[]` | 56 / 119 | **OUI** | **TABLES** (déjà traitées) |
| `suppliers[].suppliedIngredients[]` | 3, jusqu'à 3 IDs, **11 divergences** | **NON lu** (constat n°3) | **TABLE de liaison `bebba_supplier_ingredients`** avec traçabilité d'origine |
| `orders[].client{}` | 54 | **OUI** (masquage, `track-lookup`, affichage livreur) | **Colonnes plates sur `bebba_orders`** — pas de table séparée (1:1 strict, A36 interdit la mutualisation) |

#### `bebba_product_ingredients` — la recette

| Colonne | Origine | Note |
|---|---|---|
| `product_id`, `ingredient_id` | `baseIngredients[].ingredientId` | **PK composée**. `ingredient_id` **NULL-able** + `legacy_ingredient_id VARCHAR(64)` pour A6 (`ing-1`, `ing-4`) **ou** ingrédient fantôme marqué `is_tombstone` |
| `quantity` | `baseIngredients[].quantity` | `DECIMAL(12,3) NOT NULL` |
| `unit_code` | `baseIngredients[].unit` | ⚠️ **recopié**, peut diverger de `ingredients.unit` (0 divergence constatée, mais aucune contrainte) |
| `ingredient_name_snapshot` | `baseIngredients[].ingredientName` | ⚠️ **dénormalisation du vivant** : ici ce n'est **pas** de l'historique. **Recommandation : ne PAS la stocker** (jointure suffisante) — sauf si l'on veut reproduire `computePreparationSheet:929` qui utilise ce nom **et non** celui de l'ingrédient. **À VÉRIFIER** (§7-Q11) |
| `position` | ordre du tableau | **AJOUT indispensable** : §1.3(b) démontre que **l'ordre du tableau change le résultat de la recette** (`find()` renvoie le premier match). Sans `position`, `prod-mix-grill-fitness` peut voir ses +100 g basculer du poulet au bœuf |
| `role_tag ENUM('protein','vegetable','starch','sauce','other') NULL` | **n'existe pas** | **AJOUT recommandé** : c'est la seule façon de **supprimer les heuristiques `includes('poulet')`** (§1.3(b)). Sans lui, le portage PHP devra répliquer des `strpos()` sur les IDs — fragile et non auditable |

#### `bebba_product_option_groups` / `bebba_product_options` / `bebba_product_option_effects`

`customization` est aujourd'hui un objet à **7 clés hétérogènes** :
`allowsProteinChoice`, `proteinOptions`, `allowsVeggiesChoice`, `veggiesOptions`,
`allowsBaseChoice`, `baseChoices`, `allowedSupplementIds`
(présences réelles : 11, 11, 10, 10, 12, 12, 23).

| Table | Colonne | Origine | Note |
|---|---|---|---|
| `bebba_product_option_groups` | `product_id`, `axis ENUM('protein','vegetable','base')`, `is_enabled` | `allowsProteinChoice` / `allowsVeggiesChoice` / `allowsBaseChoice` | **PK `(product_id, axis)`** |
| | `position` | — | ordre d'affichage |
| `bebba_product_options` | `option_group_id`, `label`, `extra_price` | `proteinOptions[].label/extraPrice` etc. | ⚠️ **aujourd'hui une option n'a AUCUN identifiant** : elle est reconnue par **label, insensible à la casse et après `trim()`** (`server/db.ts:869-873`). Donner un `id` est un **prérequis** pour `bebba_product_option_effects` et pour l'historique |
| | `extra_quantity DECIMAL(12,3) NULL` | `extraGrams` | **`NULL` pour `baseChoices`** (aucun `extraGrams` dans les données, vérifié) |
| | `unit_code NULL` | **n'existe pas** | ⚠️ `extraGrams` est **toujours** interprété dans l'unité de l'ingrédient cible, **sans vérification** (§1.3(b)4). Colonne **nécessaire** pour rendre l'unité explicite |
| | `is_default`, `position` | — | `is_default` : options à `extraPrice = 0` (`'Portion normale (200g)'`, `'Riz Basmati complet'`) |
| | `label_price_hint DECIMAL NULL` + `label_grams_hint INT NULL` | extraits de `'( +1.5 DT )'`, `'( +100g )'` | **AJOUT de contrôle** : §1.3(c) montre que le prix est **dupliqué dans le texte**. 1 contradiction réelle détectée. Permet une validation de cohérence à l'import et à chaque écriture |
| **`bebba_product_option_effects`** | `option_id`, `effect_type ENUM('add_quantity','replace_ingredient','transfer_quantity')`, `source_ingredient_id NULL`, `target_ingredient_id NULL`, `quantity_mode ENUM('from_option','from_source','fixed')`, `quantity NULL`, `unit_code NULL`, `role_match_hint VARCHAR(32) NULL` | **AUCUNE DONNÉE — 100 % issu du code** | **C'est la table la plus importante de tout l'audit.** Elle matérialise §1.3(a) et §1.3(b) |

**Population de `bebba_product_option_effects` — ce que l'import doit déduire du code :**

| Règle codée en dur | `effect_type` | `source` → `target` | `quantity_mode` |
|---|---|---|---|
| `extraGrams` protéine (`server/db.ts:935-947`) | `add_quantity` | — → premier ingrédient de `role_tag='protein'` | `from_option` |
| `extraGrams` légumes (`:950-961`) | `add_quantity` | — → premier ingrédient de `role_tag='vegetable'` | `from_option` |
| `baseChoice.label` contient `Quinoa` (`:964-973`) | `replace_ingredient` | `ing-riz` → `ing-quinoa` | `from_source` |
| `baseChoice.label` contient `Patates douces` (`:974-982`) | `replace_ingredient` | `ing-riz` → `ing-patate-douce` | `from_source` |
| `baseChoice.label` contient `100% Légumes` (`:983-992`) | `transfer_quantity` | `ing-riz`/`ing-patate-douce` → `ing-legumes` | `from_source` |

**Trois exigences d'intégrité à imposer dès l'import, sous peine de reproduire les défauts :**
1. **Les 8 cas de substitution impossible (A26) et les 5 options payées sans effet (A25) doivent
   être écrits en quarantaine**, pas ignorés : sinon le nouveau système continuera d'encaisser
   des suppléments sans consommer de stock.
2. **Les 8 labels non reconnus (A27) doivent être tranchés explicitement** : soit on leur crée un
   effet (ex. `Double légumes (sans féculents)` → `transfer_quantity`), soit on assume qu'ils n'en
   ont pas — mais **le statut actuel est « effet attendu, non produit, silencieusement »**.
3. **Les 4 labels `Quinoa*` qui mappent sur un seul ingrédient avec un nom codé en dur**
   (`'Quinoa royal aux graines'`) doivent être **séparés** : chacun doit pointer vers son propre
   ingrédient, sinon la fiche cuisine continuera d'afficher un nom que le client n'a pas choisi.

#### `bebba_order_item_ingredients` — la fiche de préparation figée

C'est **la table critique pour la cuisine** et pour la restitution de stock.

| Colonne | Origine | Note |
|---|---|---|
| `order_item_id` FK NOT NULL | — | |
| `ingredient_id` FK **NULL** `SET NULL` | `totalIngredients[].ingredientId` | **A5 : `ing-fantome-inconnu` réel** ⇒ FK dure impossible |
| `legacy_ingredient_id VARCHAR(64) NULL` | idem | conserve l'ID même quand il ne résout rien |
| `ingredient_name_snapshot VARCHAR(191) NOT NULL` | `totalIngredients[].ingredientName` | **figé** — c'est ce que lit la cuisine (`KitchenView.tsx:335-336` via `summaryLines`, et l'admin via `totalIngredients`) |
| **`quantity_per_unit DECIMAL(12,3) NOT NULL`** | `totalIngredients[].totalQuantity` | ⚠️ **le nom actuel ment** : c'est une valeur **unitaire** (constat n°17) |
| **`quantity_total DECIMAL(12,3) NOT NULL`** | **`quantity_per_unit × items.quantity`** | **AJOUT indispensable** : c'est la valeur réellement consommée (`server/db.ts:1298-1300`). **Aujourd'hui elle n'est stockée nulle part** — elle n'existe que dans les mouvements, **agrégée par ingrédient sur toute la commande** |
| `unit_code` FK NULL | `totalIngredients[].unit` | |
| **`source ENUM('base','protein_extra','vegetable_extra','base_substitution','supplement') NOT NULL`** | **n'existe pas** | **AJOUT recommandé** : permet de **rejouer** la recette, d'expliquer un écart de stock, et de restituer **partiellement** lors d'une annulation. Sans lui, une annulation ne peut que tout restituer en bloc |
| `position` | ordre de la `Map` | ⚠️ **l'ordre actuel vient d'une `Map` JS** (`server/db.ts:1041`) = ordre d'insertion : base d'abord, puis suppléments. Ordre **significatif** pour l'affichage cuisine |

**Pourquoi `quantity_total` doit exister alors que les mouvements existent déjà :**
les mouvements sont **agrégés par ingrédient et par commande** (`requiredStockMap`,
`server/db.ts:1240`). Pour `BEBBA-1084` (2× poulet grillé), le mouvement dit `ing-poulet −500`
mais **aucune donnée** ne dit que cela vient de **2 × 250 g**. Une restitution partielle,
une analyse de marge par ligne, ou un contrôle cuisine sont **impossibles** aujourd'hui.

### 2.8 Ce qui ne doit PAS être migré

| Élément | Preuve | Verdict |
|---|---|---|
| `categories.image`, `products.image` | doublons morts, jamais lus par le front | **Ne pas migrer** |
| `order` (doublon de `sortOrder`) | `server/db.ts:181-184, 435-438, 534-537` | **Ne pas migrer** comme colonne distincte |
| `available` / `isAvailable` (doublon) | §2.3 | **Une seule colonne** |
| `quantity` des suppléments (doublon de `quantityConsumed`) | `server/db.ts:466` | **Une seule colonne** |
| `hasInactiveIngredient`, `ingredientActive`, `drivers[].username`, `clientPhoneIndex.name/createdAt/normalizedPhone` | calculés à la volée | **Ne pas migrer** (données calculées) |
| `statusHistory[].label` **en tant que donnée dérivable** | 3 variantes pour `received` | **Migrer en instantané**, ne pas régénérer |
| `summaryLines` | constat n°17 | **Ne pas migrer** comme authoritative ; régénérer depuis `bebba_order_item_ingredients` |
| `firebase-blueprint.json` | **obsolète** : déclare `Product.price` (inexistant, c'est `basePrice`), ignore `Supplement.ingredientId`, `Supplier.suppliedIngredients`, `Order.items`, `User.username/phone/driverId`, `meta/counters` | **Ne pas utiliser comme source de mapping** |
| `firestore.rules` | **règles mortes** (`request.auth` toujours `null`, §1.3(e)) | **Ne pas dériver les permissions WordPress de ce fichier** ; utiliser la matrice de `server/auth.ts` + `server.ts` |
| `firestore.indexes.json` | `{"indexes": [], "fieldOverrides": []}` — **vide** | Rien à migrer |
| `metadata.json`, `firebase-applet-config.json` | configuration AI Studio / Firebase | **Ne pas migrer** |
| `localStorage` : `bebba_auth_token`, `bebba_last_tracking_token`, `bebba_notifications` | `AppContext.tsx:205,309,342` | **Ne pas migrer** (état navigateur). ⚠️ noter le fallback codé en dur `'tk_bebba_1047_demo'` (`:309`) qui pointe vers une **vraie commande de `db.json`** |
| `server/seedData.ts`, `src/data/initialData.ts` | données de démonstration, dont `initialStats` **codé en dur** (`todayRevenue: 80.8`) | **Ne pas migrer**. ⚠️ mais c'est **l'origine des 20 commandes sans montant** (A1) : à purger ou à tracer (A29) |
| Rate limiter en mémoire (`server.ts:795-800`) | non persistant, perdu au redémarrage | **Ne pas migrer** comme donnée ; à réimplémenter |
| `passwordHash` vides de `db.json` | 7/7 à `''` | **Ne pas migrer depuis `db.json`** — source = Firestore, avec réinitialisation obligatoire (constat n°9) |
| `order.phone` (racine) | 0/54 ; branche morte `server/db.ts:1478` | **Ne pas migrer** |
| `Driver.rating` **en tant que KPI** | constat n°8 | Migrer la valeur, **ne pas** la présenter comme une métrique |

---

## 3. Schéma logique

### 3.1 Vue d'ensemble

Toutes les tables métier portent le préfixe WordPress dynamique :
`$wpdb->prefix . 'bebba_...'`. **Aucun préfixe `wp_` codé en dur.**
Moteur `InnoDB` obligatoire (transactions, FK, verrous). Jeu de caractères `utf8mb4`.

```
                              ┌──────────────────────────┐
                              │      WordPress natif     │
                              │  wp_users · wp_usermeta  │
                              │  wp_options · rôles/caps │
                              └───────────┬──────────────┘
                                          │ user_id (1:1)
             ┌────────────────────────────┼────────────────────────────┐
             │                            │                            │
   ┌─────────▼─────────┐        ┌─────────▼─────────┐        ┌─────────▼──────────┐
   │   bebba_clients   │        │   bebba_staff     │        │   bebba_drivers    │
   │ phone_norm UNIQUE │        │ (admin/kitchen/   │        │ user_id UNIQUE     │
   │  (remplace        │        │  admin_readonly)  │        │ total_deliveries_  │
   │ clientPhoneIndex) │        └─────────┬─────────┘        │      opening       │
   └─────────┬─────────┘                  │                  └─────────┬──────────┘
             │ client_user_id (NULL-able) │ actor_user_id              │ assigned_driver_id
             │                            │ performed_by_user_id       │  (NULL-able, SET NULL)
             │                            │ collected_by_user_id       │
   ┌─────────▼────────────────────────────▼────────────────────────────▼──────────┐
   │                              bebba_orders                                    │
   │  order_number UNIQUE · order_seq UNIQUE · tracking_token UNIQUE              │
   │  client_*_snapshot · subtotal/total_amount NULL-ables · status · stock_state │
   └───────┬──────────────────────┬────────────────────────┬─────────────────────┘
           │                      │                        │
 ┌─────────▼──────────┐ ┌─────────▼───────────────┐ ┌──────▼──────────────────┐
 │ bebba_order_items  │ │bebba_order_status_      │ │ bebba_order_payments    │
 │ product_id NULL    │ │       history           │ │  (AJOUT — inexistant)   │
 │ *_snapshot         │ │ seq UNIQUE(order,seq)   │ └─────────────────────────┘
 │ unit_price NULL    │ │ event_type · status NULL│
 └───┬──────────┬─────┘ │ actor_label_snapshot    │
     │          │       └─────────────────────────┘
     │          │
┌────▼────────┐ ┌▼──────────────────────────┐
│bebba_order_ │ │bebba_order_item_ingredients│
│item_supple- │ │ ingredient_id NULL (A5)    │
│   ments     │ │ quantity_per_unit          │
│ *_snapshot  │ │ quantity_total  (AJOUT)    │
└──────┬──────┘ │ source          (AJOUT)    │
       │        └───────────┬────────────────┘
       │                    │ ingredient_id
       │        ┌───────────▼──────────┐
       └───────►│   bebba_ingredients  │◄──── bebba_stock_movements (FK NOT NULL)
                │ current_stock        │      movement_type ENUM (8 valeurs)
                │ row_version (AJOUT)  │      quantity_delta SIGNED
                │ is_tombstone (AJOUT) │      balance_after (AJOUT)
                └───┬───────────┬──────┘      ingredient_name_snapshot
                    │           │             performed_by_label_snapshot
     default_supplier_id    ingredient_id
                    │           │
        ┌───────────▼───┐  ┌────▼──────────────────┐
        │bebba_suppliers│  │  bebba_supplements    │
        └───────┬───────┘  └────┬──────────────────┘
                │               │ supplement_id
  ┌─────────────▼──────────┐    │
  │bebba_supplier_         │    │
  │      ingredients (N-N) │    │
  │ source ENUM (A9)       │    │
  └────────────────────────┘    │
                                │
        ┌───────────────────────▼───────────────────────────────────┐
        │                     bebba_products                        │
        │  category_id FK RESTRICT · base_price · is_available      │
        └──┬───────────────┬────────────────────┬───────────────────┘
           │               │                    │
 ┌─────────▼────────┐ ┌────▼───────────────┐ ┌──▼──────────────────────┐
 │bebba_product_    │ │bebba_product_      │ │bebba_product_option_    │
 │   ingredients    │ │    supplements     │ │       groups            │
 │ position (crit.) │ │      (N-N)         │ │ axis ENUM(protein,      │
 │ role_tag (AJOUT) │ │                    │ │      vegetable,base)    │
 └──────────────────┘ └────────────────────┘ └──┬──────────────────────┘
                                                │
                                     ┌──────────▼─────────────────┐
                                     │  bebba_product_options     │
                                     │  label · extra_price       │
                                     │  extra_quantity · unit     │
                                     │  label_*_hint (contrôle)   │
                                     └──────────┬─────────────────┘
                                                │
                            ┌───────────────────▼──────────────────────────┐
                            │      bebba_product_option_effects            │
                            │  ★ TABLE LA PLUS CRITIQUE DE L'AUDIT ★       │
                            │  effect_type ENUM(add_quantity,              │
                            │              replace_ingredient,             │
                            │              transfer_quantity)              │
                            │  source_ingredient_id → target_ingredient_id │
                            │  quantity_mode · unit_code                   │
                            │  ⟵ matérialise server/db.ts:935-995          │
                            └──────────────────────────────────────────────┘

  Tables transverses (techniques)
  ┌────────────────────────┐ ┌──────────────────────────────┐ ┌────────────────────────────┐
  │ bebba_categories       │ │ bebba_order_status_          │ │ bebba_sequences            │
  │  slug UNIQUE           │ │        transitions           │ │  name PK · current_value   │
  │  sort_order            │ │  from · to · required_cap    │ │  (remplace meta/counters)  │
  └────────────────────────┘ └──────────────────────────────┘ └────────────────────────────┘
  ┌────────────────────────┐ ┌──────────────────────────────┐ ┌────────────────────────────┐
  │ bebba_units            │ │ bebba_order_idempotency_keys │ │ bebba_system_state         │
  │  code PK (g/ml/piece/  │ │  key PK · caller_id          │ │  état mono-ligne, lu DANS  │
  │  portion)              │ │  request_hash CHAR(64)       │ │  la transaction            │
  └────────────────────────┘ │  order_id FK                 │ │  (remplace meta/system)    │
  ┌────────────────────────┐ └──────────────────────────────┘ └────────────────────────────┘
  │bebba_ingredient_       │ ┌──────────────────────────────┐ ┌────────────────────────────┐
  │      categories        │ │ bebba_settings               │ │ bebba_migration_quarantine │
  │ (8 valeurs libres)     │ │  key PK · value · scope      │ │  + bebba_migration_log     │
  └────────────────────────┘ │  (delivery_fee, préfixes…)   │ │  + bebba_migration_id_map  │
                             └──────────────────────────────┘ └────────────────────────────┘
```

### 3.2 Inventaire des tables et cardinalités

| Table | Origine | Cardinalité | FK entrantes | FK sortantes | Règles de suppression |
|---|---|---|---|---|---|
| `bebba_categories` | `categories` | 9 → N | `bebba_products.category_id` | — | **`RESTRICT`** (reproduit `server/db.ts:229-233`) |
| `bebba_suppliers` | `suppliers` | 3 → N | `bebba_ingredients.default_supplier_id`, `bebba_supplier_ingredients.supplier_id` | — | **`SET NULL`** (aujourd'hui **aucun** garde-fou, `server/db.ts:255-259`) |
| `bebba_supplier_ingredients` | `suppliers[].suppliedIngredients` **+** `ingredients[].supplierId` | **N-N** | — | les deux | `CASCADE` depuis les deux parents |
| `bebba_units` | valeurs libres (`g`,`ml`,`piece`,`portion`,`NULL`) | 4 → N | ingrédients, suppléments, options, mouvements, lignes de commande | — | **`RESTRICT`** |
| `bebba_ingredient_categories` | `ingredients[].category` (8 valeurs libres) | 8 → N | `bebba_ingredients` | — | **`SET NULL`** |
| `bebba_ingredients` | `ingredients` | 19 → N | `bebba_product_ingredients`, `bebba_supplements`, `bebba_supplier_ingredients`, `bebba_stock_movements`, `bebba_order_item_ingredients`, `bebba_order_item_supplements`, `bebba_product_option_effects` (×2) | `bebba_units`, `bebba_suppliers`, `bebba_ingredient_categories` | **`RESTRICT`** depuis le catalogue (reproduit `deleteIngredient`, `server/db.ts:328-351`) ; **`SET NULL`** depuis l'historique |
| `bebba_supplements` | `supplements` | 10 → N | `bebba_product_supplements`, `bebba_order_item_supplements` | `bebba_ingredients`, `bebba_units` | **`RESTRICT`** catalogue ; **`SET NULL`** historique |
| `bebba_products` | `products` | 23 → N | `bebba_order_items`, `bebba_product_ingredients`, `bebba_product_supplements`, `bebba_product_option_groups` | `bebba_categories` | **`SET NULL`** depuis `bebba_order_items` (A3 : 2 orphelins **réels** causés par l'absence de garde-fou) |
| `bebba_product_ingredients` | `products[].baseIngredients` | **N-N** + attributs | — | `bebba_products`, `bebba_ingredients`, `bebba_units` | `CASCADE` produit ; `SET NULL` ingrédient |
| `bebba_product_supplements` | `customization.allowedSupplementIds` | **N-N** pur | — | `bebba_products`, `bebba_supplements` | `CASCADE` des deux côtés |
| `bebba_product_option_groups` | `customization.allows*` | 1:N (max 3/produit) | `bebba_product_options` | `bebba_products` | `CASCADE` |
| `bebba_product_options` | `proteinOptions`/`veggiesOptions`/`baseChoices` | 1:N | `bebba_product_option_effects`, `bebba_order_items.*_option_id` | `bebba_product_option_groups`, `bebba_units` | `CASCADE` groupe ; **`SET NULL`** depuis `bebba_order_items` (historique) |
| **`bebba_product_option_effects`** | **aucune donnée — déduit de `server/db.ts:935-995`** | 1:N | — | `bebba_product_options`, `bebba_ingredients` ×2, `bebba_units` | `CASCADE` option ; `SET NULL` ingrédients |
| `bebba_drivers` | `drivers` | 3 → N | `bebba_orders.assigned_driver_id`, `bebba_order_payments.collected_by_driver_id` | `wp_users` (1:1) | **`SET NULL`** depuis les commandes (`deleteDriver` supprime déjà sans garde-fou, `server/db.ts:786-805`) |
| `bebba_clients` | `users` (`role='client'`) **+** `clientPhoneIndex` | 1:1 avec `wp_users` | `bebba_orders.client_user_id` | `wp_users` | `CASCADE` depuis `wp_users` ; **`SET NULL`** depuis `bebba_orders` |
| `bebba_staff` | `users` (`role ∈ {admin, admin_readonly, kitchen}`) | 1:1 avec `wp_users` | — | `wp_users` | `CASCADE` |
| `bebba_orders` | `orders` | 54 → N | `bebba_order_items`, `bebba_order_status_history`, `bebba_order_payments`, `bebba_stock_movements`, `bebba_order_idempotency_keys` | `wp_users`, `bebba_clients`, `bebba_drivers` | **aucune suppression** (reproduit `firestore.rules:173` `allow delete: if false`, la **seule** règle à conserver) |
| `bebba_order_items` | `orders[].items` | 1:N (56/54) | `bebba_order_item_supplements`, `bebba_order_item_ingredients`, `bebba_stock_movements.order_item_id` | `bebba_orders`, `bebba_products`, `bebba_product_options` ×3 | `CASCADE` commande ; `SET NULL` produit/options |
| `bebba_order_item_supplements` | `items[].supplements` | 1:N (12/56) | — | `bebba_order_items`, `bebba_supplements`, `bebba_ingredients`, `bebba_units` | `CASCADE` ligne ; `SET NULL` refs |
| `bebba_order_item_ingredients` | `items[].preparationSheet.totalIngredients` | 1:N | — | `bebba_order_items`, `bebba_ingredients`, `bebba_units` | `CASCADE` ligne ; **`SET NULL`** ingrédient (**A5 : `ing-fantome-inconnu`**) |
| `bebba_order_status_history` | `orders[].statusHistory` | 1:N (119/54) | — | `bebba_orders`, `wp_users` | `CASCADE` commande ; `SET NULL` acteur. **Append-only** |
| `bebba_order_payments` | **AJOUT** (drapeau seul aujourd'hui) | 1:N | — | `bebba_orders`, `wp_users`, `bebba_drivers` | `CASCADE` commande |
| `bebba_stock_movements` | `stockMovements` | 173 → N | — | `bebba_ingredients` (**NOT NULL**), `bebba_orders`, `bebba_order_items`, `bebba_units`, `wp_users` | **append-only** : ni `UPDATE` ni `DELETE` (reproduit `firestore.rules:179-180`) |
| `bebba_order_status_transitions` | **`server/auth.ts:154-163` + `server/db.ts:1514-1522`** (dupliqué !) | ~11 lignes | — | — | `RESTRICT` |
| `bebba_sequences` | `meta/counters` **+** `db.json.nextOrderSeq` | 1+ | — | — | **aucune suppression** |
| `bebba_order_idempotency_keys` | `orderIdempotencyKeys` | inconnu | — | `bebba_orders` | **aucune suppression** (`firestore.rules:121-122`) ; purge par TTL uniquement |
| `bebba_system_state` | `meta/system` | 1 | — | — | **aucune suppression** |
| `bebba_settings` | constantes codées en dur (§1.3(d)) | ~10 | — | — | `RESTRICT` sur les clés obligatoires |
| `bebba_migration_log` / `_quarantine` / `_id_map` | **AJOUT** | — | — | — | conservées après migration |

### 3.3 Relations que le modèle actuel n'exprime pas et qu'il faut créer

| Relation | Statut actuel | Preuve | Cible |
|---|---|---|---|
| option de personnalisation → ingrédient affecté | **implicite, codée en dur** | `server/db.ts:935-995` | `bebba_product_option_effects` |
| ingrédient → rôle dans la recette (protéine / légume / féculent / sauce) | **implicite, par sous-chaîne d'ID** | `includes('poulet')`, `includes('legumes')` | `bebba_product_ingredients.role_tag` |
| mouvement de stock → ligne de commande | **absente** (agrégat par commande) | `requiredStockMap`, `server/db.ts:1240` | `bebba_stock_movements.order_item_id` |
| encaissement → acteur / date / montant | **absente** | `server/db.ts:1679-1693` | `bebba_order_payments` |
| mouvement de stock → utilisateur | **absente** (texte libre) | A21 | `performed_by_user_id` + snapshot |
| événement d'historique → utilisateur | **absente** (texte libre) | A20 | `actor_user_id` + snapshot |
| réception fournisseur → mouvement de réappro | **absente** (`'Bon #4891'` dans `notes`) | constat n°21 | À VÉRIFIER (§7-Q12) |
| commande → position de ligne / position d'ingrédient | **absente** (ordre de tableau) | §2.6, §2.7 | colonnes `position` |
| ingrédient → version de concurrence | **absente** | `server/db.ts:376` read-modify-write | `bebba_ingredients.row_version` |

---

## 4. Données techniques

### 4.1 Compteurs de commandes — `meta/counters.nextOrderSeq` / `db.json.nextOrderSeq`

**État réel :** valeur `1101` dans `db.json:9137` ; `meta/counters` dans Firestore avec
`{nextOrderSeq, updatedAt}` ; dernière commande réelle `BEBBA-1100` ; **54 commandes, 0 trou, 0 doublon**.

**Trois valeurs par défaut divergentes dans le code** : `1101` (`server/db.ts:1192`),
`1101` exigé à l'import (`scripts/migrate-to-firestore.ts:143-146`),
`1001` après reset (`server/db.ts:2091-2094`).

**Cible : `bebba_sequences`** — table dédiée, **ni `wp_options`, ni `wp_usermeta`, ni constante**.

| Colonne | Rôle |
|---|---|
| `sequence_name VARCHAR(64)` PK | `'order_number'`, et extensible |
| `current_value BIGINT UNSIGNED NOT NULL` | prochain `order_seq` |
| `prefix VARCHAR(16) NOT NULL` | `'BEBBA-'` — aujourd'hui codé en dur (`server/db.ts:1338`) |
| `floor_value BIGINT UNSIGNED NOT NULL` | **garde-fou** : valeur plancher issue de `MAX(order_seq)+1` à l'import |
| `updated_at DATETIME(3)` | équivalent de `meta/counters.updatedAt` |

**Deux mécanismes d'incrémentation atomique acceptables :**
- `UPDATE … SET current_value = LAST_INSERT_ID(current_value + 1)` puis `LAST_INSERT_ID()`
  (atomique, sans verrou explicite) ;
- `SELECT … FOR UPDATE` dans la transaction de création de commande.

**Pourquoi `wp_options` est à proscrire ici** (justification technique, pas stylistique) :
1. `get_option()` est **mis en cache** en mémoire et **chargé en masse** (`autoload`) : la valeur lue
   peut être **périmée** dans la même requête ;
2. `update_option()` n'est **pas** une opération atomique `SET x = x + 1` : c'est un
   read-modify-write, exactement le défaut de `driver.totalDeliveries` (`server/db.ts:1624-1631`) ;
3. l'option n'est **pas lue dans la transaction SQL** de création de commande, alors que
   `meta/counters` l'est aujourd'hui via `transaction.get` (`server/db.ts:1190`) — la garantie
   d'atomicité actuelle **régresserait** ;
4. aucune contrainte `UNIQUE` exploitable sur la valeur.

**Règle d'import obligatoire :** `current_value = MAX(bebba_orders.order_seq) + 1`, **jamais** une
constante. Justification : constat n°23 (reset à 1001 + suppression d'orders bloquée par
`firestore.rules:173` ⇒ collisions démontrables).

### 4.2 Idempotence — `orderIdempotencyKeys`

**État réel :** collection **absente de `db.json`**, population inconnue.
`scripts/migrate-to-firestore.ts:245-250` **exige qu'elle soit vide** à l'issue de la migration
initiale et **échoue** sinon ⇒ forte probabilité qu'elle soit vide ou quasi vide, **mais ce n'est
pas démontré pour l'état courant** (le script a tourné à un instant T). **À VÉRIFIER** (§7-Q13).

**Champs réels** (`server/db.ts:1408-1414`) : `key`, `callerId`, `requestHash`, `orderId`, `createdAt`.

**Sémantique à reproduire exactement** (`server/db.ts:1152-1186`) :

| Situation | Réponse actuelle |
|---|---|
| même clé + même `callerId` + même `requestHash` | **200** + commande existante (`isExisting: true`) |
| même clé + **autre** `callerId` | **403** `IdempotencyForbiddenError` |
| même clé + même `callerId` + **autre** `requestHash` | **422** `IdempotencyConflictError` |
| enregistrement présent **sans** `orderId` | **500** `IdempotencyInconsistencyError` |
| `orderId` référencé **introuvable** | **500** `IdempotencyInconsistencyError` |
| aucune clé fournie | **création sans protection** (201) |

**Cible : `bebba_order_idempotency_keys`**

| Colonne | Origine | Note |
|---|---|---|
| `idempotency_key VARCHAR(190)` PK | document ID | UUID v4 côté client (`CheckoutModal.tsx:74`). 190 car. = 760 octets en `utf8mb4`, sous la limite InnoDB `DYNAMIC` |
| `caller_id VARCHAR(191) NOT NULL` | `callerId` | `client:<userId>` ou `guest:<phoneNorm|'unknown'>` (`server.ts:1025`) |
| `request_hash CHAR(64) NOT NULL` | `requestHash` | SHA-256 hex — **algorithme à porter à l'identique** (§1.3(f)) |
| `order_id` FK **NOT NULL** | `orderId` | La contrainte SQL **remplace** `IdempotencyInconsistencyError` : un enregistrement sans commande valide devient **impossible** au lieu d'être détecté à l'exécution |
| `created_at DATETIME(3) NOT NULL` | `createdAt` | |
| **`expires_at DATETIME(3) NULL`** | **n'existe pas** | **AJOUT recommandé** : aujourd'hui les clés sont **éternelles** (`firestore.rules:121` `allow delete: if false`). La table croît sans borne |
| **`hit_count`, `last_hit_at`** | **n'existe pas** | **AJOUT optionnel** : observer les rejeux réels |
| **`response_status SMALLINT NULL`** | **n'existe pas** | pour rejouer un **200** identique au **201** initial (`server.ts:1041-1046`) |

**Verrouillage :** la lecture de la clé doit se faire par `SELECT … FOR UPDATE` **dans** la
transaction de création, ce qui reproduit `transaction.get(idemRef)` (`server/db.ts:1155`).
⚠️ Différence de comportement à anticiper : Firestore **réessaie** automatiquement la transaction
en cas de contention ; InnoDB **lève un deadlock**. Une politique de retry applicative est requise.

**Faiblesse réelle du mécanisme actuel, à corriger pendant la migration** (pas seulement à porter) :
la clé est générée à l'ouverture du modal (`CheckoutModal.tsx:73-75`), régénérée après succès
(`:201`), **et effacée à la fermeture** (`:93, 104`). Elle **n'est jamais persistée** côté client
(aucun `localStorage` — vérifié). ⇒ **Un rechargement de page entre deux tentatives produit une
nouvelle clé et donc une commande dupliquée.** La protection réelle se limite aux rejeux réseau
dans une même session de modal.

### 4.3 `meta/system` — verrou de migration

**État réel :** `getSystemState()` (`server/db.ts:162-169`) renvoie `'NOT_STARTED'` si le document
est absent. `createOrder` **refuse toute création** si `state !== 'READY'`
(`server/db.ts:1145-1150` → `SystemNotReadyError`, HTTP **503**, `server.ts:1057-1058`).
États observés dans le code : `NOT_STARTED`, `IN_PROGRESS`, `READY`, `FAILED`
(`scripts/migrate-to-firestore.ts:77, 262, 274`). Champs : `state`, `startedAt`, `migratedAt`,
`failedAt`, `version` (`'V2.2.5'`), `error`, `stats`.

**Cible : `bebba_system_state` — table mono-ligne, PAS `wp_options`.**
Justification décisive : ce document est lu **via `transaction.get()` à l'intérieur de la
transaction de création de commande** (`server/db.ts:1145`). Une `get_option()` est hors
transaction et en cache : le verrou deviendrait **inefficace** (une commande pourrait passer
pendant une migration). C'est un cas où le choix « option WordPress » **casserait une garantie
de sécurité existante**.

Colonnes : `id` (toujours 1, `CHECK`), `state ENUM('NOT_STARTED','IN_PROGRESS','READY','FAILED')`,
`version VARCHAR(32)`, `started_at`, `migrated_at`, `failed_at`, `error_message TEXT`,
`stats_snapshot` (JSON **acceptable ici** : pure archive non interrogée), `updated_at`.

⚠️ **Ce mécanisme est exactement celui dont la migration WordPress a besoin.** Il doit être
**réutilisé** pour la bascule Firestore → MySQL, pas supprimé.

### 4.4 Index de recherche et normalisations

| Mécanisme actuel | Preuve | Cible |
|---|---|---|
| `clientPhoneIndex` (téléphone → `userId`) | `server/db.ts:1786-1815` | **`bebba_clients.phone_normalized CHAR(8) UNIQUE`** — l'entité disparaît, la contrainte devient SQL |
| Scan de secours de tous les clients + ré-écriture différée de l'index | `server/db.ts:1800-1812` | **À supprimer** : c'est un palliatif Firestore. Le conserver masquerait les collisions |
| Détection manuelle de collisions à l'import | `scripts/migrate-to-firestore.ts:118-124` | **remplacée par la contrainte UNIQUE** |
| Réconciliation bidirectionnelle + recherche d'orphelins | `scripts/migrate-to-firestore.ts:217-243` | **remplacée par la FK + l'UNIQUE** |
| `normalizePhoneNumber` (8 derniers chiffres) | **dupliqué 3×** : `server/db.ts:98-106`, `server.ts:939` (via import), `scripts/migrate-to-firestore.ts:19-24` | **une seule fonction PHP**, et **une colonne normalisée indexée** par site d'usage (`bebba_clients`, `bebba_orders`, `bebba_drivers`) |
| `normalizeAddress` (trim + lowercase + collapse) | `server/db.ts:109-113` — utilisé **uniquement** pour le hash (`server.ts:940`) | colonne `client_address_normalized` (§2.6) pour rendre le hash reproductible sans recalcul |
| Recherche commande par `orderNumber` + téléphone | `server/db.ts:1461-1489` — reconstruit `BEBBA-` si l'entrée est **purement numérique**, retire un `#` initial, met en majuscules | **index composé** `(order_number, client_phone_normalized)`. ⚠️ La normalisation d'entrée (`#`, chiffres seuls, casse) doit être **portée**, sinon `1100` ne retrouvera plus `BEBBA-1100` |
| Recherche par `trackingToken` | `server/db.ts:1454-1459` | `UNIQUE INDEX` |
| Tri des commandes par `createdAt` décroissant | `server/db.ts:1436` | `INDEX (created_at DESC, id DESC)` — **`id` en départage** car 6 commandes partagent des horodatages d'historique identiques et le tri doit rester déterministe |
| Tri catalogue par `COALESCE(sortOrder, order, 0)` | `server/db.ts:181-184, 435-438, 534-537` | `INDEX (sort_order, id)` |
| Tri des mouvements par `timestamp` décroissant | `server/db.ts:405` | `INDEX (occurred_at DESC, id DESC)` |
| Filtrage livreur `assignedDriverId == user.driverId` | `server.ts:695` | `INDEX (assigned_driver_id, status)` |
| Filtrage cuisine `status != 'cancelled'` | `server.ts:687` | `INDEX (status, created_at)` |
| `lowStockCount` : `currentStock <= minThreshold` | `server/db.ts:1722` | **index inutilisable** (comparaison de 2 colonnes) ; vue ou colonne générée `is_low_stock` — **donnée calculée, ne pas stocker comme authoritative** |
| Rate limiting `track-lookup` (5/10 min/IP, **en mémoire**) | `server.ts:795-800, 842-861` | **perdu au redémarrage** aujourd'hui. Cible : transient WP **ou** table dédiée si multi-instance. **À VÉRIFIER** (§7-Q14) |
| `firestore.indexes.json` | **vide** | rien |

### 4.5 Métadonnées système, constantes et configuration

**Cible : `bebba_settings`** pour toute valeur lue **dans** une transaction métier ;
`wp_options` pour les préférences d'UI sans enjeu transactionnel.

| Clé | Valeur actuelle | Emplacement actuel | Cible | Justification |
|---|---|---|---|---|
| `delivery_fee` | `2.5` | **6 endroits codés en dur** (§1.3(d)) | **`bebba_settings`** | lu **dans** la transaction de création (`server/db.ts:1341`) ⇒ P10 |
| `order_number_prefix` | `'BEBBA-'` | `server/db.ts:1338, 1466` | `bebba_settings` | |
| `tracking_token_prefix` / `token_bytes` | `'tk_'` / 6 | `server/db.ts:1339` | `bebba_settings` | |
| `item_quantity_min` / `_max` | 1 / 100 | `server/db.ts:1256-1264` | `bebba_settings` | |
| `money_round_decimals` | 1 (0,1 DT) | `Math.round(x*10)/10` ×8 | `bebba_settings` | **règle métier réelle** à ne pas perdre |
| `supplement_default_quantity` | 100 | `server/db.ts:466, 1013` | `bebba_settings` | |
| `sort_order_default` | 10 | `server/db.ts:203, 465, 578` | `bebba_settings` | |
| `phone_min_digits` / `phone_keep_digits` | 8 / 8 | `server/db.ts:101-104` | `bebba_settings` | |
| `official_ingredient_stock` | 17 valeurs | `server/db.ts:2065-2083` | **`bebba_stock_movements` de type `opening_balance`** | cf. constat n°22 : c'est un **stock d'ouverture**, pas une option |
| `idempotency_ttl_days` | **inexistant** | — | `bebba_settings` | §4.2 |
| `lookup_rate_limit_*` | 5 / 10 min | `server.ts:843-844` | `wp_options` (non transactionnel) | |
| `masked_display_rules` | fonctions | `server.ts:709-761` | **code**, pas données | présentation pure |

### 4.6 Mécanismes d'intégrité nécessaires pour la migration elle-même

Ce sont des **tables de service**, à conserver après migration (audit / rollback).

**`bebba_migration_log`** — journal d'exécution :
`id`, `run_id`, `phase`, `source_collection`, `records_read`, `records_written`,
`records_quarantined`, `started_at`, `finished_at`, `status`, `checksum_source`,
`checksum_target`, `message`.
*Justification :* `scripts/migrate-to-firestore.ts` produit déjà des `reconciliationStats`
enregistrés dans `meta/system.stats` (`:265`) — mais **non exploitables** ensuite. Une migration
JSON → Firestore → MySQL en deux sauts exige une trace par saut.

**`bebba_migration_quarantine`** — anomalies :
`id`, `run_id`, `anomaly_code` (A1…A36 de §1.4), `severity ENUM('blocking','warning','info')`,
`source_collection`, `source_id`, `source_path` (ex. `orders[12].items[0].unitPrice`),
`expected`, `found`, `payload_snapshot`, `resolution_status ENUM('pending','accepted','corrected','rejected')`,
`resolved_by_user_id`, `resolved_at`, `resolution_note`.
*Justification :* **36 classes d'anomalies mesurées**, dont **16 bloquantes pour des FK dures**.
Sans quarantaine, le script devra soit **échouer**, soit **inventer des valeurs** — les deux
inacceptables.

**`bebba_migration_id_map`** — correspondance des identifiants :
`id`, `entity_type`, `legacy_id`, `new_id`, `wp_user_id` (pour les utilisateurs), `run_id`,
`UNIQUE(entity_type, legacy_id)`.
*Justification :* **4 formats d'ID incompatibles** (A24) et **3 sauts de référentiel** :
`users.id → wp_users.ID`, `orders.id → bebba_orders.id`, `drivers.id → bebba_drivers.id`.
Les références à résoudre sont nombreuses et **hétérogènes** :
`orders.clientId` (0/54 dans `db.json` mais présent dans Firestore),
`users.driverId` (3), `stockMovements.orderId` (171), `stockMovements.ingredientId` (173),
`orderIdempotencyKeys.orderId`, `products.baseIngredients[].ingredientId` (jusqu'à 6/produit),
`customization.allowedSupplementIds[]` (jusqu'à 10/produit),
`suppliers.suppliedIngredients[]`, `items[].productId`, `items[].supplements[].supplementId`,
`preparationSheet.totalIngredients[].ingredientId`.
**Sans table de correspondance persistée, le rollback est impossible à rejouer de façon identique.**

**Ordre d'import contraint par les dépendances** (déduit des FK, pas choisi arbitrairement) :

```
1  bebba_units                       (aucune dépendance — 4 valeurs + NULL)
2  bebba_system_state                (verrou : passer à IN_PROGRESS)
3  bebba_sequences                   (plancher = MAX(order_seq)+1 calculé APRÈS les commandes,
                                       donc inséré ici et MIS À JOUR en étape 16)
4  bebba_settings                    (constantes §4.5)
5  wp_users (staff)  → bebba_staff   (rôles + capabilities)
6  bebba_categories                  (dépend de rien)
7  bebba_suppliers                   (dépend de rien)
8  bebba_ingredient_categories
9  bebba_ingredients                 (⚠️ AVANT produits/suppléments ; créer les TOMBSTONES
                                       ing-1, ing-4, ing-fantome-inconnu ici)
10 bebba_supplier_ingredients        (⚠️ APRÈS 7 et 9 ; tracer `source`)
11 bebba_supplements                 (dépend de 9)
12 bebba_products                    (dépend de 6)
13 bebba_product_ingredients         (dépend de 12, 9, 1)
14 bebba_product_supplements         (dépend de 12, 11)
15 bebba_product_option_groups / _options / _effects   (dépend de 12, 9)
   ⚠️ étape la plus délicate : déduite du CODE, pas des données (§1.3(a)(b))
16 wp_users (clients) → bebba_clients                  (dépend de rien côté métier)
17 bebba_drivers                      (dépend de 5)
18 bebba_orders                       (dépend de 16, 17)
19 bebba_order_items                  (dépend de 18, 12, 15)
20 bebba_order_item_supplements       (dépend de 19, 11, 9)
21 bebba_order_item_ingredients       (dépend de 19, 9)
22 bebba_order_status_history         (dépend de 18, 5)
23 bebba_order_payments               (dépend de 18, 5, 17)
24 bebba_stock_movements              (dépend de 9, 18, 19, 5)
   ⚠️ insérer AUSSI les mouvements `opening_balance` (A31)
25 bebba_order_idempotency_keys      (dépend de 18)
26 bebba_order_status_transitions     (dépend de rien — recopie de auth.ts:154-163)
27 bebba_sequences                   (MISE À JOUR : MAX(order_seq)+1)
28 bebba_system_state                 (→ READY uniquement si 0 quarantaine bloquante non résolue)
```

**Garde-fous d'intégrité à exécuter avant de passer à `READY`** (transposition des vérifications
déjà présentes dans `scripts/migrate-to-firestore.ts:200-257`, qui constituent le **meilleur
précédent du projet** et doivent être conservés) :

| Contrôle | Précédent existant | Version MySQL |
|---|---|---|
| counts source vs cible par collection | `:200-215` | `COUNT(*)` par table vs taille du document source |
| `clientPhoneIndex` : 0 manquant, 0 divergent, 0 orphelin | `:217-243` | `bebba_clients.phone_normalized` : 0 `NULL`, 0 doublon (garanti par UNIQUE), 0 ligne sans `wp_users` |
| `orderIdempotencyKeys` vide à l'import initial | `:245-250` | **inapplicable** : la collection peut être non vide **maintenant** (§7-Q13) |
| `nextOrderSeq` == valeur attendue | `:252-257` | `bebba_sequences.current_value == MAX(order_seq)+1` — **calculé, pas constant** |
| chaque élément a un `id` | `:100-102` | `legacy_id IS NOT NULL` sur toutes les lignes importées |
| sommes monétaires | **absent** | **À AJOUTER** : `SUM(total_amount)` source vs cible, et **compte séparé des `NULL`** (A1 : 20) pour prouver qu'aucun `null` n'est devenu `0` |
| cohérence stock | **absent** | **À AJOUTER** : `current_stock` cible == source pour les 19 ingrédients, **et** `SUM(quantity_delta)` du journal == `current_stock − opening_balance` |
| cohérence `stock_state` | **absent** | **À AJOUTER** : croiser le drapeau et le ledger (A15 : 10 divergences) et journaliser |

### 4.7 Identifiants et stratégie de migration des IDs

**Recommandation : nouveaux IDs techniques + `legacy_id`, et conservation des identifiants publics.**

| Type d'identifiant | Décision | Justification par la preuve |
|---|---|---|
| **PK internes** (`ord-…`, `prod-…`, `ing-…`, `drv-…`, `usr-…`, `mov-…`, `cat-…`, `sup…`) | **Nouveaux `BIGINT UNSIGNED AUTO_INCREMENT`** + **`legacy_id VARCHAR(64) NULL UNIQUE`** | (1) 4 formats incompatibles par collection, dont `mov-1`, `ord-1047`, `test-ing-kitchen-…` (A24) ; (2) `wp_users.ID` est **nécessairement** un entier ⇒ les IDs utilisateurs changent de toute façon ; (3) une PK `VARCHAR` sur `bebba_order_items`/`bebba_stock_movements` (les 2 plus grosses tables) coûte en index et en FK ; (4) `item.id` n'est **même pas unique par construction** (constat n°18) |
| **`orderNumber`** (`BEBBA-1100`) | **CONSERVÉ À L'IDENTIQUE** + `UNIQUE` | C'est l'identifiant **public** : `track-lookup` (`server/db.ts:1461-1489`), affichage livreur (`DriverView.tsx:220`), notes de mouvements (171 occurrences), notes d'historique. Le changer **casserait le support client et l'historique imprimé** |
| **`trackingToken`** | **CONSERVÉ À L'IDENTIQUE** + `UNIQUE` | Seul moyen d'accès anonyme (`server.ts:815`) ; les liens déjà partagés doivent continuer à fonctionner. Y compris les **3 tokens `tk_bebba_10NN_demo`** hors format (A23) ⇒ **aucune contrainte de format** |
| **`slug` de catégorie** | **CONSERVÉ** + `UNIQUE` | 9/9 présents, potentiellement exposés dans des URL |
| **`username` staff** | **CONSERVÉ** dans `wp_users.user_login` | `admin`, `cuisine`, `livreur1…3`, `admin_readonly` — sinon le personnel perd ses accès. ⚠️ **`admin` est fortement déconseillé par WordPress** (cible de brute-force) : décision à trancher (§7-Q15) |
| **téléphone client** | **CONSERVÉ brut** + normalisé | A36 : le téléphone est la **seule** identité client démontrée |

**Conséquences pour les relations — traitées explicitement :**

1. **Toutes les références internes doivent être résolues via `bebba_migration_id_map`**, dans
   l'ordre d'import de §4.6. Les références concernées sont énumérées en §4.6.
2. **Les références non résolues ne doivent PAS bloquer l'import** : elles deviennent
   `NULL` + `legacy_*_id` conservé + ligne de quarantaine. C'est le cas de **A3, A4, A5, A6, A7, A8**
   (**13 références orphelines réelles**).
3. **Les références textuelles ne sont pas résolues automatiquement.** `statusHistory.updatedBy`
   (119 valeurs libres, A20) et `stockMovements.performedBy` (173, A21) : **`actor_user_id` /
   `performed_by_user_id` restent `NULL`**, le texte est conservé. Toute tentative de mapping
   automatique (`'Chef'` → quel compte ?) **inventerait** de l'information.
4. **Rollback :** la source Firestore/`db.json` reste **intacte et ré-importable** parce que
   (a) `legacy_id` permet de rétablir les IDs d'origine, (b) aucune donnée source n'est modifiée,
   (c) `bebba_migration_id_map` permet de rejouer exactement le même mapping.
   **Limite à déclarer honnêtement :** toute donnée **créée dans WordPress après la bascule**
   (nouvelles commandes, nouveaux mouvements, nouveaux clients) **n'existe pas dans la source** :
   un rollback après exploitation **perd ces données** sauf script de rétro-export.
   ⇒ Le rollback n'est **sûr** que pendant la fenêtre de bascule, d'où la nécessité de
   `bebba_system_state` pour **geler les écritures** (§4.3).
5. **Collision de `legacy_id` :** `item.id` n'est pas unique par construction (constat n°18).
   ⇒ `legacy_id` **sans** contrainte `UNIQUE` sur `bebba_order_items`, ou UNIQUE **après
   vérification** (0 collision constatée sur 56, mais l'échantillon est faible).

### 4.8 Types physiques transverses (décisions, pas de SQL)

| Domaine | Décision | Justification par la preuve |
|---|---|---|
| **Monétaire** | `DECIMAL(10,3)` pour prix/montants ; `DECIMAL(12,4)` pour `purchase_cost` | arrondi applicatif réel à **0,1 DT** (`Math.round(x*10)/10`, 8 occurrences) mais `purchaseCost` = `0.016`/`0.002` (**3 décimales**). `FLOAT`/`DOUBLE` **interdits** : `0.1 + 0.2 ≠ 0.3` |
| **Montants de commande** | **`NULL`-ables** | A1/A2 : 20 commandes et 20 lignes à `null`. `NOT NULL DEFAULT 0` **inventerait** 0,000 DT |
| **Quantités** | `DECIMAL(12,3)` | le code arrondit à 0,1 (`server/db.ts:1298`) même si toutes les données sont entières ; `ing-oeuf` est en `piece`, `ing-repas-programme` en `portion` |
| **Unités** | table `bebba_units` + FK **NULL**-able | 4 valeurs réelles **+ 1 `NULL`** (A11) **+ 1 mouvement sans unité** (A12) |
| **Dates** | `DATETIME(3)`, valeurs en **UTC**, conversion explicite à l'import | ISO-8601 `…Z` avec millisecondes partout ; **`TIMESTAMP` à proscrire** (limite 2038, conversion de fuseau implicite). La précision ms est **réellement utilisée** pour le tri (`server/db.ts:1436, 405`) |
| **Date d'historique** | `DATETIME(3)` **+ `seq`** | A18 : 6 commandes avec `timestamp` identiques à la ms |
| **Booléens** | `TINYINT(1)` / `BOOLEAN` | ⚠️ **règle de défaut critique** : `active` absent = **actif** (`active === false`, `server/db.ts:325, 522, 929`). Un import qui traite l'absence comme `FALSE` **désactiverait 14 ingrédients sur 19** |
| **Texte** | `utf8mb4`, collation **à trancher** selon le SGBD | emoji 4 octets réels (🍗🥩🐟🍚🥦🥑🥚🧀🥣🌿⚠️) ; `utf8mb3` **tronquerait** `summaryLines` |
| **ENUM vs table de référence** | ENUM pour les **ensembles fermés stables** (statuts, types de mouvement, axes d'options) ; table pour `bebba_units` et `bebba_ingredient_categories` | 7 statuts figés par `auth.ts:154-163` ; 8 types de mouvement ; en revanche 8 catégories d'ingrédients **libres et non normalisées** ⇒ table |
| **Moteur** | `InnoDB` | transactions et FK obligatoires (§1.3(g)) |
| **Préfixe** | `$wpdb->prefix . 'bebba_…'` **partout**, jamais `wp_` en dur | exigence du cahier des charges |

---

## 5. Données historiques — ce qui doit être figé, ce qui peut rester une référence

### 5.1 Test appliqué

Pour chaque champ, la question posée est : **« si la donnée de référence change dans 6 mois,
l'ancienne commande doit-elle changer aussi ? »**
- **Non** ⇒ **instantané obligatoire** (copie figée).
- **Oui** ⇒ référence simple (FK) suffisante.

Les scénarios imposés par la commande d'audit ont été testés un par un contre le code réel.

### 5.2 Matrice figé / référence

| Donnée | Scénario testé | Verdict | Preuve dans le code actuel |
|---|---|---|---|
| **Nom du produit** | le produit change de nom | **FIGÉ** — `orders.items[].productName` | déjà stocké (56/56). `formatPublicOrder` l'affiche **sans jamais relire le produit** (`server.ts:781`). `KitchenView` et `DriverView:265` idem |
| **Prix unitaire payé** | le prix change | **FIGÉ** — `unit_price` | déjà stocké. ⚠️ ce n'est **pas** `basePrice` mais `basePrice + extras + suppléments` (`server/db.ts:1035`) |
| **Total de ligne / sous-total / frais / total** | les prix changent | **FIGÉS** — et **`NULL`-ables** (A1) | déjà stockés ; `deliveryFee` figé à `2.5` sur 54/54 |
| **Catégorie du produit** | **la catégorie est supprimée** | **RÉFÉRENCE, pas d'instantané** | ⚠️ **décision contre-intuitive mais justifiée** : `orderNumber`, `productName` et les prix suffisent à la lecture historique ; **aucun code ne lit la catégorie depuis une commande** (vérifié : `formatPublicOrder`, `KitchenView`, `DriverView`, `AdminView` n'y accèdent jamais). Ajouter `category_name_snapshot` serait **inventer** un besoin. En revanche la FK doit être **`SET NULL`** et non `RESTRICT`, pour que la suppression d'une catégorie ne soit **jamais** bloquée par l'historique |
| **Ingrédients de la recette** | **la recette change** | **FIGÉS** — `bebba_order_item_ingredients` | déjà stocké (`preparationSheet.totalIngredients`, 56/56). **Et c'est fonctionnellement obligatoire** : `updateOrderStatus` **recalcule la consommation de stock depuis cet instantané** pour les commandes anciennes (`server/db.ts:1531-1541`). Si l'on ne figeait pas la recette, une commande `received` de 2026 passant en `preparing` en 2027 consommerait la **nouvelle** recette |
| **Nom de l'ingrédient** | **l'ingrédient est remplacé/renommé** | **FIGÉ** — `ingredient_name_snapshot` | déjà stocké partout : `totalIngredients[].ingredientName`, `supplements[].ingredientName`, `stockMovements[].ingredientName` (173/173). **A5 le rend obligatoire** : `ing-fantome-inconnu` n'a **que** son nom comme information |
| **Unité** | l'ingrédient change d'unité | **FIGÉ** — `unit_code` sur la ligne historique | déjà stocké dans `totalIngredients[].unit` et `supplements[].unit` |
| **Quantité unitaire ET totale** | la recette change | **FIGÉES, et à SÉPARER** | constat n°17 : `totalIngredients` est **unitaire** alors que les mouvements sont **totaux**. Le modèle actuel **perd** la quantité totale par ligne |
| **Options de personnalisation (label, extraPrice, extraGrams)** | l'option change de prix / disparaît | **FIGÉS** | déjà stocké sous forme d'objets résolus (`resolvedProteinOption`, `server/db.ts:875-880`). **Le label est la seule clé** — les options n'ont **aucun ID** aujourd'hui |
| **Suppléments (nom, prix, ingrédient, quantité, unité)** | **le supplément change de prix** | **FIGÉS** — c'est le **meilleur instantané du projet** | 8 champs × 12 lignes, 100 % présents. `enrichedSupplements` (`server/db.ts:1017-1026`) copie `price`, `ingredientId`, `ingredientName`, `quantityConsumed`, `unit` |
| **Instructions spéciales client** | — | **FIGÉ** | 1/56 mais critique cuisine (`⚠️ NOTE CLIENT`, `server/db.ts:1082-1084`) |
| **Identité du client (nom, téléphone, adresse, notes)** | le client change de nom/adresse/téléphone | **FIGÉE** | déjà stocké 54/54. **A36 le démontre** : le même téléphone porte 10 identités différentes. Relire le profil casserait l'historique |
| **Nom du livreur affecté** | le livreur est renommé **ou supprimé** | **FIGÉ** — `assigned_driver_name_snapshot` | déjà stocké (10/10). **Obligatoire** : `deleteDriver` supprime le livreur sans garde-fou (`server/db.ts:786-805`) et `formatSafeDriverName` affiche ce nom sur le tracking public (`server.ts:753-760`) |
| **Numéro de commande sur un mouvement de stock** | — | **FIGÉ** — `order_number_snapshot` | déjà stocké (171/173) ; `orderNumber` est l'identifiant public |
| **Nom de l'ingrédient sur un mouvement** | ingrédient renommé | **FIGÉ** | 173/173 |
| **Acteur d'un changement de statut** | l'utilisateur est renommé/supprimé | **FIGÉ** (texte) **+** référence `NULL`-able | `updatedBy` 112/119, 20 valeurs libres (A20). `deleteDriver` supprime le compte lié ⇒ la référence **doit** être `NULL`-able |
| **Acteur d'un mouvement de stock** | idem | **FIGÉ** (texte) **+** référence `NULL`-able | `performedBy` 173/173, 9 valeurs libres (A21) |
| **Libellé d'étape (`label`)** | le wording change | **FIGÉ** | 8 valeurs réelles dont **3 variantes pour `received`** (constat n°14). Non dérivable |
| **Note d'étape (`note`)** | — | **FIGÉ** | 119/119 |
| **`summaryLines`** | la recette change | **NI figé NI référence : à régénérer** | constat n°17 : sémantique **contradictoire** (unitaire dans le seed, total dans le code). Le figer **pérenniserait une erreur d'affichage cuisine** |
| **`stockConsumed`** | — | **à RECONSTRUIRE depuis le ledger** | A14/A15 : absent 26/54, **contredit 10 fois** par les mouvements |
| **`totalDeliveries` du livreur** | — | **valeur d'ouverture figée + comptage ultérieur** | A30 : 308 déclarés vs 4 livraisons tracées |
| **`currentStock`** | — | **état figé à l'import + mouvement `opening_balance`** | A31 : non dérivable du journal |
| **`rating` du livreur** | — | **figé, marqué non authoritative** | constat n°8 : aucune source, aucun calcul |
| **Statut de commande** | — | **RÉFÉRENCE vivante** + historique figé | `orders.status` est l'état courant ; l'historique est figé |
| **`paymentStatus`** | — | **RÉFÉRENCE vivante** + ledger figé (§2.6) | aujourd'hui **aucun** historique : `updatePaymentStatus` écrase sans trace (`server/db.ts:1690-1691`) |

### 5.3 Cas limites démontrés par les données, à traiter explicitement

| Cas | Donnée réelle | Traitement recommandé |
|---|---|---|
| Commande **annulée** dont le stock a été consommé | `BEBBA-1079` : 4 mouvements `order_consumption` (−1 240), **0 restitution** | **Figer les mouvements tels quels** (le journal est append-only) **et** ouvrir une quarantaine A22. Ne **pas** créer rétroactivement un mouvement de restitution : cela falsifierait l'horodatage et l'acteur. Décision métier à trancher (§7-Q8) |
| Commande dont le **produit a été supprimé** | `BEBBA-1071`, `BEBBA-1072` | `product_id = NULL`, `legacy_product_id` conservé, `product_name_snapshot` **préservé** (il existe : `productName` 56/56). La commande reste **lisible et facturable** |
| Fiche cuisine avec **ingrédient inexistant** | `BEBBA-1086` → `ing-fantome-inconnu` | `ingredient_id = NULL`, `legacy_ingredient_id = 'ing-fantome-inconnu'`, nom conservé. La cuisine lit le **nom**, qui est présent |
| Commande **sans aucun montant** | 20 commandes (A1) | montants `NULL`. **Ne pas recalculer** : le recalcul produirait un total **différent** de ce qui a été encaissé (ou non). Quarantaine A1 + décision humaine |
| Commande **livrée mais non encaissée** | `BEBBA-1091` | `payment_status='to_collect'` conservé ; `bebba_order_payments.collected_at = NULL`. C'est la **seule** façon de rendre cette dette visible |
| Statut **sans trace** dans l'historique | `BEBBA-1095` (`ready`, hist. `['received']`) | importer l'historique **tel quel** + quarantaine A16. **Ne pas** fabriquer d'entrée `ready` : ce serait inventer un horodatage et un acteur |
| Entrées d'historique **en double** | `BEBBA-1079` (2× `preparing`) | importer **les deux** (append-only) + `seq` distinct + quarantaine A17. Une contrainte `UNIQUE(order_id, status)` **casserait l'import** |
| **3 commandes `status='ready'`** alors que le code auto-transite vers `waiting_for_driver` | `BEBBA-1095`, `BEBBA-1068`, `BEBBA-1060` | conserver `ready` dans l'ENUM **et** dans les données. À VÉRIFIER si le workflow cible réintroduit `ready` comme état persistant (§7-Q16) |
| **Tokens de suivi hors format** | `tk_bebba_1047_demo`, `1048`, `1049` | conserver à l'identique (liens déjà partagés). **Aucune** contrainte de format |
| **Options payées sans effet sur la recette** | 5 cas (A25) | les commandes historiques concernées **doivent rester telles quelles** : l'argent a été encaissé, le stock n'a pas bougé. La correction porte sur le **catalogue cible**, pas sur l'historique |

### 5.4 Ce que l'historique permet de rejouer — et ce qu'il ne permet pas

**Rejouable après migration** (grâce aux instantanés existants) :
- le **détail cuisine** d'une commande (ingrédients, quantités unitaires, noms, unités) ;
- la **consommation de stock** d'une commande (`updateOrderStatus` le fait déjà, `server/db.ts:1531-1541`) ;
- le **prix payé** et sa décomposition (base + options + suppléments), pour les 34 commandes non nulles ;
- la **chronologie des statuts** et le **livreur** affecté ;
- l'**identité du client au moment de la commande**.

**NON rejouable, perte définitive si rien n'est fait :**

| Perte | Cause démontrée |
|---|---|
| **Qui** a encaissé, **quand**, **combien** | `updatePaymentStatus` ne stocke qu'un drapeau (`server/db.ts:1690-1691`) |
| **Montant** des 20 commandes les plus anciennes | A1 : `null` dans la source |
| **Quantité totale par ligne** de commande | constat n°17 : seul l'agrégat par ingrédient et par commande existe (mouvements) |
| **Quel ingrédient** a été affecté par quelle option | §1.3(b) : heuristique non tracée ; rien dans les données ne dit que les +100 g sont allés au poulet |
| **Identité réelle** des acteurs (`updatedBy`, `performedBy`) | A20/A21 : 100 % en texte libre |
| **304 livraisons** par livreur | A30 |
| **Origine du stock initial** | A31 : aucun mouvement d'ouverture |
| **Référence du bon fournisseur `#4891`** en tant que donnée | constat n°21 : noyée dans `notes` |
| **Date de création** des livreurs, fournisseurs, 4 catégories, 7 produits, 8 suppléments, 13 ingrédients | A35 et recensements §1.2 |

---

## 6. Risques de perte de données lors d'une migration naïve

Classement par gravité. Chaque risque est **démontré** par une donnée ou une ligne de code.

### 6.1 Gravité CRITIQUE — perte ou corruption silencieuse

| # | Risque | Ce que fait une migration naïve | Preuve | Conséquence |
|---|---|---|---|---|
| R1 | **Colonnes monétaires `NOT NULL DEFAULT 0`** | transforme 20 `null` en `0,000 DT` | A1/A2 : 20 commandes, 20 lignes | **Falsification comptable irréversible** : impossible de distinguer « gratuit » de « inconnu » ; `SUM()` et dashboard faux sans aucun signal |
| R2 | **FK dures sur l'historique** | l'import **échoue** sur 13 références orphelines, ou le script les **supprime** | A3 (2), A4 (2), A5 (1), A6 (4), A7 (4), A8 (2) | Perte de commandes clientes réelles, ou perte de la composition cuisine |
| R3 | **Perte des relations option → ingrédient** | `customization` copié en JSON, heuristiques non portées | §1.3(a)(b) : `server/db.ts:935-995` | **Le nouveau système calcule des fiches cuisine et des consommations de stock FAUSSES** : substitutions de base inopérantes, grammes supplémentaires affectés au mauvais ingrédient |
| R4 | **Non-portage du hash d'idempotence** | hash PHP différent du hash JS | §1.3(f) : `JSON.stringify` + `localeCompare` | **422/403 spurieux** ou, pire, **doublons de commandes** non détectés |
| R5 | **Mots de passe bcrypt non vérifiables par WordPress** | import des hash tels quels | `bcryptjs@3.0.3` (`bun.lock:410`), `server/auth.ts:38-41` | **Tous les comptes inutilisables** après bascule (§7-Q2) |
| R6 | **Clients non migrés** | migration pilotée par `db.json` | `db.json` contient **0 compte `client`** | **Perte de 100 % des comptes clients** et de `clientPhoneIndex` |
| R7 | **`summaryLines` migré comme donnée authoritative** | copie du tableau de chaînes | constat n°17 : unitaire dans le seed, total dans le code | **Fiche cuisine fausse** pour toute commande en quantité > 1 : `BEBBA-1084` affiche 250 g au lieu de 500 g |
| R8 | **`stockConsumed` migré tel quel** | copie du drapeau | A14 (26 absents), A15 (10 contradictions) | **Double consommation** ou **non-consommation** de stock selon le chemin (`server/db.ts:1528-1556`) |
| R9 | **Annulation sans restitution, pérennisée** | le comportement est reproduit à l'identique | constat n°15 : `BEBBA-1079`, −1 240 unités, 0 restitution ; type déclaré jamais implémenté | **Fuite de stock permanente** : chaque annulation détruit de la matière première |
| R10 | **Séquence de commande initialisée par une constante** | `nextOrderSeq = 1101` recopié | constat n°23 : 3 valeurs divergentes (1101 / 1101 exigé / 1001) + `firestore.rules:173` bloque les suppressions | **Duplication de `orderNumber`** ⇒ collision `UNIQUE` (ou, sans contrainte, **deux commandes homonymes** dans le support client) |
| R11 | **`totalDeliveries` recalculé depuis les commandes** | `COUNT(*) WHERE status='delivered'` | A30 : 308 vs 4 | **Perte de 304 livraisons** ; KPI de performance des livreurs anéanti |
| R12 | **Stock non rapproché par un mouvement d'ouverture** | import de `current_stock` seul | A31 : `ing-poulet` Σmouvements = **+4 430** pour un stock de 8 230 | Journal **incapable d'expliquer l'état** ; tout audit de stock futur échoue ; écarts indétectables |
| R13 | **`UNIQUE(order_id, timestamp)` sur l'historique** | contrainte « propre » | A18 : 6 commandes avec horodatages identiques à la ms | **Échec d'import** de l'historique, ou perte d'entrées |
| R14 | **Transactions non atomiques reproduites** | portage 1:1 de `updateOrderStatus` | §1.3(g) : `getDoc` → `setDoc`, et `addStockMovement` en boucle avec **transaction propre** | **Consommation de stock partielle** en cas d'échec à mi-parcours ; statuts et historique désynchronisés |

### 6.2 Gravité ÉLEVÉE — déformation sémantique

| # | Risque | Preuve | Conséquence |
|---|---|---|---|
| R15 | **Fusion des doublons `available`/`isAvailable`, `order`/`sortOrder`, `image`/`imageUrl`, `quantity`/`quantityConsumed`** par `COALESCE` sans décision | constat n°6 / A28 : **7 produits phares** exclus par `availableOnly` | **Changement de comportement** du catalogue : 7 produits réapparaissent ou disparaissent selon le choix |
| R16 | **`active` absent traité comme `FALSE`** | 14 ingrédients sur 19 n'ont pas `active` ; le code teste `active === false` (`server/db.ts:325`) | **14 ingrédients désactivés** ⇒ tous les produits qui les utilisent deviennent **imcommandables** (`computePreparationSheet:927-931` **lève une erreur**) |
| R17 | **Relation fournisseur construite depuis `suppliedIngredients`** | constat n°3 / A9 : **11 divergences** | 11 ingrédients rattachés au **mauvais** fournisseur, ou à aucun |
| R18 | **`supplierName` traité comme simple dénormalisation de `supplierId`** | A10 : `'marché'` sans `supplierId` | **Perte du fournisseur réel** d'un ingrédient |
| R19 | **`totalIngredients` nommé/compris comme un total** | constat n°17 | Erreur de facteur `quantity` sur toute la consommation de stock |
| R20 | **`quantityConsumed` des suppléments de commande compris comme unitaire** | §2.7 : c'est `quantityConsumed × quantity` (`server/db.ts:1013`) | Double multiplication ou division erronée |
| R21 | **`statusHistory` modélisé comme journal de statuts uniquement** | constat n°14 : `assignDriver` pousse une entrée **sans** changement de statut (`server/db.ts:1668-1674`) | **Perte des réaffectations de livreur**, ou faux changements de statut |
| R22 | **`label` d'historique régénéré depuis le statut** | 3 variantes réelles pour `received` | Réécriture de l'historique affiché au client sur le tracking public |
| R23 | **`updatedBy` / `performedBy` mappés automatiquement vers des utilisateurs** | A20 (20 valeurs libres), A21 (9 valeurs libres), dont `'Tentative Doublon'`, `'BEBBA KDS Moteur Automatique'` | **Attribution inventée** d'actes à des personnes réelles — risque juridique et d'audit |
| R24 | **Précision monétaire réduite à 2 décimales** | `purchaseCost` = `0.016`, `0.002` | Perte sur les coûts matière ⇒ marge fausse |
| R25 | **`utf8mb3` au lieu de `utf8mb4`** | emoji 4 octets dans `summaryLines` et `notes` | **Troncature** ou **échec d'insertion** des fiches cuisine |
| R26 | **Précision milliseconde perdue (`DATETIME` sans `(3)`)** | toutes les dates sont en ms ; tri par `createdAt` (`server/db.ts:1436`) ; A18 | **Ordre des commandes et de l'historique modifié** |
| R27 | **Fuseau horaire implicite (`TIMESTAMP`)** | données en UTC (`…Z`) ; `getDashboardStats` compare `createdAt.startsWith(todayStr)` avec `new Date().toISOString()` (`server/db.ts:1698-1701`) | **Décalage d'un jour** sur les statistiques « aujourd'hui » |
| R28 | **`trackingToken` reformatté ou contraint** | A23 : 3 tokens de 18 caractères | **Liens de suivi déjà partagés cassés** |
| R29 | **`orderNumber` régénéré** | 54 numéros, utilisés dans 171 notes de mouvements et dans le tracking | **Perte de correspondance** avec l'historique imprimé et les notes |
| R30 | **Position des lignes et des ingrédients non conservée** | ordre de tableau JS ; §1.3(b) : `find()` dépend de l'ordre | **Recette modifiée** : les +100 g de `prod-mix-grill-fitness` peuvent basculer du poulet au bœuf |

### 6.3 Gravité MOYENNE — perte d'information non bloquante

| # | Risque | Preuve |
|---|---|---|
| R31 | Horodatages perdus (14 ingrédients, 8 suppléments, 7 produits, 4 catégories, **tous** les livreurs et fournisseurs) | recensements §1.2, A35 |
| R32 | `rating` perdu ou présenté comme fiable | constat n°8 |
| R33 | `purchaseCost` perdu (jamais lu par le code, mais seule donnée de coût matière) | §1.2 |
| R34 | `ingredient.category` (8 familles libres) perdu ou normalisé à tort | constat n°5 |
| R35 | `icon` (noms `lucide-react`) perdu ou rendu inopérant | §1.2 |
| R36 | Valeurs nutritionnelles (`calories`, `proteinGrams`, `carbsGrams`, `fatGrams`) mises à `0` au lieu de `NULL` pour 1 produit | 22/23 |
| R37 | `specialInstructions` perdu (1 occurrence réelle, mais bloquant en cuisine) | §1.2 |
| R38 | Clés d'idempotence perdues ⇒ doublons possibles pendant la fenêtre de bascule | §4.2 |
| R39 | `Bon #4891` (référence de réception fournisseur) non extrait du texte libre | constat n°21 |
| R40 | Comptes de test migrés en production (`agent_test_audit`, `test-i*`, `prod-test-indisponible`, `prod-1788693673602` « test plat 1 », 3 commandes `tk_*_demo`, notes `Test A…I`) | A29, `server/db.ts:2022-2027, 2058` |
| R41 | `address` client perdu (non présent dans `db.json`, présent dans Firestore) | `server/db.ts:1848` |
| R42 | `lastLoginAt` perdu (5/7) | §1.2 |

### 6.4 Documents du projet à ne PAS utiliser comme référence de migration

| Document | Défaut démontré |
|---|---|
| **`firebase-blueprint.json`** | **Obsolète et faux** : `Product.price` (le champ réel est `basePrice`), `Product` sans `baseIngredients`/`customization`, `Ingredient` sans `supplierId`/`minThreshold`/`purchaseCost`, `Supplier` réduit à `id`+`name`, `Order` sans `items`/`client`/`statusHistory`, `User` réduit à `id`+`role`, `Driver` sans `vehicle`/`active`, `StockMovement` sans `quantity`/`orderId`. **`/meta/{metaId}` est déclaré avec le schéma de `Category`** (ligne 113-116) — absurdité manifeste |
| **`firestore.rules`** | **Règles mortes** : `request.auth` est toujours `null` (pas de Firebase Auth, JWT maison — §1.3(e)). Seule la sémantique `allow delete: if false` sur `orders`, `stockMovements`, `orderIdempotencyKeys`, `clientPhoneIndex` mérite d'être conservée |
| **`security_spec.md`** | **Diverge du code** : §6.3 annonce `/idempotency_keys/{key}`, le code utilise `orderIdempotencyKeys` (`server/db.ts:1154`). §1 annonce 4 profils, le code en gère **5** (`admin_readonly`, `auth.ts:150`) |
| **`src/types.ts`** | Champs **jamais produits** : `order_cancellation_restore` (constat n°15), `StockMovement.unit` déclaré obligatoire mais absent 1 fois (A12), `User.address`/`username` optionnels alors que `username` est 7/7 pour le staff et 0/0 pour les clients |
| **`src/data/initialData.ts` → `initialStats`** | Statistiques **codées en dur** (`todayRevenue: 80.8`, 4 `topSellingProducts`) — aucune valeur probante |
| **`server/seedData.ts`** | Origine des 20 commandes sans montant (A1), des tokens `_demo` (A23), des `summaryLines` non multipliés (constat n°17), des 3 labels `'Commande reçue & enregistrée'` |

---

## 7. Points ambigus ou nécessitant vérification

**Aucune des questions ci-dessous n'est tranchée par le code.** Je ne fais aucune supposition
silencieuse : chacune est explicitement marquée **À VÉRIFIER**.

| # | Question | Ce que le code démontre | Ce qui manque | Impact si mauvaise réponse |
|---|---|---|---|---|
| **Q1** | **Comment synthétiser `wp_users.user_login` pour les clients ?** | Les clients n'ont **aucun** `username` ; ils s'authentifient par **téléphone + mot de passe** (`server.ts:92-94`) ; un compte `client` trouvé par `username` est **explicitement rejeté** (`server.ts:98-100`). A36 : un téléphone porte jusqu'à **10 identités différentes** | La règle de génération (téléphone normalisé ? préfixe `cli_` ? aléatoire ?) et la politique de collision | `user_login` est **UNIQUE** : une collision **bloque l'import**. Et si le login = téléphone, le client **voit son téléphone comme identifiant** — décision UX |
| **Q2** | **WordPress peut-il vérifier les hash bcrypt produits par `bcryptjs@3.0.3` ?** | `bcryptjs@3.0.3` (`bun.lock:410`), salt rounds 10 (`server/auth.ts:38-41`). `db.json` a `passwordHash: ''` (7/7) ⇒ **les vrais hash ne sont que dans Firestore** | (a) le **préfixe réel** des hash (`$2a$`, `$2b$`, `$2y$`) — à prélever sur Firestore ; (b) le comportement de `wp_check_password()` sur ce préfixe avec la version de PHP cible. PHP `crypt()` documente `$2a$`, `$2x$`, `$2y$` — **pas `$2b$`** | **Bloquant** : si les hash ne sont pas vérifiables, **tous les comptes sont inutilisables**. Test obligatoire **avant** migration : prélever 3 hash réels, les charger dans un WordPress de test, appeler `wp_check_password()`. Plan B : réinitialisation forcée (de toute façon **nécessaire** pour le staff, constat n°9) |
| **Q3** | **`admin_readonly` est-il volontairement aussi restreint ?** | Il n'accède **qu'à** `/api/stock-movements` (`server.ts:446`) et `/api/stats` (`server.ts:1255`). Il ne peut **pas** lire les commandes (`server.ts:674`), les ingrédients (`server.ts:383`), les livreurs (`server.ts:457`), les fournisseurs (`server.ts:579`), ni le détail d'une commande (`server.ts:892`) | L'intention métier | Reproduire fidèlement donnerait un rôle **quasi inutile** ; l'élargir serait un **changement de sécurité non demandé** |
| **Q4** | **Faut-il un carnet d'adresses client ?** | `User.address` = **une seule** valeur (`types.ts:230`, `server/db.ts:1848`). A36 : `99999999` → 10 adresses/noms différents ; `20123456` → 2 adresses. Chaque commande **fige** son adresse | Le besoin métier (multi-adresses, adresses sauvegardées) | Sans table d'adresses, le client doit **ressaisir** son adresse à chaque commande (comportement actuel) |
| **Q5** | **`vehicle` doit-il devenir une entité ?** | Texte libre : `'Scooter Honda 125cc (Rapide)'`, `'Moto Peugeot Tweet'`, `'Vélo Électrique Cargo'`. **Aucun** code ne le lit hors affichage (`DriverModal.tsx:212`) | Le besoin (capacité de charge, zone, coût/km) | Une entité véhicule vide serait de la sur-ingénierie ; un texte libre interdit tout calcul de tournée |
| **Q6** | **Que deviennent les noms d'icônes `lucide-react` ?** | 9/9 catégories portent `Salad`, `Flame`, `Baby`, `GlassWater`, `Calendar`, `Sparkles`… ; rendu par `ClientView.tsx:38-46` | Le futur front WordPress (thème, Gutenberg, blocs) | Conserver les valeurs **sans** table de correspondance produit des icônes **cassées** ; les supprimer perd l'intention de design |
| **Q7** | **`purchaseCost` sert-il à quelque chose ?** | Stocké 18/19, **jamais lu** par aucun code métier (`grep` : uniquement `types.ts`, `db.json`, modales admin). Précision **3 décimales**, supérieure à la précision monétaire (0,1 DT) | L'intention (calcul de marge ? valorisation du stock ?) | Le migrer sans usage = donnée morte ; ne pas le migrer = **seule** source de coût matière perdue |
| **Q8** | **Que faire du stock perdu par les annulations passées ?** | Constat n°15 : `BEBBA-1079` a consommé 1 240 unités, **0 restitution**. `order_cancellation_restore` est déclaré (`types.ts:46`) et **jamais implémenté** | Décision : (a) migrer l'état actuel + quarantaine documentée, (b) recalculer un stock corrigé, (c) inventaire physique complet avant bascule | (a) transfère un passif faux ; (b) modifie rétroactivement un état ; (c) est le seul fiable mais coûteux. **C'est une décision de direction, pas d'ingénierie** |
| **Q9** | **Le paiement restera-t-il uniquement COD ?** | `paymentMethod` = `'cash_on_delivery'` sur **54/54** ; `types.ts:189` le type comme **littéral unique** | L'intention (paiement en ligne, acompte, avoir) | Un ENUM à 1 valeur est **correct aujourd'hui** mais bloquant demain. Élargir sans besoin = complexité inutile |
| **Q10** | **Faut-il un objet « livraison » distinct ?** | **Aucune** donnée de livraison structurée : pas d'heure de prise en charge, de remise, de zone, de distance, de preuve. Tout est dans `statusHistory` (`delivering`, `delivered`) | Le besoin (tournée, SLA, preuve photo, multi-livreur) | Créer `bebba_deliveries` maintenant = **table vide**. Ne pas la créer = évolution de schéma plus tard |
| **Q11** | **`baseIngredients[].ingredientName` doit-il survivre comme instantané ?** | `computePreparationSheet:929` utilise **`base.ingredientName`** (la copie) et **non** `allIngredientsMap.get(...).name` (la référence) pour construire la fiche. **0 divergence** constatée aujourd'hui | L'intention : est-ce un instantané volontaire ou une dénormalisation accidentelle ? | Si l'on ne stocke que la FK, un ingrédient **renommé** changera le nom affiché **dans la recette vivante** (acceptable) mais le comportement actuel (nom figé dans le produit) **ne sera pas reproduit** |
| **Q12** | **Faut-il une entité « réception fournisseur » ?** | Constat n°21 : la **seule** trace est `'Réception livraison fournisseur Volailles du Terroir (Bon #4891)'` dans `stockMovements.notes`. `replenishment` est utilisé par `AdminView.tsx:273` mais produit **0 mouvement** dans les données | Le besoin (bons de commande, rapprochement, prix d'achat réel par lot) | Sans entité, `purchase_cost` reste théorique et aucun rapprochement fournisseur n'est possible |
| **Q13** | **`orderIdempotencyKeys` est-elle vide actuellement ?** | **Absente de `db.json`**. `scripts/migrate-to-firestore.ts:245-250` **exige** qu'elle soit vide **à l'issue de la migration initiale** | L'état **courant** de Firestore (le script a tourné à un instant T ; des commandes ont été créées depuis — `db.json` va jusqu'à `BEBBA-1100` datée du 2026-09-04) | Si des clés existent et ne sont pas migrées, **des doublons de commandes** peuvent apparaître pendant la fenêtre de bascule |
| **Q14** | **Le rate limiting doit-il être persistant ?** | `server.ts:795-800` : `Map` **en mémoire**, perdue au redémarrage, **non partagée** entre instances | L'architecture cible (mono-instance PHP ? plusieurs nœuds derrière un load balancer ?) | En multi-instance, un limiteur par processus **divise l'efficacité par N** ; `track-lookup` est un endpoint **public** de recherche par couple `orderNumber`+`phone` |
| **Q15** | **Le login `admin` est-il conservé ?** | `usr-admin-1` a `username: 'admin'` (`db.json`) | La politique de sécurité WordPress | `admin` est la **cible n°1** des attaques par force brute. Le conserver exige un durcissement (limitation de tentatives, 2FA). Le renommer **casse l'accès** du personnel |
| **Q16** | **`ready` redevient-il un état persistant ?** | Constat n°13 : `updateOrderStatus` transforme **systématiquement** `ready` → `waiting_for_driver` avec **2 entrées** d'historique (`server/db.ts:1585-1604`). Pourtant **3 commandes** ont `status='ready'` et **13 entrées** d'historique portent `ready` | Le workflow cuisine cible (KDS) | Garder l'auto-transition = `ready` reste un état **fantôme**. La supprimer = **changement de workflow** non demandé. `security_spec.md` §3 documente l'auto-transition comme **intentionnelle** |
| **Q17** | **Faut-il purger les données de test avant ou après migration ?** | A29 : `agent_test_audit`, `ing-1788825545393`, `test-ing-kitchen-…`, `prod-test-indisponible`, `prod-1788693673602` (« test plat 1 »), `prod-1788252897607`, `prod-1788252928280`, 3 commandes `tk_*_demo`, notes `Test A…I`, `updatedBy: 'Tentative Doublon'`. `resetDemoData` (`server/db.ts:1959-2210`) **tente** déjà cette purge mais est **bloquée par `firestore.rules`** | La liste exhaustive validée par le métier | Purger **avant** = données perdues sans trace. Purger **après** = base WordPress polluée. **Recommandation : migrer TOUT, marquer `is_test_data`, purger ensuite** — la traçabilité prime |
| **Q18** | **MySQL 8.4 ou MariaDB ?** | Le cahier des charges dit **« MySQL 8.4 / MariaDB »** — les deux | Le choix réel | Divergences concrètes : collation `utf8mb4_0900_ai_ci` **absente** de MariaDB ; `CHECK` ignorées avant MariaDB 10.2 / MySQL 8.0.16 ; `LAST_INSERT_ID(expr)` supporté des deux côtés ; CTE et fonctions de fenêtre supportés des deux côtés mais avec des écarts. **Le schéma ne peut pas être finalisé sans cette réponse** |
| **Q19** | **WooCommerce ou tables `bebba_*` ?** | `.opencode/skills/bebba-wordpress/SKILL.md` §4 demande d'évaluer WooCommerce en priorité. Le cahier des charges de la mission parle d'un **plugin métier `bebba_*`** | La décision d'architecture | **Mon analyse indépendante, sur preuves** : WooCommerce est **mal adapté** ici, pour 5 raisons démontrées — (1) le stock est géré **au niveau ingrédient** avec recette et substitution (`server/db.ts:935-995`), alors que WooCommerce gère le stock **au niveau produit/variation** ; (2) `computePreparationSheet` doit **recalculer la consommation depuis l'historique** (`:1531-1541`), ce que `wc_order_itemmeta` (EAV) rend très coûteux ; (3) **aucun client n'a d'email** (A33) alors que le checkout WooCommerce est centré sur l'email ; (4) les statuts requis (`waiting_for_driver`, `preparing`) et la **matrice de transition par rôle** (`auth.ts:145-181`) n'ont pas d'équivalent natif ; (5) le COD exige une **réconciliation par livreur et par jour** (`DriverView.tsx:61-62`) absente de WooCommerce. **Recommandation : tables `bebba_*`**, avec WooCommerce **uniquement** si une boutique en ligne classique doit coexister — **À VÉRIFIER** |
| **Q20** | **`ing-fantome-inconnu` : d'où vient-il ?** | A5 : présent dans `BEBBA-1086`. `deleteIngredient` **bloque** la suppression si l'ingrédient est référencé par une commande (`isIngredientInUse`, `server/db.ts:295-297, 341-351`) | L'explication : contournement du garde-fou, écriture directe, ou donnée de test | Si le garde-fou a été contourné une fois, **d'autres orphelins peuvent apparaître** après l'audit. Il faut vérifier l'état **courant** de Firestore, pas seulement `db.json` |
| **Q21** | **`db.json` ou Firestore : quelle source pour la migration ?** | `db.json` : 9 collections, **0 client**, `passwordHash` vides, **pas** de `clientPhoneIndex` / `orderIdempotencyKeys` / `meta/*`. Firestore : **13 collections/documents**, population réelle inconnue | Un **export Firestore daté et complet** | **Risque majeur** : migrer depuis `db.json` perd les clients (R6), les mots de passe (R5) et les clés d'idempotence (R38). **La source doit être Firestore**, `db.json` ne servant que de référence de contrôle |
| **Q22** | **`ingredient.category` doit-il être normalisé ?** | 8 valeurs libres, **non lues par le code** : `Légumes` vs `Légumes & Fruits`, `Protéines` vs `Protéines & Fromages` | L'intention (familles d'achat ? groupes de stock ?) | Normaliser **sans règle métier** fusionnerait des catégories peut-être distinctes ; ne pas normaliser conserve le désordre |
| **Q23** | **Les produits sans `baseIngredients` sont-ils légitimes ?** | `prod-test-indisponible` : **aucun** `baseIngredients`. `computePreparationSheet` produit alors une fiche **vide** et ne consomme **rien** | S'il existe de vrais produits sans recette (ex. « Pack Repas Programme », boisson en bouteille) | Un produit commandable **sans consommation de stock** fausse la valorisation du stock. `ing-repas-programme` (unité `portion`, coût `8.5`) existe mais n'est rattaché à **aucun** produit vérifié |
| **Q24** | **Faut-il conserver `isPopular`, `calories`, macros ?** | `isPopular` 23/23 ; macros 22/23. Utilisés uniquement en affichage client | La stratégie de contenu WordPress (champs personnalisés, ACF, blocs) | Les macros sont un **argument de vente** (`ProductDetailView`) : les perdre dégraderait le front |

---

## 8. Proposition finale — modèle logique

> **Rappel du cadre :** aucune table n'est créée et **aucun SQL physique n'est fourni**.
> Ce qui suit est le modèle logique recommandé, avec les justifications qui le distinguent
> d'un mapping « évident ».

### 8.1 Répartition WordPress natif / tables métier

| Couche | Contenu | Pourquoi |
|---|---|---|
| **WordPress natif** | Identité et authentification **uniquement** : `wp_users` (ID, login, mot de passe, `display_name`, `user_registered`), `wp_usermeta` (rôles/capabilities, `first_name`/`last_name`, téléphone **staff**, `bebba_last_login_at`, `bebba_account_active`), rôles créés par `add_role()`, `wp_options` pour les préférences **non transactionnelles** | Le cahier des charges le demande, et c'est le seul domaine où WordPress apporte une valeur réelle démontrée (authentification, sessions, rôles, admin). **Rien d'autre** ne doit y aller |
| **Tables métier `bebba_*`** | **Tout le reste** : catalogue, recettes, options et effets d'options, ingrédients, stock, mouvements, fournisseurs, livreurs (profil métier), commandes, lignes, instantanés cuisine, historique d'événements, encaissements, séquences, idempotence, état système, paramètres transactionnels, tables de migration | Besoins **transactionnels, agrégés, contraints et normalisés** (P5, P10). `wp_postmeta` est un EAV sans type, sans FK, indexé en préfixe — structurellement inapte |
| **Ni l'un ni l'autre** | `summaryLines`, `hasInactiveIngredient`, `ingredientActive`, `drivers[].username`, `clientPhoneIndex.{name,createdAt,normalizedPhone}`, `image` (doublon), `order` (doublon), `quantity` (doublon), `firestore.rules`, `firebase-blueprint.json`, état `localStorage` | Données **calculées**, **dupliquées** ou **mortes** (§2.8, §6.4) |

**Décision tranchée : pas de `wp_posts` / `wp_postmeta` / `wp_terms` pour le métier,
et pas de WooCommerce pour les commandes** — justification sur preuves en **Q19**.

### 8.2 Liste finale des entités (28 tables métier + 2 tables de service)

**Identité & profils (3)**
1. `bebba_clients` — 1:1 `wp_users` ; **remplace `clientPhoneIndex`** par une contrainte `UNIQUE` réelle
2. `bebba_staff` — 1:1 `wp_users` (admin / admin_readonly / kitchen) ; porte `legacy_user_id`, `updated_at`
3. `bebba_drivers` — 1:1 `wp_users` **NULL-able** ; `total_deliveries_opening` ; `rating` non authoritative

**Référentiels (3)**
4. `bebba_units` — 4 valeurs réelles + `NULL` autorisé
5. `bebba_ingredient_categories` — 8 familles libres, non normalisées **volontairement** (Q22)
6. `bebba_order_status_transitions` — matérialise la matrice **dupliquée** dans `auth.ts:154-163` et `db.ts:1514-1522`

**Catalogue (4)**
7. `bebba_categories` — `slug UNIQUE`, `sort_order` unique (fusion `order`/`sortOrder`)
8. `bebba_suppliers` — seul porteur d'`email`
9. `bebba_ingredients` — `current_stock` **NULL-able**, `row_version`, `is_tombstone`, `supplier_name_free` distinct de la FK
10. `bebba_supplements` — `quantity_per_unit` (fusion `quantityConsumed`/`quantity`), `is_available` (fusion)

**Recette & personnalisation (5)** — *le cœur de l'apport de cet audit*
11. `bebba_product_ingredients` — N-N produit↔ingrédient **+ `position` + `role_tag`**
12. `bebba_product_supplements` — N-N produit↔supplément
13. `bebba_product_option_groups` — 3 axes (`protein`, `vegetable`, `base`), `is_enabled`
14. `bebba_product_options` — **donne enfin un identifiant** à des options aujourd'hui reconnues **par label**
15. **`bebba_product_option_effects`** — ★ matérialise `server/db.ts:935-995` ; sans elle, les
    substitutions de base et les grammes supplémentaires restent des heuristiques non auditées

**Produit (1)**
16. `bebba_products`

**Commandes (6)**
17. `bebba_orders` — `order_number UNIQUE`, **`order_seq UNIQUE`**, `tracking_token UNIQUE`,
    montants **NULL-ables**, instantanés client, `stock_state` à 3 états
18. `bebba_order_items` — `position`, `product_id SET NULL`, options en **colonnes d'instantané + FK NULL-able**
19. `bebba_order_item_supplements` — instantané complet (le meilleur du projet), `quantity_consumed_total` **renommé**
20. `bebba_order_item_ingredients` — **`quantity_per_unit` ET `quantity_total`**, `source`, `ingredient_id SET NULL` (A5)
21. `bebba_order_status_history` — **append-only**, `UNIQUE(order_id, seq)`, `event_type`, `status` **NULL-able**, acteur texte + FK NULL-able
22. `bebba_order_payments` — **AJOUT** : aucune donnée d'encaissement n'existe aujourd'hui au-delà d'un drapeau

**Stock (1)**
23. `bebba_stock_movements` — **append-only**, `movement_type` ENUM **8 valeurs** (7 déclarées + `opening_balance`),
    `quantity_delta` signé, `balance_after`, `order_item_id`, `reason_code`, acteur texte + FK NULL-able

**Techniques (4)**
24. `bebba_sequences` — **pas `wp_options`** (P10, §4.1), avec `floor_value` anti-collision (constat n°23)
25. `bebba_order_idempotency_keys` — `order_id NOT NULL` (la FK **remplace** `IdempotencyInconsistencyError`), `expires_at`
26. `bebba_system_state` — **pas `wp_options`** : lu **dans** la transaction (P10, §4.3) ; **réutilisable pour la bascule elle-même**
27. `bebba_settings` — `delivery_fee` et constantes aujourd'hui codées en dur **6 fois** (§4.5)

**Service migration (3)**
28. `bebba_migration_log`
29. `bebba_migration_quarantine` — 36 classes d'anomalies mesurées (§1.4)
30. `bebba_migration_id_map` — **indispensable au rollback** (§4.7)

### 8.3 Les 12 décisions qui distinguent ce modèle d'un mapping « propre »

Un mapping naïf mais esthétiquement propre aurait fait l'inverse sur chacun de ces points.
Chaque ligne est justifiée par une preuve.

| # | Décision | Ce qu'un mapping « propre » ferait | Preuve qui l'interdit |
|---|---|---|---|
| D1 | **`bebba_product_option_effects`** | Garder `customization` en JSON, « c'est de la config » | §1.3(a)(b) : la recette **réelle** dépend de `label.includes('Quinoa')` et de `ingredientId.includes('poulet')`. **8 substitutions impossibles**, **5 options payées sans effet**, **1 cas où l'ordre du tableau décide quel ingrédient reçoit +100 g** |
| D2 | **Montants de commande `NULL`-ables** | `DECIMAL(10,2) NOT NULL DEFAULT 0` | A1/A2 : **20 commandes et 20 lignes à `null`**. `0` ≠ `inconnu` (R1) |
| D3 | **FK `SET NULL` + instantanés sur tout l'historique** | FK `NOT NULL RESTRICT` « pour l'intégrité » | A3-A8 : **13 références orphelines réelles**, dont `ing-fantome-inconnu` dans une fiche cuisine (R2) |
| D4 | **`quantity_per_unit` ET `quantity_total` séparés** | Un seul champ « total » | Constat n°17 : `BEBBA-1084`, quantité 2 → `totalIngredients` dit **250 g**, `summaryLines` dit **250 g**, les mouvements disent **−500 g** (R7, R19) |
| D5 | **`UNIQUE(order_id, seq)` sur l'historique, jamais `(order_id, timestamp)`** | Contrainte naturelle sur le couple statut/horodatage | A18 : **6 commandes** avec horodatages **identiques à la milliseconde** ; A17 : `BEBBA-1079` a **2 entrées `preparing`** (R13) |
| D6 | **`event_type` + `status` NULL-able dans l'historique** | Une table `order_status_history` = une ligne par statut | Constat n°14 : `assignDriver` pousse une entrée **sans changer le statut** (`server/db.ts:1668-1674`) ⇒ **perte des réaffectations de livreur** (R21) |
| D7 | **Mouvement `opening_balance` obligatoire** | Importer `current_stock` et basta | A31 : `ing-poulet` Σmouvements = **+4 430** pour un stock de **8 230**. Le journal ne peut **pas** expliquer l'état (R12) |
| D8 | **`total_deliveries_opening` + comptage, pas un compteur unique** | Recopier `totalDeliveries`, ou le recalculer | A30 : **308** déclarés vs **4** commandes `delivered`. Le recalcul perd **304** livraisons ; le compteur unique reproduit la race de `server/db.ts:1624-1631` (R11, §1.3(g)) |
| D9 | **`bebba_clients` avec `phone_normalized UNIQUE`, et suppression de `clientPhoneIndex` comme entité** | Reproduire la collection en table, « par fidélité » | `getClientByPhone` fait une lecture d'index **puis un scan complet de tous les clients avec ré-écriture différée** (`server/db.ts:1800-1812`) : c'est un palliatif Firestore. Le script actuel doit **détecter les collisions et les orphelins à la main** (`migrate-to-firestore.ts:118-124, 217-243`) |
| D10 | **`bebba_sequences` et `bebba_system_state` en tables, JAMAIS en `wp_options`** | `update_option('bebba_next_order_seq', …)` | P10 : `meta/counters` et `meta/system` sont lus **via `transaction.get()` dans la transaction de création de commande** (`server/db.ts:1145, 1190`). `get_option()` est **caché et hors transaction** ⇒ le verrou de migration et l'unicité du numéro **régresseraient** |
| D11 | **`supplier_name_free` conservé comme colonne distincte de la FK, et table de liaison avec `source`** | Une seule relation fournisseur propre | A10 : `ing-1788825545393` → `supplierName: 'marché'`, `supplierId: null`. A9 : **11 divergences** entre les deux sens de la relation. Fusionner = **perdre ou inventer** (R17, R18) |
| D12 | **3 axes d'options en colonnes fixes, pas de table générique d'options de commande** | Une table `order_item_options` élégante et extensible | §2.6 : les données réelles ne contiennent **que 3 axes** ; `buildDeterministicOrderHash` (`server.ts:955-964`) les traite comme des champs **nommés et typés** ⇒ une modélisation générique **casserait la reproductibilité du hash** (R4) |

### 8.4 Exigences non négociables pour que la migration soit intègre

Ces exigences portent sur le **processus**, pas sur le schéma. Elles sont toutes justifiées par un
constat mesuré.

1. **La source de vérité est Firestore, pas `db.json`** (Q21, R6). `db.json` ne contient
   **0 client**, des `passwordHash` **vides**, et **aucune** des collections
   `clientPhoneIndex` / `orderIdempotencyKeys` / `meta/*`. Il ne sert que de **référence de contrôle**.
2. **Geler les écritures pendant la bascule** en réutilisant `meta/system.state = IN_PROGRESS`
   (`server/db.ts:1145-1150` → HTTP 503). Ce mécanisme **existe déjà** et doit être porté, pas réinventé.
3. **Vérifier les hash bcrypt avant tout import** (Q2, R5). Test concret : prélever 3 hash réels
   depuis Firestore, les charger dans un WordPress de test, appeler `wp_check_password()`.
   **Plan B obligatoire** : réinitialisation forcée — de toute façon **nécessaire** pour le staff,
   dont les mots de passe sont **partagés par rôle** (constat n°9).
4. **Ne corriger aucune anomalie silencieusement** : 36 classes mesurées (§1.4) ⇒
   **une ligne de quarantaine par occurrence**, avec `resolution_status` validé par un humain.
5. **Journaliser plutôt que déduire** : `updatedBy` (119 valeurs libres, A20) et `performedBy`
   (173, A21) **ne doivent jamais** être mappés automatiquement vers des comptes (R23).
6. **Ne pas purger les données de test avant migration** (Q17) : tout importer, marquer
   `is_test_data`, purger ensuite. La purge actuelle (`resetDemoData`) est **déjà inefficace**
   parce que `firestore.rules:173` bloque les suppressions — c'est même ce qui crée le risque
   de duplication de `orderNumber` (constat n°23).
7. **Contrôles de réconciliation bloquants avant `READY`**, en transposant ceux qui existent déjà
   dans `scripts/migrate-to-firestore.ts:200-257` (**le meilleur précédent du projet**) et en
   **ajoutant** les 3 manquants : sommes monétaires **avec compte séparé des `NULL`**,
   cohérence `current_stock` ↔ `Σ quantity_delta` + `opening_balance`,
   cohérence `stock_state` ↔ ledger (§4.6).
8. **Toutes les opérations critiques dans une transaction SQL unique**, avec **retry sur deadlock**
   et **ordre de verrouillage déterministe** des ingrédients (§1.3(g)). Aujourd'hui
   `updateOrderStatus`, `assignDriver`, `updatePaymentStatus` et `totalDeliveries++`
   **ne sont pas transactionnels**, et le rattrapage de stock ouvre **une transaction par ingrédient**
   (`server/db.ts:1544-1554`) ⇒ consommation partielle possible (R14).
9. **Corriger l'annulation pendant la migration, pas après** (constat n°15, R9, Q8) :
   `order_cancellation_restore` est déclaré depuis l'origine et **jamais implémenté**.
   Le porter à l'identique **pérenniserait** une fuite de stock démontrée (−1 240 unités sur
   `BEBBA-1079`).
10. **Porter le hash d'idempotence à l'identique, avec test de non-régression** (R4) :
    jeu de commandes réelles → hash JS de référence → hash PHP → **comparaison octet par octet**.
    Sans ce test, les réponses 200/403/422 ne sont pas garanties.

### 8.5 Ce que cet audit refuse de valider

Par honnêteté d'audit, voici ce que je **ne** valide **pas**, malgré une apparence propre :

| Élément | Pourquoi je ne le valide pas |
|---|---|
| **`firebase-blueprint.json` comme contrat de données** | `Product.price` n'existe pas (c'est `basePrice`) ; `/meta/{metaId}` est déclaré avec le schéma de **`Category`** ; `Order.items`, `Supplier.suppliedIngredients`, `User.username/phone/driverId` sont absents (§6.4) |
| **`firestore.rules` comme source des permissions WordPress** | Règles **mortes** : `request.auth` est toujours `null` car l'app n'utilise **pas** Firebase Auth (§1.3(e)). La vraie matrice est dans `server/auth.ts` + `server.ts` |
| **`security_spec.md` comme spécification** | Diverge du code : `/idempotency_keys/{key}` vs `orderIdempotencyKeys` ; 4 rôles annoncés vs **5** implémentés (§6.4) |
| **`src/types.ts` comme inventaire** | `order_cancellation_restore` n'existe que là ; `StockMovement.unit` déclaré obligatoire mais absent en pratique ; `User.address`/`username` mal typés par rapport aux données réelles |
| **Le modèle de recette actuel** | Il n'existe **pas** en tant que données : il est dans des `includes()` sur des IDs et des labels (§1.3). Le valider reviendrait à valider **8 substitutions silencieusement impossibles** et **5 options payées sans effet** |
| **`preparationSheet.summaryLines` comme fiche cuisine** | Deux sémantiques contradictoires selon l'origine de la commande (constat n°17). Pour `BEBBA-1084`, la cuisine lit **250 g** alors qu'il faut **500 g** |
| **`stockConsumed` comme indicateur** | Absent 26/54, **contredit 10 fois** par le ledger (A14, A15) |
| **`statusHistory` comme journal d'audit complet** | `BEBBA-1095` a changé de statut **sans trace** ; 0 % des acteurs sont résolubles (A16, A20) |
| **`resetDemoData` comme procédure sûre** | Remet le compteur à **1001** alors que les commandes ne peuvent **pas** être supprimées (`firestore.rules:173`) ⇒ duplication de `orderNumber` démontrable (constat n°23) |
| **`Driver.rating` comme KPI** | Aucune source, aucun calcul, aucune lecture (constat n°8) |
| **`getProducts({availableOnly:true})`** | Exclut **7 produits phares** faute du champ `available` (constat n°6). Latent car le front ne l'appelle jamais — mais le normaliser à la migration **changerait** le catalogue |

---

## Annexe A — Index des preuves

Toute affirmation du rapport renvoie à une preuve vérifiable.

### A.1 Fichiers analysés

| Fichier | Lignes | Rôle |
|---|---|---|
| `data/db.json` | 9 137 | données réelles (9 collections + `nextOrderSeq`) |
| `server/db.ts` | 2 211 | **autorité** comportementale |
| `server.ts` | 1 295 | contrats HTTP, RBAC, hash d'idempotence, masquage |
| `server/auth.ts` | 191 | JWT, bcrypt, matrice de transition par rôle |
| `src/types.ts` | 310 | types déclarés (**non fiable seul**) |
| `scripts/migrate-to-firestore.ts` | 288 | migration JSON → Firestore, contrôles de réconciliation |
| `server/seedData.ts` | 1 531 | origine des anomalies A1, A23, constat n°17 |
| `firestore.rules` | 285 | **règles mortes** sauf `allow delete: if false` |
| `firebase-blueprint.json` | ~140 | **obsolète** |
| `security_spec.md` | 92 | **diverge du code** |
| `src/context/AppContext.tsx` | 1 317 | contrats front, `localStorage` |
| `src/components/**` | — | ce qui est réellement affiché (cuisine, livreur, admin, client) |

### A.2 Références de code citées

| Sujet | Emplacements |
|---|---|
| Verrou système | `server/db.ts:162-169`, `1145-1150` ; `scripts/migrate-to-firestore.ts:76-80, 261-266, 273-277` |
| Idempotence | `server/db.ts:62-84`, `1152-1186`, `1407-1414` ; `server.ts:925-995`, `1022-1046` ; `firestore.rules:119-129` |
| Compteur de commandes | `server/db.ts:1190-1192`, `1338`, `1417-1421`, `2091-2094` ; `data/db.json:9137` ; `scripts/migrate-to-firestore.ts:142-151, 252-257` |
| Hash canonique | `server.ts:925-995` |
| Recette & substitutions (**§1.3**) | `server/db.ts:807-1111`, notamment `925-933` (base), `935-947` (protéine), `950-961` (légumes), `964-995` (base swap), `997-1030` (suppléments), `1035-1037` (prix), `1041-1085` (fiche) |
| Création de commande | `server/db.ts:1113-1428` ; `server.ts:998-1075` |
| Contrôle de stock | `server/db.ts:1240-1247`, `1296-1325`, `1391-1406` |
| Transition de statut | `server/db.ts:1491-1645` ; `server/auth.ts:145-181` ; `server.ts:1089-1172` |
| Rattrapage de stock non transactionnel | `server/db.ts:1526-1556` |
| Auto-transition `ready` → `waiting_for_driver` | `server/db.ts:1585-1604` |
| Affectation livreur | `server/db.ts:1646-1677` ; `server.ts:1174-1189` |
| Incrémentation `totalDeliveries` | `server/db.ts:1622-1631` |
| Encaissement | `server/db.ts:1679-1693` ; `server.ts:1191-1252` ; `security_spec.md:§5` |
| Dashboard | `server/db.ts:1696-1748` ; `server.ts:1255-1263` |
| `clientPhoneIndex` | `server/db.ts:1782-1815`, `1817-1864`, `1866-1918`, `1936-1957` ; `scripts/migrate-to-firestore.ts:112-140, 217-243` ; `firestore.rules:208-216` |
| Normalisations | `server/db.ts:98-113` ; `scripts/migrate-to-firestore.ts:19-24` ; `server.ts:939-940` |
| Masquage public | `server.ts:709-793` |
| Rate limiting | `server.ts:795-800`, `836-890` |
| Garde-fous de suppression | `server/db.ts:228-237` (catégorie), `276-351` (ingrédient), `255-259` (fournisseur — **aucun**), `496-500` (supplément — **aucun**), `612-616` (produit — **aucun**), `786-805` (livreur — **cascade sur le compte**) |
| `resetDemoData` | `server/db.ts:1959-2210`, notamment `2065-2083` (stocks nominaux), `2091-2094` (compteur), `2117-2124` + `2203-2206` (suppressions bloquées) |
| RBAC HTTP | `server.ts` : `209, 234, 266, 293, 325, 351, 383, 393, 403, 414, 424, 446, 457, 467, 514, 528, 550, 568, 579, 619, 628, 674, 815, 836, 892, 998, 1078, 1089, 1174, 1191, 1255, 1265` |
| Types de mouvements | `src/types.ts:39-46` ; usages réels : `server/db.ts:1400, 1547`, `server.ts:436`, `src/components/admin/AdminView.tsx:273`, `src/components/kitchen/KitchenView.tsx:77` |
| Affichage cuisine | `src/components/kitchen/KitchenView.tsx:335-336` (`summaryLines`), `356-370` (options et suppléments) |
| Encaissement livreur | `src/components/driver/DriverView.tsx:61-62, 77, 89-93, 226, 280-296, 371-396` |
| Panier & checkout | `src/components/client/CartDrawer.tsx:33-34`, `CheckoutModal.tsx:68-104, 144-145, 175-201` |
| `localStorage` | `src/context/AppContext.tsx:205, 309, 342, 365, 514, 623, 704, 795, 801` |

### A.3 Mesures effectuées sur `data/db.json`

| Mesure | Résultat |
|---|---|
| Volumes | 9 catégories, 3 fournisseurs, 19 ingrédients, 10 suppléments, 23 produits, 3 livreurs, 54 commandes, 173 mouvements, 7 utilisateurs, `nextOrderSeq = 1101` |
| Rôles des utilisateurs | 3 `driver`, 2 `kitchen`, 1 `admin`, 1 `admin_readonly` — **0 `client`** |
| Statuts de commande | `received` 24, `preparing` 15, `delivered` 4, `delivering` 4, `ready` 3, `waiting_for_driver` 3, `cancelled` 1 |
| Paiement | `to_collect` 51, `paid` 3 ; `cash_on_delivery` 54/54 ; **1 `delivered` + `to_collect`** (`BEBBA-1091`) ; **0 `paid` non `delivered`** |
| `orderNumber` | `BEBBA-1047`…`BEBBA-1100`, 54 valeurs, **0 doublon, 0 trou** |
| `trackingToken` | **0 doublon** ; 51 × 15 car., **3 × 18 car.** (`tk_bebba_10NN_demo`) |
| `createdAt` commande | **0 doublon** |
| Montants | `subtotal`/`totalAmount` **`null` × 20** ; `unitPrice`/`itemTotalPrice` **`null` × 20** ; `deliveryFee` = `2.5` × 54 |
| `stockConsumed` | présent 28/54 (`true` 20, `false` 8), **absent 26** ; **10 contradictions avec le ledger** |
| Historique | 119 entrées ; `updatedBy` présent 112/119, **20 valeurs libres distinctes** ; `label` **8 valeurs** dont **3 pour `received`** ; **6 commandes** avec horodatages dupliqués ; **1** doublon d'entrée ; **1** historique incomplet |
| Lignes de commande | 56 ; `baseChoice` 26, `proteinOption` 11, `veggiesOption` 7, `specialInstructions` **1**, suppléments **12** |
| Mouvements | `order_consumption` 171 (**171 négatifs**), `manual_in` 2 (**2 positifs**) ; **5 types déclarés jamais produits** ; `unit` absent 1 ; `orderId` absent 2 ; `performedBy` **9 valeurs libres** |
| Téléphones clients | **20 numéros normalisés distincts** pour 54 commandes ; `99999999` → **10 identités** ; `20123456` → **2 identités** ; 12 formats bruts |
| Intégrité référentielle | **13 références orphelines** (2 produits, 2 suppléments, 1 ingrédient fantôme en commande, 4 ingrédients en recette, 4 suppléments autorisés, 2 ingrédients en supplément) ; **11 divergences** fournisseur |
| Dérive des dénormalisations de nom | **0** (vérifié sur produits, suppléments, ingrédients) |
| Options payées sans effet | **5** ; substitutions de base impossibles : **8** ; labels non reconnus : **8** sur 19 |
| Recalculabilité du stock | **impossible** : `ing-poulet` Σmouvements **+4 430** vs `currentStock` **8 230** |
| Formats d'ID | 4 familles par collection : `prefixe-<slug>`, `prefixe-<epochms>`, `prefixe-<epochms>-<rand>`, `prefixe-<petit entier>`, + IDs contenant `test` |
| Encodage | emoji 4 octets réels (🍗🥩🐟🍚🥦🥑🥚🧀🥣🌿⚠️), accents (Œufs, Bœuf, Détox) ⇒ **`utf8mb4` obligatoire** |

---

## Annexe B — Résumé exécutif en 10 constats

1. **`db.json` n'est pas la source de vérité** : 3 collections techniques et **tous les comptes
   clients** n'y figurent pas. La migration doit partir de **Firestore** (Q21, R6).
2. **La recette réelle n'existe pas dans les données** : elle est dans des `includes()` sur des IDs
   d'ingrédients et sur des **labels d'options**. Résultat mesuré : **8 substitutions impossibles**,
   **5 options payées sans effet sur le stock**, **8 labels non reconnus**, et **1 plat où l'ordre du
   tableau décide quel ingrédient reçoit les 100 g supplémentaires** (§1.3, D1).
3. **37 % des commandes n'ont aucun montant** (`null`, pas `0`). Toute colonne `NOT NULL DEFAULT 0`
   **falsifie la comptabilité** (A1, R1, D2).
4. **13 références orphelines réelles** dans les commandes et le catalogue, dont un
   **`ing-fantome-inconnu`** dans une fiche cuisine ⇒ **aucune FK dure** sur l'historique
   (A3-A8, R2, D3).
5. **`preparationSheet` mélange unitaire et total** : pour `BEBBA-1084` (×2), la fiche et le résumé
   affichent **250 g** alors que le stock a consommé **500 g**. `summaryLines` n'est **pas** fiable
   (constat n°17, R7, D4).
6. **L'annulation ne restitue jamais le stock** : `order_cancellation_restore` est déclaré et
   **jamais implémenté** ; `BEBBA-1079` a détruit **1 240 unités**. Porter le comportement à
   l'identique **pérennise la fuite** (constat n°15, R9, Q8).
7. **Le stock n'est pas reconstructible depuis le journal** (aucun mouvement d'ouverture ;
   `ing-poulet` : Σ = **+4 430** pour un état de **8 230**) ⇒ `opening_balance` **obligatoire**
   (A31, R12, D7). Et **`totalDeliveries`** n'est pas recalculable : **308** déclarés vs **4**
   traçables (A30, R11, D8).
8. **`statusHistory` n'est pas un journal fiable** : statut changé sans trace (`BEBBA-1095`),
   doublons (`BEBBA-1079`), **6 commandes** avec horodatages identiques à la ms, **100 %** des
   acteurs en texte libre non résolvable, et des entrées **qui ne sont pas des changements de
   statut** ⇒ `UNIQUE(order_id, seq)` + `event_type` + `status` NULL-able
   (constat n°14, A16-A21, R13, R21, D5, D6).
9. **`meta/counters` et `meta/system` ne doivent PAS devenir des `wp_options`** : ils sont lus
   **dans la transaction** de création de commande. De plus, `resetDemoData` remet le compteur à
   **1001** alors que `firestore.rules:173` **empêche** de supprimer les commandes ⇒
   **duplication de `orderNumber` démontrable** (§4.1, §4.3, constat n°23, R10, D10).
10. **Deux bloqueurs techniques à lever avant tout import** : la **vérifiabilité des hash bcrypt
    par WordPress** (Q2, R5) et la **reproductibilité exacte du hash d'idempotence** en PHP
    (`JSON.stringify` + `localeCompare`, §1.3(f), R4). Aucun des deux n'est démontré par le dépôt.

---

*Fin du rapport. Mapping logique uniquement — aucune table créée, aucun SQL physique fourni.*
