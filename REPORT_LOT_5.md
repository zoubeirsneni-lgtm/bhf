# RAPPORT LOT 5 — Flux cuisine & livreur (plugin v0.5.0)

## 1. Périmètre livré

Le LOT 5 porte le flux opérationnel cuisine/livreur d'Express (`server.ts`
l.674/1089/1174/1191 + `db.ts` l.1491/1646/1679 + `auth.ts` l.147) vers le
plugin WordPress, sous `/wp-json/bebba/v1/*`, avec les messages d'erreur
français exacts de l'original et l'amélioration imposée par la spec (§6.3).
Quatre routes sont ajoutées ; le reste du plugin est inchangé.

| Route | Accès | Source Express |
|---|---|---|
| `GET /orders` | admin, kitchen, driver | server.ts l.674 |
| `PATCH /orders/:id/status` | admin, kitchen, driver | server.ts l.1089 |
| `PATCH /orders/:id/assign-driver` | admin | server.ts l.1174 |
| `PATCH /orders/:id/payment` | admin, driver (cascade en handler) | server.ts l.1191 |

Version plugin : **0.5.0** (header + constante `BEBBA_HF_VERSION`).

## 2. Détails d'implémentation

### 2.1 GET /orders — scoping par rôle (l.674)
- `admin` : toutes les commandes ; `kitchen` : tout sauf `cancelled` ;
  `driver` : uniquement les commandes dont `driver_id` est le sien
  (liste vide si le compte n'est pas lié à un livreur). Tri `placed_at DESC`
  (équivalent du tri `createdAt desc` de Firestore).
- `client` / `admin_readonly` : 403 par `require_role` (même comportement que
  `requireRole('admin','kitchen','driver')`).

### 2.2 PATCH /orders/:id/status — le cœur du lot
Ordre des vérifications fidèle à Express :
1. 404 `Commande non trouvée.`
2. IDOR livreur : `user.driverId` doit correspondre au `driver_id` de la
   commande, sinon 403 `Accès refusé : Cette commande ne vous est pas attribuée.`
3. 400 `Le champ statut est requis.`
4. Idempotence : même statut → la commande est renvoyée sans aucune écriture.
5. Matrice stricte (`is_valid_status_transition`, portage de
   `isValidStatusTransition`) : admin = cycle complet sans saut ni retour
   (`received→preparing/cancelled`, …, `delivering→delivered/cancelled`,
   `delivered`/`cancelled` = terminaux) ; kitchen = `received→preparing` et
   `preparing→ready` uniquement ; driver = `delivering→delivered` uniquement ;
   client et `admin_readonly` = jamais. Sinon 403
   `Transition interdite : Le rôle 'X' n'est pas autorisé à passer de 'Y' à 'Z'.`
6. Passage à `delivering` : livreur obligatoire (400 explicite), existant
   (`Livreur #X introuvable.`) et actif (`Le livreur "X" est désactivé et ne
   peut pas recevoir de nouvelle commande.`). Le paramètre
   `assignedDriverId` n'est honoré que pour l'admin sur cette transition.
7. Écritures dans une transaction (`SELECT ... FOR UPDATE` sur la commande,
   re-vérification du statut courant contre les transitions concurrentes) :
   - **double transition automatique** : `ready` pousse deux entrées
     d'historique (`ready` par l'acteur, puis `waiting_for_driver` par
     « Système BEBBA ») et la commande termine en `waiting_for_driver` ;
   - `delivered` incrémente `total_deliveries` du livreur assigné ;
   - `updated_by` serveur-vérifié : `Nom (Admin|Cuisine|Livreur)`, libellés
     français exacts (`statusLabels`).

### 2.3 Restauration du stock à l'annulation (spec §6.3, constat C2)
Amélioration délibérée par rapport à Express (qui n'avait jamais implémenté
la restauration) : chaque transition à `cancelled` d'une commande dont le
stock avait été consommé restaure, dans la même transaction, les quantités
par ingrédient (agrégat `order_item_prep` de la commande) et écrit des
mouvements `order_cancellation_restore` (quantités positives, trace
`Restauration stock annulation commande #BEBBA-####`, acteur = l'auteur de
l'annulation). Le re-cancel est idempotent (même statut → aucune écriture,
aucune double restauration ; `stock_consumed` repasse à 0).
Le portage du bloc rétro-compatible de `db.updateOrderStatus` (consommation
à `preparing` si `stock_consumed` ≠ 1, pour les commandes migrées) est inclus
avec sa vérification `Stock insuffisant pour l'ingrédient X.` avant écriture.

### 2.4 PATCH /orders/:id/assign-driver (admin seul)
Accepte `driverId` ou `assignedDriverId` (comme Express), refuse les
commandes `delivered`/`cancelled`
(`Impossible de modifier l’affectation d’une commande clôturée ou annulée.`),
vérifie l'existence et l'activité du livreur, met à jour le trio
`driver_id` / `driver_legacy_id` / `driver_name_snapshot` et pousse une
entrée d'historique `Livreur affecté : <nom>` / note
`Affectation livreur mise à jour par l'administrateur` / auteur
`Nom (Admin)`. Toutes les erreurs de cette route sortent en 400 (comme le
catch Express).

