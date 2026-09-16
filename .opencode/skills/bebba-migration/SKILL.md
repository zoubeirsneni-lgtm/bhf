---
name: bebba-migration
description: >
  Use when migrating BEBBA data, application components, database structures,
  WordPress data, WooCommerce data, legacy JSON data, or systems between
  environments. Use for mapping, transformation, import, export, validation,
  rollback, and migration planning. Avoid when no BEBBA migration is involved.
---

# BEBBA Migration

## 1. Purpose

Cette skill encadre toute migration du projet BEBBA Healthy Food.

Elle couvre notamment :

- migration de `db.json` ;
- migration vers MySQL ;
- migration vers WordPress ;
- migration vers WooCommerce ;
- migration de données clients ;
- migration de produits ;
- migration de commandes ;
- migration des ingrédients ;
- migration des stocks ;
- migration des livreurs ;
- migration des utilisateurs ;
- import/export ;
- transformation de données ;
- synchronisation entre environnements.

---

## 2. Migration First Requires an Inventory

Avant toute migration réelle :

1. identifier la source ;
2. identifier la destination ;
3. inventorier les données ;
4. identifier les relations ;
5. identifier les contraintes ;
6. identifier les champs obligatoires ;
7. identifier les données historiques ;
8. identifier les données incompatibles ;
9. identifier les doublons ;
10. identifier les données qui ne doivent pas être migrées.

Ne jamais commencer un import réel sur la seule base d'un schéma supposé.

---

## 3. Source of Truth

Pour chaque migration, préciser explicitement :

- source de vérité avant migration ;
- source de vérité pendant la préparation ;
- destination prévue ;
- moment où la destination devient la nouvelle source de vérité.

Ne jamais considérer une destination comme correcte simplement parce que
l'import s'est terminé sans erreur.

---

## 4. Mapping

Chaque entité migrée doit disposer d'un mapping clair.

Pour chaque champ important, déterminer :

- source ;
- destination ;
- type source ;
- type destination ;
- transformation ;
- valeur par défaut éventuelle ;
- traitement des valeurs nulles ;
- traitement des valeurs invalides ;
- conservation ou non.

Exemple :

```text
source.customer.id
        ↓
destination.wp_user.ID
```

Les correspondances partielles ou supposées doivent être signalées, jamais
déclarées comme établies sans preuve.

---

## 5. Transformation

Toute transformation doit être explicitement documentée dans le mapping.

Définir pour chaque champ concerné :

- renommage éventuel ;
- conversion de type ;
- normalisation (format, casse, espaces, encodage) ;
- valeur par défaut lorsque le champ est manquant ;
- gestion des valeurs nulles ;
- gestion des champs supprimés (abandon assumé ou erreur) ;
- conversion des dates ;
- conversion des montants ;
- conversion des références.

Règles :

- une conversion implicite n'est jamais autorisée sans documentation ;
- une valeur impossible à convertir doit être signalée, pas silencieusement
  remplacée ;
- une valeur par défaut ne doit pas masquer une perte de donnée réelle ;
- les codes de transformation partielle ou d'échec doivent être tracés.

---

## 6. IDs et relations

Définir les règles applicables aux identifiants et aux relations avant toute
migration.

Concerne notamment :

- utilisateurs ;
- commandes ;
- produits ;
- ingrédients ;
- livreurs ;
- stocks ;
- historiques ;
- relations parent/enfant ;
- clés étrangères ;
- références croisées.

Règles :

- ne jamais casser une relation sans preuve et sans stratégie explicite ;
- conserver les identifiants stables lorsque le modèle destination le permet ;
- vérifier chaque référence après import ;
- signaler toute référence orpheline.

Si une transformation d'ID est nécessaire, conserver une table de
correspondance vérifiable :

```text
source ID
→ table de correspondance
→ destination ID
```

Cette table doit être conservée et permettre de relier tout enregistrement
source à son équivalent destination.

---

## 7. Règles métier BEBBA à préserver

Une migration ne doit jamais altérer les règles métier BEBBA suivantes sans
règle explicitement documentée.

### Commandes et paiement

Le paiement V1 est **Cash on Delivery uniquement**.

Les états de paiement sont :

```text
to_collect
paid
```

Une commande nouvellement créée doit conserver :

```text
paymentStatus = to_collect
```

La livraison et l'encaissement sont deux événements distincts.

Une commande `delivered` ne signifie pas automatiquement `paid`.

Ne jamais transformer implicitement `delivered` en `paid`.

