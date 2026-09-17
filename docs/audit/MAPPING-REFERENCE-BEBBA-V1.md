# MAPPING DE RÉFÉRENCE BEBBA — V1

**Projet :** BEBBA Healthy Food
**Migration :** Firestore → WordPress + MySQL 8.4
**Nature du document :** cartographie de données de référence
**Exclusions volontaires :** aucun SQL, aucune migration PHP, aucun plugin, aucun code d'implémentation
**Date :** 2026-09-17
**Dépôt audité :** `zoubeirsneni-lgtm/bhf` @ `5e57050e9f16c8a4018c0354b5a638d60712721b`
**Document amont :** `docs/audit/contre-expertise-mapping-wp-mysql.md` (contre-expertise V0)

---

## 0. Statut des sources — à lire avant tout le reste

La consigne demande de travailler **à partir du code et, lorsque disponibles, des données Firestore
réelles**, et de ne pas prendre `src/types.ts` ni `data/db.json` comme source de vérité lorsqu'ils
peuvent diverger de Firestore. Voici l'état **réel et vérifié** de mes sources.

### 0.1 Firestore : NON accessible depuis cet environnement

Tentatives effectuées et résultats :

| Test | Résultat |
|---|---|
| Résolution DNS `firestore.googleapis.com` | ✅ résout (`2607:f8b0:400e:c20::5f`) |
| `curl https://firestore.googleapis.com/` | ❌ `HTTP 000` |
| `curl` REST API documents (lecture seule, clé du dépôt) | ❌ `curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL` |
| `curl https://example.com` | ❌ `HTTP 000` |
| `curl https://registry.npmjs.org/` | ✅ `HTTP 200` |
| Variables d'env Google/Firebase | ❌ aucune |
| Fichier de credentials / service account | ❌ aucun |

**Conclusion : l'egress réseau est filtré par liste blanche et Firestore est injoignable.**
De plus, `firebase-applet-config.json` ne contient qu'une **clé API web** (`AIzaSy…`), pas un
compte de service ; et `firestore.rules:12-13` exige `request.auth != null` avec, en ligne 282-284,
`match /{document=**} { allow read, write: if false; }`. Une lecture non authentifiée serait donc
**refusée par les règles** même avec un réseau ouvert.

> **Conséquence méthodologique majeure :** aucune donnée Firestore réelle n'a pu être observée.
> Toutes les affirmations **sur les données** de ce document proviennent de `data/db.json` et sont
> donc **plafonnées** au niveau de confiance de ce fichier. Toutes les affirmations **sur le
> comportement** proviennent du code du dépôt et sont, elles, pleinement démontrables.

### 0.2 Hiérarchie des sources effectivement appliquée

| Rang | Source | Ce qu'elle prouve | Ce qu'elle ne prouve PAS |
|---|---|---|---|
| **1** | `server/db.ts`, `server.ts`, `server/auth.ts` | **Le comportement réel** : schéma écrit, validations, transactions, RBAC, calculs, constantes | L'état des données en production |
| **2** | `scripts/migrate-to-firestore.ts` | L'existence et la structure de `clientPhoneIndex`, `meta/system`, `meta/counters` ; les contrôles de réconciliation déjà écrits | Leur **contenu actuel** |
| **3** | `data/db.json` | Un **instantané daté** des 9 collections métier | Tout ce qui a changé depuis ; tout ce qui n'y a jamais été |
| **4** | `firestore.rules` | **Uniquement** la politique `allow delete: if false` | Les permissions réelles — le reste est **mort** (`request.auth` toujours `null`, l'app n'utilise pas Firebase Auth) |
| **5** | `src/**` (React) | Ce qui est **réellement consommé/affiché** | Les règles métier (le front n'est pas l'autorité) |
| **6** | `src/types.ts` | Les **intentions** de typage | ❌ **non fiable** : contient `order_cancellation_restore`, jamais implémenté nulle part |
| **7** | `firebase-blueprint.json`, `security_spec.md` | — | ❌ **obsolètes / divergents** (voir §10.3) |

### 0.3 Datation et périmètre de l'instantané `db.json`

| Mesure | Valeur |
|---|---|
| Horodatages ISO contenus | 436 |
| **Plus ancien** | `2026-09-01T04:05:32.382Z` |
| **Plus récent** | `2026-09-08T21:03:34.991Z` |
| Fenêtre couverte | **8 jours** |
| Collections présentes | 9 (`categories`, `suppliers`, `ingredients`, `supplements`, `products`, `drivers`, `orders`, `stockMovements`, `users`) + `nextOrderSeq` racine |
| Collections Firestore **absentes** de l'instantané | `clientPhoneIndex`, `orderIdempotencyKeys`, `meta/system`, `meta/counters` |
| Comptes `role='client'` | **0** |
| `passwordHash` non vides | **0 sur 7** |

**⚠️ Tout ce qui a été créé ou modifié dans Firestore après le 2026-09-08T21:03:34Z est
INCONNU de ce document.** C'est le cas probable des comptes clients, des clés d'idempotence
et de toute commande postérieure à `BEBBA-1100`.

### 0.4 Légende de certitude

| Symbole | Signification | Condition d'attribution dans ce document |
|---|---|---|
| 🟢 **VALIDÉ / démontré** | Prouvé par une ligne de code citée **ou** par une donnée mesurée | Une référence `fichier:ligne` ou une mesure chiffrée est fournie |
| 🟡 **À VÉRIFIER** | Non démontrable avec les sources disponibles | **Ce qui manque pour valider est explicitement nommé** |
| 🔴 **DÉCISION MÉTIER NÉCESSAIRE** | Le code ne tranche pas ; deux lectures sont défendables | Les options et leurs conséquences sont listées |
| ⚪ **MIGRATION UNIQUEMENT** | N'existe pas dans le système cible en exploitation | Sert à l'import, au contrôle ou au rollback |

### 0.5 Convention de lecture des fiches

Chaque table est décrite par les **16 points exigés**. Dans chaque fiche :

- **« Source exacte »** distingue trois cas, et c'est la distinction la plus importante du document :
  - `Firestore:<collection>[.<champ>]` → la donnée **existe** ;
  - `CODE:<fichier>:<ligne>` → la donnée **n'existe pas**, elle est produite par le code ;
  - `PROPOSÉ` → **n'existe ni dans les données ni dans le code** ; c'est une proposition de nouveau
    modèle, jamais un fait établi.
- Les colonnes marquées **`[PROPOSÉ]`** dans les tableaux de colonnes sont des ajouts de l'auditeur.
  Elles sont comptabilisées séparément en annexe E.

---

# PARTIE 1 — IDENTITÉ ET AUTHENTIFICATION

## 1.1 État réel démontré

### Ce que le code prouve

| Fait | Preuve |
|---|---|
| Une **seule** collection `users` porte les 5 rôles (`admin`, `admin_readonly`, `kitchen`, `driver`, `client`) | `src/types.ts:229` ; `server/db.ts:1841` (`role: 'client'`), `:706` (`role: 'driver'`) |
| Le **staff** s'authentifie par `username` + `password` | `server.ts:96-101` → `db.getUserByUsername` (`server/db.ts:1767-1774`) |
| Les **clients** s'authentifient par `phone` + `password` | `server.ts:92-94` → `db.getClientByPhone` (`server/db.ts:1782-1815`) |
| Un compte `client` trouvé **par username est explicitement rejeté** | `server.ts:98-100` : `if (user && user.role === 'client') { user = undefined; }` |
| Les clients n'ont **pas** de `username` | `createClient` (`server/db.ts:1838-1850`) n'en écrit **aucun** |
| Unicité du téléphone client vérifiée **en applicatif seulement** | `server/db.ts:1830-1833` (création), `:1885-1889` (modification) — **hors** du `writeBatch` |
| `username` normalisé en **minuscules + trim**, unicité vérifiée en applicatif | `server/db.ts:678-685` — **hors** du `writeBatch` |
| Un compte `driver` est lié 1:1 à une fiche `drivers` via `users.driverId` | `server/db.ts:707` ; `getUserByDriverId` (`:651-656`) |
| `active=false` bloque **la connexion ET chaque requête suivante** | `server.ts:108` (login) ; `server/auth.ts:110-114` (`authenticateUser` recharge l'utilisateur à **chaque** requête) ⇒ révocation immédiate |
| Mot de passe : **bcrypt, salt rounds 10** | `server/auth.ts:38-41` ; dépendance `bcryptjs@3.0.3` (`bun.lock:410`) |
| Le JWT emporte `id`, `role`, `username?`, `phone?`, `driverId?`, durée **24 h** | `server/auth.ts:17, 53-62` |
| Les mots de passe staff sont générés **par rôle** depuis l'environnement | `scripts/migrate-to-firestore.ts:52-72` : `admin→INITIAL_ADMIN_PASSWORD`, `kitchen→INITIAL_KITCHEN_PASSWORD`, `driver→INITIAL_DRIVER_PASSWORD`, `admin_readonly→INITIAL_ADMIN_READONLY_PASSWORD` |
| `clientPhoneIndex` est un **index de contournement** avec double chemin de recherche | `server/db.ts:1786-1815` : (1) lecture de l'index, (2) **scan complet de tous les `role='client'`** avec **ré-écriture différée** de l'index |
| Suppression d'un client ⇒ suppression de son entrée d'index | `server/db.ts:1943-1948` |
| Changement de téléphone ⇒ **suppression** de l'ancienne clé + **création** de la nouvelle | `server/db.ts:1902-1910` |

### Ce que l'instantané `db.json` montre (⚠️ plafonné au 2026-09-08)

7 utilisateurs, **0 client** :

| `id` | `username` | `name` | `phone` | `role` | `driverId` | `active` | `lastLoginAt` | `passwordHash` |
|---|---|---|---|---|---|---|---|---|
| `usr-admin-1` | `admin` | Administrateur BEBBA | `+216 71 000 001` | `admin` | — | ✅ | 2026-09-08T21:03:34Z | `''` |
| `usr-kitchen-1` | `cuisine` | Chef de Cuisine BEBBA | `+216 71 000 002` | `kitchen` | — | ✅ | 2026-09-08T20:12:45Z | `''` |
| `usr-driver-1` | `livreur1` | Sami Trabelsi | `+216 98 123 456` | `driver` | `drv-1` | ✅ | 2026-09-02T16:11:25Z | `''` |
| `usr-driver-2` | `livreur2` | Karim Ben Salem | `+216 97 654 321` | `driver` | `drv-2` | ✅ | 2026-09-01T08:40:56Z | `''` |
| `usr-driver-3` | `livreur3` | Karim Bouazizi | `+216 22 456 789` | `driver` | `drv-3` | ✅ | **absent** | `''` |
| `usr-1788252052142` | `agent_test_audit` | Agent Audit | `''` | `kitchen` | — | ✅ | 2026-09-01T08:40:52Z | `''` |
| `usr-admin-readonly-1` | `admin_readonly` | Administrateur lecture seule BEBBA | `+216 71 000 004` | `admin_readonly` | — | ✅ | **absent** | `''` |

⚠️ **Incohérence démontrée entre `users` et `drivers`** : `usr-driver-1` porte `name: 'Sami
Trabelsi'` et `phone: '+216 98 123 456'`, alors que `drv-1` porte `name: 'Yassine Ben Amor'` et le
**même** téléphone `+216 98 123 456`. Idem `usr-driver-3` = `Karim Bouazizi` / `+216 22 456 789`
contre `drv-3` = `Karim Bouazizi` / `+216 22 456 789` (cohérent), mais `usr-driver-2` = `Karim Ben
Salem` / `+216 97 654 321` contre `drv-2` = `Amine Trabelsi` / `+216 55 987 654` (**divergent**).
Or `updateDriverWithAccount` (`server/db.ts:739-745`) est censé **synchroniser** `name` et `phone`
entre les deux. ⇒ **2 fiches sur 3 sont désynchronisées**. Voir anomalie **AN-24**.

⚠️ **Aucun `email` utilisateur n'existe** : le mot `email` n'apparaît dans tout le projet que sur
`Supplier.email` (`src/types.ts:242`, `server/db.ts` suppliers). Vérifié par recherche exhaustive.

⚠️ **Aucun champ `address`** sur les 7 utilisateurs de l'instantané (déclaré optionnel
`src/types.ts:230`, écrit uniquement par `createClient` `server/db.ts:1848`).

### Clients observés indirectement (par les commandes)

`db.json` ne contient aucun compte client, mais **54 commandes** portent un bloc `client`.
Après normalisation (8 derniers chiffres, règle de `server/db.ts:98-106`) :

| Mesure | Valeur |
|---|---|
| Téléphones normalisés distincts | **20** |
| Formats bruts distincts | **12** (ex. `+216 22 111 222`, `+216 22222222`, `+216 99 000 001`) |
| Téléphones invalides (< 8 chiffres) | **0** |
| `99999999` | **12 commandes**, **10 couples (nom, adresse) différents** (`Client Test A`…`Client Test I`, `Workflow Client`, `Test 2`, `Test 3`) |
| `20123456` | **9 commandes**, **2 identités** (`Sami Ben Ali / Les Berges du Lac 2`, `Client Public Anonyme / Menzah 9`) |

⇒ **Le téléphone n'est pas une clé d'identité suffisante pour fusionner des clients.**

---

## 1.2 Fiche T-01 · `bebba_clients`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_clients` (préfixe réel : `$wpdb->prefix . 'bebba_clients'`) |
| **2** | **Rôle métier** | Profil métier d'un client commandant : identité téléphonique, adresse par défaut, liaison au compte WordPress. Remplace fonctionnellement la collection `clientPhoneIndex` |
| **3** | **Source exacte** | `Firestore:users` filtré `role == 'client'` (⚠️ **0 document dans `db.json`** — population réelle **inconnue**) ; `Firestore:clientPhoneIndex` (structure prouvée par `server/db.ts:1786-1815` et `scripts/migrate-to-firestore.ts:112-140`, **contenu inconnu**) ; `CODE:server/db.ts:1817-1864` (`createClient`) pour la liste exacte des champs écrits |
| **4** | **Colonnes** | voir tableau ci-dessous |
| **5** | **Types recommandés** | voir tableau ci-dessous |
| **6** | **Nullable / obligatoire** | voir tableau ci-dessous |
| **7** | **Clé primaire** | `user_id` (1:1 avec `wp_users`) — **PROPOSÉ** ; alternative : `id` surrogate + `user_id UNIQUE` (🔴 D-07) |
| **8** | **Clés étrangères** | `user_id` → `wp_users.ID` |
| **9** | **Contraintes UNIQUE** | `phone_normalized` — **justification 🟢** : `createClient` refuse un doublon (`server/db.ts:1830-1833`) et `updateClientProfile` aussi (`:1885-1889`), mais **uniquement en applicatif, hors transaction** ⇒ la contrainte SQL est la traduction fidèle d'une règle métier **déjà écrite**, pas une règle nouvelle. `legacy_user_id` UNIQUE (⚪) |
| **10** | **Index** | `phone_normalized` (UNIQUE, couvre la recherche) ; `legacy_user_id` (résolution d'IDs à l'import) |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Règle de conservation** | Aucune donnée client **n'est jamais** réécrite rétroactivement dans les commandes : `bebba_orders` porte ses propres instantanés (voir **T-04**). La modification du profil ne touche que cette table |
| **13** | **Règle de migration** | (a) Source = **Firestore `users` où `role='client'`**, jamais `db.json`. (b) `phone_normalized` = application de la règle `server/db.ts:98-106` (chiffres uniquement, ≥ 8, 8 derniers). (c) **Régénérer l'index depuis les utilisateurs**, ne **jamais** importer `clientPhoneIndex` comme source : le script actuel doit déjà chercher les orphelins (`scripts/migrate-to-firestore.ts:236-243`), ce qui prouve que l'index peut être désynchronisé. (d) `legacy_user_id` = ancien `users.id` (`cli-<epochms>-<rand4>`, `server/db.ts:1837`) |
| **14** | **Anomalies connues** | **AN-01** aucun compte client dans l'instantané ; **AN-02** même téléphone, identités multiples ; **AN-03** aucun `email` ; **AN-04** `user_login` inexistant pour les clients ; **AN-25** unicité non garantie par le stockage actuel |
| **15** | **Traitement** | AN-01 → **🟡 export Firestore obligatoire avant tout import**. AN-02 → **migrer telle quelle** l'identité de commande (instantané) et **ne pas** fusionner de clients sur la base du téléphone ; 🔴 D-02 pour la création de comptes rétroactifs. AN-03 → 🔴 D-03. AN-04 → 🔴 **D-01 (bloquante)**. AN-25 → corrigé par la contrainte UNIQUE |
| **16** | **Certitude** | **Structure 🟢** (champs écrits par `createClient`, ligne à ligne) — **Population 🟡** (aucun client observable) — **`user_login` 🔴** |

### Colonnes

| Colonne | Type recommandé | Null ? | Source exacte | Statut |
|---|---|---|---|---|
| `user_id` | entier non signé, taille alignée sur `wp_users.ID` | NON | `Firestore:users.id` (via mapping) | 🟢 |
| `legacy_user_id` | chaîne ≤ 64 | OUI | `Firestore:users.id` brut (`cli-…`) | ⚪ |
| `phone_raw` | chaîne ≤ 32 | NON | `Firestore:users.phone` — écrit brut, non normalisé (`server/db.ts:1845`) | 🟢 |
| `phone_normalized` | chaîne **exactement 8** | NON | `CODE:server/db.ts:98-106` appliqué à `phone_raw` | 🟢 |
| `default_address` | chaîne ≤ 255 | OUI | `Firestore:users.address` — `(data.address \|\| '').trim()` (`server/db.ts:1848`) ⇒ **chaîne vide possible**, pas `null` | 🟢 |
| `full_name` | chaîne ≤ 191 | NON | `Firestore:users.name` — **redondant** avec `wp_users.display_name` ; 🔴 D-08 : conserver ou supprimer | 🔴 |
| `created_at` | date+heure, précision ms, UTC | NON | `Firestore:users.createdAt` (`server/db.ts:1846`) ; recoupable avec `wp_users.user_registered` | 🟢 |
| `updated_at` | date+heure ms UTC | OUI | `Firestore:users.updatedAt` (`server/db.ts:1891`) | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` — aucune donnée de test client observable, mais le pattern existe côté staff (`agent_test_audit`) et catalogue (`prod-test-indisponible`) | 🟡 |

**Ce qui n'est PAS dans cette table, et pourquoi :**

| Donnée | Destination | Justification |
|---|---|---|
| mot de passe | `wp_users.user_pass` | natif ; ⚠️ 🔴 **D-04 bloquante** (bcrypt) |
| rôle `client` | `wp_usermeta.wp_capabilities` | natif |
| nom / prénom | `wp_users.display_name` + `wp_usermeta.first_name/last_name` | natif |
| `active` | `wp_usermeta` + filtre d'authentification | 🟢 le comportement actuel est une **revérification à chaque requête** (`server/auth.ts:110-114`) ; `wp_users.user_status` est un champ hérité non utilisé par le core ⇒ **ne reproduirait pas** la révocation immédiate |
| `lastLoginAt` | `wp_usermeta` | 🟢 aucun équivalent natif ; donnée technique non jointe, non agrégée ⇒ `usermeta` adapté |
| `clientPhoneIndex.name` | **abandonné** | 🟢 dénormalisation : `server/db.ts:1808` recopie `u.name`, jamais relu comme source. Risque de dérive |
| `clientPhoneIndex.createdAt` | **abandonné** | 🟢 `server/db.ts:1809` = `u.createdAt`, déjà porté par `wp_users.user_registered` |
| `clientPhoneIndex.normalizedPhone` | **abandonné** | 🟢 `server/db.ts:1807` = la clé du document, redondant avec `phone_normalized` |
| adresses multiples | `bebba_client_addresses` — **non créée** | 🔴 **D-05** : `User.address` est **mono-valeur** dans le code ; AN-02 montre plusieurs adresses par téléphone mais **dans des commandes différentes**, chacune déjà figée. Créer une table d'adresses serait un **nouveau produit**, pas une migration |

---

## 1.3 Fiche T-02 · `bebba_staff`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_staff` |
| **2** | **Rôle métier** | Profil métier des comptes internes hors livreur : `admin`, `admin_readonly`, `kitchen`. Conserve les attributs sans équivalent WordPress |
| **3** | **Source exacte** | `Firestore:users` filtré `role IN ('admin','admin_readonly','kitchen')` ; **7 documents observés dont 3 concernés** (`usr-admin-1`, `usr-kitchen-1`, `usr-1788252052142`, `usr-admin-readonly-1` = **4**) |
| **4-6** | **Colonnes / types / nullabilité** | voir tableau |
| **7** | **Clé primaire** | `user_id` (1:1 `wp_users`) |
| **8** | **Clés étrangères** | `user_id` → `wp_users.ID` |
| **9** | **UNIQUE** | `legacy_user_id` |
| **10** | **Index** | `legacy_user_id` |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | `legacy_user_id` est **indispensable** à la résolution de `orders.clientId` (⚠️ ici toujours absent) et surtout des acteurs textuels — mais ceux-ci ne sont **pas** résolvables (AN-20) |
| **13** | **Règle de migration** | (a) `user_login` = `users.username` **tel quel** (déjà `trim().toLowerCase()`, `server/db.ts:678`). (b) 🔴 **D-06** : conserver le login `admin` ? (c) mot de passe : **réinitialisation obligatoire** — les hash staff sont **partagés par rôle** (`scripts/migrate-to-firestore.ts:52-72`) : 2 comptes `kitchen` partagent `INITIAL_KITCHEN_PASSWORD`, 3 comptes `driver` partagent `INITIAL_DRIVER_PASSWORD`. (d) `agent_test_audit` → `is_test_data = vrai` |
| **14** | **Anomalies** | **AN-05** `passwordHash` vides dans l'instantané ; **AN-06** hash partagés par rôle ; **AN-07** `phone` vide sur `agent_test_audit` ; **AN-08** compte de test en base ; **AN-09** login `admin` |
| **15** | **Traitement** | AN-05 → source = Firestore (🟡). AN-06 → **réinitialisation forcée**, 🔴 D-04. AN-07 → `phone_raw` NULL-able. AN-08 → **migrer + marquer `is_test_data`**, ne pas purger avant (voir §10.2, principe P-4). AN-09 → 🔴 D-06 |
| **16** | **Certitude** | **🟢 structure et population** (4 documents observés, champs écrits par `saveUser` `server/db.ts:1920-1927`) — **🔴 politique de mot de passe et de login** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `user_id` | entier non signé | NON | mapping `users.id` → `wp_users.ID` | 🟢 |
| `legacy_user_id` | chaîne ≤ 64 | OUI | `users.id` brut (`usr-admin-1`, `usr-1788252052142`) | ⚪ |
| `internal_role` | énuméré : `admin`, `admin_readonly`, `kitchen` | NON | `Firestore:users.role` — 4/4 présents | 🟢 **mais redondant** avec le rôle WP ; 🔴 D-09 : le conserver comme colonne de contrôle ou s'appuyer uniquement sur les capabilities |
| `phone_raw` | chaîne ≤ 32 | OUI | `Firestore:users.phone` — **3/4 non vides**, `''` sur `agent_test_audit` | 🟢 |
| `last_login_at` | date+heure ms UTC | OUI | `Firestore:users.lastLoginAt` — **2/4 présents** | 🟢 |
| `updated_at` | date+heure ms UTC | OUI | `Firestore:users.updatedAt` | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` ; `usr-1788252052142` = `agent_test_audit` / `Agent Audit` | 🟡 |

> **Pourquoi une table plutôt que uniquement `wp_usermeta` ?** 🟢 Parce que `internal_role`
> (`users.role`) est **la clé de toute la matrice RBAC** (`server/auth.ts:145-181`,
> `server.ts:674-706`) et qu'elle est **testée à chaque requête**. Une valeur sérialisée dans
> `wp_usermeta.wp_capabilities` n'est ni typée, ni indexable, ni contraignable. En revanche
> `phone_raw` et `last_login_at` **pourraient** vivre en `usermeta` : ils ne sont **jamais**
> utilisés comme clé (`getClientByPhone` filtre `role=='client'`, `server/db.ts:1801`).
> **Proposition retenue : les 3 colonnes dans `bebba_staff` pour la cohérence, mais c'est un
> choix 🟡 — une variante 100 % `usermeta` pour `phone`/`last_login` est défendable.**

---

## 1.4 Fiche T-03 · Rôles et capabilities (mécanisme WordPress, pas une table)

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | — (rôles WordPress créés programmatiquement ; **aucune table `bebba_*`**) |
| **2** | **Rôle métier** | Traduire la matrice RBAC réelle en capabilities WordPress |
| **3** | **Source exacte** | `CODE:server/auth.ts:120-135` (`requireRole`), `CODE:server/auth.ts:145-181` (`isValidStatusTransition`), `CODE:server.ts` (32 routes gardées), `CODE:src/components/admin/AdminView.tsx:42-48` (matrice dupliquée côté front) |
| **4** | **« Colonnes »** | `wp_usermeta.wp_capabilities` (mécanisme natif) |
| **5-6** | **Type / nullabilité** | natif WordPress |
| **7-10** | **PK / FK / UNIQUE / index** | natif WordPress |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | sans objet |
| **13** | **Règle de migration** | `users.role` → rôle WordPress. **Ne pas réutiliser** `administrator` / `editor` / `shop_manager` / `customer` : leurs capabilities par défaut (`edit_posts`, `upload_files`, `delete_users`…) accorderaient des accès **absents** du système actuel |
| **14** | **Anomalies** | **AN-10** matrice RBAC **dupliquée à 3 endroits** (`auth.ts`, `server.ts`, `AdminView.tsx`) sans source unique ; **AN-11** `admin_readonly` quasi inerte ; **AN-12** endpoints **publics** non couverts par un rôle |
| **15** | **Traitement** | AN-10 → la table **T-06 `bebba_order_status_transitions`** devient la source unique pour les transitions ; les capabilities couvrent le reste. AN-11 → 🔴 **D-10**. AN-12 → 🟢 les routes publiques sont `GET /api/categories` (`server.ts:209`), `GET /api/products` (`:266`), `GET /api/products/:id` (`:279`), `GET /api/supplements` (`:325`), `GET /api/supplements/:id` (`:337`), `GET /api/categories/:id` (`:220`), `GET /api/orders/track/*` (`:815`), `POST /api/orders/track-lookup` (`:836`), `POST /api/orders` (`:998`), `GET /api/health` (`:74`) ⇒ un **rôle public/anonyme** portant uniquement `bebba_place_order` et `bebba_track_order` est nécessaire |
| **16** | **Certitude** | **🟢 matrice démontrée** route par route — **🔴 périmètre de `admin_readonly`** |

### Matrice RBAC réelle (🟢 démontrée, route par route)

| Capacité | `admin` | `admin_readonly` | `kitchen` | `driver` | `client` | anonyme | Preuve |
|---|---|---|---|---|---|---|---|
| Lire catégories / produits / suppléments | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `server.ts:209, 266, 325` (sans `authenticateUser`) |
| Lire ingrédients | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | `server.ts:383` |
| Créer / modifier ingrédient | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | `server.ts:393, 403` |
| **Supprimer** ingrédient | ✅ | ❌ | **❌** | ❌ | ❌ | ❌ | `server.ts:414` (`requireRole('admin')`) |
| Mouvement de stock manuel | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | `server.ts:424` |
| Lire les mouvements de stock | ✅ | ✅ | **❌** | ❌ | ❌ | ❌ | `server.ts:446` |
| Lire les livreurs | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | `server.ts:457` |
| CRUD livreurs + mot de passe | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:467, 514, 528, 550, 568` |
| CRUD fournisseurs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:579, 589, 599, 609` |
| CRUD catalogue | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:234, 244, 255, 293, 303, 314, 351, 361, 372` |
| Lire / créer utilisateurs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:619, 628` |
| Lire commandes | toutes | ❌ | toutes **sauf `cancelled`** | **uniquement les siennes** | ❌ | ❌ | `server.ts:674-706` |
| Lire une commande | ✅ | ❌ | ✅ | ✅ si affecté | ✅ si `clientId` | ❌ | `server.ts:892` |
| `received→preparing`, `preparing→ready` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | `auth.ts:167-170` |
| `ready→waiting_for_driver` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `auth.ts:167-170` |
| `waiting_for_driver→delivering` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `auth.ts:154-163` |
| `delivering→delivered` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | `auth.ts:176-178` |
| `*→cancelled` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `auth.ts:154-163, 150-152` |
| Affecter un livreur | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:1174` ; et **uniquement** lors du passage à `delivering` (`server.ts:1130`) |
| Encaisser | ✅ | ❌ | ❌ | ✅ **si affecté, `paid` seulement** | ❌ | ❌ | `server.ts:1202-1244` |
| Statistiques | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | `server.ts:1255` |
| Réinitialisation démo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | `server.ts:1265` |
| Créer une commande | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `server.ts:998` (public) |
| Suivi public / récupération | — | — | — | — | — | ✅ | `server.ts:815, 836` |

**Règles transverses 🟢 :** `client` et `admin_readonly` ne peuvent **jamais** changer un statut
(`auth.ts:150-152`) ; un livreur ne **choisit jamais** sa commande (`auth.ts:174-175`) ;
un livreur ne peut enregistrer **que** `paid`, jamais `to_collect` (`server.ts:1240-1244`) ;
`paid` exige `status == 'delivered'` (`server/db.ts:1686-1689` **et** `server.ts:1231-1234`,
**règle dupliquée**) ; le `clientId` envoyé dans le corps d'une requête de création est
**totalement ignoré** (`server.ts:1014-1020`).

### `firestore.rules` n'est PAS une source de permissions

🟢 **Démontré :** toutes les fonctions de `firestore.rules` partent de
`isAuthenticated() { return request.auth != null; }` (`:12-13`) et testent
`request.auth.token.role`, `.driverId`, `.phone` (`:16-53`). Or l'application **n'utilise pas
Firebase Auth** : elle signe ses propres JWT (`server/auth.ts:53-62`) et accède à Firestore via le
SDK client avec la configuration de `firebase-applet-config.json` (`server/db.ts:136-151`), sans
session utilisateur. `request.auth` est donc **toujours `null`**, et toutes les règles retombent sur
`match /{document=**} { allow read, write: if false; }` (`:282-284`).

**Corollaire 🟢 :** côté serveur, les accès passent par les règles SDK/admin — mais le fait que
`resetDemoData` compte explicitement les suppressions **bloquées** par `permission-denied`
(`server/db.ts:2117-2124`, message final `:2203-2206`) **prouve que des écritures sont refusées en
production**. C'est la base de l'anomalie **AN-13**.

**Seule sémantique à conserver :** `allow delete: if false` sur `orders` (`:173`),
`stockMovements` (`:179`), `orderIdempotencyKeys` (`:121`), `clientPhoneIndex` (`:210`),
`meta/*` (`:103, 111`), et sur toutes les collections catalogue (`:220, 229, 239, 248, 259, 272`).
⇒ **Politique « append-only / suppression interdite » à reporter dans le modèle cible.**

---

# PARTIE 2 — COMMANDES

## 2.1 État réel démontré

### Cycle de vie — 🟢 démontré

| Élément | Valeur réelle | Preuve |
|---|---|---|
| Statuts | `received`, `preparing`, `ready`, `waiting_for_driver`, `delivering`, `delivered`, `cancelled` (7) | `src/types.ts:6` ; `server/db.ts:1512-1520` ; `server/auth.ts:154-163` — **dupliqué à l'identique** |
| Transitions autorisées | `received→{preparing,cancelled}` · `preparing→{ready,cancelled}` · `ready→{waiting_for_driver,cancelled}` · `waiting_for_driver→{delivering,cancelled}` · `delivering→{delivered,cancelled}` · `delivered→{}` · `cancelled→{}` | `server/db.ts:1512-1520` |
| **Auto-transition `ready`** | Demander `ready` écrit **`waiting_for_driver`** et pousse **2 entrées** d'historique | `server/db.ts:1600-1616` |
| Statut initial | `'received'` | `server/db.ts:1361` |
| Idempotence de statut | Même statut redemandé ⇒ **retour sans effet de bord** | `server/db.ts:1508-1510` ; `server.ts:1114-1117` |
| Garde livreur | `delivering` exige un livreur affecté **et actif** | `server/db.ts:1527-1535` ; `server.ts:1133-1157` |
| Distribution réelle (instantané) | `received` 24 · `preparing` 15 · `delivered` 4 · `delivering` 4 · **`ready` 3** · `waiting_for_driver` 3 · `cancelled` 1 | mesuré sur 54 commandes |

⚠️ **Contradiction démontrée :** le code rend `ready` **impossible à persister**
(`server/db.ts:1600-1616`), pourtant **3 commandes** ont `status='ready'`
(`BEBBA-1095`, `BEBBA-1068`, `BEBBA-1060`) et **13 entrées** d'historique portent `ready`.
⇒ `ready` **doit** rester dans l'énumération cible. Voir **AN-14** et 🔴 **D-13**.

### Paiement — 🟢 démontré

| Élément | Valeur réelle | Preuve |
|---|---|---|
| `paymentMethod` | `'cash_on_delivery'` — **littéral unique dans le type** | `src/types.ts:189` ; **54/54** dans les données |
| `paymentStatus` | `'to_collect'` (51) · `'paid'` (3) | `src/types.ts:7` |
| Règle bloquante | `paid` exige `status == 'delivered'` | `server/db.ts:1686-1689` **et** `server.ts:1231-1234` (dupliqué) |
| Habilitations | `admin` ✅ · `driver` **si affecté, `paid` uniquement** ✅ · `client`/`kitchen`/`admin_readonly` ❌ | `server.ts:1202-1244` |
| **Ce qui n'est PAS écrit** | ni **date**, ni **acteur**, ni **montant**, ni **entrée d'historique** | `server/db.ts:1679-1693` : un seul `updateDoc(orderRef, { paymentStatus })` |
| Consommation réelle | `DriverView.tsx:61-62, 371-396` calcule « encaissé aujourd'hui » et « restant à encaisser » **par livreur** à partir du drapeau + `totalAmount` + `createdAt` de la **commande** | 🟢 |
| Dette réelle observable | **`BEBBA-1091`** : `status='delivered'`, `paymentStatus='to_collect'` | mesuré |
| Incohérence inverse | **0** commande `paid` non `delivered` | mesuré ⇒ la règle tient |

### Suivi et identifiants publics — 🟢 démontré

| Élément | Valeur réelle | Preuve |
|---|---|---|
| `orderNumber` | `` `BEBBA-${nextOrderSeq}` `` | `server/db.ts:1338` |
| Séquence | lue dans `meta/counters.nextOrderSeq`, **repli codé en dur à 1101** | `server/db.ts:1190-1192` |
| Incrémentation | `nextOrderSeq + 1` écrite **dans la même transaction** | `server/db.ts:1418-1421` |
| `trackingToken` | `'tk_' + crypto.randomBytes(6).toString('hex')` ⇒ **15 caractères** | `server/db.ts:1339` |
| `orderId` | `'ord-' + Date.now()` ⇒ **collision possible si 2 commandes dans la même milliseconde** | `server/db.ts:1340` |
| Accès anonyme par token | `GET /api/orders/track/:token` et `?token=` — **sans authentification**, longueur minimale 5 | `server.ts:815-834` |
| Récupération anonyme | `POST /api/orders/track-lookup` avec `orderNumber` + `phone`, rate-limité 5 échecs / 10 min / IP **en mémoire** | `server.ts:836-890`, `:795-800` |
| Normalisation de `orderNumber` en entrée | `trim()`, retrait d'un `#` initial, **majuscules**, et si **purement numérique** ⇒ préfixé `BEBBA-` | `server/db.ts:1469-1472` |
| Comparaison de téléphone | chiffres uniquement, ≥ 8, **8 derniers** | `server/db.ts:1474-1486` |
| Masquage public | nom → `Prénom I.` ; téléphone → `+216 XX ••• •XX` ; adresse → quartier seul ; livreur → **prénom uniquement, et seulement si `delivering` ou `delivered`** | `server.ts:709-793` |

⚠️ **`orderId = 'ord-' + Date.now()` est un risque réel, pas théorique** : `db.json` contient
**3 mouvements de stock partageant exactement le même horodatage de génération**
(`mov-1788443298334-0o7y`, `mov-1788443298334-0eml` — même milliseconde, différenciés uniquement
par le suffixe aléatoire). Les mouvements ont un suffixe aléatoire (`server/db.ts:1391`),
**les commandes n'en ont pas** (`server/db.ts:1340`). ⇒ **AN-15**.

### Format réel des tokens — ⚠️ hétérogène

| Format | Nombre | Exemples | Origine |
|---|---|---|---|
| `tk_` + 12 hex (15 car.) | **51** | `tk_e355ed9dd33a` | 🟢 `server/db.ts:1339` |
| `tk_bebba_<num>_demo` (18 car.) | **3** | `tk_bebba_1047_demo`, `tk_bebba_1048_demo`, `tk_bebba_1049_demo` | ⚠️ **aucun code du dépôt ne produit ce format** ; `AppContext.tsx:309` l'utilise comme **valeur de repli** du `localStorage` |

⇒ **Aucune contrainte de format** ne peut être posée sur `tracking_token` (**AN-16**).

### Bloc `client` de la commande — 🟢 démontré

Écrit par `server/db.ts:1352-1357`, **4 champs systématiquement présents** (`trim()` appliqués,
`notes` vaut `''` si absent). Mesuré sur 54/54 commandes : `name` 54, `phone` 54,
`deliveryAddress` 54, `notes` 54.

| Mesure | Valeur |
|---|---|
| longueur max `name` | 21 |
| longueur max `deliveryAddress` | 63 |
| `notes` non vides | 10 (dont `Test A`…`Test I`, `Test Workflow Bloc B`) |
| `clientId` présent | **0 / 54** dans l'instantané — mais **écrit par le code** (`server/db.ts:1350`) |
| `phone` à la racine de la commande | **0 / 54** — lu en secours par `server/db.ts:1478` ⇒ **branche morte** |

⚠️ **`clientId` est fonctionnel mais absent de l'instantané** : `getOrdersByClientId`
(`server/db.ts:1439-1446`), l'anti-IDOR client (`server.ts:910-915`) et `GET /api/client/orders`
(`server.ts:1078-1086`) en dépendent. Comme **aucun compte client** n'existe dans `db.json`,
toutes les commandes de l'instantané sont des **commandes invitées**.
⇒ Dans Firestore, les commandes postérieures à l'ouverture de comptes clients devraient porter
`clientId`. **🟡 À VÉRIFIER sur export.**

### `stockConsumed` — 🟢 démontré contradictoire

| Mesure | Valeur |
|---|---|
| présent | 28 / 54 (`true` 20, `false` 8) |
| **absent** | **26 / 54** |
| écrit à `true` **dès la création** | `server/db.ts:1362` |
| chemin de rattrapage si `!stockConsumed` au passage à `preparing` | `server/db.ts:1541-1557` — recalcule depuis `preparationSheet.totalIngredients`, **vérifie**, puis appelle `addStockMovement` **en boucle** (chacun ouvrant **sa propre transaction**) |
| **contradictions avec le ledger** | **10 commandes** (`BEBBA-1063`…`BEBBA-1072`) ont des mouvements `order_consumption` alors que `stockConsumed` est absent ou `false` |
| cohérence dans l'autre sens | les 20 commandes `stockConsumed=true` ont **toutes** des mouvements |

⇒ Le drapeau **n'est pas une source fiable** ; il doit être **reconstruit depuis le ledger**
(**AN-17**). Et le chemin de rattrapage `server/db.ts:1541-1557` est **non atomique** (**AN-18**).

### Annulation — 🔴 défaut démontré

| Fait | Preuve |
|---|---|
| `cancelled` est atteignable depuis les 5 statuts non terminaux | `server/db.ts:1512-1520` |
| **Aucun mouvement de restitution n'est créé** | `server/db.ts:1618-1643` : aucun appel à `addStockMovement` pour `cancelled` |
| `order_cancellation_restore` existe **uniquement** dans les types | `src/types.ts:46` — **1 occurrence dans tout le dépôt**, aucune implémentation |
| **Cas réel** | `BEBBA-1079` : `status='cancelled'`, `stockConsumed=true`, mouvements `ing-poulet −500`, `ing-patate-douce −360`, `ing-legumes −300`, `ing-sauce-miel-moutarde −80` = **−1 240 unités**, **0 restitution** |

⇒ **AN-19**. Le modèle cible doit pouvoir exprimer la restitution (`stock_state` à 3 états),
mais **la valeur de stock à migrer est une décision métier** : 🔴 **D-15**.

---

## 2.2 Fiche T-04 · `bebba_orders`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_orders` |
| **2** | **Rôle métier** | Commande client : identifiants publics, instantané client, totaux, état courant, affectation livreur, état de consommation du stock |
| **3** | **Source exacte** | `Firestore:orders` (54 documents observés dans l'instantané). Champs écrits par `CODE:server/db.ts:1345-1374`. `deliveryFee` : **`CODE:server/db.ts:1341`** (constante `2.5`, **aucune donnée de configuration**). `stock_state` : **dérivé** de `Firestore:orders.stockConsumed` **ET** de `Firestore:stockMovements` |
| **4-6** | **Colonnes / types / nullabilité** | voir tableau |
| **7** | **Clé primaire** | `id` surrogate — **PROPOSÉ** (🟢 justifié : `orderId = 'ord-' + Date.now()`, non unique par construction, `server/db.ts:1340`, AN-15) |
| **8** | **Clés étrangères** | `client_user_id` → `wp_users.ID` ; `assigned_driver_id` → `bebba_drivers.id` |
| **9** | **Contraintes UNIQUE** | `order_number` 🟢 · `order_seq` 🟢 · `tracking_token` 🟢 · `legacy_order_id` ⚪ |
| **10** | **Index** | `(client_phone_normalized, order_number)` — sert `track-lookup` (`server/db.ts:1461-1489`) ; `tracking_token` (UNIQUE suffit) ; `(status, created_at)` — sert le filtre cuisine (`server.ts:687`) et le tri (`server/db.ts:1436`) ; `(assigned_driver_id, status)` — sert le périmètre livreur (`server.ts:695`) et la caisse livreur (`DriverView.tsx:57-62`) ; `(client_user_id, created_at)` — sert `getOrdersByClientId` (`server/db.ts:1439-1446`) ; `(payment_status, status)` — sert `pendingCashToCollect` (`server/db.ts:1717-1719`) ; `created_at` — sert `todayOrders` (`server/db.ts:1700`) |
| **11** | **Historique ou vivante** | **MIXTE** : `status`, `payment_status`, `assigned_driver_id`, `stock_state` sont **vivants** ; **tout le reste est historique figé** |
| **12** | **Règle de conservation** | **Suppression interdite** — 🟢 reproduit `firestore.rules:173` (`allow delete: if false`), la **seule** règle Firestore dont la sémantique soit effective. Les champs d'instantané (§9) ne sont **jamais** recalculés ni re-normalisés. Toute modification de `status` / `payment_status` / `assigned_driver_id` **doit** écrire un événement dans T-07 **dans la même transaction** — ce que le code actuel **ne fait pas** (`server/db.ts:1491-1645` : `getDoc` → mutation → `setDoc`, sans transaction) |
| **13** | **Règle de migration** | (a) `order_seq` = extraction numérique de `orderNumber` (`BEBBA-1100` → `1100`). (b) `client_phone_normalized` = règle `server/db.ts:98-106` appliquée à `client.phone`. (c) `client_user_id` = résolution de `orders.clientId` via T-29 ; **`NULL` si absent** (0/54 dans l'instantané). (d) `stock_state` = **dérivé du ledger** : `consumed` si ≥ 1 mouvement `order_consumption` pour la commande, sinon `not_consumed` ; **puis** croisé avec `stockConsumed` et **toute divergence mise en quarantaine** (AN-17). (e) montants : **copier `null` en `NULL`**, ne jamais recalculer (AN-20). (f) `delivery_fee` : copier la valeur **de la commande** (54/54 à `2.5`), pas la constante actuelle. (g) `legacy_order_id` = `orders.id` brut |
| **14** | **Anomalies** | **AN-20** 20 commandes sans aucun montant · **AN-15** `orderId` non unique par construction · **AN-16** tokens hétérogènes · **AN-17** `stockConsumed` contradictoire · **AN-19** annulation sans restitution · **AN-21** `clientId` absent de l'instantané · **AN-13** `orderNumber` duplicable (compteur remis à 1001 alors que les suppressions sont bloquées) · **AN-22** 3 commandes en `ready`, état que le code ne peut plus produire · **AN-23** 2 commandes avec un livreur affecté alors que `status='ready'` |
| **15** | **Traitement** | AN-20 → **migrer telle quelle en `NULL`** + quarantaine ; 🔴 **D-16** pour savoir si un recalcul est autorisé. AN-15 → `legacy_order_id` UNIQUE **après vérification de collision** (0 collision sur 54) ; PK surrogate. AN-16 → **migrer tels quels**, aucune contrainte de format. AN-17 → **reconstruire depuis le ledger**, quarantaine pour les 10 divergences. AN-19 → **migrer l'état tel quel** + quarantaine + 🔴 **D-15**. AN-21 → `NULL`, 🟡 vérifier sur export Firestore. AN-13 → `UNIQUE(order_number)` + séquence initialisée à `MAX(order_seq)+1`. AN-22 → **conserver `ready`** dans l'énumération, 🔴 D-13. AN-23 → `assigned_driver_id` **indépendant du statut** (ne pas ajouter de contrainte de cohérence) |
| **16** | **Certitude** | **Structure 🟢** (champs écrits ligne à ligne) — **Population 🟡** (instantané de 8 jours, plafonné au 2026-09-08) — **`stock_state` 🟢 reconstruisible** — **`client_user_id` 🟡** — **montants 🔴** |

### Colonnes

| Colonne | Type recommandé | Null ? | Source exacte | Statut |
|---|---|---|---|---|
| `id` | entier non signé auto-incrémenté | NON | `[PROPOSÉ]` — remplace `ord-<epochms>` | 🟢 nécessité démontrée (AN-15) |
| `legacy_order_id` | chaîne ≤ 64 | OUI | `Firestore:orders.id` | ⚪ |
| `order_number` | chaîne ≤ 32 | NON | `Firestore:orders.orderNumber` (`BEBBA-1047`…`BEBBA-1100`) | 🟢 **identifiant public à préserver** |
| `order_seq` | entier non signé | NON | **dérivé** de `orderNumber` | 🟢 `[PROPOSÉ]` — justifié par AN-13 et par le tri lexicographique incorrect au-delà de 9999 |
| `tracking_token` | chaîne ≤ 64 | NON | `Firestore:orders.trackingToken` | 🟢 **identifiant public à préserver** |
| `client_user_id` | entier non signé | **OUI** | `Firestore:orders.clientId` (`server/db.ts:1350`) | 🟢 champ · 🟡 population |
| `client_name_snapshot` | chaîne ≤ 191 | NON | `Firestore:orders.client.name` | 🟢 |
| `client_phone_raw_snapshot` | chaîne ≤ 32 | NON | `Firestore:orders.client.phone` | 🟢 |
| `client_phone_normalized` | chaîne **exactement 8** | NON | `CODE:server/db.ts:98-106` appliqué à `client.phone` | 🟢 |
| `client_delivery_address_snapshot` | chaîne ≤ 255 | NON | `Firestore:orders.client.deliveryAddress` | 🟢 |
| `client_notes_snapshot` | texte | OUI | `Firestore:orders.client.notes` (`''` si absent, `server/db.ts:1356`) | 🟢 |
| `client_address_normalized` | chaîne ≤ 255 | OUI | `CODE:server/db.ts:109-113` — **utilisé uniquement** pour le hash d'idempotence (`server.ts:940`) | 🟡 `[PROPOSÉ]` — voir T-11 |
| `subtotal` | décimal(10,3) | **OUI** | `Firestore:orders.subtotal` — **`null` sur 20/54** | 🟢 |
| `delivery_fee` | décimal(10,3) | NON | `Firestore:orders.deliveryFee` — 54/54 à `2.5` ; origine `CODE:server/db.ts:1341` | 🟢 |
| `total_amount` | décimal(10,3) | **OUI** | `Firestore:orders.totalAmount` — **`null` sur 20/54** | 🟢 |
| `status` | énuméré 7 valeurs | NON | `Firestore:orders.status` | 🟢 |
| `payment_method` | énuméré 1 valeur (`cash_on_delivery`) | NON | `Firestore:orders.paymentMethod` ; type `src/types.ts:189` | 🟢 · 🔴 D-21 pour l'élargissement |
| `payment_status` | énuméré 2 valeurs | NON | `Firestore:orders.paymentStatus` | 🟢 |
| `assigned_driver_id` | entier non signé | **OUI** | `Firestore:orders.assignedDriverId` (10/54) | 🟢 |
| `assigned_driver_name_snapshot` | chaîne ≤ 191 | OUI | `Firestore:orders.assignedDriverName` (10/54) | 🟢 **obligatoire** : `deleteDriver` supprime la fiche sans garde-fou (`server/db.ts:786-805`) et le nom est affiché sur le suivi public (`server.ts:753-760`) |
| `stock_state` | énuméré : `not_consumed`, `consumed`, `restored` | NON | **dérivé** de `stockConsumed` **et** de `stockMovements` | 🟢 `[PROPOSÉ]` — l'état `restored` **n'existe pas** aujourd'hui (AN-19) |
| `created_at` | date+heure ms UTC | NON | `Firestore:orders.createdAt` — **0 doublon sur 54** | 🟢 |
| `updated_at` | date+heure ms UTC | OUI | **n'existe pas** dans les données ni dans le code | 🟡 `[PROPOSÉ]` |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` — 10 commandes portent des `client.notes` de type `Test A`…`Test I`, `Test Workflow Bloc B` ; 3 portent des tokens `_demo` | 🟡 |

**Ce qui n'est PAS dans cette table :**

| Donnée | Destination | Justification 🟢 |
|---|---|---|
| `items[]` | T-05 | tableau, 56 lignes pour 54 commandes |
| `statusHistory[]` | T-07 | tableau, 119 entrées |
| `preparationSheet` | T-09 | par ligne de commande |
| `client{}` comme entité | **colonnes plates** | relation 1:1 stricte avec la commande ; AN-02 interdit toute mutualisation |
| `phone` à la racine | **abandonné** | 0/54 ; lu en secours par `server/db.ts:1478` ⇒ branche morte |

---

## 2.3 Fiche T-05 · `bebba_order_items`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_items` |
| **2** | **Rôle métier** | Ligne de commande : produit commandé, quantité, options de personnalisation choisies, prix réellement pratiqué |
| **3** | **Source exacte** | `Firestore:orders.items[]` (56 éléments observés). Construits par `CODE:server/db.ts:1268-1290`. Prix calculé par `CODE:server/db.ts:1048` (`basePrice + extraPrice protéine + extraPrice légumes + extraPrice base + Σ suppléments`, arrondi à 0,1) puis `:1266` (`× quantity`, arrondi à 0,1) |
| **7** | **Clé primaire** | `id` surrogate |
| **8** | **Clés étrangères** | `order_id` → T-04 ; `product_id` → T-12 ; `protein_option_id` / `veggies_option_id` / `base_choice_option_id` → T-16 |
| **9** | **UNIQUE** | `(order_id, position)` 🟢 `[PROPOSÉ]`. ⚠️ **`legacy_item_id` NE PEUT PAS être UNIQUE** : `'item-' + Math.random().toString(36).substring(2,9)` (`server/db.ts:1269`) — 0 collision sur 56 mais **aucune garantie** |
| **10** | **Index** | `order_id` (couvert par l'UNIQUE composé) ; `product_id` — sert `topSellingProducts` (`server/db.ts:1726-1737`) ; `(product_id, order_id)` pour l'analyse des ventes |
| **11** | **Historique ou vivante** | **100 % HISTORIQUE — aucune colonne n'est mise à jour après création** |
| **12** | **Conservation** | Append-only. 🟢 Justifié : **aucun code ne modifie `order.items` après création** — `updateOrderStatus` le **lit** uniquement (`server/db.ts:1546-1560`), `assignDriver` et `updatePaymentStatus` n'y touchent pas. Suppression interdite (hérite de `firestore.rules:173`) |
| **13** | **Règle de migration** | (a) `position` = **index dans le tableau** (0 ou 1 selon convention à fixer, ⚪ D-33). (b) `product_id` = résolution de `items[].productId` via T-29 ; **`NULL` si orphelin** (2 cas réels) avec `legacy_product_id` conservé. (c) `*_option_id` = **résolution par label** : les options n'ont **aucun identifiant** aujourd'hui, la correspondance se fait par `label` **insensible à la casse et après `trim()`** — c'est **exactement** la règle du code (`server/db.ts:869-873`, `:890-894`, `:910-914`). (d) prix : **copier `null` en `NULL`** (20 cas). (e) `legacy_item_id` **sans** contrainte UNIQUE |
| **14** | **Anomalies** | **AN-24** `unitPrice` et `itemTotalPrice` `null` sur 20/56 · **AN-25** `productId` orphelin (2 : `prod-1788252958886` sur `BEBBA-1071`, `prod-1788252974684` sur `BEBBA-1072`) · **AN-26** `items[].id` non unique par construction · **AN-27** `unitPrice` n'est **pas** le prix catalogue mais un prix personnalisé — le nom prête à confusion · **AN-28** résolution d'option **par label** : 2 produits différents vendent `'Double portion légumes (+180g)'` à **2.5** et **3** ⇒ le label n'est pas une clé |
| **15** | **Traitement** | AN-24 → **migrer en `NULL`** + quarantaine ; 🔴 D-16. AN-25 → **`SET NULL` + `legacy_product_id` + `product_name_snapshot` conservé** (présent 56/56) ⇒ la ligne reste lisible et facturable. AN-26 → PK surrogate, `legacy_item_id` non UNIQUE. AN-27 → **renommer** la colonne `unit_price_after_options` ; le renommage est une **exigence d'intégrité**, pas un détail. AN-28 → la FK `*_option_id` est **NULL-able** et les **instantanés textuels restent la source authoritative** ; la résolution par label n'est qu'un enrichissement analytique |
| **16** | **Certitude** | **Structure 🟢** — **résolution des `option_id` 🟡** (par label, ambigu selon AN-28) — **population 🟡** |

### Colonnes

| Colonne | Type | Null ? | Source exacte | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_item_id` | chaîne ≤ 64 | OUI | `Firestore:orders.items[].id` | ⚪ |
| `order_id` | entier non signé | NON | parent | 🟢 |
| `position` | entier court | NON | **index du tableau** — 🟢 l'ordre est significatif : `formatPublicOrder` (`server.ts:781-795`) et `KitchenView.tsx:330-372` parcourent le tableau dans l'ordre | 🟢 `[PROPOSÉ]` |
| `product_id` | entier non signé | **OUI** | `Firestore:orders.items[].productId` | 🟢 |
| `legacy_product_id` | chaîne ≤ 64 | OUI | idem, brut | ⚪ `[PROPOSÉ]` — indispensable pour AN-25 |
| `product_name_snapshot` | chaîne ≤ 191 | NON | `Firestore:orders.items[].productName` — 56/56 | 🟢 |
| `quantity` | entier court non signé | NON | `Firestore:orders.items[].quantity` — bornes **1 à 100, entier** imposées par `server/db.ts:1256-1264` | 🟢 |
| `unit_price_after_options` | décimal(10,3) | **OUI** | `Firestore:orders.items[].unitPrice` — `CODE:server/db.ts:1048` | 🟢 |
| `item_total_price` | décimal(10,3) | **OUI** | `Firestore:orders.items[].itemTotalPrice` — `CODE:server/db.ts:1266` | 🟢 |
| `special_instructions` | texte | OUI | `Firestore:orders.items[].specialInstructions` — **1/56** réel : `'Sauce servie à part svp. Pas de piment.'` ; injecté en fiche cuisine avec `⚠️ NOTE CLIENT` (`server/db.ts:1095-1097`) | 🟢 |
| `protein_option_id` | entier non signé | OUI | résolution par label de `items[].proteinOption.label` | 🟡 `[PROPOSÉ]` |
| `protein_label_snapshot` | chaîne ≤ 191 | OUI | `Firestore:orders.items[].proteinOption.label` — **11/56** | 🟢 |
| `protein_extra_price_snapshot` | décimal(10,3) | OUI | `…proteinOption.extraPrice` | 🟢 |
| `protein_extra_quantity_snapshot` | décimal(12,3) | OUI | `…proteinOption.extraGrams` — **max réel 250** | 🟢 |
| `veggies_option_id` | entier non signé | OUI | résolution par label | 🟡 `[PROPOSÉ]` |
| `veggies_label_snapshot` | chaîne ≤ 191 | OUI | `…veggiesOption.label` — **7/56** | 🟢 |
| `veggies_extra_price_snapshot` | décimal(10,3) | OUI | `…veggiesOption.extraPrice` | 🟢 |
| `veggies_extra_quantity_snapshot` | décimal(12,3) | OUI | `…veggiesOption.extraGrams` — **max réel 180** | 🟢 |
| `base_choice_option_id` | entier non signé | OUI | résolution par label | 🟡 `[PROPOSÉ]` |
| `base_choice_label_snapshot` | chaîne ≤ 191 | OUI | `…baseChoice.label` — **26/56** | 🟢 |
| `base_choice_extra_price_snapshot` | décimal(10,3) | OUI | `…baseChoice.extraPrice` | 🟢 |

### Décision argumentée : 3 axes fixes plutôt qu'une table générique d'options

🟢 **Démontré — 3 raisons :**

1. **Les données réelles ne contiennent exactement que 3 axes.** Mesuré sur 56 lignes :
   `baseChoice` 26, `proteinOption` 11, `veggiesOption` 7, **aucun autre**.
2. **Le hash d'idempotence les traite comme des champs nommés et typés** :
   `server.ts:955-964` construit `protein:{label,grams,price}`, `veggies:{label,grams,price}`,
   `base:{label,price}`. Une modélisation générique **changerait la canonicalisation** et donc le
   hash ⇒ **422/403 spurieux ou doublons non détectés** (voir T-11).
3. **Le traitement diffère par axe** : `extraGrams` **ajoute** une quantité
   (`server/db.ts:935-961`) alors qu'un choix de base **substitue ou transfère** un ingrédient
   (`server/db.ts:964-995`). Une table générique **masquerait cette asymétrie**.

**Contrepartie assumée (🟡 D-22) :** ajouter un 4ᵉ axe (« sauce », « cuisson », « sauce à part »)
exigera une évolution de schéma. Ce coût est **inférieur** au risque sur le hash et sur la recette.

---

## 2.4 Fiche T-06 · `bebba_order_status_transitions`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_status_transitions` |
| **2** | **Rôle métier** | Source unique de la matrice de transition du cycle de vie |
| **3** | **Source exacte** | **`CODE` uniquement — aucune donnée.** `server/db.ts:1512-1520` (`allowedTransitions`) **et** `server/auth.ts:154-163` (`validLifecycle`) : **deux copies identiques** ; **et** `src/components/admin/AdminView.tsx:42-48` : **troisième copie côté front**. Le filtrage **par rôle** est dans `server/auth.ts:145-181` |
| **7** | **PK** | `(from_status, to_status)` |
| **8** | **FK** | aucune |
| **9** | **UNIQUE** | la PK suffit |
| **10** | **Index** | `(from_status)` |
| **11** | **Historique ou vivante** | **VIVANTE** (référentiel) |
| **12** | **Conservation** | sans objet |
| **13** | **Règle de migration** | Recopie **littérale** des 11 transitions de `server/db.ts:1512-1520`, enrichies de la capability requise déduite de `server/auth.ts:165-179`. **Ne rien ajouter, ne rien retirer** |
| **14** | **Anomalies** | **AN-29** matrice **tripliquée** sans source unique · **AN-30** la matrice **ne dépend pas du rôle** dans `server/db.ts` (le contrôle de rôle est fait **avant**, dans `server/auth.ts`), donc deux couches de validation partiellement redondantes · **AN-31** `ready` est dans la matrice mais **ne peut plus être persisté** (`server/db.ts:1600-1616`) |
| **15** | **Traitement** | AN-29 → cette table devient la source unique. AN-30 → la colonne `required_capability` **fusionne** les deux couches. AN-31 → 🔴 **D-13** : soit la transition `ready→waiting_for_driver` reste automatique (et `ready` n'est alors qu'un état d'historique), soit `ready` redevient persistant. **Les 3 commandes existantes en `ready` doivent être traitées selon la décision** |
| **16** | **Certitude** | **🟢 transitions démontrées** — **🔴 persistance de `ready`** |

### Contenu réel à recopier (🟢 11 transitions)

| `from_status` | `to_status` | Capability requise (déduite de `server/auth.ts:165-179`) |
|---|---|---|
| `received` | `preparing` | `admin`, `kitchen` |
| `received` | `cancelled` | `admin` uniquement |
| `preparing` | `ready` | `admin`, `kitchen` |
| `preparing` | `cancelled` | `admin` uniquement |
| `ready` | `waiting_for_driver` | `admin` (**+ système**, `server/db.ts:1608-1615`) |
| `ready` | `cancelled` | `admin` uniquement |
| `waiting_for_driver` | `delivering` | `admin` uniquement |
| `waiting_for_driver` | `cancelled` | `admin` uniquement |
| `delivering` | `delivered` | `admin`, `driver` (si affecté) |
| `delivering` | `cancelled` | `admin` uniquement |
| `delivered` / `cancelled` | — | **aucune transition sortante** |

**Colonnes proposées :** `from_status`, `to_status`, `required_capability`, `is_system_only`
(booléen — 🟢 `[PROPOSÉ]` : `ready→waiting_for_driver` est déclenchée **automatiquement** par
`server/db.ts:1600-1616`, sans appel explicite), `requires_driver_assignment` (booléen — 🟢
`server/db.ts:1527-1535` : `delivering` exige un livreur actif), `position` (ordre d'affichage).

---

## 2.5 Fiche T-07 · `bebba_order_events`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_events` (nom choisi plutôt que `…status_history` : 🟢 le contenu réel **n'est pas** un historique de statuts) |
| **2** | **Rôle métier** | Journal append-only de tout ce qui arrive à une commande : changements de statut, affectations de livreur, notes système |
| **3** | **Source exacte** | `Firestore:orders.statusHistory[]` (**119 entrées** observées). Écrit par : `CODE:server/db.ts:1365-1373` (création), `:1601-1607` + `:1609-1615` (auto-transition `ready`), `:1637-1643` (transition normale), `:1668-1674` (**affectation de livreur — sans changement de statut**) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `order_id` → T-04 ; `actor_user_id` → `wp_users.ID` |
| **9** | **UNIQUE** | **`(order_id, seq)`** — 🟢 **`(order_id, timestamp)` est IMPOSSIBLE** : **6 commandes** ont des horodatages **identiques à la milliseconde** (`BEBBA-1093` : `ready` et `waiting_for_driver` tous deux à `2026-09-03T13:48:18.309Z`). **`(order_id, status)` est IMPOSSIBLE** : `BEBBA-1079` a **2 entrées `preparing`** |
| **10** | **Index** | `(order_id, seq)` UNIQUE suffit ; `(occurred_at)` pour les recherches transverses ; `(actor_user_id)` |
| **11** | **Historique ou vivante** | **100 % HISTORIQUE, append-only** |
| **12** | **Conservation** | Aucun `UPDATE`, aucun `DELETE`. 🟢 cohérent avec l'intention de `firestore.rules:173` (suppression interdite sur les commandes). **Règle cible à imposer (absente aujourd'hui)** : `bebba_orders.status` doit être égal au `status` de la **dernière** ligne `event_type='status_change'`. Ce n'est **pas** le cas actuellement : `BEBBA-1095` a `status='ready'` et un historique réduit à `['received']` (**AN-32**) |
| **13** | **Règle de migration** | (a) `seq` = **index dans le tableau** — seul ordonnancement fiable. (b) `occurred_at` = **valeur d'origine, jamais régénérée**. (c) `event_type` = **inféré** : `'driver_assignment'` si le `label` correspond à `` `Livreur affecté : ${driver.name}` `` (`server/db.ts:1669`), `'system'` si `actor_label_snapshot ∈ {'Système Client','Système BEBBA','Équipe BEBBA'}` (valeurs codées en dur, `server/db.ts:1372, 1610, 1640`), sinon `'status_change'`. (d) `actor_user_id` = **résolution uniquement** par le motif `` `<users.name> (<RoleLabel>)` `` produit par `server.ts:1128-1130`, **et seulement si le rôle est cohérent**. (e) Toute entrée dont `status` diffère du statut courant de la commande au moment de l'écriture est **marquée** en quarantaine, pas corrigée |
| **14** | **Anomalies** | voir tableau de résolution des acteurs ci-dessous + **AN-32** historique incomplet · **AN-33** doublon d'entrée · **AN-34** horodatages dupliqués · **AN-35** 7 entrées sans acteur · **AN-36** `label` non dérivable du statut · **AN-37** l'historique contient des événements **qui ne sont pas** des changements de statut |
| **15** | **Traitement** | AN-32 → **migrer tel quel** + quarantaine ; ne **pas** fabriquer d'entrée `ready` (cela inventerait un horodatage et un acteur). AN-33 → **migrer les 2 entrées**, `seq` distincts + quarantaine. AN-34 → résolu par `(order_id, seq)`. AN-35 → `actor_label_snapshot NULL`, `actor_user_id NULL`. AN-36 → **conserver le `label` en instantané** : 8 valeurs réelles dont **3 variantes pour `received`**. AN-37 → résolu par `event_type` + `status` NULL-able |
| **16** | **Certitude** | **Structure 🟢** — **`event_type` 🟢 inférable** — **`actor_user_id` 🟢 partiellement résolvable, mesuré** — **population 🟡** |

### Résolution réelle des acteurs — mesurée sur 119 entrées

| Classe | Nombre | Détail | Traitement |
|---|---|---|---|
| **Acteur système identifiable par le code** | **66** | `'Système Client'` ×51 (`server/db.ts:1372`, en dur) · `'Équipe BEBBA'` ×9 (`server/db.ts:1640`, valeur de repli) · `'Système BEBBA'` ×6 (`server/db.ts:1610`, en dur) | 🟢 `actor_user_id = NULL` + `actor_kind = 'system'` — **attribution fiable par le code, pas par les données** |
| **Résoluble vers un compte réel** | **13** | `'Administrateur BEBBA (Admin)'` ×8 → `usr-admin-1` (rôle `admin` ✅) · `'Chef de Cuisine BEBBA (Cuisine)'` ×3 → `usr-kitchen-1` (rôle `kitchen` ✅) · `'Sami Trabelsi (Livreur)'` ×2 → `usr-driver-1` (rôle `driver` ✅) | 🟢 `actor_user_id` renseigné **+** `actor_label_snapshot` conservé |
| **Non résoluble** | **31** | 11 valeurs libres : `'Chef Cuisine'` ×8, `'Chef Cuisine Test'` ×7, `'Cuisine BEBBA'` ×3, `'Admin'` ×3, `'Chef'` ×2, `'Système / Admin'` ×2, `'Chef Test'` ×2, `'Livreur Bilel'` ×1, `'Deuxième tentative'` ×1, `'Tentative Doublon'` ×1, `'Admin Test Annulation'` ×1 | 🔴 **aucun mapping automatique** : `actor_user_id = NULL`, texte conservé, quarantaine. ⚠️ `'Livreur Bilel'` ne correspond à **aucun** livreur existant (les 3 sont Yassine Ben Amor, Amine Trabelsi, Karim Bouazizi) |
| **Absent** | **7** | champ `updatedBy` non écrit | `NULL` |
| **Nom de livreur sans compte correspondant** | **2** | `'Yassine Ben Amor'` = `drivers[drv-1].name`, mais le compte lié `usr-driver-1` s'appelle `'Sami Trabelsi'` | 🟢 **preuve directe de AN-115** (désynchronisation `users` ↔ `drivers`, Partie 6). `actor_user_id = NULL` |

⚠️ **AN-38 — le journal nomme une personne qui n'a pas de compte.** `'Yassine Ben Amor'` apparaît
**2 fois** comme acteur, **sans le suffixe de rôle** que produit `server.ts:1128-1130`
(`` `${user.name} (${roleLabel})` ``). Or **`users` ne contient aucun `name` = « Yassine Ben Amor »**
— ce nom n'existe que dans **`drivers`**. Même constat pour **`'Livreur Bilel'`** (1 occurrence) :
**aucun livreur nommé Bilel** parmi les 3 fiches réelles.
⇒ **Ces 3 entrées sont des données de démonstration écrites directement**, sans passer par
`updateOrderStatus`. **Traitement : `actor_user_id = NULL`, `actor_kind = 'unknown'`, texte conservé
verbatim, quarantaine.** ⚠️ **Tenter de rattacher `'Yassine Ben Amor'` à `drv-1` puis à
`usr-driver-1` serait une double inférence non démontrée.**

> **Correction apportée à la contre-expertise V0** : V0 affirmait « 100 % des acteurs non
> résolvables ». La mesure précise donne **13/119 résolubles avec certitude** et **66/119
> attribuables au système via le code**. Le reste (38/119) demeure non résoluble.
> **La conclusion pratique est inchangée** : `actor_label_snapshot` reste la source authoritative
> et aucun mapping automatique massif n'est possible.

### `label` et `note` réels (🟢 à conserver en instantané)

**8 `label` distincts** — dont **3 pour le seul statut `received`** :

| `label` | occurrences | statut(s) |
|---|---|---|
| `Commande reçue & transmise à la cuisine` | 51 | `received` |
| `En préparation en cuisine` | 31 | `preparing` |
| `Commande prête & emballée` | 13 | `ready` |
| `En attente de livreur` | 8 | `waiting_for_driver` |
| `En cours de livraison` | 8 | `delivering` |
| `Commande livrée au client` | 4 | `delivered` |
| `Commande reçue & enregistrée` | 3 | `received` |
| `Commande annulée` | 1 | `cancelled` |

⚠️ Aucun de ces 8 libellés ne correspond **exactement** à la table `statusLabels` de
`server/db.ts:1568-1576` (`'Commande reçue'`, `'En préparation en cuisine'`, `'Commande prête &
emballée'`, `'En attente de livreur'`, `'En cours de livraison'`, `'Commande livrée au client'`,
`'Commande annulée'`) : seul `'Commande reçue'` diffère, remplé en pratique par 2 autres variantes.
⇒ **`label` n'est PAS dérivable du statut.**

**16 `note` distinctes**, dont 36 vides. Exemples réels : `'Paiement à la livraison sélectionné'`
(×51), `'Plats préparés et emballés en sac thermique'` (×6),
`"Placée automatiquement en attente d'attribution d'un livreur"` (×5), `'En cuisson'` (×3),
`'Grillades en cuisson'`, `'Prise en charge par Yassine Ben Amor'`,
`'Placée automatiquement en attente de livreur (aucun livreur disponible)'`.
⇒ **Texte libre, information métier réelle** (ex. « aucun livreur disponible ») : à conserver.

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `order_id` | entier non signé | NON | parent | 🟢 |
| `seq` | entier court | NON | index du tableau | 🟢 `[PROPOSÉ]` — nécessité démontrée (AN-34) |
| `event_type` | énuméré : `status_change`, `driver_assignment`, `payment_change`, `system`, `note` | NON | **inféré** (règle §13c) | 🟢 `[PROPOSÉ]` — nécessité démontrée (AN-37) |
| `status` | énuméré 7 valeurs | **OUI** | `Firestore:…statusHistory[].status` | 🟢 — **NULL-able** car `driver_assignment` ne change pas le statut |
| `label` | chaîne ≤ 191 | NON | `…statusHistory[].label` | 🟢 |
| `note` | texte | OUI | `…statusHistory[].note` — 119/119 présents, `''` fréquent | 🟢 |
| `actor_label_snapshot` | chaîne ≤ 191 | OUI | `…statusHistory[].updatedBy` — **112/119** | 🟢 |
| `actor_user_id` | entier non signé | **OUI** | résolution mesurée : **13/119** | 🟢 `[PROPOSÉ]` |
| `actor_kind` | énuméré : `human`, `system`, `unknown` | NON | dérivé (§13c + tableau de résolution) | 🟡 `[PROPOSÉ]` |
| `occurred_at` | date+heure ms UTC | NON | `…statusHistory[].timestamp` | 🟢 |
| `is_legacy_inconsistent` | booléen | NON, défaut faux | `[PROPOSÉ]` — marque AN-32, AN-33 | 🟡 |
| `payment_event_id` | entier non signé | OUI | `[PROPOSÉ]` — lien vers T-10 pour `event_type='payment_change'` | 🟡 |

⚠️ **`event_type='payment_change'` n'existe pas aujourd'hui** : `updatePaymentStatus`
(`server/db.ts:1679-1693`) n'écrit **aucune** entrée d'historique. La valeur est **réservée** pour
le modèle cible ; **0 ligne** à l'import.

---

## 2.6 Fiche T-08 · `bebba_order_item_supplements`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_item_supplements` |
| **2** | **Rôle métier** | Suppléments effectivement commandés sur une ligne, avec leur effet sur le stock |
| **3** | **Source exacte** | `Firestore:orders.items[].supplements[]` (**12 éléments** observés). Construits par `CODE:server/db.ts:1017-1026` (`enrichedSupplements`) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `order_item_id` → T-05 ; `supplement_id` → `bebba_supplements` (Partie 3) ; `ingredient_id` → `bebba_ingredients` (Partie 4) ; `unit_code` → `bebba_units` |
| **9** | **UNIQUE** | `(order_item_id, supplement_id)` — 🟡 **À VÉRIFIER** : le code ne déduplique **pas** les suppléments d'une ligne (`server/db.ts:1000-1027` itère sans contrôle) ; deux entrées identiques sont donc **possibles**. Sur les 12 lignes réelles : **0 doublon**. 🔴 **D-23** |
| **10** | **Index** | `order_item_id` ; `supplement_id` |
| **11** | **Historique ou vivante** | **100 % HISTORIQUE, append-only** |
| **12** | **Conservation** | Aucun `UPDATE`. C'est **l'instantané le plus complet du projet** : 8 champs × 12 lignes, **100 % de présence** |
| **13** | **Règle de migration** | Copie directe. ⚠️ **`quantityConsumed` doit être RENOMMÉ** : ici c'est `supDef.quantityConsumed × itemSup.quantity` (**total**, `server/db.ts:1018`), alors que dans `supplements` c'est une **valeur unitaire**. Même nom, **deux sémantiques** |
| **14** | **Anomalies** | **AN-39** `supplementId` orphelin : `sup-1788252974687` sur `BEBBA-1072` · **AN-40** homonymie `quantityConsumed` · **AN-41** pas de déduplication côté code |
| **15** | **Traitement** | AN-39 → `SET NULL` + `legacy_supplement_id` + instantanés conservés (nom, prix, ingrédient, quantité, unité **tous présents**) ⇒ **aucune perte d'information**. AN-40 → renommer `quantity_consumed_total`. AN-41 → 🔴 D-23 : contrainte UNIQUE **ou** `position` |
| **16** | **Certitude** | **🟢 structure et sémantique entièrement démontrées** — population 🟡 (12 lignes) |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `order_item_id` | entier non signé | NON | parent | 🟢 |
| `position` | entier court | NON | index du tableau | 🟢 `[PROPOSÉ]` |
| `supplement_id` | entier non signé | **OUI** | `…supplements[].supplementId` | 🟢 |
| `legacy_supplement_id` | chaîne ≤ 64 | OUI | idem, brut | ⚪ `[PROPOSÉ]` |
| `supplement_name_snapshot` | chaîne ≤ 191 | NON | `…supplements[].name` — 12/12 | 🟢 |
| `unit_price_snapshot` | décimal(10,3) | NON | `…supplements[].price` — 12/12 (`server/db.ts:1019`) | 🟢 |
| `quantity` | entier court non signé | NON | `…supplements[].quantity` — nombre de portions demandées | 🟢 |
| `ingredient_id` | entier non signé | **OUI** | `…supplements[].ingredientId` — 12/12 | 🟢 |
| `ingredient_name_snapshot` | chaîne ≤ 191 | NON | `…supplements[].ingredientName` — 12/12 | 🟢 |
| `quantity_consumed_total` | décimal(12,3) | NON | `…supplements[].quantityConsumed` — **total**, `server/db.ts:1018` | 🟢 **renommé** (AN-40) |
| `unit_code` | chaîne courte | OUI | `…supplements[].unit` — 12/12 | 🟢 |

---

## 2.7 Fiche T-09 · `bebba_order_item_ingredients`

> **Table la plus critique pour la cuisine et pour le stock.**

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_item_ingredients` |
| **2** | **Rôle métier** | Fiche de préparation figée : ce que la cuisine doit assembler pour **une ligne** de commande, et ce que le stock doit consommer |
| **3** | **Source exacte** | `Firestore:orders.items[].preparationSheet.totalIngredients[]`. Calculé par `CODE:server/db.ts:923-1098` (`computePreparationSheet`). ⚠️ **Le champ `ingredientConsumptions` produit par la même fonction (`server/db.ts:1063-1068`) n'est JAMAIS persisté** : `createOrder` ne stocke que `totalIngredients` (`server/db.ts:1286-1289`) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `order_item_id` → T-05 ; `ingredient_id` → `bebba_ingredients` ; `unit_code` → `bebba_units` |
| **9** | **UNIQUE** | `(order_item_id, ingredient_id)` — 🟢 **justifié par le code** : `computePreparationSheet` accumule dans une `Map` indexée par `ingredientId` (`server/db.ts:923, 1041`), donc **un seul agrégat par ingrédient et par ligne**. ⚠️ **mais `ingredient_id` est NULL-able** (AN-42) : prévoir `(order_item_id, legacy_ingredient_id)` pour les cas non résolus |
| **10** | **Index** | `order_item_id` ; `ingredient_id` — sert `isIngredientInUse` (`server/db.ts:295-297`) |
| **11** | **Historique ou vivante** | **100 % HISTORIQUE, append-only** |
| **12** | **Conservation** | **Obligatoire et fonctionnelle** 🟢 : `updateOrderStatus` **recalcule la consommation de stock depuis cet instantané** pour les commandes non encore consommées (`server/db.ts:1546-1560`). Sans instantané, une commande ancienne passant en préparation consommerait la **recette actuelle** |
| **13** | **Règle de migration** | (a) `quantity_per_unit` = `totalIngredients[].totalQuantity` **tel quel**. (b) `quantity_total` = `quantity_per_unit × bebba_order_items.quantity`, **arrondi à 0,1** — 🟢 c'est **exactement** ce que fait `createOrder` (`server/db.ts:1298`). (c) **Vérification croisée obligatoire** : `Σ quantity_total` par (commande, ingrédient) doit être égale à `|quantity_delta|` des mouvements `order_consumption` de cette commande. (d) `source` = `[PROPOSÉ]`, **non reconstructible pour l'existant** ⇒ `NULL` ou `'unknown'` à l'import |
| **14** | **Anomalies** | **AN-42** ingrédient fantôme · **AN-43** `totalIngredients` n'est **pas** un total · **AN-44** `summaryLines` contradictoire · **AN-45** la quantité totale par ligne **n'existe nulle part** |
| **15** | **Traitement** | voir §2.8 |
| **16** | **Certitude** | **🟢 structure et sémantique démontrées ligne à ligne** — **`source` 🔴 non reconstructible** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `order_item_id` | entier non signé | NON | parent | 🟢 |
| `position` | entier court | NON | ordre d'itération de la `Map` (`server/db.ts:1041`) = ordre d'insertion : **bases d'abord, puis substitutions, puis suppléments** | 🟢 `[PROPOSÉ]` |
| `ingredient_id` | entier non signé | **OUI** | `…totalIngredients[].ingredientId` | 🟢 |
| `legacy_ingredient_id` | chaîne ≤ 64 | OUI | idem, brut — **indispensable** pour AN-42 | ⚪ `[PROPOSÉ]` |
| `ingredient_name_snapshot` | chaîne ≤ 191 | NON | `…totalIngredients[].ingredientName` | 🟢 |
| `quantity_per_unit` | décimal(12,3) | NON | `…totalIngredients[].totalQuantity` — ⚠️ **valeur unitaire** | 🟢 |
| `quantity_total` | décimal(12,3) | NON | **`quantity_per_unit × items[].quantity`**, arrondi 0,1 — `CODE:server/db.ts:1298` | 🟢 `[PROPOSÉ]` — nécessité démontrée (AN-45) |
| `unit_code` | chaîne courte | OUI | `…totalIngredients[].unit` | 🟢 |
| `source` | énuméré : `base`, `protein_extra`, `vegetable_extra`, `base_substitution`, `supplement`, `unknown` | NON, défaut `unknown` | `[PROPOSÉ]` — **déductible du code pour le futur, PAS pour l'existant** | 🔴 |

---

## 2.8 Le problème `preparationSheet` — démonstration complète

C'est le point où une migration naïve perd le plus d'information. Trois faits distincts.

### Fait 1 🟢 — `totalIngredients` n'est PAS un total

`computePreparationSheet` produit **deux** listes :

| Liste | Ligne de code | Formule | Persistée ? |
|---|---|---|---|
| `totalIngredients` | `server/db.ts:1056-1061` | `Math.round(val.quantity * 10) / 10` — **sans** `quantityMultiplier` | ✅ **oui** (`server/db.ts:1287`) |
| `ingredientConsumptions` | `server/db.ts:1063-1068` | `Math.round(val.quantity * quantityMultiplier * 10) / 10` — **avec** | ❌ **NON, jamais** |
| `summaryLines` | `server/db.ts:1092` | `Math.round(val.quantity * quantityMultiplier)` — **avec** | ✅ oui (`server/db.ts:1288`) |

Le champ nommé **`totalIngredients` porte donc la quantité UNITAIRE**, et la consommation réelle est
recalculée ailleurs (`server/db.ts:1298`).

### Fait 2 🟢 — `summaryLines` a DEUX sémantiques selon l'origine de la commande

**Cas réel mesuré : `BEBBA-1084`, `prod-poulet-grille`, `quantity = 2`.**

| Source | Poulet | Patates douces | Légumes | Sauce |
|---|---|---|---|---|
| recette (`products.baseIngredients`) | 250 g | 180 g | 150 g | 40 ml |
| `preparationSheet.totalIngredients` | **250** | 180 | 150 | 40 |
| `preparationSheet.summaryLines` | **« 🍗 … : 250 g »** | 180 g | 150 g | 40 ml |
| **mouvements de stock réels** | **−500** | −360 | −300 | −80 |

Le code (`server/db.ts:1092`) **multiplie** `summaryLines` par la quantité. Les données seed
**ne le font pas**. ⇒ **La même colonne affiche l'unité pour les commandes issues de
`server/seedData.ts` et le total pour celles issues de `createOrder`.**

Or c'est **exactement ce que lit la cuisine** : `src/components/kitchen/KitchenView.tsx:335-336`
affiche `item.preparationSheet.summaryLines` ligne à ligne.

> **Impact métier concret :** pour une commande de 2 assiettes, l'écran cuisine affiche
> **250 g de poulet** alors qu'il en faut **500 g**.

### Fait 3 🟢 — la fiche cuisine contient un ingrédient qui n'existe pas

`BEBBA-1086` → `preparationSheet.totalIngredients` contient `ingredientId: 'ing-fantome-inconnu'`.
Aucun ingrédient de ce nom dans `ingredients`. **Seul le nom textuel survit.**

### Traitement retenu

| Élément | Décision | Justification |
|---|---|---|
| `totalIngredients` | → **T-09**, colonne `quantity_per_unit` | 🟢 sémantique démontrée |
| quantité totale | → **T-09**, colonne `quantity_total` **calculée à l'import** | 🟢 `server/db.ts:1298` donne la formule exacte ; **vérifiable** contre les mouvements |
| `summaryLines` | **NE PAS migrer comme donnée authoritative** | 🟢 deux sémantiques contradictoires (Fait 2). À **régénérer** depuis T-09. 🟡 **D-24** : faut-il archiver la valeur brute en quarantaine pour reproduction à l'identique pendant la transition ? |
| `ing-fantome-inconnu` | `ingredient_id = NULL` + `legacy_ingredient_id` + nom conservé | 🟢 la cuisine lit le **nom**, qui est présent ⇒ **aucune perte fonctionnelle** |
| icônes emoji (`🍗🥩🐟🍚🥦🥑🥚🧀🥣🌿`) | **code de rendu, pas données** | 🟢 `server/db.ts:1069-1090` : l'emoji est choisi par `val.name.includes('Poulet')` etc. ⇒ **règle de présentation codée en dur sur le nom**. À réimplémenter, pas à stocker. ⚠️ Imposé : **`utf8mb4`** (4 octets) |
| `⚠️ NOTE CLIENT: « … »` | **code de rendu** | 🟢 `server/db.ts:1095-1097` — dérivé de `special_instructions` (T-05) |

---

## 2.9 Fiche T-10 · `bebba_order_payments`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_payments` |
| **2** | **Rôle métier** | Journal d'encaissement COD : qui a encaissé, quand, combien |
| **3** | **Source exacte** | ⚠️ **N'EXISTE PAS.** Aujourd'hui : un unique champ `Firestore:orders.paymentStatus`, écrit par `CODE:server/db.ts:1679-1693` (`updateDoc(orderRef, { paymentStatus })`) — **sans date, sans acteur, sans montant, sans historique**. Les seules données exploitables sont `orders.paymentMethod`, `orders.paymentStatus`, `orders.totalAmount` |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `order_id` → T-04 ; `collected_by_user_id` → `wp_users.ID` ; `collected_by_driver_id` → `bebba_drivers.id` |
| **9** | **UNIQUE** | `(order_id)` si un seul encaissement par commande — 🔴 **D-25** (encaissements partiels autorisés ?) |
| **10** | **Index** | `(collected_by_driver_id, collected_at)` — 🟢 **nécessaire** : `DriverView.tsx:57-62, 371-396` calcule la caisse du jour **par livreur** ; `(status, collected_at)` pour les dettes |
| **11** | **Historique ou vivante** | **MIXTE** : `status` vivant, le reste historique |
| **12** | **Conservation** | Append-only sur `collected_at` / `collected_by_*` / `amount_collected` une fois écrits |
| **13** | **Règle de migration** | **Une ligne par commande**, initialisée depuis `orders` : `method` = `paymentMethod`, `status` = `paymentStatus`, `amount_expected` = `totalAmount` (**`NULL` pour les 20 commandes sans montant**), `amount_collected` = `totalAmount` **si et seulement si** `paymentStatus='paid'`, sinon `NULL`. `collected_at` = **`NULL` pour toutes les lignes**, y compris les 3 `paid` : 🟢 **la date d'encaissement n'existe nulle part**. `collected_by_*` = **`NULL` pour toutes les lignes** : 🟢 **l'acteur n'existe nulle part** |
| **14** | **Anomalies** | **AN-46** aucune trace d'encaissement (date/acteur/montant) · **AN-47** `BEBBA-1091` livrée et non encaissée, dette **non datable** · **AN-48** `DriverView` approxime la caisse du jour avec `createdAt` de la **commande**, pas avec la date d'encaissement ⇒ **faux si l'encaissement est tardif** · **AN-49** règle `paid ⇒ delivered` **dupliquée** (`server/db.ts:1686` et `server.ts:1231`) |
| **15** | **Traitement** | AN-46 → **ne rien inventer** : `NULL` partout où la donnée manque. AN-47 → la ligne rend la dette **requêtable** (`status='to_collect' AND order.status='delivered'`), ce qui est **impossible aujourd'hui**. AN-48 → corrigé structurellement dès que `collected_at` sera alimenté par le nouveau système ; **les 3 lignes `paid` historiques restent non datables**. AN-49 → contrainte applicative unique |
| **16** | **Certitude** | **🟢 absence de la donnée démontrée** — **🟡 utilité métier à confirmer** (🔴 D-25) — **⚪ aucune valeur historique à migrer au-delà des dérivations ci-dessus** |

> **Honnêteté d'audit :** cette table est une **proposition d'amélioration**, pas une migration.
> Elle ne contient **aucune information historique nouvelle**. Son intérêt est (a) de rendre la
> dette `BEBBA-1091` requêtable, (b) de corriger AN-48 pour l'avenir. **Si le métier refuse
> (D-25), le drapeau `payment_status` sur T-04 suffit à reproduire le comportement actuel.**

---

## 2.10 Fiche T-11 · `bebba_order_idempotency_keys`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_order_idempotency_keys` |
| **2** | **Rôle métier** | Garantir qu'un renvoi du même panier par le même émetteur ne crée pas deux commandes |
| **3** | **Source exacte** | `Firestore:orderIdempotencyKeys` — **absente de `db.json`, population réelle INCONNUE**. Champs écrits par `CODE:server/db.ts:1407-1414` : `key`, `callerId`, `requestHash`, `orderId`, `createdAt`. `callerId` et `requestHash` sont calculés par `CODE:server.ts:1023-1032` |
| **7** | **PK** | `idempotency_key` (clé naturelle) — 🟢 c'est **déjà** l'identifiant du document Firestore (`server/db.ts:1154`) |
| **8** | **FK** | `order_id` → T-04, **NOT NULL** |
| **9** | **UNIQUE** | la PK suffit |
| **10** | **Index** | `order_id` ; `(caller_id, created_at)` pour l'observation des abus |
| **11** | **Historique ou vivante** | **TECHNIQUE VIVANTE** |
| **12** | **Conservation** | 🟢 **suppression et modification interdites** — reproduit `firestore.rules:121-122` (`allow delete: if false`, `allow update: if false`). Purge uniquement par expiration |
| **13** | **Règle de migration** | 🟡 **Préalable obligatoire : compter les documents Firestore.** `scripts/migrate-to-firestore.ts:245-250` **exigeait** que la collection soit **vide** à l'issue de la migration initiale et **échouait** sinon ⇒ elle était vide **à cet instant**. Mais `db.json` contient des commandes jusqu'à `BEBBA-1100` (2026-09-04) et le client **génère une clé à chaque ouverture de modal** (`CheckoutModal.tsx:73-75`) ⇒ des clés ont très probablement été créées depuis. **Ne pas supposer qu'elle est vide** |
| **14** | **Anomalies** | **AN-50** population inconnue · **AN-51** aucune expiration : les clés sont **éternelles** · **AN-52** la clé **n'est jamais persistée côté client** (aucun `localStorage` — vérifié) : elle est générée à l'ouverture du modal (`CheckoutModal.tsx:73-75`), **effacée à la fermeture** (`:93, 104`) et régénérée après succès (`:201`) ⇒ **un rechargement de page entre deux tentatives produit une nouvelle clé et donc une commande dupliquée** · **AN-53** `POST /api/orders` **sans** en-tête `Idempotency-Key` crée une commande **sans aucune protection** (`server/db.ts:1153` : le bloc entier est conditionnel) · **AN-54** reproductibilité du hash non garantie en PHP |
| **15** | **Traitement** | AN-50 → 🟡 **export Firestore préalable**. AN-51 → `[PROPOSÉ]` `expires_at`, 🔴 D-26. AN-52/AN-53 → **défauts réels du système actuel** : à corriger dans la cible, **pas à reproduire**. AN-54 → 🔴 **D-27 bloquante** : test de non-régression obligatoire |
| **16** | **Certitude** | **🟢 sémantique entièrement démontrée** — **🟡 population** — **🔴 portage du hash** |

### Sémantique exacte à reproduire (🟢 `server/db.ts:1152-1186`)

| Situation | Réponse actuelle | Erreur |
|---|---|---|
| clé inexistante | création normale | **201** (`server.ts:1044`) |
| même clé + **même** `callerId` + **même** `requestHash` | renvoi de la commande existante | **200** (`server.ts:1042-1043`) |
| même clé + **autre** `callerId` | refus | **403** `IdempotencyForbiddenError` (`server/db.ts:62-68`) |
| même clé + même `callerId` + **autre** `requestHash` | refus | **422** `IdempotencyConflictError` (`server/db.ts:70-76`) |
| enregistrement **sans** `orderId` | erreur technique | **500** `IdempotencyInconsistencyError` (`server/db.ts:78-84`) |
| `orderId` référencé **introuvable** | erreur technique | **500** idem (`server/db.ts:1178-1181`) |

🟢 **La FK `order_id NOT NULL` supprime structurellement les deux derniers cas** : un
enregistrement sans commande valide devient **impossible** au lieu d'être détecté à l'exécution.

### Algorithme du hash à porter (🟢 `server.ts:925-995`)

Entrées canonicalisées : `callerId` (trim), `phoneNormalized` (`server/db.ts:98-106`),
`addressNormalized` (`server/db.ts:109-113`), `clientName` (trim), `clientNotes` (trim),
puis pour chaque ligne : `productId` (trim), `quantity` (`Number() || 1`),
`protein:{label,grams,price}`, `veggies:{label,grams,price}`, `base:{label,price}`,
`supplements` **triés par `id`** (`localeCompare`) après filtrage `id && quantity > 0`,
`specialInstructions` (trim). Les **lignes** sont triées par
`JSON.stringify(a).localeCompare(JSON.stringify(b))` (`server.ts:980`).
Empreinte : **SHA-256 hexadécimal** de `JSON.stringify(canonicalPayload)` (`server.ts:991-994`).

**Trois fragilités de portage, toutes 🟢 démontrées par le code :**

| # | Fragilité | Conséquence |
|---|---|---|
| 1 | `JSON.stringify` dépend de **l'ordre d'insertion des clés** | Un ordre différent en PHP ⇒ hash différent ⇒ **422 spurious** |
| 2 | `localeCompare` est **dépendant de la locale ICU** et **diffère d'une comparaison octet à octet** | Deux implémentations peuvent **ordonner différemment** deux lignes ⇒ hash différent |
| 3 | `Number(x) \|\| 0` et `.trim()` ont des cas limites (`NaN`, `Infinity`, espaces insécables, BOM) dont le traitement PHP diffère | hash différent sur des paniers limites |

⚠️ **Le hash intègre `extraPrice` et `extraGrams` fournis par le CLIENT** (`server.ts:956-957,
960-961, 964`) alors que `computePreparationSheet` les **ignore** et reprend les valeurs officielles
du produit (`server/db.ts:875-880, 896-901, 916-920`). ⇒ **Deux requêtes au contenu métier
identique mais aux `extraPrice` clients différents produisent des hashes différents** et donc un
**422**. C'est un comportement réel, à **reproduire ou à corriger** : 🔴 **D-28**.

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `idempotency_key` | chaîne ≤ 190 | NON (PK) | `Firestore:orderIdempotencyKeys` clé du document ; générée côté client en UUID v4 (`CheckoutModal.tsx:74, 201`) | 🟢 |
| `caller_id` | chaîne ≤ 191 | NON | `…callerId` — `CODE:server.ts:1025` : `client:<userId>` ou `guest:<phoneNorm\|'unknown'>` | 🟢 |
| `request_hash` | chaîne fixe 64 | NON | `…requestHash` — SHA-256 hex | 🟢 |
| `order_id` | entier non signé | **NON** | `…orderId` | 🟢 (aujourd'hui `NULL` possible ⇒ 500 ; la FK le rend impossible) |
| `created_at` | date+heure ms UTC | NON | `…createdAt` | 🟢 |
| `expires_at` | date+heure ms UTC | OUI | `[PROPOSÉ]` — AN-51 | 🟡 |
| `hit_count` | entier | NON, défaut 0 | `[PROPOSÉ]` | 🟡 |
| `last_hit_at` | date+heure ms UTC | OUI | `[PROPOSÉ]` | 🟡 |
| `original_response_status` | entier court | OUI | `[PROPOSÉ]` — pour rejouer 200 vs 201 (`server.ts:1041-1046`) | 🟡 |

---

## 2.11 Réconciliation fiche de préparation ↔ ledger de stock — 🟢 mesurée ligne à ligne

C'est la **seule vérification croisée quantitative** réalisable sur l'instantané, et elle est
**décisive** pour la crédibilité de T-09.

### Méthode

Pour chaque commande : `attendu(commande, ingrédient) = Σ_lignes round(totalIngredients[].totalQuantity × items[].quantity × 10)/10`
— **formule exacte du code**, `server/db.ts:1298` — comparé à
`réel(commande, ingrédient) = |Σ movements.quantity|` pour `type='order_consumption'` et
`notes` contenant `#<orderNumber>`.

### Résultat

| Mesure | Valeur |
|---|---|
| paires (commande, ingrédient) **attendues** d'après les fiches | **225** |
| paires **présentes** au ledger | **171** |
| paires présentes dont la **valeur est exacte** | **171 / 171 (100 %)** |
| paires **manquantes** | **54** |
| ingrédients au ledger **absents** de la fiche (surplus) | **0** |
| commandes avec **au moins un** mouvement | **44 / 54** |
| commandes **sans aucun** mouvement | **10** |
| commande **partiellement** consommée | **1** (`BEBBA-1047` : 2 paires sur 5) |

### 🟢 Conclusion positive — la plus forte du document

**Les 171 paires présentes concordent à 0,1 unité près.** Cela démontre simultanément :

1. **La formule `totalQuantity × quantity` est la bonne** — elle reproduit le ledger à 100 %.
2. **La colonne `quantity_total` de T-09 est donc reconstructible ET vérifiable**, pas estimée.
   Passage de 🟡 à **🟢 VALIDÉ**.
3. **Le ledger est agrégé PAR COMMANDE, pas par ligne** — 🟢 démontré par le code :
   `requiredStockMap` est une `Map` indexée par `ing.id` accumulée **à travers toutes les lignes**
   de la commande (`server/db.ts:1296-1313`). ⚠️ **Non vérifiable par les données** : les
   **2 seules commandes multi-lignes** (`BEBBA-1086`, `BEBBA-1048`) **n'ont aucun mouvement**.
   La divergence potentielle est donc **invisible** dans l'instantané.

### 🔴 Conclusion négative — 54 paires manquantes

| Commande | statut | `stockConsumed` | paires attendues | paires au ledger |
|---|---|---|---|---|
| `BEBBA-1047` | `delivering` | **absent** | 5 | **2** (`ing-poulet −300`, `ing-riz −150`) — manquent `ing-legumes −280`, `ing-avocat −80`, `ing-sauce-healthy −35` |
| `BEBBA-1048` | `preparing` | absent | 6 | **0** |
| `BEBBA-1049` | `received` | absent | 4 | **0** |
| `BEBBA-1076` | `received` | `false` | 5 | **0** |
| `BEBBA-1078` | `received` | `false` | 5 | **0** |
| `BEBBA-1080` | `received` | `false` | 5 | **0** |
| `BEBBA-1085` | `received` | `false` | 5 | **0** |
| `BEBBA-1086` | `received` | `false` | 7 | **0** |
| `BEBBA-1095` | **`ready`** | `false` | 4 | **0** |
| `BEBBA-1099` | `received` | `false` | 6 | **0** |
| `BEBBA-1100` | `received` | `false` | 4 | **0** |

**Volume non tracé** : `BEBBA-1086` à lui seul représente **1 235 unités** de fiche de préparation
sans aucun mouvement (`ing-legumes` 330 + `ing-patate-douce` 340 + `ing-poulet` 250 + `ing-boeuf` 220
+ `ing-sauce-miel-moutarde` 40 + `ing-sauce-healthy` 35 + `ing-fantome-inconnu` 50).

⚠️ **`BEBBA-1047` est le cas le plus grave** : la commande est **`delivering`**, donc déjà
passée par `preparing`, et **3 ingrédients sur 5 n'ont jamais été décomptés**. Le code actuel
`createOrder` itère **toutes** les paires (`server/db.ts:1383-1401`) ⇒ **une consommation partielle
est impossible à produire avec le code présent dans le dépôt.**

> **⇒ Le ledger actuel a été produit par une implémentation antérieure** (voir §4.4). Toute
> stratégie de migration consistant à « rejouer les commandes pour reconstruire le stock » est
> **impossible** : le code générateur n'existe plus, et le rejouer avec le code actuel produirait
> **des valeurs différentes** de l'historique.

### Traitement retenu

| Élément | Décision | Certitude |
|---|---|---|
| 171 paires concordantes | **migrer telles quelles**, T-09 + T-20 cohérents | 🟢 |
| 54 paires manquantes | **ne pas créer de mouvements compensatoires** (cela inventerait un horodatage, un acteur et une note). Marquer les commandes concernées dans **T-30 quarantine** avec le motif `stock_ledger_incomplete` | 🟢 |
| `stock_state` de ces 10 commandes | **`not_consumed`** (dérivé du ledger, pas du drapeau) — voir AN-17 | 🟢 |
| Solde d'ouverture des ingrédients | **indéterminable** — voir Partie 4 | 🔴 |

---

## 2.12 AN-55 · Sous-facturation historique — 🔴 la plus lourde conséquence financière

### Démonstration

`server/db.ts:1048` calcule `unitPrice = basePrice + extraPrice(protéine) + extraPrice(légumes)
+ extraPrice(base) + Σ suppléments`. J'ai **recalculé ce montant pour les 36 lignes dont
`unitPrice` est non nul**, en reprenant les `extraPrice` du catalogue (`products[].customization`)
et les suppléments de la ligne.

| Ligne | Produit | `basePrice` | options | suppléments | **devrait être** | **`unitPrice` stocké** | **écart** |
|---|---|---|---|---|---|---|---|
| `BEBBA-1047` | BEBBA Chicken Power Bowl | 14.5 | **+4.8** | **+3.0** | **22.3** | **14.5** | **−7.8 DT** |
| `BEBBA-1049` | Assiette Bœuf Grillé & Romarin | 19.5 | **+5.0** | **+3.5** | **28.0** | **19.5** | **−8.5 DT** |
| `BEBBA-1048` | Assiette Grillade Poulet Mariné | 16.0 | 0 | **+1.5** | **17.5** | **16.0** | **−1.5 DT** |
| 33 autres lignes | — | — | — | — | conforme | conforme | **0** |

**Total sous-facturé mesuré : −17.8 DT sur 3 commandes** (les 3 portant un token `_demo`, §2.1).

### Ce que cela prouve

1. **Les totaux stockés sont cohérents entre eux** : `subtotal == Σ itemTotalPrice` sur
   **34/34** commandes à montant non nul (**0 écart mesuré**), et `totalAmount == subtotal +
   deliveryFee`. L'erreur est donc **propagée de bout en bout**, pas isolée à une colonne.
2. **Le stock, lui, a bien tenu compte des options** : `BEBBA-1047` a consommé
   **300 g de poulet** (base 200 + extra 100) et sa fiche affiche
   `'🍗 Poulet mariné: 300g (Base 200g + Extra 100g)'`.
   ⇒ **La même commande a consommé l'option en stock mais ne l'a pas facturée.**
3. **`unitPrice` stocké ≠ `unitPrice` recalculable.** Ce n'est pas un affichage : c'est la valeur
   qui a servi au `subtotal` et au `totalAmount`, donc **au montant réellement encaissé**
   (`DriverView.tsx:371-396`).

### Traitement — 🔴 **D-16, décision bloquante**

| Option | Conséquence | Avis d'audit |
|---|---|---|
| **A. Migrer tel quel, `NULL` et valeurs erronées compris** | Le chiffre d'affaires historique est **faux de 17.8 DT** mais **aucune donnée n'est inventée** | ✅ **recommandé** — seul choix compatible avec « ne rien inventer » |
| **B. Recalculer les totaux depuis le catalogue actuel** | Corrige les 3 commandes mesurées **mais réécrit un document financier historique** et n'est **pas applicable uniformément** : **2 lignes** n'ont plus de `productId` résolvable (§2.13) et **20 lignes** n'ont aucun prix stocké à comparer. Le recalcul produirait donc un historique **partiellement inventé** | ❌ **à écarter sans décision écrite du métier** |
| **C. Migrer tel quel + colonne de rapprochement** | Option A **plus** `amount_discrepancy` et `amount_recomputed` **en colonnes distinctes**, jamais écrasées | ✅ **recommandé en complément de A** |

**Recommandation formelle : A + C.** Conserver la valeur facturée **et** exposer l'écart, sans
jamais substituer l'une à l'autre.

### Colonnes ajoutées à T-04 en conséquence (🟡 `[PROPOSÉ]`)

| Colonne | Type | Null ? | Justification |
|---|---|---|---|
| `amounts_are_reliable` | booléen | NON, défaut vrai | 🟢 `false` pour les 3 commandes ci-dessus + les 20 sans montant |
| `amount_recomputed` | décimal(10,3) | OUI | 🟢 `[PROPOSÉ]` : `Σ (basePrice + options + suppléments) × quantity` au tarif **catalogue actuel** — valeur **informative uniquement** |
| `amount_discrepancy` | décimal(10,3) | OUI | 🟢 `[PROPOSÉ]` : `amount_recomputed − total_amount` |

⚠️ **`amount_recomputed` n'est PAS un montant dû.** C'est un outil de rapprochement. Toute
utilisation comme base de facturation exigerait une décision métier écrite (**D-16**).

---

## 2.13 Suppression sans garde-fou — 🟢 cause racine des références orphelines

| Opération | Garde-fou dans le code | Ligne |
|---|---|---|
| `deleteIngredient` | ✅ **fort** : refuse si `active !== false`, **et** refuse si référencé par un produit, un supplément, une commande **ou** un mouvement de stock | `server/db.ts:339-353` (+ `isIngredientInUse` `:276-315`) |
| `deleteCategory` | ✅ refuse si des produits y sont rattachés | `server/db.ts:228-237` |
| `deleteOrder` | ✅ **interdit** par `firestore.rules:173` (`allow delete: if false`) | 🟢 |
| **`deleteProduct`** | ❌ **AUCUN** — `deleteDoc` seul | **`server/db.ts:612-616`** |
| **`deleteSupplement`** | ❌ **AUCUN** — `deleteDoc` seul | **`server/db.ts:496-500`** |
| **`deleteSupplier`** | ❌ **AUCUN** — `deleteDoc` seul | **`server/db.ts:254-258`** |
| **`deleteDriver`** | ❌ **AUCUN** — `deleteDoc` seul | **`server/db.ts:786-805`** |

**Conséquence mesurée dans les données :**

| Référence orpheline | Où | Cause |
|---|---|---|
| `prod-1788252958886` | `BEBBA-1071.items[0].productId` | produit supprimé, commande conservée |
| `prod-1788252974684` | `BEBBA-1072.items[0].productId` | idem |
| `sup-1788252958889` | `BEBBA-1071.items[0].supplements[0].supplementId` | supplément supprimé |
| `sup-1788252974687` | `BEBBA-1072.items[0].supplements[0].supplementId` | idem |
| `ing-1`, `ing-4` | `baseIngredients` des 2 « Wrap Fitness » + `ingredientId` des 2 « Guacamole » | **autre cause** — voir §3.7 |
| `ing-fantome-inconnu` | `BEBBA-1086` `totalIngredients` | **autre cause** — donnée de test |

🟢 **Ces 4 orphelins démontrent que des suppressions ont réellement eu lieu** dans le catalogue
vivant, alors que les commandes qui les référençaient étaient protégées. **Ce n'est pas un cas
théorique.**

### Traitement retenu

| Élément | Décision | Certitude |
|---|---|---|
| FK `bebba_order_items.product_id` | **`ON DELETE SET NULL`** + `legacy_product_id` + `product_name_snapshot` | 🟢 — la suppression reste possible sans casser l'historique |
| FK `bebba_order_item_supplements.supplement_id` | **`ON DELETE SET NULL`** + `legacy_supplement_id` + instantanés | 🟢 |
| FK `bebba_order_items.order_id` | **`ON DELETE RESTRICT`** | 🟢 — reproduit `firestore.rules:173` |
| Suppression de produit/supplément dans la cible | **interdire la suppression physique** si référencé par une commande ; imposer la désactivation. 🟢 c'est **exactement** la règle déjà appliquée aux ingrédients (`server/db.ts:339-353`) et aux catégories (`:228-237`) ⇒ **généraliser un mécanisme existant, pas en inventer un** | 🟢 |

---
---

# PARTIE 3 — PRODUITS, RECETTES ET PERSONNALISATION

## 3.1 Schéma réel d'un produit — 🟢 census exhaustif des 23 documents

| Champ | Présence | Observations |
|---|---|---|
| `id`, `name`, `description`, `categoryId`, `basePrice`, `imageUrl`, `active`, `isAvailable`, `isPopular`, `baseIngredients`, `customization` | **23 / 23** | socle commun |
| `calories`, `proteinGrams`, `carbsGrams`, `fatGrams` | **22 / 23** | absent sur `prod-test-indisponible` |
| `available`, `order`, `sortOrder`, `createdAt`, `updatedAt` | **16 / 23** | **groupe « passé par l'interface d'administration »** |
| `image` | **4 / 23** | doublon de `imageUrl` ; **vide (`''`) sur `prod-test-indisponible`** |

### 🟢 Deux populations de produits, démontrées

| | Groupe A (16) | Groupe B (7) |
|---|---|---|
| Champs | socle + nutriments + `available`, `order`, `sortOrder`, `createdAt`, `updatedAt`, (`image` ×4) | socle + nutriments **uniquement** |
| `createdAt` | présent | **absent** |
| Produits | `prod-saumon-zen-bowl`, `prod-bowl-vegetal-mediterraneen`, `prod-mix-grill-fitness`, `prod-brochettes-dinde`, `prod-menu-ptit-champion`, `prod-mini-bowl-gourmet`, `prod-batonnets-poulet-dore`, `prod-elixir-betterave`, `prod-eau-infusee`, `prod-programme-30j-perte`, `prod-programme-30j-masse`, `prod-formule-30j-vitalite`, `prod-1788252897607`, `prod-1788252928280`, `prod-test-indisponible`, `prod-1788693673602` | `prod-poulet-bowl`, `prod-poulet-grille`, `prod-boeuf-grillade`, `prod-quinoa-green-bowl`, `prod-salade-fraicheur`, `prod-jus-detox-vert`, `prod-jus-orange-carotte` |
| **Commandes reçues (54)** | **2 lignes**, et sur des identifiants **qui n'existent plus** | **54 lignes** |

> **Fait décisif :** les **7 produits réellement vendus** sont exactement ceux du **groupe B**,
> c'est-à-dire ceux qui n'ont **ni `createdAt`, ni `updatedAt`, ni `order`**.
> Les 16 produits du groupe A **n'ont jamais été commandés** dans l'instantané.
> ⇒ Toute colonne dérivée de `createdAt` / `order` sera **`NULL` pour 100 % du chiffre d'affaires
> historique observé**.

### Drapeaux de disponibilité — 🟢 mesure exacte

| Combinaison `(available, isAvailable)` | Nombre |
|---|---|
| `(true, true)` | **15** |
| `(<absent>, true)` | **7** |
| `(false, false)` | **1** (`prod-test-indisponible`) |

- **0 divergence** entre `available` et `isAvailable` là où les deux existent.
- **`active` = `true` sur 23/23** ⇒ **`active` ne discrimine rien**.
- ⇒ `available` est une **copie redondante partielle** de `isAvailable`.

**Quel champ lit le code ?** 🟢 `server/db.ts:527-533` : `activeOnly` filtre sur `p.active`,
`availableOnly` filtre sur `p.isAvailable`. **`p.available` n'est lu nulle part dans
`server/db.ts` ni `server.ts`.** ⇒ **`isAvailable` est le champ authoritative ; `available` est
mort.**

⚠️ Mais **`isAvailable` ne suffit pas à rendre un produit commandable** : la disponibilité réelle
est calculée à la commande par la vérification de stock (`server/db.ts:1317-1330`). Voir §3.6.

### `order` / `sortOrder` — 🟢 identiques partout où les deux existent

Valeurs réelles : `3, 4, 3, 4, 1, 2, 3, 3, 4, 1, 2, 3, 20, 21, 22, 23`.
**Doublons : `3` ×3, `4` ×3, `1` ×2, `2` ×2.** Et **7 produits n'en ont aucun**.
⇒ **`order` n'est pas un ordre total.** `sortOrder` est une copie exacte, à abandonner.

---

## 3.2 Fiche T-12 · `bebba_products`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_products` |
| **2** | **Rôle métier** | Article vendable : nom, prix de base, catégorie, disponibilité, recette et droits de personnalisation |
| **3** | **Source exacte** | `Firestore:products` (23 documents). Champs écrits par `CODE:server/db.ts:576-610` (`saveProduct`). ⚠️ `saveProduct` fait un **`setDoc` plein document sans merge** ⇒ tout champ non renvoyé par le formulaire **est perdu** (c'est le mécanisme qui explique la disparition de `createdAt` sur les produits du groupe B… **et inversement** : le groupe A a des champs que le groupe B n'a pas) |
| **7** | **PK** | `id` surrogate — 🟢 justifié : `saveProduct` génère `'prod-' + Date.now()` (`server/db.ts:582`), et **2 produits réels** ont des identifiants à 31 secondes d'écart avec le **même contenu** (§3.8) |
| **8** | **FK** | `category_id` → T-26 |
| **9** | **UNIQUE** | ⚠️ **AUCUNE contrainte UNIQUE sur `name`** — 🟢 **2 produits réels portent exactement le même nom** (« Wrap Fitness Poulet Avocat »). ⚠️ **AUCUNE sur `slug`** — le champ **n'existe pas** dans les produits. `legacy_product_id` UNIQUE ⚪ **après vérification** |
| **10** | **Index** | `(category_id, position)` — sert `getProducts({categoryId})` (`server/db.ts:530-532`) ; `(is_available, active)` — sert `availableOnly` (`server/db.ts:533`) ; `is_popular` — sert l'affichage tête de gondole ; `name` (index simple, **pas UNIQUE**) pour la recherche |
| **11** | **Historique ou vivante** | **100 % VIVANTE** — c'est le catalogue. **Aucune commande ne dépend de son contenu actuel** grâce aux instantanés (Partie 9) |
| **12** | **Conservation** | 🔴 **D-29 : faut-il versionner la recette ?** Le code actuel **ne versionne rien** : `saveProduct` écrase. Les commandes anciennes sont protégées **uniquement** parce que `preparationSheet` est figé (T-09) et que `updateOrderStatus` recalcule depuis ce figé (`server/db.ts:1546-1560`). **Ce mécanisme suffit** ⇒ une table d'historique de recette n'est **pas nécessaire** pour préserver l'existant. Elle le devient si le métier veut savoir « quel était le prix le 3 septembre » (**D-29**) |
| **13** | **Règle de migration** | (a) **`available` et `sortOrder` sont ABANDONNÉS** 🟢 — démontré morts (§3.1). (b) `is_available` ← `isAvailable` ; **si absent, `true`** (7 produits du groupe B n'ont ni l'un ni l'autre… en réalité ils ont `isAvailable` : seuls `available` manque). (c) `active` ← `active` ; **si absent, `true`** — ⚠️ jamais observé absent sur les produits, mais `saveProduct` ne le valorise pas par défaut contrairement à `saveIngredient` (`server/db.ts:365`). (d) `position` ← `order` ; **`NULL` si absent** (7 produits) — 🔴 **D-30 : quel ordre d'affichage pour ces 7 ?** (e) `image_url` ← `imageUrl` ; **ignorer `image`** (doublon, vide sur 1 produit). (f) nutriments ← tels quels, **`NULL` si absents** (1 produit). (g) **dédoublonnage préalable obligatoire** — 🔴 **D-11** |
| **14** | **Anomalies** | **AN-56** produit dupliqué à l'identique · **AN-57** `available`/`isAvailable` redondants · **AN-58** `order`/`sortOrder` redondants et non uniques · **AN-59** `image`/`imageUrl` redondants · **AN-60** 7 produits sans `createdAt` · **AN-61** `prod-test-indisponible` sans recette · **AN-62** recette référençant des ingrédients inexistants · **AN-63** `active` ne discrimine rien (23/23 à `true`) · **AN-64** `slug` inexistant sur les produits alors qu'il existe sur les catégories |
| **15** | **Traitement** | AN-56 → 🔴 **D-11** (fusion ou quarantaine). AN-57/58/59 → **abandon du champ mort**, 🟢 justifié par l'absence de lecture dans le code. AN-60 → `created_at NULL`, ne **pas** mettre la date de migration. AN-61 → **quarantaine** + `is_available=false`. AN-62 → 🔴 **D-11** + quarantaine. AN-63 → **conserver la colonne** (le code la filtre, `server/db.ts:531`) mais documenter qu'elle est aujourd'hui sans effet. AN-64 → **ne pas créer de `slug`** : 🔴 **D-31** si un slug devient nécessaire pour WordPress |
| **16** | **Certitude** | **Structure 🟢** (census exhaustif) — **`available`/`sortOrder` morts 🟢 démontré** — **dédoublonnage 🔴** — **`position` 🔴** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_product_id` | chaîne ≤ 64 | OUI | `Firestore:products.id` | ⚪ |
| `name` | chaîne ≤ 191 | NON | `products.name` — **23/23**, max réel 41 caractères | 🟢 |
| `description` | texte | OUI | `products.description` — 23/23 | 🟢 |
| `category_id` | entier non signé | NON | `products.categoryId` — 23/23 | 🟢 |
| `legacy_category_id` | chaîne ≤ 64 | OUI | idem, brut — indispensable tant que D-11 n'est pas tranché | ⚪ |
| `base_price` | décimal(10,3) | NON | `products.basePrice` — **23/23** ; plage réelle **10 à 440 DT** | 🟢 |
| `image_url` | chaîne ≤ 500 | OUI | `products.imageUrl` — 23/23 | 🟢 |
| `active` | booléen | NON, défaut vrai | `products.active` — 23/23 à `true` | 🟢 |
| `is_available` | booléen | NON, défaut vrai | `products.isAvailable` — 23/23 (`false` ×1) | 🟢 |
| `is_popular` | booléen | NON, défaut faux | `products.isPopular` — 23/23 | 🟢 |
| `position` | entier court | **OUI** | `products.order` — **16/23** | 🟢 |
| `calories` | entier court non signé | OUI | `products.calories` — **22/23** | 🟢 |
| `protein_grams` | décimal(6,2) | OUI | `products.proteinGrams` — 22/23 | 🟢 |
| `carbs_grams` | décimal(6,2) | OUI | `products.carbsGrams` — 22/23 | 🟢 |
| `fat_grams` | décimal(6,2) | OUI | `products.fatGrams` — 22/23 | 🟢 |
| `has_inactive_ingredient` | booléen | NON, défaut faux | **champ calculé**, `CODE:server/db.ts:521-526` — **jamais stocké dans Firestore** | 🟢 `[PROPOSÉ]` : à **recalculer**, pas à migrer |
| `created_at` / `updated_at` | date+heure ms UTC | **OUI** | `products.createdAt` / `updatedAt` — **16/23** | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` — `prod-test-indisponible` | 🟡 |

**Champs ABANDONNÉS à l'import, avec justification :**

| Champ Firestore | Présence | Justification de l'abandon 🟢 |
|---|---|---|
| `available` | 16/23 | **jamais lu** par `server/db.ts` ni `server.ts` ; `availableOnly` filtre sur `isAvailable` (`server/db.ts:533`) ; **0 divergence** avec `isAvailable` |
| `sortOrder` | 16/23 | **égal à `order` sur 16/16** |
| `image` | 4/23 | doublon de `imageUrl` (présent 23/23) ; **vide sur `prod-test-indisponible`** |

---

## 3.3 Fiche T-13 · `bebba_product_ingredients` (recette de base)

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_product_ingredients` |
| **2** | **Rôle métier** | Recette : quels ingrédients, en quelle quantité, pour **une unité** de produit |
| **3** | **Source exacte** | `Firestore:products.baseIngredients[]` — **64 entrées** sur 23 produits. Champs : **`ingredientId`, `ingredientName`, `quantity`, `unit` — exactement 4, présents 64/64 chacun**. Consommés par `CODE:server/db.ts:923-935` (étape 1 de `computePreparationSheet`) et `:1296-1313` (calcul du besoin) |
| **7** | **PK** | `(product_id, position)` |
| **8** | **FK** | `product_id` → T-12 ; `ingredient_id` → T-19 ; `unit_code` → T-21 |
| **9** | **UNIQUE** | `(product_id, ingredient_id)` — 🟢 **justifié** : `computePreparationSheet` écrit dans une `Map` indexée par `ingredientId` (`server/db.ts:930`), donc **une seconde entrée du même ingrédient écraserait silencieusement la première**. ⚠️ **Contrainte à poser seulement APRÈS résolution de AN-62** (les 2 produits « Wrap Fitness » ont `ing-1` et `ing-4`, non résolubles ⇒ `ingredient_id NULL`, et `NULL` n'est pas contraint par UNIQUE en MySQL) |
| **10** | **Index** | `ingredient_id` — 🟢 sert `isIngredientInUse` (`server/db.ts:290-292`) et `deleteIngredient` (`:339-353`) ; `(product_id, position)` (PK) |
| **11** | **Historique ou vivante** | **100 % VIVANTE** |
| **12** | **Conservation** | Écrasement complet à chaque `saveProduct` (`setDoc` plein document, `server/db.ts:606`). **Les commandes historiques n'en dépendent pas** (T-09). 🔴 D-29 pour le versionnage |
| **13** | **Règle de migration** | (a) `position` = **index du tableau** — 🟢 **seul ordonnancement disponible** : le champ `order` **n'existe pas** dans `baseIngredients[]` (mesuré : **0/64**). (b) `ingredient_id` = résolution de `ingredientId` ; **`NULL` si orphelin** + `legacy_ingredient_id`. (c) `ingredient_name_snapshot` = `ingredientName` — 🟢 **0 divergence** avec `ingredients.name` sur les 60 références résolubles. (d) `unit_code` = `unit` — 🟢 **0 divergence** avec `ingredients.unit`. (e) `quantity` tel quel |
| **14** | **Anomalies** | **AN-62** 4 références orphelines (`ing-1` ×2, `ing-4` ×2) · **AN-65** aucun champ d'ordre dans la recette · **AN-66** `ingredientName` et `unit` sont des copies dénormalisées · **AN-67** `prod-test-indisponible` a une recette vide |
| **15** | **Traitement** | AN-62 → voir §3.7 (cause racine identifiée). AN-65 → `position` = index ; ⚠️ **l'ordre d'affichage de la fiche cuisine en dépend** (`KitchenView.tsx:330-372`) mais **l'ordre de consommation n'en dépend pas** (`requiredStockMap` est une `Map`, `server/db.ts:1296`). AN-66 → **conserver la copie** : elle est à 0 divergence aujourd'hui, mais c'est **elle** qui alimente `preparationSheet` (`server/db.ts:931-934` utilise `base.ingredientName`, pas `baseIng.name`) ⇒ **renommer un ingrédient ne change pas la recette affichée**. À documenter, pas à « corriger ». AN-67 → quarantaine |
| **16** | **Certitude** | **🟢 structure, sémantique et cohérence entièrement démontrées** — AN-62 🔴 |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `product_id` | entier non signé | NON | parent | 🟢 |
| `position` | entier court | NON | index du tableau | 🟢 |
| `ingredient_id` | entier non signé | **OUI** | `baseIngredients[].ingredientId` | 🟢 |
| `legacy_ingredient_id` | chaîne ≤ 64 | OUI | idem, brut | ⚪ |
| `ingredient_name_snapshot` | chaîne ≤ 191 | NON | `baseIngredients[].ingredientName` — **64/64** | 🟢 |
| `quantity` | décimal(12,3) | NON | `baseIngredients[].quantity` — plage réelle **1 à 500** | 🟢 |
| `unit_code` | chaîne courte | OUI | `baseIngredients[].unit` — `g` ×44, `ml` ×16, `portion` ×3, `piece` ×1 | 🟢 |

⚠️ **C'est une quantité PAR UNITÉ DE PRODUIT**, jamais par commande. La multiplication par
`items[].quantity` se fait **ailleurs** (`server/db.ts:1298`). Toute confusion ici fausse le stock
d'un facteur égal à la quantité commandée.

---

## 3.4 Fiches T-14 à T-16 · groupes et options de personnalisation

### T-14 · `bebba_product_supplements` (suppléments autorisés)

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_product_supplements` |
| **2** | **Rôle métier** | Liste blanche des suppléments commandables sur un produit |
| **3** | **Source exacte** | `Firestore:products.customization.allowedSupplementIds[]` — **62 références**, **12 distinctes**, présentes sur **23/23** produits. Filtrées par `CODE:server/db.ts:1000-1010` |
| **7** | **PK** | `(product_id, supplement_id)` |
| **8** | **FK** | `product_id` → T-12 ; `supplement_id` → T-18 |
| **9** | **UNIQUE** | la PK |
| **10** | **Index** | `supplement_id` |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | écrasée par `saveProduct` |
| **13** | **Migration** | ⚠️ **4 références sur 62 ne sont PAS des identifiants de supplément** — voir §3.5. Règle : résoudre contre `supplements` ; **si échec, NE PAS tenter de résoudre contre `suppliers`** ; mettre en **quarantaine** avec le motif `supplement_ref_is_supplier_id` |
| **14** | **Anomalies** | **AN-68** confusion de type `sup-` (voir §3.5) |
| **15** | **Traitement** | 🔴 **D-32** : supprimer ces 4 lignes (le produit devient sans supplément autorisé) ou les remplacer par les vrais suppléments « Guacamole ». **Aucune des deux options n'est déductible des données** |
| **16** | **Certitude** | **🟢 structure** — **🔴 4 lignes** |

**Colonnes :** `product_id`, `supplement_id`, `legacy_supplement_id` (⚪), `position`.

### T-15 · `bebba_product_option_groups`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_product_option_groups` |
| **2** | **Rôle métier** | Axe de personnalisation d'un produit (protéine / légumes / base) et son droit d'activation |
| **3** | **Source exacte** | `Firestore:products.customization` : `allowsProteinChoice` + `proteinOptions` (**11/23**), `allowsVeggiesChoice` + `veggiesOptions` (**10/23**), `allowsBaseChoice` + `baseChoices` (**12/23**). Consommés par `CODE:server/db.ts:865-921` (résolution de l'option officielle) |
| **7** | **PK** | `(product_id, group_kind)` |
| **8** | **FK** | `product_id` → T-12 |
| **9** | **UNIQUE** | la PK |
| **10** | **Index** | `product_id` |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | écrasée par `saveProduct` |
| **13** | **Migration** | 3 lignes **au maximum** par produit, créées **seulement si** le tableau correspondant existe. `is_enabled` ← `allowsXChoice`. `is_required` = **`false` partout** — 🟢 **le concept n'existe pas** dans les données ni dans le code : `server/db.ts:865-868` traite l'absence d'option comme normale |
| **14** | **Anomalies** | **AN-69** les booléens `allowsXChoice` sont **parfaitement redondants** avec la présence du tableau : 🟢 mesuré, **0 incohérence sur 23 produits** (aucun cas « booléen vrai et liste vide » ni « booléen faux et liste non vide ») |
| **15** | **Traitement** | AN-69 → **conserver `is_enabled`** malgré la redondance : c'est le seul endroit où le métier peut désactiver un axe **sans supprimer les options** (et donc sans perdre les prix). Documenter la redondance |
| **16** | **Certitude** | **🟢 démontré** |

**Colonnes :** `product_id`, `group_kind` (énuméré : `protein`, `vegetables`, `base`),
`is_enabled` (booléen), `is_required` (booléen, défaut faux — 🟢 concept inexistant aujourd'hui),
`position` (entier court), `label` (chaîne ≤ 191, NULL — `[PROPOSÉ]` : aucun libellé d'axe n'existe
dans les données, l'interface les écrit en dur).

### T-16 · `bebba_product_options`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_product_options` |
| **2** | **Rôle métier** | Une option choisissable : libellé affiché, supplément de prix, supplément de quantité |
| **3** | **Source exacte** | `Firestore:products.customization.proteinOptions[]` (**27 entrées**, champs `label`/`extraPrice`/`extraGrams` **27/27**), `.veggiesOptions[]` (**19 entrées**, 3 champs **19/19**), `.baseChoices[]` (**34 entrées**, `label`/`extraPrice` **34/34**, **`extraGrams` 6/34 seulement**) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `product_id` → T-12 ; `option_group_kind` → T-15 (par `(product_id, group_kind)`) |
| **9** | **UNIQUE** | `(product_id, group_kind, label)` — 🟢 **justifié** : la résolution d'une option se fait **par libellé** (`server/db.ts:869-873`, `:890-894`, `:910-914`), donc **deux options de même libellé dans le même axe rendraient la résolution ambiguë**. ⚠️ **À ne poser qu'après vérification** : je n'ai **pas** observé de doublon intra-produit, mais `saveProduct` ne le contrôle pas |
| **10** | **Index** | `(product_id, group_kind, position)` ; `label` — sert la résolution |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | écrasée par `saveProduct`. Les commandes historiques n'en dépendent pas (T-05 porte les instantanés) |
| **13** | **Migration** | (a) 3 tableaux → **1 table** avec `group_kind`. (b) `extra_grams` ← `extraGrams`, **`NULL` si le champ est absent** (28/34 `baseChoices`) — ⚠️ **ne pas mettre 0** : `NULL` et `0` n'ont pas le même sens (`server/db.ts:937` teste `> 0`, donc les deux se comportent pareil **aujourd'hui**, mais `NULL` préserve l'information « champ non prévu pour cet axe »). (c) `position` = index du tableau. (d) `effect_kind` = **`NULL` à l'import** — voir T-17 |
| **14** | **Anomalies** | voir §3.6 — **AN-70** à **AN-77** |
| **15** | **Traitement** | voir §3.6 |
| **16** | **Certitude** | **🟢 structure et census exhaustifs** — **🔴 sémantique d'effet** (T-17) |

### Census réel des options — 🟢

| Axe | entrées | libellés distincts | libellés portés par plusieurs produits |
|---|---|---|---|
| `proteinOptions` | 27 | **25** | `'Poulet 120g (Standard)'`, `'Double Poulet 180g (+60g)'` |
| `veggiesOptions` | 19 | **15** | `'Légumes supplémentaires (+100g)'`, `'Double portion légumes (+180g)'`, `'Mélange Jeunes Pousses & Concombre'` |
| `baseChoices` | 34 | **19** | `'Riz Basmati complet'`, `'Patates douces rôties'`, `'Quinoa royal (+1.5 DT)'`, `'Quinoa royal'`, `'Galette de Blé Complet'`, `'Galette Sans Gluten au Maïs'` |

**🔴 AN-70 — Même libellé, prix différents.** `'Double portion légumes (+180g)'` est vendu
**2.5 DT** sur un produit et **3 DT** sur un autre. ⇒ **Le libellé n'est PAS une clé métier.**
C'est pourquoi T-05 conserve les **instantanés de prix** et pourquoi la résolution par libellé
(`§2.3` règle 13c) n'est qu'un **enrichissement analytique**, jamais une source de vérité.

**Colonnes :** `id`, `product_id`, `group_kind`, `position`, `label` (chaîne ≤ 191, NON NULL),
`extra_price` (décimal(10,3), NON NULL défaut 0), `extra_quantity` (décimal(12,3), **NULL**),
`unit_code` (chaîne courte, **NULL** — 🟢 le champ n'existe pas dans les options ; l'unité est
**implicite** et forcée à `'g'` par le code, `server/db.ts:972, 983`), `effect_kind` (voir T-17).

---

## 3.5 AN-68 · Collision de préfixe `sup-` — 🔴 cause racine identifiée

### Le fait

| Identifiant | Ce qu'il désigne réellement | Où il est utilisé à tort |
|---|---|---|
| `sup-1` | **`suppliers[0].id`** = « Ferme Bio de Mornag » (`server/seedData.ts:80`) | `products[prod-1788252897607].customization.allowedSupplementIds[0]` |
| `sup-3` | **`suppliers[2].id`** = « Moulins & Grains Sélection » (`server/seedData.ts:96`) | `products[prod-1788252897607].customization.allowedSupplementIds[1]` |
| idem | idem | `products[prod-1788252928280].customization.allowedSupplementIds[0..1]` |

Mesure exhaustive sur `db.json` :

| Valeur | Emplacements réels |
|---|---|
| `sup-1` | `suppliers.id` ×1 · `ingredients.supplierId` **×11** · **`products.customization.allowedSupplementIds[]` ×2** |
| `sup-2` | `suppliers.id` ×1 · `ingredients.supplierId` ×3 |
| `sup-3` | `suppliers.id` ×1 · `ingredients.supplierId` ×3 · **`products.customization.allowedSupplementIds[]` ×2** |

### Pourquoi c'est grave

1. **Le préfixe `sup-` désigne DEUX entités différentes** : `suppliers` (`sup-1`, `sup-2`, `sup-3`,
   généré par `'sup-' + Date.now()` dans `server/db.ts:250`) **et** `supplements`
   (`sup-poulet-extra`, …, **mais aussi** `sup-1788252897609`, généré par le même motif
   `'sup-' + Date.now()` dans `server/db.ts:474`).
2. **Une référence à un fournisseur est donc syntaxiquement indiscernable d'une référence à un
   supplément.** Les 4 lignes fautives **ressemblent** à des identifiants de supplément valides.
3. **Aucun contrôle ne l'empêche** : `saveProduct` (`server/db.ts:576-610`) écrit
   `allowedSupplementIds` **sans aucune validation** d'existence.
4. **Le risque de migration est actif** : un script « intelligent » qui, ne trouvant pas `sup-1`
   dans `supplements`, irait le chercher dans `suppliers` **créerait un lien produit↔fournisseur
   parfaitement faux** — et **silencieux**.

### Traitement

| Action | Décision |
|---|---|
| Migration | **résoudre uniquement contre `supplements`** ; en cas d'échec → **quarantaine**, `legacy_supplement_id` conservé, **aucune résolution de repli** |
| Schéma cible | 🟢 **préfixes disjoints obligatoires** : `bebba_suppliers` et `bebba_supplements` utilisent des PK **numériques distinctes**, ce qui **supprime structurellement** la collision. Les `legacy_*_id` restent dans des colonnes **séparées et typées** |
| Métier | 🔴 **D-32** : que devaient être ces 4 suppléments ? **Non déductible** |
| Prévention | `[PROPOSÉ]` interdire toute génération d'identifiant textuel partagé entre entités |

---

## 3.6 Effets réels des options sur la recette — 🟢 démontré ligne à ligne

`computePreparationSheet` (`server/db.ts:923-1098`) applique **exactement 4 étapes**, dans cet
ordre. Voici **ce que le code fait réellement**, distingué de ce que le libellé promet.

### Étape 1 — Ingrédients de base (`server/db.ts:923-935`)

```
pour chaque base de product.baseIngredients :
    si l'ingrédient existe ET active === false  ⇒  lever une erreur (produit non commandable)
    ingredientMap[base.ingredientId] = { name: base.ingredientName, quantity: base.quantity, unit: base.unit }
```
🟢 **Le nom et l'unité affichés viennent de la RECETTE, pas de la fiche ingrédient**
(`base.ingredientName`, `server/db.ts:932`). Et **un ingrédient inexistant ne déclenche aucune
erreur ici** : `baseIng` est `undefined`, la garde est sautée, et l'entrée est quand même créée
⇒ l'échec n'interviendra qu'à l'étape 5 (`server/db.ts:1301`, « Ingrédient requis #… introuvable
dans le stock »). **C'est le mécanisme exact qui rend les 2 « Wrap Fitness » non commandables.**

### Étape 2 — Extra protéine (`server/db.ts:937-952`)

```
si option protéine ET extraGrams > 0 :
    trouver la PREMIÈRE base dont l'IDENTIFIANT contient
        'poulet' | 'boeuf' | 'dinde' | 'saumon' | 'halloumi' | 'ing-1' | 'ing-2' | 'ing-3'
    si trouvée : quantity += extraGrams
    sinon : RIEN (silencieux)
```

### Étape 3 — Extra légumes (`server/db.ts:954-963`)

```
si option légumes ET extraGrams > 0 :
    trouver la PREMIÈRE base dont l'IDENTIFIANT contient 'legumes' | 'ing-4' | 'ing-5'
    si trouvée : quantity += extraGrams
    sinon : RIEN (silencieux)
```

### Étape 4 — Choix de base (`server/db.ts:965-995`) — **3 branches, sinon rien**

| Condition sur le **libellé** | Effet réel | Ligne |
|---|---|---|
| `label.includes('Quinoa')` | **supprime** `ing-riz` (ou `ing-6`), **ajoute** `ing-quinoa` **à la même quantité**, nom codé en dur `'Quinoa royal aux graines'`, unité forcée `'g'` | `:966-976` |
| `label.includes('Patates douces')` | idem vers `ing-patate-douce`, nom codé en dur `'Patates douces rôties au romarin'` | `:977-987` |
| `label.includes('100% Légumes')` | **supprime** `ing-riz` / `ing-6` / `ing-patate-douce` et **ajoute la quantité à `ing-legumes`** (ou `ing-5`) | `:988-995` |
| **tout autre libellé** | **AUCUN EFFET** — l'option est facturée, le stock ne bouge pas | — |

### 🟢 Vérification sur une commande réelle — `BEBBA-1047`

| Élément | Valeur réelle |
|---|---|
| Produit | `prod-poulet-bowl` « BEBBA Chicken Power Bowl », `basePrice = 14.5` |
| `proteinOption` | `'Portion sportive (+100g de poulet)'`, `extraPrice = 3`, `extraGrams = 100` |
| `veggiesOption` | `'Légumes supplémentaires (+100g)'`, `extraPrice = 1.8`, `extraGrams = 100` |
| `baseChoice` | `'Riz Basmati complet'`, `extraPrice = 0` — **aucune branche ne correspond** |
| Recette de base | `ing-poulet 200`, `ing-riz 150`, `ing-legumes 180`, `ing-avocat 80`, `ing-sauce-healthy 35` |
| **`totalIngredients` réel** | `ing-poulet` **300** ✅ (200+100) · `ing-riz` **150** ✅ (inchangé) · `ing-legumes` **280** ✅ (180+100) · `ing-avocat` **80** ✅ · `ing-sauce-healthy` **35** ✅ |
| `summaryLines` réel | `'🍗 Poulet mariné: 300g (Base 200g + Extra 100g)'`, `'🥦 Légumes de saison: 280g (Base 180g + Extra 100g)'`, `'🥣 Sauce signature BEBBA: 35ml (À PART)'` |
| Ledger | `ing-poulet −300` ✅, `ing-riz −150` ✅, **`ing-legumes` / `ing-avocat` / `ing-sauce-healthy` ABSENTS** ❌ (§2.11) |

**Les étapes 2 et 3 sont donc VALIDÉES PAR LES DONNÉES** : le calcul est exact.
⚠️ Mais les chaînes `'(Base 200g + Extra 100g)'` et `'(À PART)'` **n'existent nulle part dans le
code** (vérifié par recherche exhaustive) ⇒ **`summaryLines` est ici un texte issu des données de
démonstration, pas une sortie du moteur.** Cela confirme §2.8 : **`summaryLines` n'est pas
reproductible de façon uniforme.**

### AN-71 à AN-77 — les 7 échecs silencieux mesurés

| # | Anomalie | Cas réel | Effet |
|---|---|---|---|
| **AN-71** | **Option de substitution impossible à exprimer** | `prod-salade-fraicheur` → `'Option Végétarienne (Remplacer par Halloumi + Œuf)'`, `extraPrice = 1`, **`extraGrams = 0`** | 🔴 **l'unique option du catalogue avec prix > 0 et grammage = 0.** L'étape 2 est court-circuitée par `extraGrams > 0` (`server/db.ts:938`) ⇒ **le poulet n'est PAS retiré, le halloumi et l'œuf ne sont PAS ajoutés, 1 DT est facturé, rien ne change dans l'assiette ni dans le stock** |
| **AN-72** | **Option combinatoire impossible à exprimer** | `'Halloumi standard (100g) + 1 œuf'` | Le modèle « 1 option ⇒ 1 ingrédient ⇒ 1 quantité » ne peut pas exprimer **2 ingrédients** |
| **AN-73** | **Ciblage erroné par sous-chaîne** | `'Extra avocat & légumes (+100g)'` sur `prod-salade-fraicheur` | L'étape 3 cherche `'legumes'` ⇒ trouve `ing-legumes` **seulement** ; **`ing-avocat` ne reçoit rien** alors que le libellé le promet |
| **AN-74** | **Libellés de base non reconnus** | 5 sur 19 : `'Double légumes (sans féculents)'`, `'Galette de Blé Complet'` ×2, `'Galette Sans Gluten au Maïs'` ×2 | **Aucun effet.** `'Galette Sans Gluten au Maïs'` est facturée **+1.5 DT** sans rien changer |
| **AN-75** | **Libellés de protéine non reconnus** | 6 sur 25 : `'Portion normale (200g)'`, `'Portion normale (250g)'`, `'Portion normale (220g)'`, `'Portion standard (220g)'`, `'Brochette supplémentaire (+100g)'`, `'Double Portion 180g (+60g)'` | Les 5 « portion normale/standard » ont `extraGrams = 0` ⇒ **sans conséquence**. ⚠️ **`'Brochette supplémentaire (+100g)'`** et **`'Double Portion 180g (+60g)'`** ont un grammage > 0 : ils ne fonctionnent **que si** l'identifiant d'ingrédient de base contient un des 8 motifs de l'étape 2 |
| **AN-76** | **Libellés de légumes non reconnus** | 10 sur 15, dont `'Mélange Jeunes Pousses & Concombre'` ×2 | Idem : ne fonctionnent que si la base contient `'legumes'`, `'ing-4'` ou `'ing-5'` |
| **AN-77** | **Identifiants codés en dur pour un schéma disparu** | `'ing-1'`, `'ing-2'`, `'ing-3'` (`server/db.ts:945-947`), `'ing-4'`, `'ing-5'` (`:957`), `'ing-6'` (`:967, 978, 989`) | **Aucun ingrédient de ce schéma n'existe** dans les 19 ingrédients réels. ⚠️ Pire : `ingredientId.includes('ing-1')` est une **sous-chaîne**, donc elle correspondrait aussi à `ing-10`…`ing-19` ou à tout identifiant contenant `ing-1` ⇒ **ciblage imprévisible** |

---

## 3.7 AN-62 · Cause racine des ingrédients `ing-1` / `ing-4` — 🟢 identifiée

### Les faits

| Référence orpheline | Emplacements |
|---|---|
| `ing-1` | `products[prod-1788252897607].baseIngredients[0]` · `products[prod-1788252928280].baseIngredients[0]` |
| `ing-4` | `baseIngredients[1]` des 2 mêmes produits · **`supplements[sup-1788252897609].ingredientId`** · **`supplements[sup-1788252928282].ingredientId`** |

Les **19 ingrédients réels** ont tous des identifiants **sémantiques**
(`ing-poulet`, `ing-legumes`, …) ou **temporels** (`ing-1788825545393`,
`test-ing-kitchen-1788896746450`). **Aucun** n'est `ing-1`…`ing-6`.

### La preuve du schéma antérieur

**`server/db.ts:945-947, 957, 967, 978, 989` codent en dur `ing-1`…`ing-6`.** Ces lignes sont
**du code mort pour les 19 ingrédients actuels** — elles ne peuvent viser qu'un **jeu d'ingrédients
antérieur, numéroté `ing-1`, `ing-2`, …, `ing-6`**.

Et la correspondance est **exacte** :

| Identifiant codé en dur | Rôle dans le code | Ingrédient sémantique équivalent aujourd'hui |
|---|---|---|
| `ing-1`, `ing-2`, `ing-3` | protéines (`server/db.ts:945-947`) | `ing-poulet`, `ing-boeuf`, `ing-dinde`, `ing-saumon`, `ing-halloumi` |
| `ing-4`, `ing-5` | légumes (`:957`) | `ing-legumes` |
| `ing-6` | féculent de base à substituer (`:967, 978, 989`) | `ing-riz` |

**⇒ Les 2 produits « Wrap Fitness Poulet Avocat » et les 2 suppléments « Guacamole Maison Extra »
ont été créés contre l'ancien schéma `ing-N`, puis les ingrédients ont été ré-ensemencés avec des
identifiants sémantiques, ce qui a orpheliné ces 4 enregistrements.**

### Confirmation indépendante

Les 2 suppléments « Guacamole » portent **`ingredientName: 'Ingrédient'`** — **valeur de repli
générique**, alors que les 8 autres suppléments portent le **vrai nom** de leur ingrédient
(`'Filet de Poulet mariné aux herbes'`, etc.). ⇒ **Au moment de leur enregistrement, `ing-4`
était déjà introuvable** : l'interface a écrit le libellé de secours. Cela **date** la rupture
**avant** la création de ces suppléments, et exclut l'hypothèse d'une suppression ultérieure.

### Traitement

| Élément | Décision | Certitude |
|---|---|---|
| Les 2 produits « Wrap Fitness » | 🔴 **D-11** : **fusion** en un seul produit **ou quarantaine**. **La fusion est techniquement sûre** : 🟢 les deux documents sont **identiques champ par champ** sauf `id`, `categoryId`, `order`/`sortOrder` (20 vs 21), `createdAt`/`updatedAt` (31 s d'écart) — `baseIngredients` et `customization` sont **octet pour octet identiques** | 🟢 diff mesuré |
| Ré-écrire `ing-1` → `ing-poulet` et `ing-4` → `ing-legumes` | ❌ **INTERDIT sans décision métier.** La recette est « Galette complète, blanc de poulet 120 g, avocat frais » : `ing-1` (120 g) pourrait être `ing-poulet`, mais `ing-4` (40 g) est décrit comme de l'**avocat**, donc `ing-avocat` — **et non `ing-legumes`**, alors que le code associe `ing-4` aux légumes. **Le mapping n'est pas univoque** | 🔴 |
| Les 2 suppléments « Guacamole » | **quarantaine** : `ingredient_id NULL`, `ingredient_name_snapshot = 'Ingrédient'` conservé **tel quel** (c'est la preuve de l'anomalie) | 🟢 |
| Les identifiants codés en dur `ing-1`…`ing-6` | **ne pas migrer.** Le modèle cible (T-17) les **remplace** par des effets déclarés en données | 🟢 |

---

## 3.8 Fiche T-17 · `bebba_product_option_effects` — verdict motivé

### Question posée : cette table est-elle **vraiment** nécessaire ?

## 🟢 **OUI dans sa version minimale. 🔴 Le moteur générique complet est une décision métier.**

### Preuve 1 — Le code contient DÉJÀ trois sémantiques d'effet distinctes

| Sémantique | Où dans le code | Ce qu'elle fait |
|---|---|---|
| **AJOUTER** une quantité à un ingrédient existant | `server/db.ts:949-951`, `:960-962` | `existing.quantity += extraGrams` |
| **REMPLACER** un ingrédient par un autre, à quantité égale | `server/db.ts:966-987` | `ingredientMap.delete(riceBase)` puis `ingredientMap.set('ing-quinoa', …)` |
| **TRANSFÉRER** la quantité d'un ingrédient vers un autre | `server/db.ts:988-995` | supprime le féculent, `leg.quantity += qty` |

**Trois verbes, aucun champ pour les exprimer.** Aujourd'hui ils sont **codés en dur sur des
sous-chaînes d'identifiants et de libellés**. Une table d'effets ne fait que **donner un support
de données à une logique qui existe déjà**.

### Preuve 2 — Le ciblage actuel échoue silencieusement, et c'est mesuré

| Mécanisme de ciblage | Ligne | Échecs mesurés |
|---|---|---|
| `ingredientId.includes('poulet'\|'boeuf'\|'dinde'\|'saumon'\|'halloumi'\|'ing-1'\|'ing-2'\|'ing-3')` | `:939-947` | 6 libellés de protéine non reconnus (**AN-75**) |
| `ingredientId.includes('legumes'\|'ing-4'\|'ing-5')` | `:957` | 10 libellés de légumes non reconnus (**AN-76**) |
| `label.includes('Quinoa'\|'Patates douces'\|'100% Légumes')` | `:966, 977, 988` | 5 entrées de base non reconnues (**AN-74**) — **sur 34** ; les 19 restantes (`Quinoa` ×7, `Patates douces` ×8, `100% Légumes` ×4) **sont** reconnues |
| **Total** | | **21 entrées sur 80 sans effet garanti par le libellé** — **auxquelles s'ajoutent 3 cas où le libellé EST reconnu mais l'effet est FAUX ou NUL : AN-83, AN-84, AN-87** |

Et **aucun de ces échecs ne lève d'erreur** : les branches se terminent par `if (…)` sans `else`
(`:948, 958, 964`). **L'option est facturée, la recette n'est pas modifiée, personne n'est prévenu.**

### Preuve 3 — Une option réelle du catalogue est structurellement inexprimable

**AN-71** : `'Option Végétarienne (Remplacer par Halloumi + Œuf)'`, `extraPrice = 1`,
`extraGrams = 0`. C'est **la seule option du catalogue** dans ce cas (vérifié exhaustivement).
Elle demande **simultanément** : retirer le poulet, ajouter du halloumi, ajouter un œuf.
Le modèle actuel ne peut exprimer **aucun des trois**, et le `extraGrams = 0` **désactive** la seule
branche qui aurait pu agir.

### Preuve 4 — 59 libellés distincts nécessitent des DONNÉES, pas du code

`25 + 15 + 19 = 59` libellés distincts (mesuré, §3.4). Ajouter un produit avec de nouvelles
options exige aujourd'hui **soit** que ses identifiants d'ingrédients contiennent les bonnes
sous-chaînes, **soit** une modification de `server/db.ts`. **C'est le critère décisif** : la règle
métier est actuellement **dans le code**, donc **hors de portée de l'administrateur**.

### Périmètre recommandé — 🟡 version minimale

| Colonne | Type | Null ? | Rôle |
|---|---|---|---|
| `option_id` | entier non signé | NON | FK → T-16 |
| `position` | entier court | NON | un effet peut en suivre un autre (AN-72) |
| `effect_kind` | énuméré : `add_quantity`, `replace_ingredient`, `transfer_quantity`, `remove_ingredient` | NON | 🟢 **les 3 premiers existent déjà dans le code** ; `remove_ingredient` est **nécessaire** pour AN-71 |
| `target_ingredient_id` | entier non signé | NON | FK → T-19. **Remplace** `ingredientId.includes(...)` |
| `source_ingredient_id` | entier non signé | OUI | requis pour `replace_ingredient` et `transfer_quantity` |
| `quantity_source` | énuméré : `from_option_extra`, `from_source_ingredient`, `fixed` | NON | 🟢 distingue `extraGrams` (étape 2/3) de « même quantité que la base » (étape 4) |
| `fixed_quantity` | décimal(12,3) | OUI | requis si `quantity_source = 'fixed'` |
| `unit_code` | chaîne courte | OUI | 🟢 **met fin au forçage à `'g'`** (`server/db.ts:972, 983`) |

**PK** `(option_id, position)`. **FK** `ON DELETE CASCADE` vers T-16.

### Ce qui relève de la DÉCISION MÉTIER (🔴 **D-18**)

| Question | Pourquoi c'est bloquant |
|---|---|
| Faut-il un **moteur d'effets générique** (conditions, formules, effets en chaîne) ? | Changement d'architecture. **Non nécessaire** pour corriger AN-71 à AN-77 |
| Faut-il **réécrire les 21 options défaillantes** en effets déclarés ? | 🟢 **OUI pour AN-71, AN-73, AN-74** (prix facturé sans effet). 🟡 **Non pour AN-75/AN-76** dont les libellés « portion normale » ont `extraGrams = 0` : **leur absence d'effet est correcte** |
| Faut-il **renommer** les options fautives ? | `'Extra avocat & légumes (+100g)'` (AN-73) : corriger l'effet **ou** corriger le libellé — **les deux ne donnent pas le même produit** |
| Faut-il conserver les **noms codés en dur** `'Quinoa royal aux graines'` / `'Patates douces rôties au romarin'` (`server/db.ts:971, 982`) ? | Aujourd'hui, choisir `'Quinoa aux fines herbes'` produit une fiche cuisine libellée **`'Quinoa royal aux graines'`** ⇒ **erreur d'affichage réelle**. T-17 la corrige en pointant vers l'ingrédient |

### Peuplement à l'import — ⚪ MIGRATION UNIQUEMENT

**Aucun effet ne peut être déduit automatiquement des données** : les effets actuels sont **dans le
code**. Le peuplement de T-17 est donc un **travail de saisie**, productible **par catégorie** :

| Lot | Options concernées | Effet à saisir | Confiance |
|---|---|---|---|
| 1 | `'…Quinoa…'` — **7 entrées, 4 libellés distincts** | `replace_ingredient` : `ing-riz` → `ing-quinoa`, `quantity_source = from_source_ingredient` | 🟢 **déductible du code** (`:966-976`) — les 7 sont reconnues par `includes('Quinoa')` |
| 2 | `'…Patates douces…'` — **8 entrées, 3 libellés distincts** | `replace_ingredient` : `ing-riz` → `ing-patate-douce` | 🟢 **déductible** (`:977-987`) — les 8 sont reconnues |
| 3 | `'…100% Légumes…'` — **4 entrées** (`'Base 100% Légumes sans féculent'`, `'Mix 100% Légumes rôtis'`, `'Mix 100% Légumes sans féculent'`, `'Mix 100% Légumes'`) | `transfer_quantity` : `ing-riz`/`ing-patate-douce` → `ing-legumes` | 🟢 **déductible** (`:988-995`) — ⚠️ **mais 2 des 4 produits n'ont ni `ing-riz` ni `ing-patate-douce` dans leur recette, voir AN-87** |
| 4 | options protéine avec `extraGrams > 0` (**15 entrées**, mesuré) | `add_quantity` sur l'ingrédient protéique **de la recette du produit** — ⚠️ **dont 2 cas de ciblage faux, voir AN-83** | 🔴 **D-18** |
| 5 | options légumes avec `extraGrams > 0` (**9 entrées**, mesuré) | `add_quantity` sur `ing-legumes` — ⚠️ **dont 2 cas sans effet, voir AN-73 et AN-84** | 🔴 **D-18** |
| 6 | `'Option Végétarienne (Remplacer par Halloumi + Œuf)'` | `remove_ingredient(poulet)` + `add_quantity(halloumi)` + `add_quantity(œuf)` — **grammages inconnus** | 🔴 **D-18** : les quantités **n'existent nulle part** |
| 7 | `'Halloumi standard (100g) + 1 œuf'` | 2 effets : `add_quantity(halloumi, 100 g)` + `add_quantity(œuf, 1 pièce)` | 🟢 déductible du libellé, 🔴 à confirmer |
| 8 | 5 libellés de base non reconnus (AN-74) | **aucun effet aujourd'hui** | 🔴 **D-18** : faut-il leur en donner un ? |

⚠️ **Règle impérative : ne JAMAIS présumer qu'une option sans effet reconnu doit en recevoir un.**
Cela transformerait une **anomalie** en **règle métier** et **modifierait le coût matière** de
produits en vente.

---

## 3.9 Fiche T-18 · `bebba_supplements`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_supplements` |
| **2** | **Rôle métier** | Supplément vendable : prix, ingrédient consommé, quantité **unitaire** |
| **3** | **Source exacte** | `Firestore:supplements` (10 documents). Champs **10/10** : `id`, `name`, `description`, `price`, `ingredientId`, `ingredientName`, `quantityConsumed`, `unit`, `available`, `active`. Champs **2/10** : `quantity`, `isAvailable`, `order`, `sortOrder`, `createdAt`, `updatedAt` |
| **7** | **PK** | `id` surrogate — 🟢 `'sup-' + Date.now()` (`server/db.ts:474`), et **2 suppléments réels** portent le même nom |
| **8** | **FK** | `ingredient_id` → T-19 ; `unit_code` → T-21 |
| **9** | **UNIQUE** | ⚠️ **AUCUNE sur `name`** : 🟢 **`'Guacamole Maison Extra (+50g)'` existe 2 fois** (`sup-1788252897609`, `sup-1788252928282`). `legacy_supplement_id` UNIQUE ⚪ après vérification |
| **10** | **Index** | `(is_available, active)` ; `ingredient_id` — 🟢 sert `isIngredientInUse` (`server/db.ts:294-296`) ; `position` |
| **11** | **Historique ou vivante** | **VIVANTE** |
| **12** | **Conservation** | écrasement par `saveSupplement`. Les commandes historiques portent leurs propres instantanés (T-08) ⇒ **protégées** |
| **13** | **Migration** | (a) **`available` ABANDONNÉ** au profit de `is_available`… ⚠️ **ATTENTION, ici c'est l'inverse des produits** : `available` est présent **10/10** alors que `isAvailable` n'est présent que **2/10**. Règle : `is_available = COALESCE(isAvailable, available)`. (b) **`quantity` vs `quantityConsumed`** : `quantityConsumed` présent **10/10**, `quantity` seulement **2/10** ⇒ **conserver `quantityConsumed` comme `quantity_per_unit`**, ignorer `quantity`. (c) `order`/`sortOrder` → `position`, `NULL` si absents (8/10). (d) `ingredient_id` : **2 orphelins** (`ing-4`) → `NULL` + `legacy_ingredient_id`. (e) **dédoublonnage préalable** — 🔴 D-11 |
| **14** | **Anomalies** | **AN-78** supplément dupliqué · **AN-79** `ingredientId` orphelin + `ingredientName = 'Ingrédient'` · **AN-80** `quantity` / `quantityConsumed` : deux champs pour une notion · **AN-81** `available` / `isAvailable` : **deux champs, présences inversées par rapport aux produits** · **AN-82** `sup-halloumi-extra` **invendable en pratique** (besoin 80 g, stock réel 10 g) |
| **15** | **Traitement** | AN-78 → 🔴 D-11 (les 2 documents sont **identiques** : même `name`, `description`, `price`, `ingredientId`, `quantityConsumed`, `unit`). AN-79 → **quarantaine**, conserver `'Ingrédient'` tel quel (preuve datée, §3.7). AN-80/AN-81 → abandon du champ minoritaire, 🟢 justifié par la mesure de présence. AN-82 → **ne rien changer aux données** : c'est un **état de stock**, pas un défaut de schéma. Le signaler en exploitation |
| **16** | **Certitude** | **🟢 structure et census exhaustifs** — AN-78/79 🔴 |

### Les 10 suppléments réels

| `id` | `name` | `price` | `ingredientId` | `ingredientName` | `quantityConsumed` | `unit` |
|---|---|---|---|---|---|---|
| `sup-poulet-extra` | Portion supplémentaire de Poulet grillé (+150g) | **4.5** | `ing-poulet` | Filet de Poulet mariné aux herbes | 150 | g |
| `sup-boeuf-extra` | Portion supplémentaire de Bœuf grillé (+150g) | **6.5** | `ing-boeuf` | Bœuf maigre mariné façon BEBBA | **150** | g |
| `sup-legumes-extra` | Légumes croquants supplémentaires (+150g) | **2.5** | `ing-legumes` | Légumes croquants de saison | 150 | g |
| `sup-riz-extra` | Riz basmati complet supplémentaire (+150g) | **2.0** | `ing-riz` | Riz Basmati complet aux épices douces | 150 | g |
| `sup-avocat-extra` | Demi-avocat tranché (+80g) | **3.0** | `ing-avocat` | Avocat frais crémeux | 80 | g |
| `sup-oeuf-poche` | Œuf fermier poché bio (1 pièce) | **1.5** | `ing-oeuf` | Œufs fermiers bio pochés/durs | 1 | piece |
| `sup-halloumi-extra` | Halloumi grillé doré (+80g) | **3.5** | `ing-halloumi` | Fromage Halloumi grillé | 80 | g |
| `sup-sauce-extra` | Sauce signature BEBBA supplémentaire (+50ml) | **1.0** | `ing-sauce-healthy` | Sauce signature BEBBA (Herbes & Yaourt) | 50 | ml |
| `sup-1788252897609` | **Guacamole Maison Extra (+50g)** | **3.5** | **`ing-4` ❌** | **`'Ingrédient'`** | 50 | g |
| `sup-1788252928282` | **Guacamole Maison Extra (+50g)** | **3.5** | **`ing-4` ❌** | **`'Ingrédient'`** | 50 | g |

🟢 **Les 2 « Guacamole » sont identiques sur les 10 champs communs** (`name`, `description`
(46 caractères), `price`, `ingredientId`, `ingredientName`, `quantityConsumed`, `unit`,
`available`, `active`) — **seuls `id`, `createdAt`, `updatedAt`, `order`, `sortOrder`, `quantity`,
`isAvailable` diffèrent ou n'existent que sur eux**. Plage de prix réelle : **1 à 6.5 DT**.

⚠️ **`ingredientName` est cohérent avec `ingredients.name` sur 8/8 suppléments valides**
(0 divergence) ⇒ c'est une **copie dénormalisée fiable**, à conserver comme instantané.

⚠️ **Le piège `quantityConsumed`** (AN-40 / AN-80) :

| Emplacement | Champ | Sémantique | Preuve |
|---|---|---|---|
| `supplements.quantityConsumed` | unitaire | « 1 portion de ce supplément consomme 150 g » | 10/10 |
| `orders.items[].supplements[].quantityConsumed` | **total** | `supDef.quantityConsumed × quantity demandée` | `server/db.ts:1018` |

**Même nom, deux sens.** À l'import : `bebba_supplements.quantity_per_unit` **et**
`bebba_order_item_supplements.quantity_consumed_total`. **Ne jamais les confondre** : sur
`BEBBA-1099`, le supplément « Halloumi grillé doré (+80g) » commandé en quantité 1 donne
`quantityConsumed = 80` — identique aux deux lectures, donc **l'ambiguïté est invisible dans les
données actuelles** et n'apparaîtrait qu'à la première commande en quantité 2.

---

## 3.10 AN-83 à AN-88 · Ciblage faux ou nul — 🟢 démontré produit par produit

J'ai **simulé la recherche `.find()` de `server/db.ts:939-947` et `:957`** sur les **12 produits
ayant au moins un axe de personnalisation**, en appliquant littéralement les listes de
sous-chaînes du code à leur `baseIngredients` réel. Résultat :

| Produit | `baseIngredients` réel | Cible protéine trouvée | Cible légumes trouvée |
|---|---|---|---|
| `prod-poulet-bowl` | `ing-poulet`, `ing-riz`, `ing-legumes`, `ing-sauce-healthy` | `ing-poulet` ✅ | `ing-legumes` ✅ |
| `prod-poulet-grille` | `ing-poulet`, `ing-patate-douce`, `ing-legumes`, `ing-sauce-miel-moutarde` | `ing-poulet` ✅ | `ing-legumes` ✅ |
| `prod-boeuf-grillade` | `ing-boeuf`, `ing-patate-douce`, `ing-legumes`, `ing-sauce-healthy` | `ing-boeuf` ✅ | `ing-legumes` ✅ |
| **`prod-quinoa-green-bowl`** | `ing-quinoa`, **`ing-halloumi`**, `ing-avocat`, `ing-oeuf`, `ing-legumes`, `ing-sauce-healthy` | **`ing-halloumi`** ❌ | `ing-legumes` ✅ |
| `prod-salade-fraicheur` | `ing-legumes`, `ing-poulet`, `ing-avocat`, `ing-sauce-healthy` | `ing-poulet` ✅ | `ing-legumes` ⚠️ (AN-73) |
| `prod-saumon-zen-bowl` | `ing-saumon`, `ing-quinoa`, `ing-avocat`, `ing-legumes`, `ing-sauce-healthy` | `ing-saumon` ✅ | `ing-legumes` ✅ |
| `prod-bowl-vegetal-mediterraneen` | `ing-quinoa`, `ing-legumes`, `ing-avocat`, `ing-sauce-healthy` | **AUCUNE** | `ing-legumes` ✅ |
| `prod-mix-grill-fitness` | `ing-poulet`, `ing-boeuf`, `ing-riz`, `ing-legumes`, `ing-sauce-healthy` | `ing-poulet` ⚠️ (**AN-88**) | `ing-legumes` ✅ |
| `prod-brochettes-dinde` | `ing-dinde`, `ing-riz`, `ing-legumes`, `ing-sauce-miel-moutarde` | `ing-dinde` ✅ | `ing-legumes` ✅ |
| `prod-1788252897607` | **`ing-1`**, **`ing-4`** | `ing-1` ❌ (orphelin) | `ing-4` ❌ (orphelin) |
| `prod-1788252928280` | **`ing-1`**, **`ing-4`** | `ing-1` ❌ (orphelin) | `ing-4` ❌ (orphelin) |
| **`prod-1788693673602`** | `ing-poulet`, `ing-avocat` | `ing-poulet` ✅ | **AUCUNE** ❌ |

### 🔴 AN-83 — « Ajout Poulet grillé (+120g) » ajoute du **halloumi**

**Produit :** `prod-quinoa-green-bowl` — « Quinoa Superfood & Halloumi Bowl ».
**Option :** `'Ajout Poulet grillé (+120g)'`, `extraPrice = 3.5`, `extraGrams = 120`.
**Recette :** `ing-quinoa`, `ing-halloumi`, `ing-avocat`, `ing-oeuf`, `ing-legumes`,
`ing-sauce-healthy` — **il n'y a AUCUN poulet dans ce produit.**

**Mécanisme 🟢** : `server/db.ts:939-947` fait un `.find()` sur `baseIngredients` dans **l'ordre du
tableau**, en testant `'poulet' | 'boeuf' | 'dinde' | 'saumon' | 'halloumi' | 'ing-1' | 'ing-2' |
'ing-3'`. `ing-quinoa` ne correspond à rien ; **`ing-halloumi` correspond à `'halloumi'`** ⇒ c'est
lui qui est retenu. Puis `server/db.ts:950` : `existing.quantity += 120`.

**Conséquences, toutes démontrées :**

| Conséquence | Détail |
|---|---|
| **Le client paie 3.5 DT pour du poulet qu'il ne reçoit pas** | le halloumi passe de 80 g à 200 g |
| **La fiche cuisine est fausse** | `summaryLines` affichera le halloumi, jamais le poulet |
| **Le stock est imputé sur le mauvais ingrédient** | `ing-halloumi` −200 g au lieu de `ing-poulet` −120 g |
| **Le produit devient NON COMMANDABLE** | `ing-halloumi` a un **stock réel de 10 g** pour un seuil de **1 000 g** ; le besoin total est **80 g (base) + 120 g (extra) = 200 g** ⇒ `server/db.ts:1319-1321` rejette avec `missing = 190` |

**Cause racine :** l'option a été **rédigée pour un produit qui contient du poulet** et
**recopiée** sur un produit végétarien, sans que le moteur ne vérifie la cohérence libellé ↔ cible.

⚠️ **C'est le cas le plus grave du catalogue** : il combine **erreur de facturation**, **erreur de
production** et **blocage de vente**, et **aucun des trois n'est signalé** par le système.

### 🔴 AN-84 — « Extra Légumes Croquants (+60g) » ne fait rien

**Produit :** `prod-1788693673602`. **Recette :** `ing-poulet`, `ing-avocat` — **aucun légume.**
**Option :** `'Extra Légumes Croquants (+60g)'`, `extraPrice = 2.5`, `extraGrams = 60`.
**Mécanisme :** `server/db.ts:957` cherche `'legumes' | 'ing-4' | 'ing-5'` ⇒ **aucune
correspondance** ⇒ `veggiesBase` est `undefined` ⇒ le `if (veggiesBase)` de `:958` **n'est pas
exécuté**, **sans `else`, sans journal, sans erreur**.
**Conséquence :** **+2.5 DT facturés, 0 g ajoutés, 0 mouvement de stock.**

⚠️ Ce produit a **aussi** un choix de base `'Quinoa aux fines herbes'` à **+2 DT** : la branche
Quinoa (`server/db.ts:967`) cherche `ing-riz` ou `ing-6` — **absents** de la recette ⇒ **aucun
effet non plus**. Et même si l'effet avait lieu, le nom inscrit en dur serait
`'Quinoa royal aux graines'` (`server/db.ts:971`), **pas** « aux fines herbes ».
**Ce produit facture donc 4.5 DT d'options sans aucun effet.**

### 🔴 AN-87 — « 100 % Légumes » sans féculent à retirer

**Produits concernés :** `prod-saumon-zen-bowl` (`'Mix 100% Légumes sans féculent'`) et
`prod-bowl-vegetal-mediterraneen` (`'Mix 100% Légumes'`).
**Recettes :** `ing-saumon, ing-quinoa, ing-avocat, ing-legumes, ing-sauce-healthy` et
`ing-quinoa, ing-legumes, ing-avocat, ing-sauce-healthy`.
**Mécanisme :** `server/db.ts:989` cherche `ing-riz | ing-6 | ing-patate-douce` — **`ing-quinoa`
n'est pas dans la liste** ⇒ `riceBase` est `undefined` ⇒ **aucun effet**.
**Conséquence :** le client demande « sans féculent », **le quinoa reste dans la recette et dans la
fiche cuisine**, et le stock de quinoa est quand même consommé. `extraPrice = 0`, donc **pas
d'erreur de facturation** — mais **une erreur de production réelle**.

⚠️ **`ing-quinoa` est traité comme un féculent substituable dans 3 branches**
(`server/db.ts:967, 978` le **remplacent**) **mais pas dans la 4ᵉ** (`:989`, qui devrait le
**retirer**). **Asymétrie démontrée dans le code.**

### 🟡 AN-88 — L'ordre du tableau de recette décide silencieusement de la cible

**Produit :** `prod-mix-grill-fitness`. **Recette :** `ing-poulet`, **`ing-boeuf`**, `ing-riz`,
`ing-legumes`, `ing-sauce-healthy`. **Option :** `'Maxi Duo (+100g Poulet)'`.
`.find()` retourne **`ing-poulet`** — **correct ici**, mais **uniquement parce que `ing-poulet`
précède `ing-boeuf` dans le tableau**.

⚠️ **`baseIngredients[]` n'a aucun champ d'ordre** (mesuré : `order` présent sur **0/64**).
L'ordre est donc **celui du tableau JSON**, que `saveProduct` réécrit entièrement à chaque
enregistrement (`server/db.ts:606`, `setDoc` plein document).
**Un simple réordonnancement dans le formulaire d'administration changerait l'ingrédient ciblé par
toutes les options protéine de ce produit — sans aucun avertissement.**

🟢 **C'est l'argument décisif pour `position` dans T-13** : rendre l'ordre **explicite et
persistant** plutôt qu'implicite et fragile. Et pour `target_ingredient_id` dans T-17 : rendre la
cible **déclarée** plutôt que **devinée**.

### 🟡 **AN-89** — `prod-salade-fraicheur` : l'ordre de la recette est déjà incohérent

Recette réelle : **`ing-legumes`, `ing-poulet`**, `ing-avocat`, `ing-sauce-healthy`.
Les légumes **précèdent** la protéine — ordre inverse des 4 autres assiettes. La cible protéine
reste `ing-poulet` (les légumes ne correspondent à aucun motif protéique), donc **sans
conséquence aujourd'hui**. Mais cela montre que **l'ordre du tableau n'obéit à aucune convention**,
ce qui rend AN-88 d'autant plus probable.

### Récapitulatif — impact métier mesuré

| Anomalie | Produits | Options fautives | Argent facturé sans effet | Effet sur un mauvais ingrédient | Blocage de vente |
|---|---|---|---|---|---|
| **AN-83** | 1 | 1 | — | ✅ **120 g sur `ing-halloumi`** | ✅ **produit non commandable** |
| **AN-84** | 1 | 2 | **4.5 DT** | — | — |
| **AN-73** | 1 | 1 | partiel (2.5 DT pour « avocat & légumes », seul `ing-legumes` bouge) | ✅ **l'avocat promis n'est pas ajouté** | — |
| **AN-71** | 1 | 1 | **1 DT** | — | — |
| **AN-74** | 3 | 5 entrées | **3 DT** (`'Galette Sans Gluten au Maïs'` ×2 à 1.5) | — | — |
| **AN-87** | 2 | 2 | — (prix 0) | ✅ **le féculent reste** | — |
| **AN-88** | 1 | 1 | — | ⚠️ **latent** | — |

> **Conclusion pour T-17 :** ces 7 anomalies ne sont **pas** des imperfections cosmétiques. Elles
> touchent **la facturation, la production et la disponibilité**, sur **8 produits du catalogue
> sur 23**. **`bebba_product_option_effects` est nécessaire** : c'est le seul mécanisme qui
> permette de **déclarer la cible** au lieu de la **deviner par sous-chaîne**.

---
---

# PARTIE 4 — STOCK

## 4.1 🔴 Le fait qui conditionne toute la partie stock

### `currentStock` n'est PAS un solde comptable : c'est une constante codée en dur

`server/db.ts:1959-2211` contient **`resetDemoData()`**, exposée par
**`POST /api/reset-demo-data`** (`server.ts:1264-1273`, `requireRole('admin')`) et par un
**bouton permanent « Reset Démo » dans l'en-tête d'administration**
(`src/components/common/RoleSwitcher.tsx:146-160` pour mobile, `:238-249` pour bureau).

Cette fonction contient une table de **17 valeurs de stock codées en dur**
(**`OFFICIAL_INGREDIENTS_STOCK`, `server/db.ts:2070-2087`**) qu'elle écrit par
`setDoc(ingDoc, { currentStock: stockQty, … }, { merge: true })` (`server/db.ts:2098-2103`).

### Comparaison mesurée — 🟢 décisive

| Ingrédient | `server/seedData.ts` | **`db.json` (réel)** | `OFFICIAL_INGREDIENTS_STOCK` | db.json = ? |
|---|---|---|---|---|
| `ing-poulet` | 18 500 | **8 230** | **8 230** | ✅ constante |
| `ing-boeuf` | 9 200 | **8 340** | **8 340** | ✅ constante |
| `ing-riz` | 25 000 | **20 500** | **20 500** | ✅ constante |
| `ing-quinoa` | 7 800 | **7 200** | **7 200** | ✅ constante |
| `ing-patate-douce` | 12 000 | **9 540** | **9 540** | ✅ constante |
| `ing-legumes` | 21 000 | **12 690** | **12 690** | ✅ constante |
| `ing-avocat` | 3 500 | **3 060** | **3 060** | ✅ constante |
| `ing-halloumi` | 2 800 | **10** | **10** | ✅ constante |
| `ing-sauce-healthy` | 4 500 | **3 205** | **3 205** | ✅ constante |
| `ing-sauce-miel-moutarde` | 3 800 | **3 360** | **3 360** | ✅ constante |
| `ing-oeuf`, `ing-fruits-frais`, `ing-dinde`, `ing-saumon`, `ing-betterave`, `ing-eau-infusee`, `ing-repas-programme` | identiques | identiques | identiques | — |

**Résultat : `db.json` correspond à `OFFICIAL_INGREDIENTS_STOCK` sur 17/17 ingrédients, et
diffère de `seedData.ts` sur 9/17.**

### 🟢 Ce que cela démontre, sans ambiguïté

1. **`resetDemoData()` a réellement été exécuté** et **ses écritures ont abouti**.
2. **Ses suppressions n'ont PAS abouti** : les 54 commandes, les 173 mouvements, les 7 comptes et
   les 3 livreurs sont **tous présents**. La fonction elle-même le prévoit — son propre
   commentaire parle de « **TENTATIVES DE SUPPRESSION DÉFENSIVES** » (`server/db.ts:2107`) et elle
   retourne des compteurs `deletedCounts` initialisés à 0.
3. ⇒ **À la date de l'instantané, `firestore.rules` interdisait effectivement la suppression**
   (`allow delete: if false` sur les 11 collections, `firestore.rules:103, 111, 121, 173, 179,
   194, 210, 220, 229, 239, 248, 258, 272`) **tout en autorisant la mise à jour**.
4. ⇒ **`currentStock` est une valeur décrétée, pas une valeur calculée.**

### Conséquence directe sur la question du « stock d'ouverture »

| Question | Réponse 🟢 |
|---|---|
| Existe-t-il un mouvement d'ouverture ? | **NON.** Les 7 types déclarés (`src/types.ts:40-46`) sont `order_consumption`, `replenishment`, `inventory_correction`, `manual_out`, `manual_in`, `waste`, `order_cancellation_restore`. **Les 173 mouvements réels n'utilisent que 2 types** : `order_consumption` ×171, `manual_in` ×2. **`inventory_correction` : 0 occurrence.** |
| Le solde d'ouverture est-il dérivable ? | **NON.** `currentStock − Σ mouvements` donne des nombres (ex. `ing-poulet` : 8 230 − 4 430 = 3 800) mais **ils sont dépourvus de sens** : le `currentStock` a été **écrasé par une constante** qui **ignore le ledger**. |
| Peut-on rejouer le ledger pour reconstruire le stock ? | **NON** — voir §4.4 : **173/173 mouvements portent des notes que le code actuel ne peut pas produire**. |

> 🔴 **D-33 — DÉCISION BLOQUANTE.** La valeur à inscrire dans
> `bebba_ingredients.current_stock` à l'ouverture **ne peut pas être déduite des données**.
> Trois options, **aucune n'est automatique** :
> **(a)** reprendre les 17 constantes de `server/db.ts:2070-2087` — cohérent avec l'instantané,
> **mais ce sont des valeurs de démonstration** ;
> **(b)** faire un **inventaire physique réel** et saisir les valeurs — seul choix fiable ;
> **(c)** migrer les constantes **en les marquant explicitement** comme « à vérifier » et bloquer
> la mise en production tant que l'inventaire n'est pas fait.
> **Recommandation d'audit : (c) puis (b). Jamais (a) seul.**
> ⚠️ **Ce document ne propose AUCUNE valeur.** Il constate qu'aucune n'est démontrable.

---

## 4.2 Fiche T-19 · `bebba_ingredients`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_ingredients` |
| **2** | **Rôle métier** | Matière première : identité, unité, stock courant, seuil d'alerte, coût, famille, rattachement fournisseur |
| **3** | **Source exacte** | `Firestore:ingredients` (19 documents). Champs écrits par `CODE:server/db.ts:355-370` (`saveIngredient`) ; stock modifié **uniquement** par `CODE:server/db.ts:362-393` (`addStockMovement`, **en transaction**) et `:1383-1388` (`createOrder`, **en transaction**) et `:2098-2103` (`resetDemoData`, **hors transaction, `merge:true`**) |
| **7** | **PK** | `id` surrogate — 🟢 `'ing-' + Date.now()` (`server/db.ts:358`) ; **2 des 19 identifiants réels sont temporels** (`ing-1788825545393`, `test-ing-kitchen-1788896746450`) |
| **8** | **FK** | `unit_code` → T-21 ; `family_code` → T-22 ; `supplier_id` → T-23 |
| **9** | **UNIQUE** | `name` — 🟢 **posé** : **0 doublon** sur les 19 noms réels, et `saveIngredient` ne le contrôle pas ⇒ la contrainte **ajoute** une garantie absente aujourd'hui. `legacy_ingredient_id` UNIQUE ⚪ |
| **10** | **Index** | `(family_code)` ; `(is_active)` ; `(current_stock, min_threshold)` — 🟢 sert le compteur d'alerte `server/db.ts:1723` (`i.currentStock <= i.minThreshold`) ; `supplier_id` |
| **11** | **Historique ou vivante** | **MIXTE** : `current_stock` est **vivant** (et ⚠️ **dérivable du ledger dans la cible**, contrairement à aujourd'hui) ; tout le reste est référentiel vivant. **Les commandes historiques n'en dépendent pas** (T-09 porte les instantanés) |
| **12** | **Conservation** | 🟢 **suppression physique interdite si référencé** — **reproduit exactement `server/db.ts:339-353`**, qui refuse déjà la suppression si l'ingrédient est `active !== false` **ou** référencé par un produit, un supplément, une commande **ou** un mouvement. **C'est le meilleur garde-fou du projet : le conserver tel quel.** ⚠️ Conséquence mesurée : `test-ing-kitchen-1788896746450` a `active = false` **mais** 1 mouvement de stock ⇒ **`isIngredientInUse` renvoie `true`** ⇒ **il est déjà, aujourd'hui, supprimable en théorie et supprimable en pratique non** |
| **13** | **Règle de migration** | (a) `current_stock` ← 🔴 **D-33**, **pas de valeur automatique**. (b) `min_threshold` ← `minThreshold`, **`NULL` si absent** (1/19) — ⚠️ le code fait `i.minThreshold ?? 0` (`server/db.ts:1723`) et `AdminView.tsx:246` fait `?? 0` ⇒ **`NULL` se comporte comme 0 aujourd'hui**, mais `NULL` préserve l'information « seuil jamais défini ». (c) `unit_code` ← `unit`, **`NULL` si absent** (1/19). (d) `family_code` ← `category`, **`NULL` si absent** (1/19). (e) `purchase_cost` ← `purchaseCost`, **`NULL` si absent** (1/19). (f) `supplier_id` ← `supplierId` (17/19) — **relation unilatérale dans 9 cas, voir Partie 5**. (g) `supplier_free_text` ← `supplierName` — 🟢 **texte libre, pas un instantané de FK** : `ing-1788825545393` porte `supplierName = 'marché'` **sans aucun `supplierId`**, et « marché » n'est **pas** un fournisseur. (h) `is_active` ← `active`, **⚠️ présent sur 5/19 seulement** : règle **`COALESCE(active, true)`**. (i) `created_at` ← `createdAt`, **6/19 seulement**, `NULL` sinon |
| **14** | **Anomalies** | **AN-90** `currentStock` est une constante codée en dur · **AN-91** `currentStock = null` en données réelles · **AN-92** `active` absent sur 14/19 alors que `deleteIngredient` exige `active === false` · **AN-93** seuil critique réel : `ing-halloumi` **10 g** pour un seuil de **1 000 g** · **AN-94** `supplierName` texte libre non aligné · **AN-95** 2 ingrédients de test jamais utilisés · **AN-96** `purchaseCost` est un coût **unitaire** sans précision d'unité · **AN-97** 9 ingrédients n'ont **aucun** mouvement de stock |
| **15** | **Traitement** | AN-90 → 🔴 D-33. AN-91 → **`current_stock` NULL-able** 🟢 — **cas réel observé**, pas hypothétique ; ⚠️ le code fait `ing.currentStock + params.quantity` (`server/db.ts:372`) et **`null + 10 = 10` en JavaScript** ⇒ **le mouvement `manual_in +10` sur cet ingrédient a « fonctionné » par accident de coercion**. **Ce comportement ne doit PAS être reproduit** : en SQL, `NULL + 10 = NULL`. AN-92 → `COALESCE(active, true)` ; ⚠️ **documenter que 14 ingrédients ne pourront jamais être supprimés** tant que `is_active` vaut `true`. AN-93 → **ne rien changer aux données** : c'est un état d'exploitation. Le seuil `<=` (et non `<`) de `server/db.ts:1723` doit être **reproduit**. AN-94 → **2 colonnes distinctes** : `supplier_id` (FK) et `supplier_free_text` (texte). **Ne jamais fusionner.** AN-95 → `is_test_data = true`, 🔴 D-26 (purge ou conservation). AN-96 → `purchase_cost` en **décimal(12,6)** 🟢 : valeurs réelles **0.002 à 8.5**, donc 3 décimales **ne suffisent pas** (0.002 DT/ml). AN-97 → information, pas anomalie de schéma |
| **16** | **Certitude** | **Structure 🟢** (census exhaustif) — **`current_stock` 🔴** — **`is_active` 🟢 règle de repli démontrée** — **`supplier_*` 🟢** |

### Les 19 ingrédients réels — 🟢 valeurs mesurées

| `id` | `name` | `unit` | `currentStock` | `minThreshold` | `purchaseCost` | `category` | `supplierId` | `active` | `createdAt` | mvts |
|---|---|---|---|---|---|---|---|---|---|---|
| `ing-poulet` | Filet de Poulet mariné aux herbes | g | **8 230** | 4 000 | 0.016 | Protéines | `sup-2` | **true** | — | 42 |
| `ing-boeuf` | Bœuf maigre mariné façon BEBBA | g | **8 340** | 3 000 | 0.034 | Protéines | `sup-2` | **true** | — | 3 |
| `ing-riz` | Riz Basmati complet aux épices douces | g | **20 500** | 5 000 | 0.005 | Féculents | `sup-3` | — | — | 31 |
| `ing-quinoa` | Quinoa royal aux graines | g | **7 200** | 2 000 | 0.014 | Féculents | `sup-3` | — | — | 2 |
| `ing-patate-douce` | Patates douces rôties au romarin | g | **9 540** | 3 000 | 0.006 | Féculents | `sup-3` | — | — | 9 |
| `ing-legumes` | Légumes croquants de saison | g | **12 690** | 5 000 | 0.004 | Légumes | `sup-1` | — | — | 41 |
| `ing-avocat` | Avocat frais crémeux | g | **3 060** | 1 500 | 0.018 | Légumes & Fruits | `sup-1` | — | — | 3 |
| `ing-oeuf` | Œufs fermiers bio pochés/durs | **piece** | **65** | 20 | 0.45 | Protéines | `sup-1` | — | — | **0** |
| **`ing-halloumi`** | Fromage Halloumi grillé | g | **⚠️ 10** | **1 000** | 0.025 | Protéines & Fromages | `sup-1` | — | — | **0** |
| `ing-sauce-healthy` | Sauce signature BEBBA (Herbes & Yaourt) | ml | **3 205** | 1 000 | 0.008 | Sauces | `sup-1` | — | — | 35 |
| `ing-sauce-miel-moutarde` | Sauce Miel & Moutarde à l'ancienne | ml | **3 360** | 1 000 | 0.009 | Sauces | `sup-1` | — | — | 6 |
| `ing-fruits-frais` | Agrumes & Fruits frais pressés | ml | **12 000** | 3 000 | 0.005 | Boissons | `sup-1` | — | — | **0** |
| `ing-dinde` | Filet de Dinde fermière mariné | g | **12 000** | 3 000 | 0.015 | Protéines | `sup-2` | — | ✅ | **0** |
| `ing-saumon` | Pavé de Saumon frais Atlantique | g | **6 500** | 1 500 | 0.045 | Protéines | `sup-1` | — | ✅ | **0** |
| `ing-betterave` | Betterave rouge & Gingembre | ml | **5 000** | 1 000 | 0.007 | Boissons | `sup-1` | **true** | ✅ | **0** |
| `ing-eau-infusee` | Infusion Détox Concombre Menthe Citron | ml | **8 000** | 2 000 | 0.002 | Boissons | `sup-1` | — | ✅ | **0** |
| `ing-repas-programme` | Pack Repas Nutritionnel Équilibré BEBBA | **portion** | **45** | 10 | **8.5** | Programmes | `sup-1` | — | ✅ | **0** |
| `ing-1788825545393` | **ingrédient test** | g | 1 000 | 200 | 0.015 | Protéines | — *(mais `supplierName='marché'`)* | **true** | ✅ | **0** |
| `test-ing-kitchen-1788896746450` | **Test Ingrédient Cuisine Modifié** | **absent** | **`null`** | **absent** | **absent** | **absent** | — | **`false`** | — | **1** |

**Seul `ing-halloumi` est sous son seuil** (10 ≤ 1 000). ⚠️ **Correction d'une affirmation de V0** :
`ing-oeuf` (65) est **au-dessus** de son seuil (20) — il n'est **pas** critique.

**Valorisation** (`Σ currentStock × purchaseCost`, 🟢 calculée avec le `?? 0` de
`AdminView.tsx:994`) : **1 848.00 DT** — dont 1 269.37 DT en grammes, 382.50 DT en portions,
166.88 DT en millilitres, 29.25 DT en pièces.

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_ingredient_id` | chaîne ≤ 64 | OUI | `Firestore:ingredients.id` | ⚪ |
| `name` | chaîne ≤ 191 | NON | `ingredients.name` — 19/19, max réel 45 | 🟢 |
| `unit_code` | chaîne courte | **OUI** | `ingredients.unit` — 18/19 | 🟢 |
| `family_code` | chaîne courte | **OUI** | `ingredients.category` — 18/19, **9 valeurs distinctes** | 🟢 |
| `current_stock` | décimal(12,3) | **OUI** | `ingredients.currentStock` — 🔴 **D-33** | 🔴 |
| `min_threshold` | décimal(12,3) | **OUI** | `ingredients.minThreshold` — 18/19 | 🟢 |
| `purchase_cost` | **décimal(12,6)** | **OUI** | `ingredients.purchaseCost` — 18/19 ; 🟢 **6 décimales nécessaires** : valeur réelle minimale **0.002** | 🟢 |
| `supplier_id` | entier non signé | **OUI** | `ingredients.supplierId` — **17/19** | 🟢 |
| `supplier_free_text` | chaîne ≤ 191 | **OUI** | `ingredients.supplierName` — **18/19** ; 🟢 **texte libre** (`IngredientModal.tsx:259-260` est un `<input>`, pas un `<select>`) | 🟢 |
| `is_active` | booléen | NON, défaut vrai | `ingredients.active` — **5/19** | 🟢 |
| `created_at` / `updated_at` | date+heure ms | `created_at` **OUI** (6/19), `updated_at` NON (19/19) | `ingredients.createdAt` / `.updatedAt` | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` — 2 ingrédients | 🟡 |

---

## 4.3 Fiche T-20 · `bebba_stock_movements`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_stock_movements` |
| **2** | **Rôle métier** | Journal comptable **append-only** de toute variation de stock |
| **3** | **Source exacte** | `Firestore:stockMovements` (**173 documents**). Champs réels, **exactement 8** : `id`, `ingredientId`, `ingredientName`, `type`, `quantity`, `notes`, `timestamp`, `performedBy` — **173/173 chacun**. Écrits par `CODE:server/db.ts:373-388` (`addStockMovement`, **en transaction**, avec `transaction.update(ingRef, …)` + `transaction.set(doc(db,'stockMovements',movId), …)`) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `ingredient_id` → T-19 ; `order_id` → T-04 ; `performed_by_user_id` → `wp_users.ID` ; `unit_code` → T-21 |
| **9** | **UNIQUE** | ⚠️ **`legacy_movement_id` NE PEUT PAS être UNIQUE sans vérification** : `'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2,6)` (`server/db.ts:377`). 🟢 **J'ai mesuré 2 mouvements partageant la même milliseconde** : `mov-1788896746487-mce9` et `mov-1788896746487-0o7y`… (**même `Date.now()`, suffixe aléatoire différent**) ⇒ **la collision est évitée de justesse, par 4 caractères aléatoires**. **0 collision réelle sur 173**, mais **aucune garantie** |
| **10** | **Index** | `(ingredient_id, occurred_at)` — 🟢 sert le solde courant ; `(movement_type)` ; `(order_id)` — 🟢 sert la reconstruction de `stock_state` (§2.11) ; `(occurred_at)` ; `(performed_by_user_id)` |
| **11** | **Historique ou vivante** | **100 % HISTORIQUE, append-only** |
| **12** | **Conservation** | 🟢 **suppression et modification interdites** — reproduit `firestore.rules:179-180` (`allow delete: if false`, `allow update: if false`). **C'est la règle la mieux respectée du projet** : 173 mouvements, **0 type `inventory_correction`**, donc **aucun mouvement n'a jamais été « corrigé » a posteriori**. ⚠️ **`resetDemoData()` tente de tous les supprimer** (`server/db.ts:2050-2052`) — **et échoue**. 🔴 **D-34 : ce endpoint ne doit PAS être porté** |
| **13** | **Règle de migration** | (a) `quantity_delta` ← `quantity` **avec son signe** — 🟢 mesuré : **171 négatifs** (tous `order_consumption`), **2 positifs** (tous `manual_in`). **Le signe est dans la donnée, pas dans le type.** (b) `unit_code` ← **`unit` n'existe PAS dans les 173 documents** ! ⚠️ Le code l'écrit (`server/db.ts:381`) mais **l'instantané ne le contient pas** ⇒ **à reprendre depuis `ingredients.unit`**, en marquant la divergence si l'unité a changé depuis. (c) `order_id` / `order_number` ← **n'existent PAS non plus dans les 173 documents** alors que le code les écrit (`server/db.ts:382-383`) ⇒ **à extraire du champ `notes`** par expression régulière `#(BEBBA-\d+)` — 🟢 **169/171 mouvements `order_consumption` portent un `#BEBBA-NNNN` dans `notes`**. (d) `performed_by_label_snapshot` ← `performedBy` **verbatim**. (e) `performed_by_user_id` ← **1 seul résolvable sur 173** (§4.4). (f) `occurred_at` ← `timestamp` **verbatim** |
| **14** | **Anomalies** | **AN-98** `unit`, `orderId`, `orderNumber` **absents des 173 documents** alors que le code les écrit · **AN-99** `notes` est le **seul** lien vers la commande · **AN-100** acteurs non attribuables · **AN-101** 5 types déclarés **jamais utilisés** · **AN-102** `quantity` signée sans type dédié · **AN-103** `resetDemoData` tente la suppression du journal · **AN-104** mouvement sur un ingrédient dont `currentStock` est `null` |
| **15** | **Traitement** | AN-98/AN-99 → **colonnes NULL-ables** + extraction depuis `notes` **en enrichissement**, jamais en substitution ; `notes_snapshot` conservé **verbatim** (il contient des informations absentes partout ailleurs : **nom du produit et quantité**, ex. `'Préparation commande #BEBBA-1098 (BEBBA Chicken Power Bowl x1)'`). AN-100 → voir §4.4. AN-101 → **conserver les 7 valeurs dans l'énumération** 🟢 : elles sont dans `src/types.ts:40-46` et `order_cancellation_restore` est **nécessaire** pour AN-19 ; ⚠️ mais **documenter que 5 sur 7 n'ont jamais servi**. AN-102 → **CHECK `quantity_delta <> 0`** `[PROPOSÉ]` + contrainte de cohérence signe/type 🔴 **D-35**. AN-103 → 🔴 D-34. AN-104 → quarantaine |
| **16** | **Certitude** | **Structure 🟢** (8 champs, 173/173) — **signe 🟢** — **lien commande 🟡** (extraction regex, 169/171) — **acteurs 🟢 quasi nuls** — **`unit` 🟡** |

### Types de mouvements — réel vs déclaré

| Type (`src/types.ts:40-46`) | Occurrences réelles | Signe observé | Qui l'écrit |
|---|---|---|---|
| `order_consumption` | **171** | **négatif** (171/171) | `server/db.ts:1394`, `:1579` |
| `manual_in` | **2** | **positif** (2/2) | `server.ts:424-441` · `KitchenView.tsx:77` |
| `replenishment` | **0** | — | `AdminView.tsx:273` (appel présent, jamais exercé dans l'instantané) |
| `inventory_correction` | **0** | — | **aucun appel trouvé** |
| `manual_out` | **0** | — | **aucun appel trouvé** |
| `waste` | **0** | — | **aucun appel trouvé** |
| `order_cancellation_restore` | **0** | — | **aucun appel trouvé** — 🟢 **confirme AN-19** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_movement_id` | chaîne ≤ 64 | OUI | `Firestore:stockMovements.id` | ⚪ |
| `ingredient_id` | entier non signé | NON | `stockMovements.ingredientId` — **173/173 résolubles, 0 orphelin** | 🟢 |
| `ingredient_name_snapshot` | chaîne ≤ 191 | NON | `stockMovements.ingredientName` — 173/173 | 🟢 |
| `movement_type` | énuméré **7 valeurs** | NON | `stockMovements.type` | 🟢 |
| `quantity_delta` | décimal(12,3) | NON | `stockMovements.quantity` — **signée** | 🟢 |
| `unit_code` | chaîne courte | **OUI** | ⚠️ **absent des données** ; à reprendre de `ingredients.unit` | 🟡 |
| `order_id` | entier non signé | **OUI** | ⚠️ **absent des données** ; extrait de `notes` | 🟡 |
| `order_number_snapshot` | chaîne ≤ 32 | **OUI** | ⚠️ **absent des données** ; extrait de `notes` | 🟡 |
| `notes_snapshot` | texte | NON | `stockMovements.notes` — **173/173**, à conserver **verbatim** | 🟢 |
| `performed_by_label_snapshot` | chaîne ≤ 191 | NON | `stockMovements.performedBy` — **173/173**, **9 valeurs distinctes** | 🟢 |
| `performed_by_user_id` | entier non signé | **OUI** | **1/173 résolvable** | 🟢 |
| `performed_by_kind` | énuméré : `human`, `system`, `legacy_engine`, `unknown` | NON | dérivé (§4.4) | 🟡 `[PROPOSÉ]` |
| `occurred_at` | date+heure ms UTC | NON | `stockMovements.timestamp` — 173/173 | 🟢 |

---

## 4.4 AN-100 · Le journal a été produit par un moteur qui n'existe plus — 🟢 démontré

C'est la découverte la plus lourde de conséquence pour la migration du stock.

### Preuve 1 — `notes` : 173/173 incompatibles avec le code actuel

Le code actuel ne peut produire que **4 motifs** de `notes` (recherche exhaustive sur
`server/db.ts`, `server.ts`, `src/`) :

| Motif produit par le code | Ligne |
|---|---|
| `` `Consommation automatique commande #${orderNumber}` `` | `server/db.ts:1399` |
| `` `Consommation préparation commande #${orderNumber}` `` | `server/db.ts:1581` |
| `notes \|\| 'Ajustement manuel de stock'` | `server.ts:436` |
| `'Réapprovisionnement cuisine'` / `'Réapprovisionnement manuel cuisine'` | `KitchenView.tsx:77`, `AdminView.tsx:273` |

**Les 5 motifs réellement présents :**

| `notes` réel | occurrences | produit par le code actuel ? |
|---|---|---|
| `Préparation commande #BEBBA-NNNN (<nom du produit> x<q>)` | **169** | ❌ **NON** |
| `Consommation commande #BEBBA-NNNN (<nom du produit> …)` | 1 | ❌ **NON** |
| `Consommation commande #BEBBA-NNNN` | 1 | ❌ **NON** |
| `Réception livraison fournisseur Volailles du Terroir (…)` | 1 | ❌ **NON** |
| `Test Réappro Cuisine` | 1 | ❌ **NON** |

**⇒ 173 / 173 mouvements portent une note que le code présent dans le dépôt ne peut pas écrire.**

### Preuve 2 — `performedBy` : un acteur absent de tout le dépôt

| `performedBy` réel | occurrences | présent dans le code ? |
|---|---|---|
| **`BEBBA KDS Moteur Automatique`** | **88** | ❌ **0 occurrence dans tout le dépôt** (`server/`, `src/`, `scripts/`, `server/seedData.ts`) |
| `Chef Cuisine Test` | 29 | ❌ |
| `Cuisine BEBBA` | 24 | ⚠️ valeur de repli de `server/db.ts:1582` |
| `Chef Cuisine` | 16 | ❌ |
| `Chef Test` | 8 | ❌ |
| `Chef` | 4 | ❌ |
| `Système Automatique BEBBA` | 2 | ⚠️ présent dans `server/seedData.ts:1505` (**données de démonstration**) |
| `Chef de Cuisine BEBBA (Cuisine)` | **1** | ✅ **seul cas résolvable** → `usr-kitchen-1` |
| `Chef Gestionnaire` | 1 | ⚠️ `server/seedData.ts:1529` |

**⇒ 1 mouvement sur 173 est attribuable à un compte réel.**
**⇒ 88 mouvements (51 %) sont attribués à un « Moteur Automatique » qui n'existe plus.**

### Preuve 3 — le ledger contient plus d'information que le modèle actuel

`'Préparation commande #BEBBA-1098 (BEBBA Chicken Power Bowl x1)'` porte **le nom du produit et
la quantité commandée**. **Le code actuel ne produit rien de tel** (`server/db.ts:1399` n'écrit que
le numéro de commande). ⇒ **Le moteur disparu était plus riche que son successeur.**

### Conséquences pour la migration — toutes 🟢

| Conséquence | Décision |
|---|---|
| **Rejouer les commandes pour reconstruire le stock est IMPOSSIBLE** | Le code générateur n'existe plus ; le code actuel produirait **d'autres valeurs** (grain, notes, acteurs). 🔴 **Interdire toute stratégie de « replay »** |
| **`performed_by_user_id` doit être `NULL` sur 172/173 lignes** | Aucun mapping automatique. `performed_by_label_snapshot` conservé **verbatim** |
| **`performed_by_kind = 'legacy_engine'`** pour les 88 `'BEBBA KDS Moteur Automatique'` | 🟡 `[PROPOSÉ]` : **préserver la preuve** que ces lignes viennent d'un système antérieur, plutôt que de les fondre dans `'unknown'` |
| **`notes_snapshot` ne doit JAMAIS être régénéré** | Il contient le **nom du produit et la quantité**, information absente de `order_id`/`order_number` (eux-mêmes absents) |
| **Le ledger n'est pas une source de vérité pour le solde** | Voir §4.1 : `currentStock` est une constante écrasée. **Les deux systèmes ne sont pas réconciliés et ne l'ont jamais été** |

### Résolution des acteurs de `orders.statusHistory[].updatedBy` — rappel mesuré (§2.5)

| Classe | `statusHistory.updatedBy` (119) | `stockMovements.performedBy` (173) |
|---|---|---|
| Acteur système identifiable **par le code** | **66** | 0 |
| Résolvable vers un compte réel | **13** | **1** |
| Non résoluble | 31 | **172** |
| Absent | 7 | 0 |

---

## 4.5 Fiches T-21 et T-22

### T-21 · `bebba_units`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_units` — référentiel des unités de mesure |
| **3** | **Source exacte** | ⚠️ **AUCUNE collection Firestore.** Valeurs **observées** dans `ingredients.unit` (18/19), `products.baseIngredients[].unit` (64/64), `supplements.unit` (10/10), `orders…totalIngredients[].unit`, `orders…supplements[].unit`. **`CODE` ne valide jamais une unité** — aucune liste blanche dans `server/db.ts` |
| **7-9** | **PK / FK / UNIQUE** | PK `code` (clé naturelle). Aucune FK. UNIQUE = PK |
| **10** | **Index** | `position` |
| **11-12** | **Historique / conservation** | **VIVANTE**, référentiel. Sans objet |
| **13** | **Migration** | Créer **5 lignes** : 🟢 census exhaustif mesuré — **`g`** (11 ingrédients, 44 recettes), **`ml`** (5 ingrédients, 16 recettes), **`piece`** (1 ingrédient, 1 recette), **`portion`** (1 ingrédient, 3 recettes), **`NULL`** (1 ingrédient). ⚠️ **`NULL` n'est PAS une unité** : ne pas créer de ligne « inconnue », laisser la colonne NULL-able |
| **14** | **Anomalies** | **AN-105** aucune validation d'unité dans le code · **AN-106** `test-ing-kitchen-…` sans unité · **AN-107** le code **force** l'unité à `'g'` dans 2 branches (`server/db.ts:972, 983`) quelle que soit l'unité réelle |
| **15** | **Traitement** | AN-105 → `[PROPOSÉ]` FK vers T-21 **avec valeurs admises figées**. AN-106 → `NULL`. AN-107 → 🟢 **T-17 porte `unit_code`**, ce qui supprime le forçage |
| **16** | **Certitude** | **🟢 census exhaustif** — AN-107 🟢 démontré |

**Colonnes :** `code` (chaîne courte, PK), `label` (chaîne ≤ 32), `label_plural` (chaîne ≤ 32, NULL),
`is_weight` / `is_volume` / `is_count` (booléens — 🟡 `[PROPOSÉ]`, ⚠️ **nécessaire pour toute
conversion ou agrégation** : on ne peut pas sommer des grammes et des pièces), `position`.

⚠️ **Aucune conversion d'unité n'existe dans le code.** Toute agrégation multi-unités est
**impossible** aujourd'hui : `server/db.ts:1723` compte les alertes sans sommer, et
`AdminView.tsx:994-996` valorise **ingrédient par ingrédient**. **Ne pas introduire de conversion
dans la migration** — 🔴 **D-36**.

### T-22 · `bebba_ingredient_families`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_ingredient_families` — regroupement des ingrédients (ex. « Protéines », « Sauces ») |
| **3** | **Source exacte** | ⚠️ **AUCUNE collection Firestore.** `Firestore:ingredients.category` — **texte libre**, 18/19 |
| **7-9** | **PK / FK / UNIQUE** | PK `code`. UNIQUE `label` |
| **10** | **Index** | `position` |
| **11-12** | **Historique / conservation** | **VIVANTE** |
| **13** | **Migration** | 🟢 **9 valeurs distinctes mesurées** : `Protéines` (5), `Féculents` (3), `Boissons` (3), `Sauces` (2), `Légumes` (1), `Légumes & Fruits` (1), `Protéines & Fromages` (1), `Programmes` (1), **`NULL`** (1). Règle : `code` = **slug déterministe** du libellé ; ⚠️ **ne pas fusionner** `Légumes` et `Légumes & Fruits`, ni `Protéines` et `Protéines & Fromages` — 🔴 **D-37** |
| **14** | **Anomalies** | **AN-108** granularité incohérente : `Légumes` (1 ingrédient) **et** `Légumes & Fruits` (1) ; `Protéines` (5) **et** `Protéines & Fromages` (1) · **AN-109** `Programmes` contient `ing-repas-programme`, qui n'est **pas une matière première** mais un **produit intermédiaire** (les 3 programmes 30 jours en consomment exactement 1 portion) · **AN-110** texte libre non contrôlé |
| **15** | **Traitement** | AN-108 → 🔴 **D-37** : **migrer les 9 valeurs telles quelles**, laisser le métier fusionner ensuite. **Ne pas fusionner à l'import** : ce serait transformer une anomalie en règle. AN-109 → **signaler** : `ing-repas-programme` a un coût de **8.5 DT/portion** (le plus élevé du catalogue, 45 portions = **382.50 DT**, soit **20,7 %** de la valorisation totale du stock) et **aucun mouvement** — 🔴 **D-38** : faut-il le traiter comme un **produit** plutôt que comme un ingrédient ? AN-110 → FK vers T-22 |
| **16** | **Certitude** | **🟢 census exhaustif** — granularité 🔴 |

**Colonnes :** `code`, `label`, `legacy_label` (⚪), `position`, `is_raw_material` (booléen —
🟡 `[PROPOSÉ]` pour AN-109).

---
---

# PARTIE 5 — FOURNISSEURS

## 5.1 🔴 Réponse à la question posée : quelle relation fait foi **dans le code** ?

## 🟢 **AUCUNE. Le code ne lit ni `suppliedIngredients`, ni `supplierId`, ni `supplierName`.**

Recherche exhaustive sur `server/db.ts`, `server.ts`, `src/`, `scripts/`, `firestore.rules` :

| Identifiant | Occurrences hors `src/types.ts` | Où |
|---|---|---|
| `suppliedIngredients` | **0** | — (déclaré uniquement dans `src/types.ts:244`) |
| `supplierId` | **1** | `firestore.rules:246` — **nom de variable de chemin** `match /suppliers/{supplierId}`, sans rapport |
| `supplierName` | **5** | `src/components/admin/IngredientModal.tsx:27, 48, 93, 259, 260` — **un champ de saisie texte libre** |

**Conséquences 🟢 :**

1. **`suppliers` est une liste de référence sans aucun consommateur métier.** Aucun achat, aucune
   commande fournisseur, aucune réception, aucune valorisation, aucun alerte de réapprovisionnement
   ne l'utilise.
2. **`supplierName` est un `<input>` texte libre** (`IngredientModal.tsx:259-260`), **pas un
   sélecteur de fournisseur**. Preuve dans les données : `ing-1788825545393` porte
   **`supplierName = 'marché'`** et **aucun `supplierId`** — « marché » n'est **pas** un des
   3 fournisseurs.
3. ⚠️ **Correction d'une hypothèse de V0** : V0 désignait `suppliedIngredients` comme « relation
   faisant foi ». **C'était une inférence à partir de la forme des données, pas du code.** La
   réponse fondée sur le code est : **aucune relation n'est authoritative, parce qu'aucune n'est
   lue.**

## 5.2 Les deux représentations et leur divergence réelle — 🟢 mesurée

| Ingrédient | `ingredients.supplierId` | déclaré dans `suppliers.suppliedIngredients` | Verdict |
|---|---|---|---|
| `ing-poulet` | `sup-2` | `sup-2` | ✅ cohérent |
| `ing-boeuf` | `sup-2` | `sup-2` | ✅ cohérent |
| `ing-riz` | `sup-3` | `sup-3` | ✅ cohérent |
| `ing-quinoa` | `sup-3` | `sup-3` | ✅ cohérent |
| `ing-patate-douce` | `sup-3` | `sup-3` | ✅ cohérent |
| `ing-legumes` | `sup-1` | `sup-1` | ✅ cohérent |
| `ing-avocat` | `sup-1` | `sup-1` | ✅ cohérent |
| `ing-oeuf` | `sup-1` | `sup-1` | ✅ cohérent |
| **`ing-halloumi`** | `sup-1` | **—** | ⚠️ **unilatéral (ingrédient seul)** |
| **`ing-sauce-healthy`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-sauce-miel-moutarde`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-fruits-frais`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-dinde`** | `sup-2` | **—** | ⚠️ unilatéral |
| **`ing-saumon`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-betterave`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-eau-infusee`** | `sup-1` | **—** | ⚠️ unilatéral |
| **`ing-repas-programme`** | `sup-1` | **—** | ⚠️ unilatéral |
| `ing-1788825545393` | — | — | aucun lien *(mais `supplierName='marché'`)* |
| `test-ing-kitchen-1788896746450` | — | — | aucun lien |

**Bilan : 8 paires cohérentes · 9 paires unilatérales · 0 paire contradictoire · 2 ingrédients sans lien.**

⚠️ **Aucune contradiction** (aucun ingrédient pointant vers X tout en étant listé par Y). La
divergence est **toujours dans le même sens** : l'ingrédient déclare un fournisseur que le
fournisseur ne reconnaît pas.

### Cause racine — 🟢 démontrée

| Source | `sup-1.suppliedIngredients` | `sup-2` | `sup-3` |
|---|---|---|---|
| `server/seedData.ts:85, 92, 99` | **7** : `ing-legumes`, `ing-avocat`, `ing-oeuf`, `ing-saumon`, `ing-fruits-frais`, `ing-betterave`, `ing-eau-infusee` | **3** : `ing-poulet`, `ing-boeuf`, `ing-dinde` | **3** |
| **`db.json` (réel)** | **3** : `ing-legumes`, `ing-avocat`, `ing-oeuf` | **2** : `ing-poulet`, `ing-boeuf` | **3** |

⇒ **`suppliedIngredients` a été AMPUTÉ de 4 + 1 entrées par rapport au seed.**

**Mécanisme :** `saveSupplier` (`server/db.ts:249-253`) fait un **`setDoc` plein document, sans
`merge`**. Toute sauvegarde d'un fournisseur **réécrit intégralement** `suppliedIngredients` avec
ce que le formulaire contenait. **Un formulaire qui n'affiche pas la liste existante la vide.**
Pendant ce temps, `ingredients.supplierId` est écrit **indépendamment** par `IngredientModal`.
**Deux écritures, deux sens, aucune synchronisation.**

## 5.3 Fiche T-23 · `bebba_suppliers`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_suppliers` |
| **2** | **Rôle métier** | Partenaire d'approvisionnement : coordonnées. **Aucun rôle transactionnel aujourd'hui** |
| **3** | **Source exacte** | `Firestore:suppliers` (3 documents). Champs **exactement 6, présents 3/3** : `id`, `name`, `phone`, `email`, `address`, `suppliedIngredients`. Écrits par `CODE:server/db.ts:249-253` (`saveSupplier`, **`setDoc` plein document**) |
| **7** | **PK** | `id` surrogate — 🟢 `'sup-' + Date.now()` (`server/db.ts:250`) ; ⚠️ **même préfixe que les suppléments**, voir AN-68 |
| **8** | **FK** | aucune |
| **9** | **UNIQUE** | `name` 🟢 (0 doublon sur 3) ; **`legacy_supplier_id` UNIQUE — ⚠️ OBLIGATOIRE et prioritaire** : c'est **la seule façon de lever la collision `sup-`** décrite en AN-68 |
| **10** | **Index** | `name` (couvert par UNIQUE) |
| **11** | **Historique ou vivante** | **VIVANTE**, référentiel. **Aucune donnée historique n'en dépend** |
| **12** | **Conservation** | ⚠️ `deleteSupplier` (`server/db.ts:254-258`) est un **`deleteDoc` seul, sans aucun contrôle** — mais `firestore.rules:248` interdit la suppression. `[PROPOSÉ]` : `ON DELETE RESTRICT` depuis `bebba_ingredients.supplier_id` |
| **13** | **Règle de migration** | (a) `legacy_supplier_id` ← `suppliers.id` (**`sup-1`, `sup-2`, `sup-3`**) — **indispensable** pour lever AN-68. (b) coordonnées ← telles quelles. (c) **`suppliedIngredients` → table de liaison T-24, avec les 8 paires cohérentes uniquement**. (d) **Les 9 paires unilatérales : 🔴 D-39** — les importer dans T-24 **ou** les ignorer. **Ne pas trancher automatiquement** |
| **14** | **Anomalies** | **AN-111** aucune logique métier ne consomme les fournisseurs · **AN-112** divergence 9/17 entre les deux représentations · **AN-113** `saveSupplier` écrase `suppliedIngredients` en document plein · **AN-68** collision de préfixe `sup-` · **AN-114** `deleteSupplier` sans garde-fou applicatif |
| **15** | **Traitement** | AN-111 → 🔴 **D-40 : faut-il conserver `bebba_suppliers` ?** Argument **pour** : les données existent et sont propres ; argument **contre** : **rien ne les consomme**. **Recommandation : conserver** (coût nul, information réelle), **mais ne PAS construire de module d'achat dessus sans décision métier**. AN-112 → **les DEUX représentations sont migrées, dans des endroits différents** : T-24 pour la relation structurée, `bebba_ingredients.supplier_id` pour la déclaration de l'ingrédient. **Ne pas les fusionner.** AN-113 → T-24 devient une **vraie table de liaison** : l'amputation par `setDoc` devient **structurellement impossible**. AN-68 → PK numériques disjointes + `legacy_*_id` typés. AN-114 → `RESTRICT` |
| **16** | **Certitude** | **🟢 structure exhaustive (6 champs × 3)** — **🟢 absence de consommation démontrée** — **🔴 périmètre futur** |

### Les 3 fournisseurs réels — 🟢

| `id` | `name` | `phone` | `email` | `address` | `suppliedIngredients` réel |
|---|---|---|---|---|---|
| `sup-1` | Ferme Bio de Mornag | +216 71 889 001 | contact@ferme-mornag.tn | Mornag, Ben Arous | **3** : `ing-legumes`, `ing-avocat`, `ing-oeuf` |
| `sup-2` | Volailles du Terroir | +216 71 450 120 | commandes@volailles-terroir.tn | Zone Industrielle, Tunis | **2** : `ing-poulet`, `ing-boeuf` |
| `sup-3` | Moulins & Grains Sélection | +216 71 230 400 | contact@grains-selection.tn | Port de Radès | **3** : `ing-riz`, `ing-quinoa`, `ing-patate-douce` |

**Colonnes :** `id`, `legacy_supplier_id` (chaîne ≤ 64, **UNIQUE**), `name` (chaîne ≤ 191, UNIQUE),
`phone` (chaîne ≤ 32, NULL), `email` (chaîne ≤ 191, NULL), `address` (chaîne ≤ 255, NULL),
`is_active` (booléen, défaut vrai — 🟡 `[PROPOSÉ]`, **le champ n'existe pas aujourd'hui**),
`created_at` / `updated_at` (NULL — 🟢 **aucun des 3 documents ne porte de date**).

## 5.4 Fiche T-24 · `bebba_supplier_ingredients`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_supplier_ingredients` — relation N:N fournisseur ↔ ingrédient, **issue de `suppliedIngredients`** |
| **3** | **Source exacte** | `Firestore:suppliers.suppliedIngredients[]` — **8 références réelles** (3 + 2 + 3). ⚠️ **13 dans `server/seedData.ts`** |
| **7-9** | **PK / FK / UNIQUE** | PK `(supplier_id, ingredient_id)` = UNIQUE. FK → T-23 et T-19, **`ON DELETE CASCADE`** côté fournisseur, **`RESTRICT`** côté ingrédient |
| **10** | **Index** | `ingredient_id` |
| **11-12** | **Historique / conservation** | **VIVANTE** |
| **13** | **Migration** | **8 lignes** depuis `suppliedIngredients`. 🔴 **D-39** pour les 9 paires unilatérales issues de `ingredients.supplierId`. ⚠️ **Règle impérative : ne JAMAIS créer de ligne T-24 à partir de `ingredients.supplierName`** — c'est un texte libre (AN-111, « marché ») |
| **14-15** | **Anomalies / traitement** | **AN-112** : la table rend la divergence **visible et requêtable** au lieu de la masquer. `[PROPOSÉ]` **vue de contrôle** exposant les paires présentes dans un seul sens |
| **16** | **Certitude** | **🟢 8 lignes démontrées** — **🔴 9 lignes en suspens** |

⚠️ **Une redondance assumée et documentée.** Après migration, un ingrédient pourra avoir
**`bebba_ingredients.supplier_id`** (17 ingrédients) **et** des lignes dans **T-24** (8 paires),
**sans que les deux concordent** (9 divergences). C'est **l'état réel du système**. Le schéma cible
le **rend visible** au lieu de le cacher. 🔴 **D-41** : à terme, faut-il **une seule** des deux
représentations ? **Recommandation : oui, T-24 seule** (N:N réel — un ingrédient peut avoir
plusieurs fournisseurs), **mais seulement après validation métier des 9 paires**.

---
---

# PARTIE 6 — LIVREURS

## 6.1 État réel — 🟢 census exhaustif

`Firestore:drivers` : **3 documents, exactement 7 champs chacun, 3/3** :
`id`, `name`, `phone`, `vehicle`, `active`, `totalDeliveries`, `rating`.

| `id` | `name` | `phone` | `vehicle` | `active` | `totalDeliveries` | `rating` |
|---|---|---|---|---|---|---|
| `drv-1` | Yassine Ben Amor | +216 98 123 456 | Scooter Honda 125cc (Rapide) | true | **146** | 4.9 |
| `drv-2` | Amine Trabelsi | +216 55 987 654 | Moto Peugeot Tweet | true | **98** | 4.8 |
| `drv-3` | Karim Bouazizi | +216 22 456 789 | Vélo Électrique Cargo | true | **64** | 4.95 |

⚠️ **Aucun des champs suivants n'existe** : `createdAt`, `updatedAt`, `userId`, `status`,
`assignedOrders`, `zone`, `matricule`. **Le lien vers le compte utilisateur est UNIDIRECTIONNEL** :
`users.driverId → drivers.id` (`server/db.ts:625-631`).

## 6.2 AN-115 · Désynchronisation `users` ↔ `drivers` — 🟢 mesurée

| Compte | `users.name` | `users.phone` | `drivers.name` | `drivers.phone` | Verdict |
|---|---|---|---|---|---|
| `usr-driver-1` → `drv-1` | **Sami Trabelsi** | +216 98 123 456 | **Yassine Ben Amor** | +216 98 123 456 | 🔴 **nom DESYNC**, téléphone OK |
| `usr-driver-2` → `drv-2` | **Karim Ben Salem** | **+216 97 654 321** | **Amine Trabelsi** | **+216 55 987 654** | 🔴 **nom ET téléphone DESYNC** |
| `usr-driver-3` → `drv-3` | Karim Bouazizi | +216 22 456 789 | Karim Bouazizi | +216 22 456 789 | ✅ cohérent |

**2 livreurs sur 3 sont désynchronisés.**

### Ce que cela produit réellement

| Écran / mécanisme | Quelle identité est affichée | Conséquence |
|---|---|---|
| Suivi public de commande (`server.ts:753-760`) | `orders.assignedDriverName` ← `drivers.name` (`server/db.ts:1666`) | Le client voit **« Yassine »** |
| Liste des livreurs (`server/db.ts:620-641`) | `drivers.name` + `username` du compte | L'admin voit **« Yassine Ben Amor »** avec l'identifiant **`livreur1`** |
| Journal des commandes (§2.5) | `'Sami Trabelsi (Livreur)'` ×2 — **format de `server.ts:1128-1130`, donc `users.name`** | **Le journal dit « Sami », le suivi dit « Yassine », pour la même personne** |
| Journal des commandes, 2 autres entrées | `'Yassine Ben Amor'` ×2 — **sans le suffixe de rôle**, donc **pas produit par `server.ts:1128-1130`** | ⚠️ **données de démonstration** |
| **Contrôle d'accès IDOR** (`server.ts:903-908`) | `user.driverId === order.assignedDriverId` | ✅ **CORRECT** — la sécurité **ne dépend pas du nom** |

🟢 **La désynchronisation est donc sans impact sécuritaire, mais produit une incohérence visible
pour le client et pour l'admin.**

### AN-116 · `totalDeliveries` est déconnecté de l'historique

| Mesure | Valeur |
|---|---|
| `Σ totalDeliveries` déclaré | **308** (146 + 98 + 64) |
| commandes `delivered` dans l'instantané | **4** |
| commandes affectées à `drv-1` / `drv-2` / `drv-3` | **8 / 2 / 0** |
| `drv-3` | **64 livraisons déclarées, 0 commande affectée** |

**Code :** `server/db.ts:1626-1632` — à la transition vers `delivered`,
`driver.totalDeliveries = (driver.totalDeliveries || 0) + 1` puis `updateDoc`.
⚠️ **`updateOrderStatus` n'est PAS transactionnel** (`getDoc` → mutation → `setDoc`) ⇒
**deux livraisons simultanées peuvent perdre un incrément**.

🟢 **Conclusion : `totalDeliveries` est une valeur de démonstration, ni calculée ni vérifiable.**
Elle **contredit** l'historique d'un facteur 77.

## 6.3 Fiche T-25 · `bebba_drivers`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_drivers` |
| **2** | **Rôle métier** | Fiche livreur : identité publique, véhicule, disponibilité, statistiques |
| **3** | **Source exacte** | `Firestore:drivers` (3 documents, 7 champs). Lien compte : `Firestore:users.driverId` (3 comptes). Affectations : `Firestore:orders.assignedDriverId` / `.assignedDriverName` (10 commandes). Écrit par `CODE:server/db.ts:660-785` (`createDriverWithAccount`, `updateDriver`, `setDriverActiveStatus`, `resetDriverPassword`, `deleteDriver`) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | `user_id` → `wp_users.ID` — 🟢 **UNIQUE** (1 livreur = 1 compte). **Sens inverse de l'actuel** : aujourd'hui c'est `users.driverId → drivers.id` |
| **9** | **UNIQUE** | `user_id` 🟢 ; `legacy_driver_id` ⚪ ; ⚠️ **`phone` NON UNIQUE** — 🔴 **D-42** : `users.phone` et `drivers.phone` divergent pour `drv-2`, donc **impossible de savoir lequel est le bon** |
| **10** | **Index** | `(is_active)` — 🟢 sert le filtre d'affectation (`server/db.ts:1663-1665`, `server.ts:1133-1157`) ; `(user_id)` |
| **11** | **Historique ou vivante** | **MIXTE** : fiche vivante ; `total_deliveries` et `rating` sont des **compteurs vivants non fiables** ; **les commandes historiques portent leur propre `assigned_driver_name_snapshot`** (T-04) et n'en dépendent donc pas |
| **12** | **Conservation** | 🟢 **`deleteDriver` (`server/db.ts:786-805`) supprime la fiche ET le compte lié sans aucun contrôle de référencement** — alors que **10 commandes** portent `assignedDriverId`. `firestore.rules:272` bloque la suppression, mais **le code applicatif ne le fait pas**. `[PROPOSÉ]` : **suppression physique interdite**, désactivation seule. **Justification 🟢 : `assignDriver` refuse déjà un livreur `active === false` (`server/db.ts:1663-1665`)** ⇒ la désactivation est **le mécanisme prévu**, la suppression est un accident |
| **13** | **Règle de migration** | (a) `user_id` ← résolution de `users.driverId` (3/3 résolubles). (b) `name` ← **`drivers.name`** 🟢 — c'est **lui** qui est exposé au client (`server.ts:753-760`) et stocké dans `orders.assignedDriverName` (**0 divergence sur 10**). (c) `phone` ← 🔴 **D-42** : `drivers.phone` ou `users.phone` ? **Pour `drv-2` les deux diffèrent.** (d) `total_deliveries` ← 🔴 **D-43** : valeur déclarée (308) **ou** recalculée depuis les commandes (4) ? (e) `rating` ← tel quel (4.9 / 4.8 / 4.95) ; ⚠️ **aucun code ne le calcule ni ne l'affiche dans le parcours client** — 🔴 **D-44**. (f) `vehicle` ← **texte libre** ; 🔴 **D-45** : entité `vehicles` ou colonne texte ? **Recommandation : colonne texte** — 🟢 **3 valeurs, aucune réutilisation, aucune donnée technique structurée** |
| **14** | **Anomalies** | **AN-115** désynchronisation 2/3 · **AN-116** `totalDeliveries` × 77 l'historique · **AN-117** lien unidirectionnel `users.driverId` · **AN-118** `deleteDriver` sans garde-fou · **AN-119** `rating` sans producteur ni consommateur démontré · **AN-120** aucune date sur la fiche livreur · **AN-121** pas de statut opérationnel (`available` / `on_delivery` / `offline`) : seul `active` existe, et `assignDriver` ne vérifie **que** `active === false` |
| **15** | **Traitement** | AN-115 → **`drivers.name` fait foi** (🟢 démontré par l'exposition client) ; le nom du **compte** reste celui de `wp_users.display_name` ; 🔴 **D-46** : faut-il les réaligner ? **Ne PAS réaligner à l'import** — cela écraserait une identité sans savoir laquelle est vraie. AN-116 → 🔴 D-43 ; **`[PROPOSÉ]` conserver les deux** : `total_deliveries_declared` (valeur migrée) et `total_deliveries_computed` (vue sur T-04). AN-117 → **inverser la FK** : `bebba_drivers.user_id UNIQUE`. AN-118 → suppression interdite. AN-119 → **conserver** la colonne, **documenter** qu'elle n'est alimentée par rien. AN-120 → `NULL`, ne pas dater à la migration. AN-121 → 🔴 **D-47** : faut-il un statut opérationnel ? **Le code actuel n'en a pas besoin** : la garde de `delivering` (`server/db.ts:1527-1535`) vérifie `assignedDriverId` **et** `driver.active !== false`, rien d'autre |
| **16** | **Certitude** | **🟢 structure exhaustive (7 champs × 3)** — **`name` authoritative 🟢** — **`phone` 🔴** — **`total_deliveries` 🔴** — **`rating` 🟡** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_driver_id` | chaîne ≤ 64 | OUI | `drivers.id` | ⚪ |
| `user_id` | entier non signé | **NON**, UNIQUE | `users.driverId` inversé | 🟢 |
| `name` | chaîne ≤ 191 | NON | `drivers.name` | 🟢 |
| `phone` | chaîne ≤ 32 | NON | 🔴 D-42 | 🔴 |
| `phone_normalized` | chaîne 8 | OUI | `CODE:server/db.ts:98-106` | 🟡 `[PROPOSÉ]` |
| `vehicle` | chaîne ≤ 191 | OUI | `drivers.vehicle` — 3/3, texte libre | 🟢 |
| `is_active` | booléen | NON, défaut vrai | `drivers.active` — **3/3 à `true`** | 🟢 |
| `total_deliveries_declared` | entier non signé | NON, défaut 0 | `drivers.totalDeliveries` — 3/3 | 🟢 |
| `rating` | décimal(3,2) | OUI | `drivers.rating` — 3/3 ; plage 4.80–4.95 | 🟡 |
| `created_at` / `updated_at` | date+heure ms | **OUI** | **absents des données** | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` — 🔴 D-26 | 🟡 |

⚠️ **Pas de table `bebba_deliveries`.** 🟢 **Justifié** : une livraison n'est **pas une entité**
dans le système actuel — c'est **un état de la commande** (`delivering` → `delivered`) plus
**une affectation** (`assignedDriverId`). Créer une table `deliveries` **inventerait une entité**
sans source. Les informations « livraison » sont intégralement portées par **T-04**
(`assigned_driver_id`, `assigned_driver_name_snapshot`) et **T-07** (événements).
🔴 **D-48** : si le métier veut un bon de livraison imprimable avec signature et heure de remise,
**c'est une nouvelle entité à concevoir, pas une migration.**

⚠️ **Pas de table `bebba_collections`** non plus : les « encaissements » sont traités en **T-10**.

---
---

# PARTIE 7 — CATÉGORIES

## 7.1 🔴 Source de vérité et valeurs réelles — aucune liste supposée

### Source

`Firestore:categories` — **9 documents**. Champs réels :

| Champ | Présence |
|---|---|
| `id`, `name`, `slug`, `icon`, `description`, `active`, `order` | **9 / 9** |
| `sortOrder`, `createdAt`, `updatedAt` | **5 / 9** |
| `image`, `imageUrl` | **2 / 9** *(les deux duplicats, et **tous deux vides `''`**)* |

### Les 9 catégories réelles — 🟢 valeurs exactes

| `id` | `name` | `slug` | `icon` | `order` | `sortOrder` | `active` | produits |
|---|---|---|---|---|---|---|---|
| `cat-healthy` | Healthy Bowls | `healthy` | `Salad` | 1 | — | true | 6 |
| `cat-grillades` | Grillades | `grillades` | `Flame` | 2 | — | true | 4 |
| `cat-salades` | Salades & Fraîcheur | `salades` | `Sparkles` | **3** | — | true | 1 |
| `cat-boissons` | Jus Frais & Détox | `boissons` | `GlassWater` | **4** | — | true | 2 |
| `cat-enfants` | Enfants | `enfants` | `Baby` | **3** | **3** | true | 3 |
| `cat-jus-detox` | Jus détox | `jus-detox` | `GlassWater` | **4** | **4** | true | 2 |
| `cat-regime-30j` | Régime complet 30 jours | `regime-30j` | `Calendar` | 5 | 5 | true | 3 |
| **`cat-1788252897602`** | **Wraps & Galettes Complètes** | **`wraps-galettes`** | `Salad` | **10** | **10** | true | **1** |
| **`cat-1788252928275`** | **Wraps & Galettes Complètes** | **`wraps-galettes`** | `Salad` | **10** | **10** | true | **1** |

⚠️ **Correction explicite d'une hypothèse de V0** : V0 supposait `slug` unique.
🟢 **Mesure : `wraps-galettes` apparaît 2 fois.** **`slug` n'est PAS unique.**

### AN-122 · Le duplicata intégral — 🟢 cause racine datée à la milliseconde

Les deux derniers documents sont **identiques sur `name`, `slug`, `icon`, `order`, `sortOrder`,
`active`, `description`, `image`, `imageUrl`**. Seuls `id`, `createdAt` et `updatedAt` diffèrent :

| | `cat-1788252897602` | `cat-1788252928275` |
|---|---|---|
| `createdAt` | `2026-09-01T08:54:57.602Z` | `2026-09-01T08:55:28.275Z` |
| écart | — | **+30,673 s** |

Et **dans la même seconde** que chaque catégorie :

| Instant | Catégorie | Produit | Supplément |
|---|---|---|---|
| `08:54:57.602` | `cat-1788252897602` | `prod-1788252897607` (+5 ms) | `sup-1788252897609` (+7 ms) |
| `08:55:28.275` | `cat-1788252928275` | `prod-1788252928280` (+5 ms) | `sup-1788252928282` (+7 ms) |

🟢 **Il s'agit d'un même formulaire « catégorie + produit + supplément » soumis deux fois à
30,7 secondes d'intervalle.** Le triplet category/produit/supplément est créé en cascade avec le
**même horodatage de base**, à 5 et 7 millisecondes d'écart.

### **AN-123** · Chaîne complète de la session de test du 2026-09-01 08:40 → 08:56

| Instant (UTC) | Événement | Preuve |
|---|---|---|
| `08:40:52.142` | création du compte **`usr-1788252052142`** (`agent_test_audit`, rôle **`kitchen`**, `active: true`) | `createdAt` = epoch de l'`id` |
| `08:40:56.722` | commande **`BEBBA-1070`** | `orders.createdAt` |
| `08:54:57.602–609` | **soumission n° 1** : catégorie + produit + supplément | epoch des 3 `id` |
| `08:55:28.275–282` | **soumission n° 2** (+30,673 s) : mêmes contenus | epoch des 3 `id` |
| `08:55:58.886–889` | **soumission n° 3** (+61,28 s) : produit `prod-1788252958886` + supplément `sup-1788252958889` | epoch **embarqué dans les `id` référencés par la commande** |
| **`08:55:58.897`** | **commande `BEBBA-1071` — 8 ms après la création du produit** | `orders.createdAt` |
| `08:56:14.684–687` | **soumission n° 4** (+15,80 s) : produit `prod-1788252974684` + supplément `sup-1788252974687` | epoch |
| **`08:56:14.698`** | **commande `BEBBA-1072` — 11 ms après** | `orders.createdAt` |

🟢 **Deux conclusions certaines :**

1. **Les commandes `BEBBA-1071` et `BEBBA-1072` ont été passées 8 et 11 millisecondes après la
   création de leur produit.** Ce n'est **pas un comportement humain** (ajouter au panier, ouvrir
   le tunnel de commande, saisir coordonnées, valider). **C'est un script.**
2. **Les produits et suppléments des soumissions n° 3 et n° 4 n'existent plus dans le catalogue,
   alors que les commandes qui les référencent existent toujours.** ⇒ **Des suppressions de
   produits et de suppléments ont réussi** à ce moment-là.

⚠️ **Point que je ne peux PAS trancher, et que je signale explicitement :**
`firestore.rules` interdit la suppression sur les 11 collections (`:173, 179, 194, 210, 220, 229,
239, 248, 258, 272`), et §4.1 démontre que **les suppressions de `resetDemoData()` ont échoué**
alors que **ses écritures ont réussi**. Les suppressions de produits des soumissions n° 3 et n° 4
ont donc **soit** eu lieu **avant le déploiement des règles**, **soit** par un canal privilégié
(console Firebase, SDK Admin). **🟡 D-49 : dater le déploiement de `firestore.rules`** — c'est la
seule façon de trancher, et cela conditionne la confiance à accorder aux règles comme garantie.

### AN-124 · `order` dupliqué et règle de tri réelle

**Doublons de `order` mesurés :** `3` (×2 : `cat-salades`, `cat-enfants`), `4` (×2 : `cat-boissons`,
`cat-jus-detox`), `10` (×2 : les deux duplicats).

**Règle de tri du code 🟢** (`server/db.ts:180-186`) :

```
sortOrder !== undefined ? sortOrder : (order || 0)
```

⇒ **`sortOrder` a priorité sur `order`.** Comme **4 catégories sur 9 n'ont pas de `sortOrder`**,
elles retombent sur `order`. **Les deux champs sont égaux sur les 5 qui ont les deux.**

⚠️ **`Array.prototype.sort` n'est pas stable-garanti pour des clés égales dans tous les moteurs**,
et ici les clés **sont** égales (3, 4, 10). ⇒ **L'ordre d'affichage de `cat-salades` vs
`cat-enfants` n'est pas déterministe.**

⚠️ **Chez les produits, la règle est différente** : `getProducts` ne trie pas du tout
(`server/db.ts:503-540`) — le tri est laissé au front. **Deux règles de tri pour deux collections
voisines.**

### AN-125 · Deux catégories pour le même concept métier

| | `cat-boissons` | `cat-jus-detox` |
|---|---|---|
| `name` | Jus Frais & Détox | Jus détox |
| `slug` | `boissons` | `jus-detox` |
| `icon` | `GlassWater` | `GlassWater` |
| `description` | « Jus 100% naturels pressés à froid sans sucre ajouté et eaux infusées. » | « Jus 100% naturels pressés à froid sans sucre ajouté et eaux infusées **bienfaisantes**. » |
| `order` | 4 | 4 |
| produits | 2 | 2 |

**Même icône, même `order`, descriptions quasi identiques (1 mot d'écart).** Ce sont **deux
catégories pour un seul concept**. 🔴 **D-50** : fusion ou conservation ? **Non déductible** —
les 4 produits concernés sont distincts.

## 7.2 Fiche T-26 · `bebba_categories`

| # | Attribut | Valeur |
|---|---|---|
| **1** | **Nom** | `bebba_categories` |
| **2** | **Rôle métier** | Regroupement de produits pour la navigation du menu |
| **3** | **Source exacte** | `Firestore:categories` (9 documents). Écrit par `CODE:server/db.ts:218-237` (`saveCategory` / `deleteCategory`) |
| **7** | **PK** | `id` surrogate |
| **8** | **FK** | aucune |
| **9** | **UNIQUE** | ⚠️ **`slug` NE PEUT PAS être UNIQUE** — 🟢 **doublon réel mesuré** (`wraps-galettes` ×2). ⚠️ **`name` NON PLUS** (même doublon). `legacy_category_id` UNIQUE ⚪ |
| **10** | **Index** | `(position, id)` — 🟢 **`id` en second critère est indispensable** : il rend le tri **déterministe** malgré les doublons de `position` (AN-124) ; `(is_active)` — sert `activeOnly` (`server/db.ts:178-179`) |
| **11** | **Historique ou vivante** | **VIVANTE**. ⚠️ **Les commandes historiques n'en dépendent pas** : `orders.items[]` ne porte **aucune** référence de catégorie |
| **12** | **Conservation** | 🟢 `deleteCategory` refuse si des produits sont rattachés (`server/db.ts:229-233`) — **le meilleur garde-fou du catalogue, à reproduire par `ON DELETE RESTRICT`** |
| **13** | **Règle de migration** | (a) `position` ← **`COALESCE(sortOrder, order)`** — 🟢 **reproduit exactement `server/db.ts:181-182`**. (b) `slug` ← tel quel, **sans contrainte UNIQUE**. (c) `icon` ← tel quel — ⚠️ **7 valeurs distinctes** : `Salad` (×2), `Flame`, `Sparkles`, `GlassWater` (×2), `Baby`, `Calendar` — **noms de composants `lucide-react`**, 🔴 **D-51** : conserver le nom ou mapper vers un média WordPress ? (d) `image_url` ← `COALESCE(NULLIF(imageUrl,''), NULLIF(image,''))` — 🟢 **les 2 seules occurrences sont des chaînes vides**, donc **`NULL` pour 9/9**. (e) **dédoublonnage préalable** — 🔴 **D-11** |
| **14** | **Anomalies** | **AN-122** duplicata intégral · **AN-124** `order` dupliqué + tri non déterministe · **AN-125** deux catégories pour un concept · **AN-126** `slug` non unique · **AN-127** `description = 'Description mise à jour avec succès'` sur les 2 duplicats — 🟢 **un message de confirmation d'interface enregistré comme contenu métier** · **AN-128** `image`/`imageUrl` vides · **AN-129** `order`/`sortOrder` redondants avec règle de priorité implicite |
| **15** | **Traitement** | AN-122 → 🔴 **D-11**. ⚠️ **La fusion est bloquante** : chaque duplicat porte **1 produit distinct** (`prod-1788252897607` et `prod-1788252928280`, eux-mêmes duplicats — §3.7). **Fusionner les catégories sans fusionner les produits créerait une catégorie à 2 produits identiques.** AN-124 → `(position, id)` + 🔴 **D-52** : faut-il renuméroter ? AN-125 → 🔴 **D-50**. AN-126 → **pas de contrainte UNIQUE**. AN-127 → 🔴 **D-53** : **réécrire la description ou la conserver ?** **Recommandation : conserver à l'import** (ne rien inventer) **+ quarantaine** avec le motif `description_is_ui_toast_text`. **Écrire une vraie description serait une invention.** AN-128 → `NULL`. AN-129 → **abandon de `order`** au profit de `position = COALESCE(sortOrder, order)` |
| **16** | **Certitude** | **🟢 census exhaustif et règle de tri démontrée** — **dédoublonnage 🔴** — **`description` 🔴** — **`icon` 🔴** |

### Colonnes

| Colonne | Type | Null ? | Source | Statut |
|---|---|---|---|---|
| `id` | entier non signé | NON | `[PROPOSÉ]` | 🟢 |
| `legacy_category_id` | chaîne ≤ 64 | OUI, UNIQUE | `categories.id` | ⚪ |
| `name` | chaîne ≤ 191 | NON | `categories.name` — 9/9 | 🟢 |
| `slug` | chaîne ≤ 191 | NON | `categories.slug` — 9/9, **non unique** | 🟢 |
| `description` | texte | OUI | `categories.description` — 9/9 | 🟢 |
| `icon` | chaîne ≤ 64 | OUI | `categories.icon` — 9/9, **7 valeurs distinctes** | 🟢 |
| `image_url` | chaîne ≤ 500 | **OUI** | `categories.image` / `.imageUrl` — **2/9, tous deux `''`** ⇒ **NULL 9/9** | 🟢 |
| `position` | entier court | NON | **`COALESCE(sortOrder, order)`** — `order` 9/9 | 🟢 |
| `is_active` | booléen | NON, défaut vrai | `categories.active` — **9/9 à `true`** | 🟢 |
| `created_at` / `updated_at` | date+heure ms | **OUI** | **5/9** | 🟢 |
| `is_test_data` | booléen | NON, défaut faux | `[PROPOSÉ]` | 🟡 |

---
---

# PARTIE 8 — DONNÉES SYSTÈME

## 8.1 Verdict par collection — 🟢 chacune qualifiée

| Collection Firestore | Dans `db.json` ? | Verdict | Destination |
|---|---|---|---|
| `clientPhoneIndex` | ❌ **absente** | 🟢 **MÉCANISME — pas une table** | **Index UNIQUE sur `bebba_clients.phone_normalized`** |
| `orderIdempotencyKeys` | ❌ **absente** | 🟢 **TABLE TECHNIQUE** | **T-11 `bebba_order_idempotency_keys`** |
| `meta/system` | ❌ **absente** | 🟢 **MÉCANISME WordPress** | **T-28 `bebba_settings`**, clé `system_state` |
| `meta/counters` | ❌ **absente** | 🟢 **TABLE TECHNIQUE** | **T-27 `bebba_sequences`** |
| `nextOrderSeq` (racine de `db.json`) | ✅ `1101` | ⚪ **ÉLÉMENT DE MIGRATION TEMPORAIRE** | valeur initiale de T-27, **puis supprimée** |

⚠️ **Les 4 collections sont absentes de `db.json`.** 🟢 **Ce n'est pas un oubli de ma part ni un
export partiel** : `scripts/migrate-to-firestore.ts` ne migre que **9 collections**
(`categories`, `products`, `supplements`, `ingredients`, `suppliers`, `drivers`, `users`, `orders`,
`stockMovements`), et **exigeait explicitement que `orderIdempotencyKeys` soit vide**
(`scripts/migrate-to-firestore.ts:245-250`). **`clientPhoneIndex` et `meta/*` ne font pas partie du
périmètre de migration initial** : ils sont **créés à l'exécution**.

⇒ **Leur contenu réel est INCONNU depuis cet environnement.** 🟡 Toute affirmation sur leur
population serait une invention. **Ce document décrit leur SÉMANTIQUE (démontrée par le code), pas
leur CONTENU.**

## 8.2 `clientPhoneIndex` — 🟢 **devient un index MySQL, pas une table**

### Structure écrite par le code

`server/db.ts:1803-1809` et `:1854-1859` — **identifiant du document = téléphone normalisé (8
chiffres)**, corps :

| Champ | Source |
|---|---|
| `userId` | `users.id` du client |
| `phone` | téléphone **brut** saisi |
| `normalizedPhone` | téléphone normalisé |
| `name` | nom du client |
| `createdAt` | horodatage |

### Sémantique démontrée

| Comportement | Preuve |
|---|---|
| C'est un **cache de recherche** | `getClientByPhone` (`server/db.ts:1782-1814`) : **1.** lecture de l'index ; **2.** si absent, **scan complet** de `users where role == 'client'` |
| Il est **auto-réparant** | `server/db.ts:1801-1808` : en cas de scan concluant, l'index est **recréé à la volée**, avec **`.catch(() => {})`** — ⚠️ **les échecs d'écriture sont silencieusement avalés** |
| Il est **écrit à la création du client** | `server/db.ts:1852-1860`, dans un `writeBatch` avec `users` |
| Il est **supprimé / déplacé** au changement de téléphone | `server/db.ts:1905` (`batch.delete(ancien)`) et `:1907` (`batch.set(nouveau)`) |
| Il est **supprimé** à la suppression du client | `server/db.ts:1946` |
| ⚠️ **Le code contredit les règles** | `firestore.rules:210` : `allow delete: if false` sur `clientPhoneIndex`, **alors que `server/db.ts:1905` et `:1946` appellent `batch.delete`** ⇒ **ces suppressions échouent**, et **un `writeBatch` est atomique : tout le lot échoue** ⇒ 🔴 **AN-130 : le changement de téléphone d'un client est très probablement IMPOSSIBLE** |

### Verdict et justification

🟢 **`clientPhoneIndex` ne devient AUCUNE table.** Il devient :

1. **`UNIQUE (phone_normalized)` sur `bebba_clients`** — 🟢 c'est **exactement** la garantie
   recherchée (1 téléphone = 1 client), obtenue **structurellement** au lieu d'être maintenue par un
   cache.
2. **`INDEX (phone_normalized)` sur `bebba_orders`** — pour la recherche transverse.

**Pourquoi c'est strictement mieux, démontré :**

| Problème du cache Firestore | Résolution en MySQL |
|---|---|
| Désynchronisation possible (le scan de secours existe précisément pour ça, `server/db.ts:1797`) | **Impossible** : l'index **est** la colonne |
| Écriture silencieusement avalée (`.catch(() => {})`, `:1808`) | **Impossible** |
| Suppression interdite par les règles ⇒ lot entier en échec (AN-130) | **Disparaît** : plus de lot |
| Cohérence à maintenir sur 2 collections | **Disparaît** |

⚠️ **Élément de migration temporaire** : si des comptes clients existent dans Firestore, le script
doit **vérifier l'unicité des téléphones normalisés avant de poser la contrainte UNIQUE**.
🟡 **À faire sur export réel** — **`db.json` contient 0 client**, donc **cette vérification est
impossible ici**.

## 8.3 `meta/system` — 🟢 **le verrou le plus critique du système**

### Sémantique démontrée

| Élément | Preuve |
|---|---|
| Lecture | `getSystemState()` — `server/db.ts:162-168` : lit `doc(db,'meta','system')`, renvoie `state`, **`'NOT_STARTED'` si le document n'existe pas** |
| **Verrou de création de commande** | **`server/db.ts:1145-1149`**, **dans la transaction de `createOrder`** : si `!sysSnap.exists() \|\| sysSnap.data()?.state !== 'READY'` ⇒ **lève `SystemNotReadyError`** |
| Code HTTP | **503** (`server/db.ts:87-89`) |
| Message | `'Système temporairement indisponible (migration en cours ou maintenance).'` |
| Règles | `firestore.rules:101-107` : lecture et écriture réservées à `canManageSystemMeta()`, **suppression interdite** |

### 🔴 Conséquence de migration — la plus bloquante de la Partie 8

> **Si `system_state` n'est pas à `'READY'` au démarrage du nouveau système, AUCUNE COMMANDE NE PEUT
> ÊTRE PASSÉE.** Toute la boutique renvoie 503.

**Et l'état réel est inconnu depuis cet environnement.** 🟢 **Mais il est déductible** :
**54 commandes existent**, dont la dernière le `2026-09-04T14:24:17.440Z` ⇒ **`meta/system.state`
valait `'READY'` au moins jusqu'à cette date.** ⚠️ **Sa valeur AUJOURD'HUI est inconnue.**

### Verdict

🟢 **Mécanisme de configuration WordPress**, pas une table métier :

| Option | Avis |
|---|---|
| `wp_options` (natif WordPress) | ⚠️ **Possible mais déconseillé** : `wp_options` est un fourre-tout sans typage, et `autoload` peut dégrader les performances |
| **T-28 `bebba_settings`** | ✅ **recommandé** : table clé/valeur typée, propre au plugin, avec **`system_state`** et **journal de changement** |

**Colonnes de T-28 :** `setting_key` (PK, chaîne ≤ 64), `setting_value` (texte), `value_type`
(énuméré `string`/`int`/`bool`/`json`), `is_public` (booléen), `updated_at`, `updated_by_user_id`,
`description`.

**Valeurs à créer :**

| Clé | Valeur à l'ouverture | Justification |
|---|---|---|
| `system_state` | 🔴 **D-54 — à fixer explicitement à `'READY'`** | 🟢 démontré nécessaire (`server/db.ts:1147`) ; **ne pas laisser `NULL` ni `'NOT_STARTED'`** |
| `delivery_fee` | **2.5** | 🟢 **aujourd'hui codé en dur** dans `server/db.ts:1341`. `[PROPOSÉ]` : le rendre configurable **sans changer la valeur** |
| `order_number_prefix` | **`BEBBA-`** | 🟢 codé en dur `server/db.ts:1338` |
| `next_order_seq` | **voir T-27** | 🟢 |

⚠️ **`deliveryFee = 2.5` est une constante du code, pas une donnée.** Mesuré : **54/54 commandes
ont `deliveryFee = 2.5`**. 🔴 **D-55** : faut-il la rendre configurable ? **Si oui, la valeur
historique des 54 commandes reste figée dans T-04** (c'est déjà un instantané).

## 8.4 Fiche T-27 · `bebba_sequences` — 🟢 table technique

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_sequences` — compteurs monotones (numérotation de commande) |
| **3** | **Source exacte** | `Firestore:meta/counters.nextOrderSeq`. Lu par `CODE:server/db.ts:1190-1192` (**dans la transaction**, avec **repli codé en dur à `1001`** si le document est absent) ; incrémenté par `CODE:server/db.ts:1418-1421` (`nextOrderSeq + 1`, **dans la même transaction**) ; **réinitialisé à `1001`** par `CODE:server/db.ts:2091-2095` (`resetDemoData`) |
| **7-9** | **PK / FK / UNIQUE** | PK `sequence_name`. Aucune FK. Aucune UNIQUE supplémentaire |
| **10** | **Index** | — |
| **11-12** | **Historique / conservation** | **TECHNIQUE VIVANTE**. Aucune conservation |
| **13** | **Migration** | 🟢 **Règle impérative : `next_value = MAX(bebba_orders.order_seq) + 1`.** **Ne PAS recopier `meta/counters.nextOrderSeq`.** Justification : `db.json` porte **`nextOrderSeq: 1101`** et la commande la plus haute est **`BEBBA-1100`** ⇒ cohérent. **Mais `resetDemoData()` le remet à `1001`** (`server/db.ts:2093`) **alors que les suppressions de commandes échouent** (`firestore.rules:173`) ⇒ **après un reset, le compteur rejoue 100 numéros déjà attribués**. **AN-13.** `MAX(order_seq)+1` est **immunisé** contre ce défaut |
| **14** | **Anomalies** | **AN-13** remise à 1001 sans suppression possible des commandes · **AN-131** repli silencieux à `1001` si le document `meta/counters` est absent (`server/db.ts:1192`) — **même conséquence** · **AN-132** `resetDemoData` remet le compteur à 1001 **en production**, via un bouton d'interface permanent |
| **15** | **Traitement** | AN-13/AN-131 → **`UNIQUE(order_number)` + `UNIQUE(order_seq)` sur T-04** : une collision devient une **erreur bloquante** au lieu d'un doublon silencieux. AN-132 → 🔴 **D-34 : ne pas porter `resetDemoData`** |
| **16** | **Certitude** | **🟢 entièrement démontré** |

**Colonnes :** `sequence_name` (chaîne ≤ 64, PK), `next_value` (entier non signé, NON NULL),
`step` (entier, défaut 1), `updated_at`.

**Ligne à créer :** `('order_number', MAX(bebba_orders.order_seq) + 1, 1, …)`.

⚠️ **Alternative à évaluer — 🔴 D-56 :** remplacer la table par une **colonne `AUTO_INCREMENT`
dédiée**. 🟢 **Avantage** : atomicité garantie par le moteur. ⚠️ **Inconvénient** : `AUTO_INCREMENT`
sur `bebba_orders.id` **ne peut pas** être réutilisé pour `order_seq` (les valeurs diffèrent —
`order_seq` démarre à 1001). **Une table de séquences reste donc nécessaire, ou une seconde table
à un seul ligne.**

## 8.5 `nextOrderSeq` à la racine de `db.json` — ⚪ élément de migration temporaire

`db.json` porte **`nextOrderSeq: 1101`** **à la racine**, hors des 9 collections.
🟢 **C'est un artefact de l'export**, pas une donnée Firestore : `meta/counters` est un **document**,
pas une collection. **Verdict : à utiliser comme contrôle de cohérence à l'import**
(`1101 == MAX(order_seq)+1 == 1100+1` ✅), **puis à jeter.**

## 8.6 Récapitulatif Partie 8

| Donnée système | Verdict 🟢 | Justification courte |
|---|---|---|
| `clientPhoneIndex` | **Mécanisme** — index UNIQUE MySQL | cache auto-réparant d'une colonne ; l'index MySQL le rend obsolète |
| `orderIdempotencyKeys` | **Table technique** (T-11) | sémantique à 5 cas, non exprimable par un index |
| `meta/system` | **Mécanisme WordPress** (T-28 `bebba_settings`) | verrou de disponibilité, 1 valeur |
| `meta/counters` | **Table technique** (T-27) | compteur transactionnel |
| `db.json.nextOrderSeq` | **Élément de migration temporaire** | artefact d'export, contrôle puis suppression |
| **`OFFICIAL_INGREDIENTS_STOCK`** | ⚠️ **AUCUN** — 🔴 **D-33** | constante de démonstration dans le code ; **ne devient rien** |
| **`resetDemoData()`** | ⚠️ **À NE PAS PORTER** — 🔴 **D-34** | contrôle destructif permanent exposé à l'admin |

---
---

# PARTIE 9 — DONNÉES HISTORIQUES : CE QUI DOIT ÊTRE FIGÉ

## 9.1 Principe

🟢 **Le système actuel fige déjà l'essentiel — mais pas tout, et pas partout.**
Le tableau ci-dessous répond **exactement** à la question posée : pour chaque donnée susceptible de
changer, **qu'est-ce qui doit être figé dans les commandes historiques ?**

## 9.2 Matrice de gel — 🟢 démontrée ligne à ligne

| Donnée qui peut changer | **Geler ?** | Où dans le modèle cible | **Existe déjà ?** | Preuve |
|---|---|---|---|---|
| **Nom du produit** | ✅ **OUI** | `bebba_order_items.product_name_snapshot` | ✅ **OUI** | `orders.items[].productName` — **56/56** ; affiché sur le suivi public (`server.ts:781-795`) et en cuisine (`KitchenView.tsx:330-372`) |
| **Prix unitaire pratiqué** | ✅ **OUI** | `bebba_order_items.unit_price_after_options` | ✅ **OUI** | `orders.items[].unitPrice` — 36/56 (20 `null`) |
| **Total de ligne** | ✅ **OUI** | `bebba_order_items.item_total_price` | ✅ **OUI** | `orders.items[].itemTotalPrice` |
| **Quantité commandée** | ✅ **OUI** | `bebba_order_items.quantity` | ✅ **OUI** | 56/56 |
| **Prix de base du produit** | ⚠️ **NON, pas directement** | — | ❌ **NON** | 🟢 **déductible** : `unit_price_after_options` **inclut déjà** le prix de base (`server/db.ts:1048`). Le conserver séparément créerait une **seconde source** susceptible de diverger. ⚠️ **Conséquence : impossible de reconstituer la remise ou le prix de base d'origine** — 🔴 **D-57** |
| **Recette du produit** (ingrédients de base) | ✅ **OUI** | `bebba_order_item_ingredients` (T-09) | ✅ **OUI** | `orders.items[].preparationSheet.totalIngredients` — **56/56**, **227 entrées** |
| **Nom de chaque ingrédient de la recette** | ✅ **OUI** | `…ingredient_name_snapshot` | ✅ **OUI** | `totalIngredients[].ingredientName` — 🟢 **c'est lui qui est affiché en cuisine**, pas `ingredients.name` (`server/db.ts:931-933` utilise `base.ingredientName`) |
| **Unité de chaque ingrédient** | ✅ **OUI** | `…unit_code` | ✅ **OUI** | `totalIngredients[].unit` |
| **Quantité par ingrédient** | ✅ **OUI** | `…quantity_per_unit` **+** `…quantity_total` | ⚠️ **PARTIEL** | `totalIngredients[].totalQuantity` = **unitaire** ; **le total n'existe nulle part** (AN-45) mais est **reconstructible et vérifié à 171/171** (§2.11) |
| **Options choisies (libellés)** | ✅ **OUI** | `…protein_label_snapshot`, `…veggies_label_snapshot`, `…base_choice_label_snapshot` | ✅ **OUI** | 11 / 7 / 26 occurrences sur 56 lignes |
| **Supplément de prix de chaque option** | ✅ **OUI** | `…protein_extra_price_snapshot`, etc. | ✅ **OUI** | présent dans chaque bloc d'option |
| **Supplément de quantité de chaque option** | ✅ **OUI** | `…protein_extra_quantity_snapshot`, etc. | ✅ **OUI** | `extraGrams` |
| **Nom de chaque supplément commandé** | ✅ **OUI** | `bebba_order_item_supplements.supplement_name_snapshot` | ✅ **OUI** | **12/12** |
| **Prix de chaque supplément** | ✅ **OUI** | `…unit_price_snapshot` | ✅ **OUI** | **12/12** |
| **Ingrédient consommé par le supplément** | ✅ **OUI** | `…ingredient_id` + `…ingredient_name_snapshot` | ✅ **OUI** | **12/12** |
| **Quantité consommée par le supplément** | ✅ **OUI** | `…quantity_consumed_total` | ✅ **OUI** | **12/12** |
| **Instructions particulières** | ✅ **OUI** | `bebba_order_items.special_instructions` | ✅ **OUI** | 1/56 non vide : `'Sauce servie à part svp. Pas de piment.'` ; injecté en cuisine avec `⚠️ NOTE CLIENT` (`server/db.ts:1095-1097`) |
| **Nom du client** | ✅ **OUI** | `bebba_orders.client_name_snapshot` | ✅ **OUI** | **54/54** |
| **Téléphone du client** | ✅ **OUI** | `…client_phone_raw_snapshot` + `…client_phone_normalized` | ✅ **OUI** | **54/54** |
| **Adresse de livraison du client** | ✅ **OUI** | `…client_delivery_address_snapshot` | ✅ **OUI** | **54/54** — 🟢 **c'est LA réponse à « adresse client » : elle est déjà figée** |
| **Notes du client** | ✅ **OUI** | `…client_notes_snapshot` | ✅ **OUI** | **54/54** (10 non vides) |
| **Nom du livreur** | ✅ **OUI** | `…assigned_driver_name_snapshot` | ✅ **OUI** | **10/10** — 🟢 **indispensable** : `deleteDriver` (`server/db.ts:786-805`) supprime la fiche **sans contrôle**, et le nom est exposé sur le suivi public (`server.ts:753-760`) |
| **Frais de livraison appliqués** | ✅ **OUI** | `…delivery_fee` | ✅ **OUI** | **54/54 à `2.5`** |
| **Sous-total et total facturés** | ✅ **OUI** | `…subtotal`, `…total_amount` | ✅ **OUI** (20 `null`) | **ne jamais recalculer** — AN-55 |
| **Méthode et état de paiement** | ✅ **OUI** | `…payment_method`, `…payment_status` | ✅ **OUI** | 54/54 |
| **Numéro de commande** | ✅ **OUI — IDENTIFIANT PUBLIC** | `…order_number` UNIQUE | ✅ **OUI** | communiqué au client, sert à la récupération anonyme (`server.ts:836-890`) |
| **Jeton de suivi** | ✅ **OUI — IDENTIFIANT PUBLIC** | `…tracking_token` UNIQUE | ✅ **OUI** | **seul moyen d'accès anonyme** au suivi (`server.ts:815-834`) |
| **Historique des statuts** | ✅ **OUI** | `bebba_order_events` (T-07) | ✅ **OUI** | **119 entrées** |
| **Fiche de préparation affichée** (`summaryLines`) | ❌ **NON** | — | ✅ existe mais **à ne pas migrer comme référence** | 🟢 **deux sémantiques contradictoires** (§2.8, Fait 2) : **à régénérer depuis T-09** |
| **Catégorie du produit** | ❌ **NON** | — | ❌ | 🟢 **`orders.items[]` ne porte aucune référence de catégorie** ; la catégorie n'apparaît ni sur le ticket ni sur le suivi |
| **Valeurs nutritionnelles** | ❌ **NON** | — | ❌ | 🟢 non présentes dans les commandes, non affichées sur le suivi |
| **Seuil et coût d'achat des ingrédients** | ❌ **NON** | — | ❌ | 🟢 sans objet : la consommation historique est en **quantités**, pas en coûts |

## 9.3 Les 4 cas où le gel est **insuffisant aujourd'hui**

| # | Cas | Ce qui manque | Traitement |
|---|---|---|---|
| **1** | **Montants** | **20 commandes sur 54** n'ont **ni `subtotal` ni `totalAmount`**, et **20 lignes sur 56** n'ont **ni `unitPrice` ni `itemTotalPrice`** | 🟢 **`NULL` à l'import, jamais 0.** `0` signifierait « gratuit », ce qui est **faux**. 🔴 **D-16** |
| **2** | **Sous-facturation** | **3 commandes** ont un `unitPrice` égal au seul `basePrice`, **options et suppléments ignorés** (AN-55, **−17.8 DT**) | 🟢 **figer la valeur facturée** + exposer `amount_recomputed` et `amount_discrepancy` **en colonnes séparées** |
| **3** | **Quantité totale par ingrédient** | **N'existe nulle part** (AN-45) | 🟢 **calculer à l'import** avec la formule du code (`server/db.ts:1298`) — **vérifiée à 171/171** contre le ledger |
| **4** | **Fiche cuisine affichée** | **`summaryLines` a deux sémantiques** selon l'origine de la commande (AN-44) | 🟢 **ne pas migrer comme référence** ; régénérer depuis T-09. 🟡 **D-24** : archiver la valeur brute en quarantaine ? |

## 9.4 🔴 Ce que le gel actuel **ne protège PAS** — 3 failles démontrées

### Faille 1 — La modification d'une commande ancienne recalcule depuis l'instantané, **mais seulement si `stockConsumed` est faux**

`server/db.ts:1541-1560` : au passage en `preparing`, si `!order.stockConsumed`, le code
**recalcule** `requiredStockMap` **depuis `preparationSheet.totalIngredients`** — ✅ **donc depuis
l'instantané**, c'est correct.
⚠️ **Mais il appelle ensuite `addStockMovement` en boucle**, et **chacun ouvre sa propre
transaction** (`server/db.ts:363`). **Une interruption au milieu laisse la commande partiellement
consommée et `stockConsumed` jamais positionné** ⇒ **AN-18**, et c'est **exactement** l'état de
`BEBBA-1047` (2 paires sur 5, §2.11).

### Faille 2 — Le nom du livreur n'est figé que dans `assignedDriverName`

🟢 Il **est** figé (`server/db.ts:1666`) et **0 divergence sur 10**.
⚠️ Mais **`deleteDriver` supprime la fiche sans contrôle** (`server/db.ts:786-805`) : si
`assignedDriverName` n'avait pas existé, le suivi public (`server.ts:753-760`) afficherait
`undefined`. **Le gel existe — il faut le conserver, pas le « normaliser » en FK seule.**

### Faille 3 — Le prix du produit n'est figé **qu'agrégé**

`orders.items[].unitPrice` contient **`basePrice + options + suppléments`** en **un seul nombre**.
🟢 **Conséquence démontrée** : il est **impossible** de savoir, pour une commande de 2026,
quel était le **prix de base** du produit à cette date, ni **quelle part** venait des options.
Pour `BEBBA-1047`, on ne peut **pas** distinguer « `basePrice` était 14.5 et les options ont été
oubliées » de « `basePrice` était 14.5 et c'était le prix convenu ».
⇒ 🔴 **D-57 : faut-il ajouter `base_price_snapshot` sur `bebba_order_items` ?**
**Recommandation : OUI pour l'avenir** (coût nul, information réelle), **mais les 56 lignes
historiques resteront sans cette valeur** — **il ne faut pas la recalculer depuis le catalogue
actuel**, ce serait une invention.

---
---

# PARTIE 10 — REGISTRE CONSOLIDÉ DES ANOMALIES

## 10.1 Les 5 mécanismes générateurs — 🟢 la plupart des anomalies ont une cause commune

Plutôt que 137 anomalies indépendantes, l'analyse en révèle **5 mécanismes** dans le code.
**Les identifier permet de traiter la cause, pas seulement les symptômes.**

### M-1 · `setDoc` plein document, sans `merge` — `server/db.ts:224, 251, 324, 492, 608, 661`

`saveCategory`, `saveSupplier`, `saveIngredient`, `saveSupplement`, `saveProduct`, `saveDriver`
**réécrivent le document entier**. **Tout champ non reconstruit par la fonction est perdu.**

🟢 **Conséquence démontrée :** `suppliers.suppliedIngredients` est passé de **13 références**
(`server/seedData.ts:85, 92, 99`) à **8** dans `db.json` (**AN-112**, **AN-113**).

### M-2 · Normalisation « complète » avec valeurs par défaut codées en dur

Chaque `save*` reconstruit **tous** les champs, avec des replis **arbitraires** :

| Fonction | Repli codé en dur | Ligne | Conséquence mesurée |
|---|---|---|---|
| `saveProduct` | `order = sortOrder ?? order ?? **10**` | `server/db.ts:579` | 🟢 **explique les `order: 10` des 2 catégories et produits duplicats** (AN-124) |
| `saveProduct` | `imageUrl = … ?? **'https://images.unsplash.com/photo-1546069901-…'**` | `server/db.ts:587` | 🟢 **image externe codée en dur**, présente sur 23/23 produits (AN-133) |
| `saveProduct` | `image = imageUrl ?? image ?? **''**` | `server/db.ts:588` | 🟢 **explique `image: ''`** sur `prod-test-indisponible` (AN-59, AN-128) |
| `saveProduct` | `isAvailable = available !== false && isAvailable !== false` | `server/db.ts:580` | 🟢 **explique les 0 divergence** entre les deux drapeaux (AN-57) |
| `saveProduct` | `customization = prod.customization ?? **{ allowedSupplementIds: [] }**` | `server/db.ts:604-606` | 🔴 **AN-85 : un formulaire qui n'envoie pas `customization` EFFACE toutes les options et tous les suppléments autorisés du produit — silencieusement** |
| `saveSupplement` | `ingredientId = sup.ingredientId ?? (ing ? ing.id : **'ing-legumes'**)` | `server/db.ts:478` | 🔴 **AN-86 : créer un supplément sans choisir d'ingrédient le fait consommer DES LÉGUMES par défaut** |
| `saveSupplement` | `ingredientName = ing ? ing.name : (sup.ingredientName ?? **'Ingrédient'**)` | `server/db.ts:479` | 🟢 **explique exactement `'Ingrédient'` sur les 2 « Guacamole »** (AN-79) — et **prouve** que `ing-4` était **déjà introuvable** à l'enregistrement |
| `saveSupplement` | `quantity = quantityConsumed` (toujours) | `server/db.ts:480-481` | 🟢 **explique la présence de `quantity` sur 2/10 suppléments seulement** (AN-80) |
| `saveSupplement` | `unit = ing ? ing.unit : (sup.unit ?? **'g'**)` | `server/db.ts:482` | 🟢 forçage à `'g'` |
| `saveSupplement` | `quantityConsumed = … ?? **100**` | `server/db.ts:470` | 🔴 **valeur par défaut arbitraire** |
| `saveIngredient` | `currentStock` **non reconstruit** — mais `active ?? true`, `createdAt ?? now` | `server/db.ts:318-324` | 🟢 **explique `active` présent sur 5/19** : seuls les ingrédients passés par `saveIngredient` l'ont (AN-92) |
| `saveCategory` | `imageUrl = … ?? ''`, `order = … ?? 10` | `server/db.ts:215-222` | 🟢 mêmes effets |

### M-3 · Génération d'identifiants par `Date.now()`, sans suffixe aléatoire sur les commandes

| Entité | Génération | Suffixe aléatoire | Ligne |
|---|---|---|---|
| catégories | `'cat-' + Date.now()` | ❌ | `server/db.ts:212` |
| produits | `'prod-' + Date.now()` | ❌ | `server/db.ts:576` |
| suppléments | `'sup-' + Date.now()` | ❌ | `server/db.ts:474` |
| fournisseurs | `'sup-' + Date.now()` | ❌ | `server/db.ts:250` |
| ingrédients | `'ing-' + Date.now()` | ❌ | `server/db.ts:318` |
| **commandes** | **`'ord-' + Date.now()`** | ❌ | **`server/db.ts:1340`** |
| lignes de commande | `'item-' + Math.random().toString(36).substring(2,9)` | ⚠️ aléatoire seul | `server/db.ts:1269` |
| mouvements | `'mov-' + Date.now() + '-' + Math.random()…substring(2,6)` | ✅ | `server/db.ts:377` |

🟢 **Conséquence démontrée :** `db.json` contient **2 mouvements partageant exactement la même
milliseconde** (`mov-1788896746487-mce9` et un second) — **la collision a été évitée par 4
caractères aléatoires**. **Les commandes n'ont pas cette protection** (**AN-15**).

⚠️ **Et `sup-` est utilisé pour DEUX entités** (fournisseurs **et** suppléments) ⇒ **AN-68**.

### M-4 · Suppression sans garde-fou applicatif

🟢 **4 fonctions sur 6 suppriment sans aucun contrôle** : `deleteProduct` (`server/db.ts:612-616`),
`deleteSupplement` (`:496-500`), `deleteSupplier` (`:254-258`), `deleteDriver` (`:786-805`).
**2 ont un garde-fou** : `deleteCategory` (`:229-233`) et `deleteIngredient` (`:339-353`).

🟢 **Conséquence démontrée :** 4 références orphelines dans les commandes (**AN-25**, **AN-39**).

### M-5 · Résolution par sous-chaîne textuelle plutôt que par identifiant

🟢 `server/db.ts:939-947, 957, 966, 977, 988` ciblent les ingrédients par
`ingredientId.includes('poulet')` **etc.** et par `label.includes('Quinoa')`.
`server/db.ts:869-873, 890-894, 910-914` résolvent les options **par libellé**.
`server/db.ts:1069-1090` choisit l'emoji de la fiche cuisine par `val.name.includes('Poulet')`.

🟢 **Conséquences démontrées :** **AN-70** à **AN-77**, **AN-83**, **AN-84**, **AN-87**, **AN-88**.

### 🟢 M-6 · Corollaire exploitable : le discriminateur de provenance

**Un document passé par un `save*` possède TOUS les champs normalisés. Un document issu du seed
n'en possède qu'une partie.** C'est un **critère de provenance fiable**, vérifié sur les 4
collections :

| Collection | Champ complet ⇒ passé par l'interface | Champ partiel ⇒ seed pur |
|---|---|---|
| `products` | **16** (ont `available`, `order`, `sortOrder`, `createdAt`, `updatedAt`) | **7** — **et ce sont exactement les 6 produits réellement vendus** + 1 fantôme |
| `supplements` | **2** (ont `quantity`, `isAvailable`, `order`, `sortOrder`, `createdAt`) | **8** |
| `categories` | **5** (ont `sortOrder`, `createdAt`, `updatedAt`) | **4** |
| `ingredients` | **6** (ont `createdAt`) / **5** (ont `active`) | **13 / 14** |

⇒ **`[PROPOSÉ]` colonne `provenance` (`seed` / `ui` / `unknown`)** sur les tables de référentiel :
🟡 **D-58**. **Utile pour AN-95 et AN-61** (identifier les données de démonstration sans deviner).

### **AN-134** — Valeur d'ordre par défaut codée en dur à **10**

🟢 `saveProduct` (`server/db.ts:579`) et `saveCategory` (`server/db.ts:216`) font
`sortOrder ?? order ?? 10`. **Tout document créé sans ordre explicite reçoit `10`.** C'est
**exactement** la valeur portée par les **2 catégories duplicats** et les **2 produits duplicats**
(`order: 10`, puis `20`, `21`, `22`, `23` pour les suivants).
⇒ **Cause directe de AN-124** (positions dupliquées) : **le repli n'est pas unique par document.**
**Traitement :** 🔴 **D-30 / D-52** — à l'import, `position` est repris **tel quel** ; **le repli à
10 ne doit pas être reproduit**, il doit être remplacé par `MAX(position)+1` dans la catégorie.

### **AN-135** — Provenance des documents non tracée

🟢 **Aucun champ** n'indique si un document vient du seed (`server/seedData.ts`,
`scripts/migrate-to-firestore.ts`) ou d'une saisie administrateur. **Le discriminateur M-6 le
déduit**, mais par **inférence** sur la présence de champs, pas par **trace**.
⇒ **Traitement :** 🟡 **D-58** — `[PROPOSÉ]` colonne `provenance`, alimentée par M-6 **à l'import
uniquement**, puis par le code applicatif ensuite.

---

## 10.2 Les 5 principes de traitement appliqués dans tout ce document

| # | Principe | Fondement |
|---|---|---|
| **P-1** | **Ne jamais inventer une valeur.** Une donnée absente devient `NULL`, jamais `0`, jamais une valeur par défaut | `0` et `NULL` n'ont pas le même sens métier (gratuit vs inconnu) |
| **P-2** | **Ne jamais transformer une anomalie en règle métier.** Une valeur aberrante est migrée **telle quelle** et signalée, pas normalisée | Ex. : `description = 'Description mise à jour avec succès'` (**AN-127**) — écrire une vraie description serait une invention |
| **P-3** | **Ne jamais supprimer une donnée pour la rendre propre.** Les valeurs aberrantes vont en **quarantaine**, pas à la corbeille | Ex. : les 2 ingrédients de test (**AN-95**) |
| **P-4** | **Conserver l'instantané ET exposer l'écart.** Quand une valeur est fausse, on garde la valeur fausse **et** on ajoute la valeur recalculée **dans une autre colonne** | **AN-55** : `total_amount` + `amount_recomputed` + `amount_discrepancy` |
| **P-5** | **Toute incertitude est signalée, jamais tranchée silencieusement** | 🔴 **D-nn** et 🟡 dans chaque fiche |

---

## 10.3 Registre — 137 anomalies classées par traitement

### 🔴 A · DÉCISION MÉTIER BLOQUANTE — 14 anomalies

| AN | Donnée | Exemple concret | Cause probable | Risque de perte | Traitement |
|---|---|---|---|---|---|
| **AN-01** | comptes clients | **0 client** dans `db.json` alors que 54 commandes existent | `db.json` est un export de seed ; les clients sont dans Firestore | **Totale** si l'export n'est pas fait | 🟡 **export Firestore obligatoire** avant tout import |
| **AN-04** | `user_login` client | inexistant : les clients s'authentifient par **téléphone** (`server/db.ts:1782`) | WordPress **exige** un `user_login` non vide et unique | Blocage technique | 🔴 **D-01** — **aucune politique n'est inventée ici** |
| **AN-05** | `passwordHash` | **`""` sur 7/7 comptes** dans `db.json`, alors que `lastLoginAt` va jusqu'au **2026-09-08T21:03** | **les hashes ont été vidés à l'export** ; `scripts/migrate-to-firestore.ts:71` les génère par bcrypt et `:197` les vérifie | **Totale** si l'on conclut à tort « pas de mot de passe » | 🔴 **D-04** — **la source est Firestore, pas `db.json`** |
| **AN-55** | montants de commande | `BEBBA-1047` : devrait être **22.3 DT**, stocké **14.5 DT** (**−7.8**) ; `BEBBA-1049` **−8.5** ; `BEBBA-1048` **−1.5** | données de démonstration écrites sans passer par `server/db.ts:1048` | **Financier** : 17.8 DT | 🔴 **D-16** + **P-4** |
| **AN-62** | recette de produit | `prod-1788252897607` et `prod-1788252928280` référencent **`ing-1`** et **`ing-4`**, inexistants | **schéma d'identifiants antérieur** (`server/db.ts:945, 957` codent `ing-1`…`ing-6` en dur) | **2 produits invendables** | 🔴 **D-11** + quarantaine ; **ré-écrire `ing-1`→`ing-poulet` est INTERDIT** (§3.7) |
| **AN-68** | identifiants `sup-` | `allowedSupplementIds: ['sup-1','sup-3']` = **des fournisseurs** | préfixe partagé (§10.1 M-3) | **Lien produit↔supplément faux** | 🔴 **D-32** + quarantaine ; **interdiction de résoudre contre `suppliers`** |
| **AN-71** | option de substitution | `'Option Végétarienne (Remplacer par Halloumi + Œuf)'`, **+1 DT**, `extraGrams = 0` | le modèle « 1 option ⇒ 1 ingrédient ⇒ 1 quantité » ne sait pas **retirer** | **1 DT facturé, 0 effet** | 🔴 **D-18** — **justifie T-17** |
| **AN-83** | ciblage d'option | `'Ajout Poulet grillé (+120g)'` sur un produit **sans poulet** ajoute **120 g de halloumi** | `.find()` retient `ing-halloumi` (`server/db.ts:943`) | **Facturation + production + vente bloquée** | 🔴 **D-18** — **justifie T-17** |
| **AN-85** | `customization` | `saveProduct` remplace `customization` par `{allowedSupplementIds: []}` si le champ est absent (`server/db.ts:604-606`) | formulaire partiel | **Toutes les options d'un produit effacées** | 🔴 **D-59** : `PUT` partiel ou complet ? |
| **AN-86** | ingrédient de supplément | `saveSupplement` affecte **`ing-legumes`** par défaut (`server/db.ts:478`) | repli arbitraire | **Consommation de stock fausse** | 🔴 **D-60** : interdire le repli |
| **AN-90** | `currentStock` | **17/17 valeurs identiques à `OFFICIAL_INGREDIENTS_STOCK`** (`server/db.ts:2070-2087`), **9/17 différentes du seed** | `resetDemoData()` a été exécuté | **Le stock réel est inconnu** | 🔴 **D-33** — **inventaire physique requis** |
| **AN-112** | lien fournisseur | **9 paires unilatérales** sur 17 | M-1 (`setDoc` plein document) | **Relation d'approvisionnement** | 🔴 **D-39** |
| **AN-116** | `totalDeliveries` | **308 déclarés** vs **4 commandes livrées** ; `drv-3` : 64 déclarés, **0 affectation** | valeur de seed + incrément non transactionnel (`server/db.ts:1626-1632`) | **Statistique de performance** | 🔴 **D-43** |
| **AN-132** | `resetDemoData` | bouton **« Reset Démo » permanent** dans l'en-tête admin (`RoleSwitcher.tsx:146-160, 238-249`) | outil de démonstration jamais retiré | **Destruction en production** | 🔴 **D-34 — ne pas porter** |

### 🟡 B · À VÉRIFIER SUR EXPORT FIRESTORE — 9 anomalies

| AN | Donnée | Ce qui manque pour valider |
|---|---|---|
| **AN-01** | `users` où `role == 'client'` | **export réel** — `db.json` n'en contient aucun |
| **AN-05** | `users.passwordHash` | **export réel** — vides dans `db.json`, prouvés fonctionnels par `lastLoginAt` |
| **AN-21** | `orders.clientId` | **0/54** dans l'instantané mais **écrit par le code** (`server/db.ts:1350`) ⇒ présent dans Firestore dès qu'un compte client existe |
| **AN-50** | `orderIdempotencyKeys` | **collection absente de `db.json`** ; `scripts/migrate-to-firestore.ts:245-250` exigeait qu'elle soit **vide** à l'issue de la migration initiale ⇒ **compter les documents** |
| **AN-98** | `stockMovements.unit` / `.orderId` / `.orderNumber` | **absents des 173 documents** alors que `server/db.ts:381-383` les écrit ⇒ **vérifier si Firestore les porte** |
| **AN-130** | `clientPhoneIndex` | **collection absente** ; ⚠️ `server/db.ts:1905, 1946` appellent `batch.delete` alors que `firestore.rules:210` l'interdit ⇒ **le changement de téléphone d'un client échoue-t-il réellement ?** |
| **AN-136** | `meta/system.state` | **document absent de `db.json`** ; 🟢 déductible à `'READY'` **jusqu'au 2026-09-04** (54 commandes créées) ; **valeur actuelle inconnue** |
| **AN-137** | `meta/counters.nextOrderSeq` | `db.json` porte **1101 à la racine** (artefact d'export) ; **vérifier la valeur du document Firestore** |
| **AN-49** | date de déploiement de `firestore.rules` | 🔴 **D-49** : les suppressions de produits des soumissions n° 3 et n° 4 (§7.1) ont **réussi**, alors que §4.1 démontre que celles de `resetDemoData` ont **échoué** ⇒ **les règles ont changé d'état pendant la fenêtre** |

### ⚪ C · MIGRER TEL QUEL, sans correction — 34 anomalies

| AN | Donnée | Exemple | Traitement |
|---|---|---|---|
| **AN-16** | jetons de suivi | 51 × `tk_` + 12 hex ; **3 × `tk_bebba_1047_demo`** | **aucune contrainte de format** |
| **AN-20** | montants | **20/54 commandes** sans `subtotal` ni `totalAmount` | **`NULL`, jamais `0`** |
| **AN-24** | prix de ligne | **20/56 lignes** sans `unitPrice` | **`NULL`** |
| **AN-25** | `productId` orphelin | `prod-1788252958886` sur `BEBBA-1071` | **`SET NULL`** + `legacy_product_id` + nom conservé |
| **AN-26** | `items[].id` | `'item-' + Math.random()…` | PK surrogate ; `legacy_item_id` **non UNIQUE** |
| **AN-32** | historique incomplet | `BEBBA-1095` : `status='ready'`, historique réduit à `['received']` | **ne pas fabriquer d'entrée** |
| **AN-33** | entrée dupliquée | `BEBBA-1079` : **2 entrées `preparing`** (`'Chef Cuisine Test'`, `'Tentative Doublon'`) ; `BEBBA-1084` idem | **migrer les 2**, `seq` distincts |
| **AN-34** | horodatages identiques | **6 commandes** avec `ready` et `waiting_for_driver` à la **même milliseconde** | PK `(order_id, seq)` |
| **AN-35** | acteur absent | **7/119** entrées sans `updatedBy` | `NULL` |
| **AN-36** | libellé non dérivable | **3 libellés différents pour `received`** | instantané `label` conservé |
| **AN-39** | `supplementId` orphelin | `sup-1788252958889`, `sup-1788252974687` | **`SET NULL`** + instantanés (tous présents) |
| **AN-42** | ingrédient fantôme | `BEBBA-1086` : `ing-fantome-inconnu` / `'Fantôme Inconnu'`, 50 g | `ingredient_id NULL` + **nom conservé** (la cuisine lit le nom) |
| **AN-60** | produits sans dates | **7/23** sans `createdAt` | `NULL` |
| **AN-70** | libellé à 2 prix | `'Double portion légumes (+180g)'` : **2.5 DT** et **3 DT** | le libellé **n'est pas une clé** |
| **AN-79** | `ingredientName='Ingrédient'` | les 2 « Guacamole » | **conserver tel quel** — 🟢 c'est le repli de `server/db.ts:479`, **preuve datée** |
| **AN-91** | `currentStock = null` | `test-ing-kitchen-1788896746450` | **colonne NULL-able** ; ⚠️ en JS `null + 10 = 10` (`server/db.ts:372`) — **comportement à NE PAS reproduire** |
| **AN-94** | `supplierName` libre | `ing-1788825545393` : `'marché'`, sans `supplierId` | **2 colonnes distinctes** |
| **AN-100** | acteurs du ledger | **1/173 résoluble** ; **88 × `'BEBBA KDS Moteur Automatique'`** (0 occurrence dans le dépôt) | `performed_by_user_id NULL` + texte **verbatim** |
| **AN-120** | fiches livreur sans date | **3/3** sans `createdAt` | `NULL` |
| **AN-127** | description = toast | `'Description mise à jour avec succès'` sur **2 catégories** | **P-2** : conserver + quarantaine |
| **AN-128** | images vides | `image: ''`, `imageUrl: ''` sur les 2 catégories duplicats | `NULL` |
| **AN-133** | image par défaut | `server/db.ts:587` injecte une **URL Unsplash codée en dur** | 🟡 **D-61** : externaliser les médias |
| … | *(les 12 restantes sont listées dans les fiches des Parties 2 à 9 et reçoivent le même traitement)* | | |

### 🔧 D · CORRIGER PAR LE SCHÉMA CIBLE — 41 anomalies

| AN | Anomalie | Correction structurelle |
|---|---|---|
| **AN-10** | matrice RBAC **tripliquée** (`server/auth.ts:145-181`, `server.ts`, `AdminView.tsx:42-48`) | **T-06** + capabilities WordPress = source unique |
| **AN-13 / AN-131** | compteur remis à **1001** alors que les suppressions sont bloquées | `UNIQUE(order_number)` + `next_value = MAX(order_seq)+1` |
| **AN-15** | `orderId = 'ord-' + Date.now()` | PK surrogate |
| **AN-17** | `stockConsumed` contradictoire : **24 commandes ont des mouvements alors que le drapeau est absent**, **8 n'en ont pas alors qu'il est `false`** | `stock_state` **dérivé du ledger** |
| **AN-19** | annulation sans restitution : `BEBBA-1079` = **−1 240 unités, 0 restitution** | `stock_state` à **3 états** + type `order_cancellation_restore` |
| **AN-27** | `unitPrice` mal nommé | **`unit_price_after_options`** |
| **AN-29** | matrice de transition **tripliquée** | **T-06** |
| **AN-40 / AN-80** | `quantityConsumed` unitaire **et** total sous le même nom | **2 colonnes distinctes** |
| **AN-43** | `totalIngredients` n'est pas un total | **`quantity_per_unit`** + **`quantity_total`** |
| **AN-45** | quantité totale inexistante | **`quantity_total`**, vérifiée **171/171** |
| **AN-46** | aucune trace d'encaissement | **T-10** |
| **AN-49** | règle `paid ⇒ delivered` dupliquée | contrainte applicative unique |
| **AN-51** | clés d'idempotence **éternelles** | `expires_at` |
| **AN-57 / AN-58 / AN-59 / AN-81 / AN-129** | 5 paires de champs redondants | **abandon du champ mort**, 🟢 justifié par l'absence de lecture |
| **AN-65** | aucun ordre dans la recette | **`position`** explicite |
| **AN-73 à AN-77, AN-84, AN-87, AN-88** | 8 anomalies de ciblage | **T-17 `bebba_product_option_effects`** |
| **AN-107** | unité forcée à `'g'` | `unit_code` dans T-17 |
| **AN-113** | `setDoc` plein document | **T-24** table de liaison |
| **AN-117** | lien livreur unidirectionnel | **`bebba_drivers.user_id UNIQUE`** |
| **AN-118 / AN-114** | suppressions sans garde-fou | **`ON DELETE RESTRICT`** + désactivation |
| **AN-124** | tri non déterministe | index **`(position, id)`** |
| **AN-126** | `slug` non unique | **pas de contrainte UNIQUE** |

### 🚫 E · METTRE EN QUARANTAINE — 12 anomalies

| AN | Objet | Motif de quarantaine |
|---|---|---|
| **AN-56 / AN-78 / AN-122** | 2 produits, 2 suppléments, 2 catégories **duplicats intégraux** | `duplicate_entity` — 🔴 D-11 |
| **AN-61 / AN-67** | `prod-test-indisponible` (sans recette, sans nutriments, `isAvailable=false`) | `test_entity` |
| **AN-62** | 4 références `ing-1` / `ing-4` | `orphan_legacy_id_scheme` |
| **AN-68** | 4 références `sup-1` / `sup-3` dans `allowedSupplementIds` | `supplement_ref_is_supplier_id` |
| **AN-79** | 2 suppléments avec `ingredientName='Ingrédient'` | `ingredient_unresolvable_at_save_time` |
| **AN-95** | `ing-1788825545393`, `test-ing-kitchen-1788896746450` | `test_entity` |
| **AN-08** | `usr-1788252052142` (`agent_test_audit`, rôle **`kitchen`**, `active: true`, **connecté le 2026-09-01**) | `test_account_active` |
| **AN-104** | mouvement `manual_in +10` sur un ingrédient à `currentStock = null` | `null_stock_movement` |
| **AN-127** | 2 descriptions « toast » | `description_is_ui_toast_text` |
| **§2.11** | 10 commandes, **54 paires** de consommation sans mouvement | `stock_ledger_incomplete` |
| **AN-55** | 3 commandes sous-facturées | `amount_discrepancy` |
| **AN-17** | 24 commandes dont le drapeau contredit le ledger | `stock_flag_inconsistent` |

### ℹ️ F · INFORMATION — sans action de migration — 20 anomalies

**AN-02** (téléphone partagé, identités distinctes) · **AN-03** (aucun `email`) · **AN-06** (hashes
partagés par rôle) · **AN-07** (`phone` vide) · **AN-09** (login `admin`) · **AN-11**
(`admin_readonly` quasi inerte) · **AN-12** (routes publiques) · **AN-14** (`ready` persistant) ·
**AN-22 / AN-23** (3 commandes en `ready`, 2 avec livreur) · **AN-31** (`ready` non persistable) ·
**AN-37** (événements hors statut) · **AN-38** (acteurs sans compte correspondant) · **AN-41** (pas de
déduplication de suppléments) · **AN-44** (`summaryLines` à 2 sémantiques) · **AN-47 / AN-48**
(dette non datable ; caisse du jour approximée) · **AN-52 / AN-53** (clé non persistée côté client ;
`POST /api/orders` sans en-tête) · **AN-63** (`active` sans effet) · **AN-64** (pas de `slug`
produit) · **AN-66** (copies dénormalisées à 0 divergence) · **AN-69** (`allowsXChoice` redondant,
**0 incohérence**) · **AN-82 / AN-89 / AN-93 / AN-97** (états d'exploitation, pas défauts de
schéma) · **AN-101 / AN-105 / AN-106 / AN-108 / AN-109 / AN-110** (référentiels) · **AN-111 /
AN-119 / AN-121 / AN-125** (périmètre métier) · **AN-134 / AN-135** (ordres par défaut)

---

## 10.4 Fiches T-29 à T-31 · outillage de migration

### T-29 · `bebba_migration_id_map`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_migration_id_map` — correspondance identifiant Firestore ↔ identifiant MySQL |
| **3** | **Source exacte** | **aucune** — créée par le processus de migration |
| **7-9** | **PK / FK / UNIQUE** | PK `id`. **UNIQUE `(entity_type, legacy_id)`** 🟢 et **UNIQUE `(entity_type, new_id)`** |
| **10** | **Index** | les 2 UNIQUE suffisent |
| **11-12** | **Historique / conservation** | ⚪ **MIGRATION UNIQUEMENT** — **à conserver après coupure** : c'est la seule trace permettant un retour arrière ou un rejeu |
| **13** | **Migration** | 1 ligne par entité migrée : **9 collections + 3 entités non Firestore** (`meta/counters`, `meta/system`, unités/familles dérivées) |
| **14-15** | **Anomalies / traitement** | Aucune. ⚠️ **`entity_type` doit distinguer `supplier` et `supplement`** — sinon **AN-68 se propage dans l'outil de migration lui-même** |
| **16** | **Certitude** | ⚪ |

**Colonnes :** `id`, `entity_type` (énuméré), `legacy_id` (chaîne ≤ 191), `new_id` (entier non
signé), `migrated_at`, `migration_batch_id`, `source_snapshot` (chaîne ≤ 64 — 🟡 `[PROPOSÉ]` :
**indispensable** car `db.json` n'est pas Firestore, §0).

### T-30 · `bebba_migration_quarantine`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_migration_quarantine` — toute donnée migrée **mais non fiable**, conservée avec son motif |
| **3** | **Source exacte** | **aucune** — alimentée par les règles des Parties 2 à 9 |
| **7-9** | **PK / FK / UNIQUE** | PK `id`. Aucune FK (**une ligne de quarantaine doit survivre à la suppression de la ligne migrée**) |
| **10** | **Index** | `(reason_code)` ; `(entity_type, legacy_id)` |
| **11-12** | **Historique / conservation** | ⚪ **MIGRATION UNIQUEMENT**, mais **à conserver** : c'est la **preuve d'audit** |
| **13** | **Migration** | **1 ligne par anomalie des classes A, C et E**, avec la valeur brute **verbatim** |
| **14-15** | **Anomalies / traitement** | ⚠️ **La quarantaine n'est pas une corbeille** (P-3). Toute ligne est **lisible, motivée et réversible** |
| **16** | **Certitude** | ⚪ |

**Colonnes :** `id`, `entity_type`, `legacy_id`, `field_name`, `raw_value` (texte — **`JSON`
recommandé**, MySQL 8.4 le supporte nativement), `reason_code` (chaîne ≤ 64), `anomaly_ref`
(chaîne ≤ 16 — **`AN-nn`**, 🟢 lien direct vers ce registre), `severity` (énuméré `blocking` /
`important` / `informational`), `requires_business_decision` (booléen), `decision_ref` (chaîne ≤ 16
— **`D-nn`**), `detected_at`, `resolved_at` (NULL), `resolution_note` (NULL).

### T-31 · `bebba_migration_log`

| # | Attribut | Valeur |
|---|---|---|
| **1-2** | **Nom / rôle** | `bebba_migration_log` — journal d'exécution par lot |
| **3** | **Source exacte** | **aucune** |
| **7-9** | **PK / FK / UNIQUE** | PK `id` |
| **10** | **Index** | `(batch_id)` ; `(started_at)` |
| **11-12** | **Historique / conservation** | ⚪ **MIGRATION UNIQUEMENT** |
| **13** | **Migration** | — |
| **14-15** | **Anomalies / traitement** | 🟢 **exigence fonctionnelle** : doit permettre de répondre à « **quelles commandes ont été importées depuis quel instantané, et lesquelles ont échoué** » — car §0 établit que **`db.json` n'est pas Firestore** et qu'un **second import** depuis un export réel est **prévisible** |
| **16** | **Certitude** | ⚪ |

**Colonnes :** `id`, `batch_id`, `step`, `entity_type`, `rows_read`, `rows_written`,
`rows_quarantined`, `rows_failed`, `started_at`, `finished_at`, `source_snapshot`, `operator`,
`error_detail` (texte, NULL).

---
---

# ANNEXE A — LISTE DES TABLES PROPOSÉES

## A.1 Tables métier — 24

| # | Table | Rôle en une phrase |
|---|---|---|
| **T-01** | `bebba_clients` | Identité et coordonnées d'un client, avec téléphone normalisé unique servant d'identifiant de connexion |
| **T-02** | `bebba_staff` | Profil métier d'un compte interne (cuisine, livraison, administration, lecture seule) rattaché à `wp_users` |
| **T-04** | `bebba_orders` | Commande client : identifiants publics, instantané du client, totaux facturés, état courant, affectation livreur et état de consommation du stock |
| **T-05** | `bebba_order_items` | Ligne de commande : produit, quantité, options choisies et prix réellement pratiqué, **entièrement figés** |
| **T-06** | `bebba_order_status_transitions` | Source unique de la matrice de transition du cycle de vie et de la capability requise pour chaque passage |
| **T-07** | `bebba_order_events` | Journal append-only de tout événement survenu sur une commande (statut, affectation, note système) |
| **T-08** | `bebba_order_item_supplements` | Suppléments réellement commandés sur une ligne, avec leur effet chiffré sur le stock |
| **T-09** | `bebba_order_item_ingredients` | **Fiche de préparation figée** : ce que la cuisine assemble et ce que le stock consomme, par ligne de commande |
| **T-10** | `bebba_order_payments` | Journal d'encaissement à la livraison : qui, quand, combien — **absent du système actuel** |
| **T-12** | `bebba_products` | Article vendable : nom, prix de base, catégorie, disponibilité et valeurs nutritionnelles |
| **T-13** | `bebba_product_ingredients` | Recette de base d'un produit, par unité, dans un ordre explicite |
| **T-14** | `bebba_product_supplements` | Liste blanche des suppléments commandables sur un produit |
| **T-15** | `bebba_product_option_groups` | Axe de personnalisation d'un produit (protéine, légumes, base) et son activation |
| **T-16** | `bebba_product_options` | Option choisissable : libellé, supplément de prix, supplément de quantité |
| **T-17** | `bebba_product_option_effects` | **Effet déclaré d'une option sur la recette** — remplace le ciblage par sous-chaîne |
| **T-18** | `bebba_supplements` | Supplément vendable : prix, ingrédient consommé et quantité **unitaire** |
| **T-19** | `bebba_ingredients` | Matière première : unité, stock courant, seuil d'alerte, coût unitaire, famille, fournisseur |
| **T-20** | `bebba_stock_movements` | Journal comptable append-only de toute variation de stock, signée et horodatée |
| **T-21** | `bebba_units` | Référentiel des unités de mesure, avec nature (poids, volume, dénombrement) |
| **T-22** | `bebba_ingredient_families` | Regroupement des ingrédients par famille |
| **T-23** | `bebba_suppliers` | Partenaire d'approvisionnement et ses coordonnées |
| **T-24** | `bebba_supplier_ingredients` | Relation N:N fournisseur ↔ ingrédient issue de `suppliedIngredients` |
| **T-25** | `bebba_drivers` | Fiche livreur : identité publique, véhicule, disponibilité, statistiques |
| **T-26** | `bebba_categories` | Regroupement de produits pour la navigation du menu |

## A.2 Tables techniques — 3

| # | Table | Rôle en une phrase |
|---|---|---|
| **T-11** | `bebba_order_idempotency_keys` | Garantit qu'un renvoi du même panier par le même émetteur ne crée pas deux commandes |
| **T-27** | `bebba_sequences` | Compteurs monotones, dont la numérotation des commandes |
| **T-28** | `bebba_settings` | Configuration clé/valeur typée du métier, dont le verrou de disponibilité `system_state` |

## A.3 Outillage de migration — 3

| # | Table | Rôle en une phrase |
|---|---|---|
| **T-29** | `bebba_migration_id_map` | Correspondance identifiant Firestore ↔ identifiant MySQL, par type d'entité |
| **T-30** | `bebba_migration_quarantine` | Toute donnée migrée mais non fiable, conservée avec sa valeur brute et son motif |
| **T-31** | `bebba_migration_log` | Journal d'exécution par lot, permettant un rejeu depuis un instantané identifié |

## A.4 Tables délibérément **NON** créées — avec justification 🟢

| Table envisagée | Verdict | Justification démontrée |
|---|---|---|
| `bebba_client_addresses` | ❌ **non créée** | `User.address` est **mono-valeur** dans le code ; les adresses multiples observées (**AN-02**) sont **déjà figées commande par commande** dans `client_delivery_address_snapshot`. 🔴 **D-05** |
| `bebba_deliveries` | ❌ **non créée** | Une livraison **n'est pas une entité** : c'est un **état** de la commande (`delivering`→`delivered`) plus une **affectation**. Tout est porté par T-04 et T-07. 🔴 **D-48** |
| `bebba_collections` | ❌ **non créée** | Les encaissements sont traités en **T-10** |
| `bebba_client_phone_index` | ❌ **non créée** | 🟢 `clientPhoneIndex` est un **cache auto-réparant** (`server/db.ts:1782-1814`) d'une colonne : il devient **`UNIQUE(phone_normalized)`** sur T-01 |
| `bebba_supplier_deliveries` / `bebba_purchase_orders` | ❌ **non créées** | 🟢 **aucune logique d'achat n'existe** (§5.1). 🔴 **D-40** |
| `bebba_vehicles` | ❌ **non créée** | 3 valeurs, aucune réutilisation, aucune donnée technique structurée. 🔴 **D-45** |
| `bebba_product_recipe_history` | ❌ **non créée par défaut** | 🟢 les commandes anciennes sont **déjà protégées** par T-09. Ne devient utile que si le métier veut « quel était le prix le 3 septembre ». 🔴 **D-29** |
| `bebba_order_status_history` | ❌ **non créée** | remplacée par **T-07 `bebba_order_events`** : 🟢 le contenu réel **n'est pas** un historique de statuts (affectations de livreur, notes système) |
| `wp_posts` / `wp_postmeta` pour les produits | ❌ **non utilisées** | 🔴 **D-19** — voir Annexe B |

**Total : 24 tables métier + 3 tables techniques (T-11, T-27, T-28) + 3 tables d'outillage
= 30 tables.**

⚠️ **Aucune table `bebba_system_state` n'est créée.** 🟢 `meta/system` ne porte **qu'une seule
valeur** (`state`), et `server/db.ts:162-168` la lit comme un réglage : une table dédiée pour une
valeur serait une sur-normalisation. **Cette valeur devient la ligne `system_state` de
T-28 `bebba_settings`.**

⚠️ **`T-03` n'est pas une table** : c'est le **mécanisme de rôles et capabilities de WordPress**
(`wp_usermeta` + `WP_Roles`), décrit en §1.4 pour exhaustivité des 16 attributs.

---

# ANNEXE B — DÉCISIONS ENCORE NÉCESSAIRES

## B.1 🔴 BLOQUANTES — à trancher **avant** toute écriture de schéma SQL : 19

| Réf. | Décision | Pourquoi elle bloque | Éléments à fournir au décideur |
|---|---|---|---|
| **D-01** | **Politique de génération du `user_login` client** | WordPress **exige** un `user_login` non vide et unique ; les clients BEBBA n'ont **que** un téléphone | ⚠️ **Ce document ne propose AUCUNE politique.** Options possibles : téléphone normalisé, `client_<id>`, email à collecter. **Chacune a des conséquences sur la connexion, l'affichage et le RGPD** |
| **D-02** | **Faut-il créer rétroactivement des comptes clients pour les commandes invitées ?** | Détermine si `bebba_orders.client_user_id` est `NULL` pour l'historique | **0/54 commandes** ont un `clientId` dans l'instantané (**AN-21**) |
| **D-03** | **`user_email` WordPress pour les clients** | Champ **NOT NULL** dans `wp_users` ; **aucun client n'a d'email** (**AN-03**) | Options : email technique non fonctionnel, ou collecte préalable |
| **D-04** | **Compatibilité bcrypt ↔ WordPress** | 🟢 `server/auth.ts:41-50` utilise **bcryptjs, salt 10** ; WordPress utilise **phpass** par défaut | **Vérifier que `wp_check_password` accepte `$2a$`/`$2b$`** ; sinon **réinitialisation forcée de tous les mots de passe**. ⚠️ **Les hashes réels sont dans Firestore, pas dans `db.json`** (**AN-05**) |
| **D-11** | **Dédoublonnage du catalogue** | **Conditionne TOUTES les contraintes UNIQUE** | 🟢 **3 duplicats intégraux mesurés** : 2 catégories (`wraps-galettes`), 2 produits (« Wrap Fitness Poulet Avocat »), 2 suppléments (« Guacamole Maison Extra »). ⚠️ **Chaque duplicat de catégorie porte 1 produit distinct, lui-même duplicat** ⇒ **la fusion doit être simultanée sur les 3 niveaux** |
| **D-12** | **`slug` unique ou non ?** | Contrainte d'index | 🟢 **Mesuré : NON unique** (`wraps-galettes` ×2). **V0 supposait l'inverse** |
| **D-13** | **Le statut `ready` est-il persistant ou transitoire ?** | Détermine l'énumération de `status` et le traitement de 3 commandes | 🟢 **Contradiction démontrée** : `server/db.ts:1600-1616` le rend **impersistable**, mais **3 commandes** l'ont et **13 entrées** d'historique le portent |
| **D-14** | **Faut-il une entité « réception fournisseur » ?** | Périmètre du module stock | 🟢 **1 seul mouvement** de ce type existe (`'Réception livraison fournisseur Volailles du Terroir'`), **et son motif n'est produit par aucun code actuel** |
| **D-15** | **Restitution du stock en cas d'annulation** | **Change la valeur de stock à migrer** | 🟢 **`BEBBA-1079`** : `cancelled`, `stockConsumed=true`, **−1 240 unités, 0 restitution**. `order_cancellation_restore` existe **dans les types** (`src/types.ts:46`) et **nulle part dans le code** |
| **D-16** | **Montants `NULL` : conserver ou recalculer ?** | **Nullabilité des colonnes de montant** | 🟢 **20/54 commandes** sans montant (**AN-20**) **et 3 commandes sous-facturées de 17.8 DT** (**AN-55**). **Recommandation : conserver + exposer l'écart** (P-4) |
| **D-17** | **Normalisation `available` / `isAvailable`** | Visibilité du catalogue | 🟢 **`available` n'est lu nulle part** ; `availableOnly` filtre sur `isAvailable` (`server/db.ts:533`). ⚠️ **Mais chez les suppléments c'est l'inverse** : `available` est présent **10/10**, `isAvailable` **2/10** |
| **D-18** | **Périmètre de `bebba_product_option_effects`** | **Détermine 8 colonnes et un moteur** | 🟢 **Version minimale nécessaire** (§3.8, preuves 1 à 4). 🔴 **Version générique = décision d'architecture**. ⚠️ **Les quantités de l'AN-71 (halloumi, œuf) n'existent nulle part** |
| **D-19** | **WooCommerce ou tables métier ?** | **Décision d'architecture structurante** | 🟢 **Arguments contre WooCommerce** : la recette par ingrédient, la fiche de préparation, le stock en grammes/ml/portions, les options à effet sur la recette et le cycle de vie à 7 statuts **n'ont aucun équivalent WooCommerce**. **Recommandation : tables métier** |
| **D-20** | **MySQL 8.4 confirmé ?** | Collations, `JSON`, expressions par défaut | ✅ **Tranché par le cahier des charges** : **MySQL 8.4**. ⚠️ **À re-vérifier si l'hébergeur impose MariaDB** — plusieurs comportements diffèrent |
| **D-32** | **Les 4 références `sup-1`/`sup-3` dans `allowedSupplementIds`** | 4 lignes de T-14 | 🔴 **AN-68** : ce sont **des fournisseurs**. **Ni supprimables ni remplaçables sans décision** |
| **D-33** | **Valeur du stock à l'ouverture** | **`bebba_ingredients.current_stock`** | 🟢 **`currentStock` = copie exacte de `OFFICIAL_INGREDIENTS_STOCK` (`server/db.ts:2070-2087`)**, **différente du seed sur 9/17**. ⚠️ **Ce document ne propose AUCUNE valeur** |
| **D-34** | **Porter ou non `resetDemoData()`** | **Risque de destruction en production** | 🟢 Bouton **permanent** dans l'en-tête admin (`RoleSwitcher.tsx:146-160, 238-249`), écrase **17 stocks** et remet le compteur à **1001**. **Recommandation : NE PAS PORTER** |
| **D-59** | **`PUT` complet ou partiel sur les produits ?** | **AN-85** : effacement silencieux de `customization` | 🟢 `server/db.ts:604-606` remplace `customization` par `{allowedSupplementIds: []}` si absent |
| **D-60** | **Interdire le repli `ing-legumes` sur les suppléments** | **AN-86** : consommation de stock arbitraire | 🟢 `server/db.ts:478` |

## B.2 🟡 IMPORTANTES NON BLOQUANTES : 24

| Réf. | Décision | Élément démontré |
|---|---|---|
| **D-05** | Carnet d'adresses client | `User.address` mono-valeur ; adresses déjà figées par commande |
| **D-06** | Conserver le login `admin` | **AN-09** — 🟡 risque de sécurité, pas de schéma |
| **D-07** | PK de `bebba_clients` | surrogate vs `phone_normalized` |
| **D-08** | `full_name` redondant avec `wp_users.display_name` | double écriture à synchroniser |
| **D-09** | `internal_role` redondant avec les capabilities | **AN-10** |
| **D-10** | Périmètre exact de `admin_readonly` | **AN-11** : quasi inerte, 1 seul endpoint dédié (`server.ts:446`) |
| **D-21** | Élargir `payment_method` au-delà de `cash_on_delivery` | 🟢 **littéral unique** dans `src/types.ts:189`, **54/54** dans les données |
| **D-22** | Accepter 3 axes d'options fixes plutôt qu'un modèle générique | §2.3 — **le hash d'idempotence en dépend** |
| **D-23** | Contrainte UNIQUE sur `(order_item_id, supplement_id)` | **AN-41** : le code ne déduplique pas ; **0 doublon sur 12** |
| **D-24** | Archiver `summaryLines` brut en quarantaine | **AN-44** : 2 sémantiques contradictoires |
| **D-25** | Encaissements partiels autorisés ? | Détermine UNIQUE sur `bebba_order_payments.order_id` |
| **D-26** | Purge des données de test | **AN-08, AN-95, AN-61** — ⚠️ **P-3 : ne pas purger avant la recette** |
| **D-27** | TTL des clés d'idempotence | **AN-51** : éternelles aujourd'hui |
| **D-28** | Le hash d'idempotence doit-il intégrer `extraPrice`/`extraGrams` **client** ? | 🟢 `server.ts:956-964` les intègre alors que `computePreparationSheet` les **ignore** (`server/db.ts:875-880`) ⇒ **422 sur paniers métier identiques** |
| **D-29** | Versionner recettes et prix | 🔴 lié à la traçabilité tarifaire |
| **D-30** | Ordre d'affichage des 7 produits sans `order` | **ces 7 sont ceux qui réalisent 100 % du CA observé** |
| **D-31** | Faut-il un `slug` produit pour WordPress | **AN-64** : le champ n'existe pas |
| **D-35** | Contrainte de cohérence signe / type de mouvement | **AN-102** : 171 négatifs, 2 positifs |
| **D-36** | Introduire des conversions d'unités | 🟢 **aucune n'existe** ; toute agrégation multi-unités est impossible |
| **D-37** | Granularité des familles d'ingrédients | **AN-108** : `Légumes` vs `Légumes & Fruits`, `Protéines` vs `Protéines & Fromages` |
| **D-38** | `ing-repas-programme` : ingrédient ou produit ? | **AN-109** : 8.5 DT/portion, **382.50 DT** soit **20,7 %** de la valeur du stock, **0 mouvement** |
| **D-39** | Importer les 9 paires fournisseur unilatérales | **AN-112** |
| **D-40** | Conserver `bebba_suppliers` | **AN-111** : 🟢 **aucun code ne le consomme** |
| **D-41** | Une ou deux représentations du lien fournisseur | redondance assumée (§5.4) |

## B.3 🟡 Suite — décisions importantes (2)

| Réf. | Décision | Élément démontré |
|---|---|---|
| **D-42 à D-47** | Livreurs : téléphone de référence, `totalDeliveries`, `rating`, véhicule, réalignement des noms, statut opérationnel | **AN-115, AN-116, AN-119, AN-121** — 🟢 pour `drv-2`, `users.phone` (`+216 97 654 321`) **et** `drivers.phone` (`+216 55 987 654`) diffèrent : **impossible de savoir lequel est le bon** |
| **D-50 à D-53** | Catégories : fusion `boissons`/`jus-detox`, icônes `lucide-react`, renumérotation, description « toast » | **AN-124, AN-125, AN-127** |
| **D-54** | Valeur de `system_state` à l'ouverture | 🟢 **si elle n'est pas `'READY'`, aucune commande ne peut être passée** (`server/db.ts:1145-1149`, HTTP **503**) |
| **D-55** | Rendre `delivery_fee` configurable | 🟢 constante `2.5` codée en dur (`server/db.ts:1341`), **54/54** |
| **D-56** | Séquence par table ou colonne `AUTO_INCREMENT` dédiée | §8.4 |
| **D-57** | Ajouter `base_price_snapshot` aux lignes de commande | **Faille 3** (§9.4) : le prix de base d'origine est **irrécupérable** |
| **D-58** | Colonne `provenance` (`seed` / `ui`) | 🟢 **M-6** : discriminateur fiable et vérifié sur 4 collections |
| **D-61** | Externaliser les médias | **AN-133** : URL Unsplash codée en dur (`server/db.ts:587`) |

## B.4 ⚪ PUREMENT TECHNIQUES : 8

| Réf. | Décision | Recommandation |
|---|---|---|
| **D-27 bis** | Persistance du rate-limiting | 🟢 **aujourd'hui en mémoire** (`server.ts:795-800`) ⇒ **inefficace en multi-process**. À persister |
| **D-33 bis** | Collation | `utf8mb4_0900_ai_ci` (MySQL 8.4) — ⚠️ **`utf8mb4` obligatoire** : les emojis des fiches cuisine sont sur **4 octets** |
| **D-34 bis** | `DATETIME(3)` vs `TIMESTAMP` | **`DATETIME(3)` en UTC** — 🟢 les 436 horodatages de l'instantané sont ISO-8601 UTC à la milliseconde ; `TIMESTAMP` sature en 2038 |
| **D-35 bis** | Précisions décimales | montants **(10,3)** 🟢 arrondi à 0,1 dans le code (`server/db.ts:1048`) ; quantités **(12,3)** ; `purchase_cost` **(12,6)** 🟢 valeur réelle minimale **0.002** |
| **D-36 bis** | Convention d'index de `position` | 0 ou 1 — **à figer une fois pour toutes** |
| **D-37 bis** | Ordre de verrouillage et gestion des interblocages | 🟢 `createOrder` verrouille dans l'ordre de `requiredStockMap` ; **le chemin de rattrapage `server/db.ts:1541-1557` ne verrouille pas du tout** (**AN-18**) |
| **D-38 bis** | `legacy_*_id` UNIQUE ou non | ⚪ UNIQUE **après vérification de collision** sur export réel |
| **D-39 bis** | `JSON` natif vs texte pour `raw_value` | MySQL 8.4 supporte `JSON` nativement — **recommandé** |

---

# ANNEXE C — DONNÉES À NE PERDRE SOUS AUCUN PRÉTEXTE

## C.1 Niveau 1 — perte **irréversible** et **immédiate**

| Donnée | Volume réel | Pourquoi la perte est irréversible |
|---|---|---|
| **`orders.orderNumber`** | **54** (`BEBBA-1047`…`BEBBA-1100`) | 🟢 **identifiant public communiqué au client** ; sert à la récupération anonyme (`server.ts:836-890`). **Un client qui rappelle avec son numéro doit pouvoir être retrouvé** |
| **`orders.trackingToken`** | **54** (51 × `tk_…`, 3 × `tk_bebba_NNNN_demo`) | 🟢 **seul moyen d'accès anonyme au suivi** (`server.ts:815-834`). **Les liens déjà partagés doivent continuer à fonctionner** |
| **`users.passwordHash`** | ⚠️ **dans Firestore, pas dans `db.json`** | 🟢 **AN-05** : vides à l'export mais **prouvés fonctionnels** par `lastLoginAt` jusqu'au **2026-09-08T21:03**. **Sans eux, 7 comptes internes doivent être réinitialisés** |
| **`stockMovements.notes`** | **173** | 🟢 **AN-98/AN-99** : contient **le nom du produit et la quantité** (`'Préparation commande #BEBBA-1098 (BEBBA Chicken Power Bowl x1)'`) — information **absente de toute autre colonne**, `orderId` et `orderNumber` **n'existant pas** dans les documents |
| **`stockMovements.performedBy`** | **173** | 🟢 **AN-100** : **1/173 résoluble**. Le texte est **la seule trace** de l'acteur. `'BEBBA KDS Moteur Automatique'` ×88 est **la seule preuve** de l'existence d'un moteur antérieur |
| **`orders.statusHistory[].updatedBy`** | **112/119** | 🟢 **13/119 résolubles** ; le texte est la seule trace pour les 31 restants |

## C.2 Niveau 2 — perte **irréversible** car **non reconstructible**

| Donnée | Volume | Pourquoi |
|---|---|---|
| **`items[].preparationSheet.totalIngredients`** | **227 entrées** sur 56 lignes | 🟢 **la recette au moment de la commande**. **Le catalogue a changé depuis** ; **`updateOrderStatus` recalcule le stock depuis cet instantané** (`server/db.ts:1546-1560`). **Sans lui, une commande ancienne passant en préparation consommerait la recette d'aujourd'hui** |
| **`items[].productName`** | **56/56** | 🟢 **2 lignes** référencent des produits **supprimés** (**AN-25**) : le nom est **la seule** information restante |
| **`items[].supplements[]`** (8 champs) | **12 lignes, 100 % de présence** | 🟢 **instantané le plus complet du projet** ; 2 références orphelines (**AN-39**) |
| **`client.name` / `.phone` / `.deliveryAddress` / `.notes`** | **54/54 chacun** | 🟢 **0 compte client** dans l'instantané ⇒ **c'est la seule identité des 54 acheteurs** |
| **`assignedDriverName`** | **10/10** | 🟢 `deleteDriver` (`server/db.ts:786-805`) supprime **sans contrôle** ; le nom est exposé sur le suivi public |
| **`ingredientName` dans les recettes et les fiches** | 64 + 227 | 🟢 **c'est lui qui est affiché en cuisine**, pas `ingredients.name` (`server/db.ts:931-933`) |
| **`supplements[].ingredientName = 'Ingrédient'`** | 2 | 🟢 **AN-79** : c'est le repli de `server/db.ts:479`. **Le « corriger » détruirait la preuve** que `ing-4` était déjà introuvable |
| **`categories.description = 'Description mise à jour avec succès'`** | 2 | 🟢 **AN-127** — même logique (P-2) |

## C.3 Niveau 3 — perte **financière ou juridique**

| Donnée | Volume | Pourquoi |
|---|---|---|
| **`subtotal`, `deliveryFee`, `totalAmount`** | 34/54 non nuls | 🟢 **montants facturés**. ⚠️ **3 sont erronés** (**AN-55**, −17.8 DT) : **conserver la valeur erronée ET l'écart** (P-4) |
| **`unitPrice`, `itemTotalPrice`** | 36/56 non nuls | idem |
| **`paymentMethod`, `paymentStatus`** | 54/54 | 🟢 **`BEBBA-1091` est une dette réelle** : `delivered` + `to_collect` + **17 DT** |
| **`statusHistory[].timestamp`** | 119 | 🟢 **horodatages d'origine** ; **6 commandes** ont des doublons à la milliseconde (**AN-34**) — **ne jamais régénérer** |
| **`stockMovements.quantity` avec son signe** | 173 | 🟢 171 négatifs, 2 positifs. **Le signe est dans la donnée** |
| **`ingredients.currentStock`** | 19 | ⚠️ 🔴 **D-33** : ce sont **les constantes de `resetDemoData`**. **À conserver comme « dernière valeur connue du système »**, mais **pas comme inventaire physique** |

## C.4 ⛔ Ce qu'il ne faut **PAS** conserver comme référence

| Donnée | Pourquoi |
|---|---|
| **`preparationSheet.summaryLines`** | 🟢 **AN-44** : **2 sémantiques contradictoires** selon l'origine de la commande (§2.8). **À régénérer depuis T-09**, pas à migrer comme vérité |
| **`products.available`, `products.sortOrder`, `products.image`** | 🟢 **champs morts** : jamais lus, ou copies exactes (§3.1) |
| **`categories.order`** | 🟢 remplacé par `COALESCE(sortOrder, order)` — la règle exacte du code (`server/db.ts:181-182`) |
| **`supplements.quantity`** | 🟢 toujours égal à `quantityConsumed` (`server/db.ts:480-481`), présent sur 2/10 |
| **`orders.stockConsumed`** | 🟢 **AN-17** : **contredit le ledger dans 24 cas**. **À reconstruire depuis T-20** |
| **`orders.phone` à la racine** | 🟢 **0/54** ; lu en secours par `server/db.ts:1478` ⇒ **branche morte** |
| **`drivers.totalDeliveries`** *comme statistique* | 🟢 **AN-116** : 308 déclarés vs 4 livraisons réelles. **À conserver comme valeur déclarée**, **pas comme mesure** |
| **`OFFICIAL_INGREDIENTS_STOCK`** *comme inventaire* | 🟢 **AN-90** : constantes de démonstration codées en dur |

---

# ANNEXE D — POINTS AMBIGUS OU CONTRADICTOIRES DU MODÈLE ACTUEL

## D.1 Contradictions **code ↔ données** — 6

| # | Contradiction | Preuve code | Preuve données |
|---|---|---|---|
| **1** | **Le statut `ready` est impersistable… mais persisté** | `server/db.ts:1600-1616` écrit `waiting_for_driver` quand on demande `ready` | **3 commandes** en `status='ready'` (`BEBBA-1095`, `BEBBA-1068`, `BEBBA-1060`) ; **13 entrées** d'historique `ready` |
| **2** | **`stockConsumed` est écrit `true` à la création… mais absent ou faux pour des commandes consommées** | `server/db.ts:1362` | **24 commandes** ont des mouvements alors que le drapeau est **absent** ; **8** n'en ont pas alors qu'il est **`false`** |
| **3** | **`createOrder` consomme tout le stock requis… mais une commande est partiellement consommée** | `server/db.ts:1383-1401` itère **toutes** les paires | **`BEBBA-1047`** : 2 paires sur 5 (manquent `ing-legumes`, `ing-avocat`, `ing-sauce-healthy`) |
| **4** | **Les notes de mouvements sont produites par le code… mais aucune des 173 ne correspond** | `server/db.ts:1399, 1581` | **173/173 incompatibles** (§4.4) |
| **5** | **`firestore.rules` interdit toute suppression… mais des suppressions ont réussi** | `firestore.rules:229, 239` | **4 références orphelines** dans les commandes (§7.1, soumissions n° 3 et 4) |
| **6** | **`clientPhoneIndex` est protégé en suppression… mais le code le supprime** | `firestore.rules:210` vs `server/db.ts:1905, 1946` | ⚠️ **un `writeBatch` est atomique** ⇒ **AN-130 : le changement de téléphone d'un client échoue probablement en entier** |

## D.2 Contradictions **code ↔ code** — 5

| # | Contradiction | Emplacements |
|---|---|---|
| **7** | **Matrice de transition dupliquée 3 fois** | `server/db.ts:1512-1520` · `server/auth.ts:154-163` · `AdminView.tsx:42-48` |
| **8** | **Règle `paid ⇒ delivered` dupliquée** | `server/db.ts:1686-1689` · `server.ts:1231-1234` |
| **9** | **`ing-quinoa` est substituable dans 2 branches mais pas dans la 3ᵉ** | `server/db.ts:967, 978` le **remplacent** ; `:989` **ne le retire pas** ⇒ **AN-87** |
| **10** | **Le hash d'idempotence intègre des valeurs que le moteur ignore** | `server.ts:956-964` (hash) vs `server/db.ts:875-880, 896-901, 916-920` (recette) ⇒ **422 sur paniers métier identiques** |
| **11** | **Deux règles de tri pour deux collections voisines** | `getCategories` trie (`server/db.ts:180-186`) ; `getProducts` **ne trie pas** (`:503-540`) |

## D.3 Ambiguïtés **sémantiques** — 7

| # | Ambiguïté | Détail |
|---|---|---|
| **12** | **`totalIngredients` n'est pas un total** | 🟢 **AN-43** : `server/db.ts:1056-1061` **sans** multiplicateur ; `:1063-1068` **avec** — et cette seconde liste **n'est jamais persistée** |
| **13** | **`quantityConsumed` a deux sens** | 🟢 **AN-40** : **unitaire** dans `supplements`, **total** dans `orders.items[].supplements[]` (`server/db.ts:1018`). ⚠️ **Invisible aujourd'hui** : les 12 lignes réelles sont toutes en quantité 1 |
| **14** | **`unitPrice` n'est pas le prix unitaire du produit** | 🟢 **AN-27** : c'est `basePrice + options + suppléments` (`server/db.ts:1048`). **Et le prix de base d'origine est irrécupérable** (D-57) |
| **15** | **Le préfixe `sup-` désigne deux entités** | 🟢 **AN-68** : `suppliers` **et** `supplements`, tous deux générés par `'sup-' + Date.now()` (`server/db.ts:250, 474`) |
| **16** | **`supplierName` : instantané ou texte libre ?** | 🟢 **texte libre** : `IngredientModal.tsx:259-260` est un `<input>` ; `'marché'` sur `ing-1788825545393` sans `supplierId` |
| **17** | **Deux représentations du lien fournisseur, non synchronisées** | 🟢 **AN-112** : 8 paires cohérentes, **9 unilatérales**, 0 contradictoire |
| **18** | **L'ordre de la recette décide silencieusement du ciblage** | 🟢 **AN-88** : `.find()` sur `baseIngredients` **sans champ d'ordre** (`order` présent sur **0/64**) |

## D.4 Ambiguïtés **de nommage** — 5 paires de champs redondants

| Paire | Présence réelle | Lequel est lu par le code ? |
|---|---|---|
| `products.available` / `products.isAvailable` | 16/23 · 23/23 | 🟢 **`isAvailable`** (`server/db.ts:533`) — `available` **jamais lu** |
| `supplements.available` / `supplements.isAvailable` | **10/10** · **2/10** | ⚠️ **`available`** domine ici — **présences inversées par rapport aux produits** |
| `products.order` / `products.sortOrder` | 16/23 · 16/23 | 🟢 **toujours égaux** ; `saveProduct` écrit les deux (`:579, 597-598`) |
| `categories.order` / `categories.sortOrder` | 9/9 · 5/9 | 🟢 **`COALESCE(sortOrder, order)`** (`server/db.ts:181-182`) |
| `products.image` / `products.imageUrl` | 4/23 · 23/23 | 🟢 **`imageUrl`** ; `image` **vide** sur `prod-test-indisponible` |
| `supplements.quantity` / `supplements.quantityConsumed` | 2/10 · **10/10** | 🟢 **`quantityConsumed`** ; `quantity` **toujours égal** (`server/db.ts:480-481`) |

## D.5 Zones d'ombre **non résolubles depuis cet environnement** — 4

| # | Zone | Ce qui manque |
|---|---|---|
| **19** | **Contenu réel de Firestore** | 🟢 **Établi en §0** : égress filtré, aucun compte de service, `firestore.rules` exige `request.auth != null`. **`db.json` est un instantané borné au 2026-09-01 → 2026-09-08** |
| **20** | **`clientPhoneIndex`, `orderIdempotencyKeys`, `meta/system`, `meta/counters`** | **4 collections absentes de l'instantané** ; hors périmètre de `scripts/migrate-to-firestore.ts` |
| **21** | **Le moteur « BEBBA KDS Moteur Automatique »** | 🟢 **88 mouvements** lui sont attribués ; **0 occurrence dans le dépôt**. **Son code n'existe plus** ⇒ **tout rejeu est impossible** |
| **22** | **Date de déploiement de `firestore.rules`** | 🔴 **D-49** : seule façon d'expliquer la contradiction n° 5 |

---

# ANNEXE E — NIVEAU DE CONFIANCE GLOBAL DU MAPPING

## E.1 Méthode

⚠️ **Aucun pourcentage global n'est fourni.** Un pourcentage unique serait **une invention** : il
supposerait que toutes les tables ont le même poids et que toutes les colonnes sont également
vérifiables. **La confiance est exprimée par nature d'affirmation**, ce qui est **vérifiable
ligne à ligne**.

## E.2 Ce qui a été **effectivement vérifié**

| Vérification | Méthode | Résultat |
|---|---|---|
| **Census exhaustif des champs** | décompte programmatique sur les **9 collections** de `db.json` | 🟢 **54 commandes, 56 lignes, 12 suppléments, 227 entrées de recette, 119 événements, 173 mouvements, 23 produits, 19 ingrédients, 10 suppléments, 9 catégories, 3 fournisseurs, 3 livreurs, 7 comptes** |
| **Citation du code** | **relecture ligne à ligne** de `server/db.ts` (2 211 lignes), `server.ts` (1 295), `server/auth.ts` (191), `server/seedData.ts` (1 531), `firestore.rules` (285), `scripts/migrate-to-firestore.ts` (288) | 🟢 **~40 références de lignes re-vérifiées** pour ce document |
| **Réconciliation quantitative** | `Σ (totalIngredients.totalQuantity × items.quantity)` vs `Σ \|stockMovements.quantity\` | 🟢 **171/171 paires exactes** ; **54 manquantes** ; **0 valeur divergente** |
| **Cohérence financière** | `subtotal` vs `Σ itemTotalPrice`, `totalAmount` vs `subtotal + deliveryFee` | 🟢 **0 écart sur 34 commandes** |
| **Recalcul des prix** | `unitPrice` vs `basePrice + options + suppléments` | 🟢 **33/36 conformes**, **3 sous-facturées de 17.8 DT** |
| **Simulation du moteur de recette** | application littérale des `.find()` de `server/db.ts:939-947, 957` aux 12 produits personnalisables | 🟢 **AN-83, AN-84, AN-87, AN-88 démontrées** |
| **Résolution des acteurs** | motif `` `<users.name> (<RoleLabel>)` `` de `server.ts:1128-1130` appliqué à 119 + 173 entrées | 🟢 **13/119 et 1/173 résolubles** — mesuré, pas estimé |
| **Attribution des notes de mouvements** | comparaison aux **4 motifs** que le code peut produire | 🟢 **173/173 incompatibles** |
| **Provenance des documents** | présence des champs de normalisation `save*` | 🟢 **discriminateur fiable vérifié sur 4 collections** (M-6) |

## E.3 Confiance **par nature d'affirmation**

| Nature d'affirmation | Confiance | Fondement |
|---|---|---|
| **Structure des tables proposées** (colonnes, PK, FK) | 🟢 **VALIDÉ** | déduite de champs **écrits ligne à ligne** dans le code **et** observés dans les données |
| **Sémantique des champs** | 🟢 **VALIDÉ** | démontrée par le code de production, **et** vérifiée sur les données réelles (réconciliation 171/171) |
| **Types de données et précisions** | 🟢 **VALIDÉ** | déduits des **plages réelles mesurées** (ex. `purchase_cost` en (12,6) parce que **0.002** existe) |
| **Contraintes UNIQUE** | 🟢 **VALIDÉ** là où un doublon a été **mesuré** (⇒ **refusées** : `slug`, `name` de catégorie/produit/supplément) ; 🟡 **À VÉRIFIER** ailleurs (population Firestore réelle inconnue) |
| **Règles de conservation historique** | 🟢 **VALIDÉ** | matrice §9.2 établie champ par champ contre le code |
| **Valeurs à migrer** (population) | 🟡 **À VÉRIFIER** | **plafonné à l'instantané `db.json`, fenêtre 2026-09-01 → 2026-09-08** |
| **`current_stock`** | 🔴 **DÉCISION MÉTIER** | 🟢 démontré **être une constante codée en dur**, pas un solde |
| **Montants historiques** | 🔴 **DÉCISION MÉTIER** | 🟢 20 absents **et** 3 erronés |
| **Dédoublonnage** | 🔴 **DÉCISION MÉTIER** | 🟢 3 duplicats intégraux mesurés |
| **Effets d'options (T-17)** | 🔴 **DÉCISION MÉTIER** pour le **peuplement** ; 🟢 **VALIDÉ** pour la **nécessité** | §3.8, preuves 1 à 4 |
| **`client_user_id`, `passwordHash`, collections système** | 🟡 **À VÉRIFIER** | **absents de l'instantané** |
| **Tables d'outillage (T-29 à T-31)** | ⚪ **MIGRATION UNIQUEMENT** | aucune source, aucun risque métier |

## E.4 Les **3 limites** qui plafonnent la confiance — énoncées explicitement

| # | Limite | Conséquence | Ce qui la lèverait |
|---|---|---|---|
| **1** | **Firestore est inaccessible depuis cet environnement** | 🟢 **Établi en §0** : DNS résolu mais egress filtré par liste blanche (`firestore.googleapis.com` → `SSL_ERROR_SYSCALL`) ; **aucun compte de service** (seule une `apiKey` web existe, `firebase-applet-config.json`) ; `firestore.rules` exige `request.auth != null`. **Toute affirmation sur les données est plafonnée à `db.json`** | **Un export Firestore complet**, réalisé par le propriétaire du projet |
| **2** | **`db.json` est borné au 2026-09-01 → 2026-09-08** | 🟢 436 horodatages ISO mesurés. **Tout ce qui est postérieur au 2026-09-08T21:03 est inconnu.** Les volumes (54 commandes, 173 mouvements) sont donc **des minima**, pas des totaux | idem |
| **3** | **4 collections sont absentes de l'instantané** | `clientPhoneIndex`, `orderIdempotencyKeys`, `meta/system`, `meta/counters`. 🟢 **Leur sémantique est démontrée par le code ; leur contenu est inconnu.** **Ce document décrit la première, jamais le second** | idem |

## E.5 Corrections apportées à la contre-expertise V0

🟢 **Ce document corrige 5 affirmations de V0**, toutes par **mesure** :

| V0 affirmait | V1 mesure |
|---|---|
| « `slug` est unique » | ❌ **`wraps-galettes` apparaît 2 fois** (AN-126) |
| « 100 % des acteurs des historiques sont non résolubles » | ❌ **13/119 résolubles** avec certitude, **66/119 attribuables au système par le code**, **38/119 non résolubles** (§2.5) |
| « `suppliedIngredients` est la relation fournisseur faisant foi » | ❌ **aucune des deux relations n'est lue par le code** (§5.1) |
| « `ing-oeuf` est sous son seuil » | ❌ **65 > 20** : seul **`ing-halloumi`** (10 ≤ 1 000) est critique |
| « 10 commandes ont des mouvements alors que `stockConsumed` est absent ou faux » | ❌ **24** (§2.1, AN-17) |

## E.6 Verdict synthétique

> **Le mapping de STRUCTURE est 🟢 VALIDÉ** : chaque table, chaque colonne, chaque contrainte de ce
> document est **rattachée à une ligne de code ou à une mesure sur les données réelles**, et les
> **16 attributs** sont renseignés pour **les 30 tables**.
>
> **Le mapping de POPULATION est 🟡 À VÉRIFIER** : il est **plafonné à un instantané de 8 jours**,
> et **4 collections** ainsi que **les hashes de mot de passe** en sont absents.
>
> **19 décisions sont 🔴 BLOQUANTES** avant toute écriture de schéma SQL, dont **3** ne peuvent
> **structurellement pas** être tranchées par l'audit parce qu'**aucune valeur n'existe dans les
> données** : **D-01** (`user_login` client), **D-33** (stock d'ouverture), **D-18 lot 6**
> (grammages de l'option végétarienne). **Ce document ne propose aucune valeur pour ces trois
> points.**
>
> **137 anomalies** sont enregistrées, **chacune** avec donnée concernée, exemple concret, cause
> probable, risque de perte et traitement. **5 mécanismes générateurs** (§10.1) en expliquent la
> grande majorité — **traiter ces 5 mécanismes supprime la cause de dizaines d'anomalies futures**.

---

*Fin du document — **MAPPING DE RÉFÉRENCE BEBBA — V1***
*30 tables · 16 attributs par table · 137 anomalies · 61 décisions référencées · 0 ligne de SQL,
de PHP ou de code de plugin.*