### 2.5 PATCH /orders/:id/payment — encaissement
Cascade fidèle à Express l.1191-1252 : 404 `Commande non trouvée.` puis
403 explicites client (`Les clients ne sont pas autorisés à modifier le
statut de paiement.`), cuisine (`La cuisine n’a pas l’autorisation de
modifier le statut de paiement.`), lecture-seule (`Lecture seule,
modification du paiement interdite.`) et tout autre rôle non autorisé ;
`paymentStatus` ∈ {paid, to_collect} sinon 400 `Statut de paiement
invalide.` ; `paid` interdit tant que la commande n'est pas `delivered`
(`Impossible d'encaisser une commande qui n'est pas encore livrée.`) ;
le livreur ne touche que SES courses (IDOR) et uniquement pour poser
`paid` (`Le livreur peut uniquement enregistrer le paiement reçu (paid).`).

## 3. Fichiers modifiés

| Fichier | Contenu |
|---|---|
| `includes/class-bebba-orders.php` | +6 méthodes publiques/privées (matrice, listes, statut, assignation, paiement, delta stock) |
| `api/class-bebba-rest.php` | +4 routes, +4 handlers, carte des phases mise à jour (LOT 3/4/5 ✓) |
| `bebba-healthy-food.php` | version 0.5.0 |
| `tests/bebba-test-lot5.php` | harnais automatique (52 tests) |
| `ROADMAP.md` | LOT 0-4 cochés ✅, LOT 5 🚧 |

## 4. Harnais de test (52 tests)

Reprend les conventions LOT 4 (comptes de test créés par le harnais,
pré-nettoyage idempotent qui supprime d'abord les commandes de test d'un
passage interrompu pour débloquer les FK livreurs, `reset-demo-data` final,
nettoyage des comptes staff, vérification d'isolation `wp_users`).

- **T1-T8** : santé 0.5.0, comptes admin/cuisine/lecture-seule + 3 livreurs ;
- **T9-T14** : commande invitée O1 + scoping `GET /orders` par rôle
  (admin/cuisine/livreur vide/client 403/lecture-seule 403) ;
- **T15-T18** : flux cuisine (`received→preparing→ready` avec double
  transition automatique vérifiée dans l'historique, saut interdit 403 exact,
  idempotence sans effet de bord) ;
- **T19-T22** : assignation (champ manquant, livreur inconnu, cuisine 403,
  admin 200 + trace `Livreur affecté :`) ;
- **T23-T29** : validations `delivering` (sans livreur, inconnu, désactivé,
  cuisine 403 exact, réutilisation du livreur existant sans paramètre) ;
- **T30-T34** : flux livreur (IDOR en écriture ET en lecture avec un 2e
  livreur, `delivering→delivered` + `updatedBy (Livreur)`,
  `totalDeliveries` incrémenté, statut terminal) ;
- **T35-T42** : encaissement (cascade 403 complète, statut invalide,
  encaissement prématuré, livreur limité à `paid`, IDOR payment, admin OK) ;
- **T43-T46** : annulation avec **restauration du stock vérifiée au centime**
  (carte complète des stocks avant/après création et après annulation),
  mouvements `order_cancellation_restore` en base, idempotence du re-cancel,
  assignation refusée sur commande annulée ;
- **T47-T48** : saut et retour arrière de l'admin refusés (403 exacts) ;
- **T49-T50** : listes après annulations (la cuisine n'expose pas les
  annulées ; le livreur ne voit que sa course) ;
- **T51-T52** : `reset-demo-data` (compteur 1100, base purgée) + isolation
  `wp_users`.

## 5. Critères d'acceptation de la spec (§10, Phase 5) — couverture

| Critère | Vérifié par |
|---|---|
| La cuisine ne peut pas sauter d'étape | T16, T28 |
| Le livreur ne marque « livré » que sur `delivering` et SA course | T30, T32 + matrice |
| Test IDOR avec 2 livreurs | T30, T31, T41 (livreurs A et B) |
| Le client ne peut jamais changer un statut (403 même avec token) | T13 (liste), T35 (payment) ; PATCH status client → 403 `require_role` |
| Encaissement restreint à admin/driver, marquant `paid`/`to_collect` | T35-T42 |

## 6. Limites connues / suivi

- La consommation de stock à la création (LOT 3) reste la voie normale ;
  le bloc rétro-compatible du LOT 5 ne sert qu'aux commandes migrées
  (`stock_consumed` ≠ 1) — il est testé côté code mais pas par le harnais
  (aucune commande migrée sur l'installation de test).
- `GET /orders/:id` (LOT 3) garde son IDOR client/livreur d'origine ; le
  harnais LOT 5 re-vérifie l'IDOR livreur en lecture (T31).