### Cycle de commande

Le flux métier est :

```text
received
→ preparing
→ ready
→ waiting_for_driver
→ delivering
→ delivered
```

avec possibilité de :

```text
cancelled
```

Ne pas modifier cet ordre lors d'une migration sans règle métier explicitement
documentée.

### Rôles

Les rôles BEBBA sont :

```text
Client
Cuisine
Livreur
Administration
```

L'Administration / Super Administrateur dispose de l'accès absolu prévu par le
modèle métier.

Une migration ne doit pas :

- transformer un rôle en un autre ;
- supprimer un rôle ;
- donner des privilèges supplémentaires ;
- perdre les restrictions d'accès.

### Livraison

La migration doit préserver :

- le livreur assigné ;
- les changements d'affectation ;
- le statut de livraison ;
- les informations nécessaires à la livraison ;
- la distinction entre livraison et encaissement.

### Client

Les informations nécessaires à une commande doivent rester cohérentes,
notamment :

- téléphone ;
- adresse de livraison.

### Tracking

Préserver les mécanismes de suivi existants lorsque concernés, notamment :

```text
trackingToken
```

et la clé locale :

```text
bebba_last_tracking_token
```

Ne pas remplacer ou générer arbitrairement des tokens existants.

### Stock

Une migration doit préserver :

- quantité ;
- coût ;
- seuil d'alerte ;
- relations avec les ingrédients ;
- historique des mouvements lorsque présent ;
- cohérence entre stock source et stock destination.

Une migration ne doit pas provoquer de consommation ou restitution implicite
de stock.

### Historique

Les historiques métier doivent être conservés lorsque leur conservation est
prévue par le modèle source/destination.

Ne jamais supprimer silencieusement :

- événements ;
- changements de statut ;
- mouvements de stock ;
- informations financières ;
- affectations de livraison.

### Production des repas

Lorsque la donnée concerne le cycle de production, préserver la règle métier
selon laquelle les repas sont préparés après commande et ne sont pas considérés
comme préparés en avance.

---

## 8. Import / Export

Définir une méthode contrôlée pour chaque migration :

1. export ;
2. sauvegarde ;
3. transformation ;
4. import ;
5. vérification post-import.

Toute migration doit être :

- traçable ;
- reproductible ;
- vérifiable.

Privilégier lorsque possible :

```text
backup
→ extraction
→ transformation
→ dry-run
→ import
→ validation
```

Chaque étape doit produire une trace exploitable.

---

## 9. Idempotence

Toute migration répétable doit définir comment éviter :

- doublons ;
- doubles imports ;
- duplication des utilisateurs ;
- duplication des commandes ;
- duplication des produits ;
- duplication des ingrédients ;
- duplication des historiques.

Lorsque possible, utiliser une clé stable ou une table de correspondance.

Une seconde exécution ne doit pas produire silencieusement une seconde copie
des mêmes données.

---

## 10. Transactions et lots

Pour les opérations sensibles :

- utiliser des transactions lorsque le moteur destination le permet ;
- utiliser des traitements par lots pour les volumes importants ;
- définir les limites de batch ;
- éviter les imports partiellement réussis sans trace ;
- journaliser les erreurs.

Pour toute opération non atomique, prévoir un mécanisme permettant d'identifier
exactement :

```text
succès
échec
non traité
```

---

## 11. Synchronisation entre environnements

Définir clairement :

- source ;
- destination ;
- environnement de test ;
- environnement de production.

Interdire une migration directe vers la production sans :

```text
inventaire
→ mapping
→ dry-run
→ sauvegarde
→ validation
```

Si une synchronisation est nécessaire, documenter :

- sens de synchronisation ;
- fréquence ;
- conflit ;
- source de vérité ;
- stratégie de résolution.

---

## 12. Validation

La validation doit être indépendante de l'exécution de la migration.

### Quantités

Comparer :

```text
nombre d'enregistrements source
vs
nombre d'enregistrements destination
```

### Relations

Vérifier :

- utilisateurs ;
- commandes ;
- produits ;
- ingrédients ;
- livreurs ;
- relations entre entités.

### Commandes

Vérifier :

- identifiant ;
- client ;
- montant ;
- statut ;
- paymentStatus ;
- livreur ;
- dates.

### Finances

Vérifier notamment :

```text
to_collect
paid
```

et empêcher toute conversion implicite de statut.

### Stock

Comparer :

- quantités ;
- coûts ;
- seuils ;
- relations ;
- historiques.

### Tracking

Vérifier la conservation des tokens lorsqu'ils existent.

### Intégrité

Rechercher :

- doublons ;
- références orphelines ;
- champs obligatoires manquants ;
- valeurs impossibles ;
- statuts invalides ;
- montants incohérents.

---

## 13. Dry-run

Toute migration importante doit prévoir un dry-run lorsque techniquement
possible.

Le dry-run doit permettre d'obtenir :

```text
records lus
records transformés
records ignorés
records en erreur
records créés
records mis à jour
doublons détectés
relations invalides
```

Le dry-run ne doit pas modifier la destination.

---

## 14. Sauvegarde et rollback

Toute migration destructive ou difficilement réversible doit disposer d'une
sauvegarde avant exécution.

Définir explicitement :

```text
ÉTAT AVANT
→ BACKUP
→ MIGRATION
→ VALIDATION
```

En cas d'échec :

```text
MIGRATION
→ DIAGNOSTIC
→ ROLLBACK
→ VALIDATION DE L'ÉTAT RESTAURÉ
```

Le rollback doit préciser :

- ce qui est restauré ;
- depuis quelle sauvegarde ;
- comment vérifier la restauration ;
- comment éviter un rollback partiel.

Ne jamais considérer qu'un rollback existe simplement parce qu'une sauvegarde
existe.

Le rollback doit être exécutable ou suffisamment précisément spécifié pour
être exécuté.

---

## 15. Sécurité des données liée à la migration

Cette skill couvre uniquement les aspects de sécurité directement liés à la
migration :

- protection des exports ;
- protection des sauvegardes ;
- secrets ;
- données personnelles ;
- permissions nécessaires à l'import/export ;
- suppression sécurisée des fichiers temporaires ;
- interdiction d'exposer des données sensibles dans les logs.

Les règles générales d'authentification, d'autorisation et d'IDOR restent de
la responsabilité de `bebba-security`.

---

## 16. Frontières entre skills

Les responsabilités sont réparties comme suit.

### `bebba-migration`

Responsable de :

- stratégie de migration ;
- inventaire source/destination ;
- mapping ;
- transformation ;
- import/export ;
- synchronisation ;
- idempotence ;
- dry-run ;
- validation spécifique à la migration ;
- sauvegarde ;
- rollback.

### `bebba-database`

Responsable de :

- architecture de données ;
- schémas ;
- tables ;
- relations ;
- indexes ;
- contraintes ;
- intégrité générale de la base.

### `bebba-wordpress`

Responsable de :

- WordPress ;
- WooCommerce ;
- plugins ;
- hooks ;
- REST WordPress ;
- administration WordPress.

### `bebba-security`

Responsable de :

- authentification ;
- autorisation ;
- rôles ;
- permissions ;
- sessions ;
- tokens ;
- protection des opérations sensibles.

### `bebba-testing`

Responsable de :

- tests fonctionnels ;
- tests de régression ;
- tests d'intégration ;
- validation globale après correction.

### `bebba-audit`

Responsable de :

- audit ;
- diagnostic ;
- collecte des preuves ;
- classification des problèmes ;
- contrôle avant correction.

### `bebba-workflow`

Responsable du processus global :

```text
BLOC
→ AUDIT
→ PREUVE
→ STOP
→ CORRECTION
→ VALIDATION
→ COMMIT
→ VÉRIFICATION GITHUB
→ STOP
```

`bebba-migration` ne doit pas remplacer ce workflow.

---

## 17. Preuve avant action

Toute migration doit partir de preuves.

Interdiction de considérer comme preuve :

- une hypothèse ;
- un nom de champ supposé ;
- un résultat déclaré « DONE » par un outil ;
- un build vert seul ;
- une interface qui semble fonctionner ;
- une correspondance supposée.

Avant toute migration :

```text
diagnostic
→ inventaire
→ preuve
→ mapping
→ migration
```

---

## 18. Modification minimale

Cette skill doit rester :

- claire ;
- opérationnelle ;
- concise ;
- orientée procédure.

Ne pas ajouter de théorie inutile.

Ne pas créer de doublons avec les autres skills.

Ne pas transformer cette skill en documentation complète de toute
l'architecture BEBBA.

---

## 19. STOP

À la fin d'un bloc de migration :

- présenter les preuves obtenues ;
- signaler les éléments restant à vérifier ;
- ne pas enchaîner automatiquement une autre action ;
- STOP.
