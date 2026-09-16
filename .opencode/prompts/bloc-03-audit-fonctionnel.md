# BLOC 3 — AUDIT FONCTIONNEL BEBBA

## RÔLE

Utilise obligatoirement la skill `bebba-workflow`.

Tu agis uniquement comme auditeur technique et fonctionnel du projet BEBBA Healthy Food.

Le but de ce bloc est de réaliser le premier audit fonctionnel nécessaire à la migration future de BEBBA vers WordPress + WooCommerce + MySQL.

## OBJECTIF

Établir un inventaire factuel et vérifiable des fonctionnalités actuellement présentes dans le projet.

Cet audit correspond à la Phase 1 de la feuille de route de migration :

* inventaire complet des fonctionnalités actuelles ;
* inventaire des règles métier à conserver impérativement.

## RÈGLE ABSOLUE : LECTURE SEULE

Tu dois uniquement examiner l'état existant.

INTERDICTIONS ABSOLUES :

* ne modifier aucun fichier ;
* ne créer aucun fichier dans le projet ;
* ne supprimer aucun fichier ;
* ne reformater aucun fichier ;
* ne lancer aucun outil de migration ;
* ne modifier aucune donnée ;
* ne modifier aucune configuration ;
* ne modifier aucune dépendance ;
* ne créer aucun commit ;
* ne faire aucun push ;
* ne commencer aucune implémentation WordPress ;
* ne commencer aucune migration MySQL ;
* ne corriger aucun problème découvert.

Un problème découvert pendant l'audit doit uniquement être documenté.

## PÉRIMÈTRE

Examine réellement les fichiers pertinents du dépôt et ne déduis pas une fonctionnalité uniquement à partir d'un nom de fichier, d'un commentaire ou d'une déclaration antérieure.

Lorsque c'est nécessaire, inspecte notamment :

* `src/`
* `server/`
* `data/`
* routes API ;
* modèles/types ;
* contextes/hooks ;
* composants d'interface ;
* logique métier ;
* authentification ;
* autorisation/RBAC ;
* scripts et données utiles à l'audit.

Ne limite pas l'audit à un seul fichier.

## INVENTAIRE FONCTIONNEL À ÉTABLIR

Pour chaque domaine ci-dessous, détermine factuellement :

1. si la fonctionnalité existe ;
2. où elle est implémentée ;
3. comment elle fonctionne réellement ;
4. quels rôles y ont accès ;
5. quelles données elle utilise ;
6. quelles règles métier sont appliquées ;
7. quelles preuves permettent de l'affirmer ;
8. s'il existe une limite, incohérence ou absence constatée.

### 1. CLIENTS

Vérifier :

* création de compte ;
* connexion ;
* gestion du compte ;
* utilisateurs invités ;
* informations client ;
* téléphone ;
* adresse de livraison ;
* historique des commandes ;
* règles d'accès aux données client.

### 2. PRODUITS ET CATALOGUE

Vérifier :

* produits ;
* catégories ;
* disponibilité ;
* prix ;
* personnalisation ;
* suppléments ;
* portions supplémentaires ;
* produits liés aux ingrédients/recettes si présents.

Identifier les catégories métier actuellement utilisées.

### 3. COMMANDES

Vérifier :

* création ;
* modification ;
* consultation ;
* lignes de commande ;
* quantités ;
* montants ;
* client ;
* téléphone ;
* adresse ;
* identifiant de commande ;
* tracking ;
* statuts ;
* annulation ;
* historique ou mécanisme équivalent.

Documenter précisément le cycle réel d'une commande.

### 4. CUISINE / KDS

Vérifier :

* réception des commandes ;
* préparation ;
* changement de statut ;
* passage à `ready` ;
* passage vers l'étape suivante ;
* accès de la Cuisine ;
* utilisation des ingrédients/stock ;
* toute logique automatique liée à la préparation.

### 5. STOCK ET INGRÉDIENTS

Vérifier :

* ingrédients ;
* quantités ;
* unités ;
* seuils ;
* coûts ;
* mouvements ;
* consommation ;
* réapprovisionnement ;
* alertes ;
* lien avec les recettes/produits ;
* accès Cuisine/Admin.

Documenter également les mécanismes automatiques existants.

### 6. LIVREURS

Vérifier :

* comptes livreurs ;
* profils métier ;
* activation/désactivation ;
* attribution ;
* réattribution ;
* accès aux commandes ;
* restriction aux commandes autorisées ;
* informations nécessaires à la livraison.

### 7. LIVRAISON

Vérifier le cycle réel :

`waiting_for_driver → delivering → delivered`

Vérifier :

* attribution du livreur ;
* confirmation de livraison ;
* informations de livraison ;
* séparation entre livraison et encaissement ;
* comportement lorsqu'un livreur n'est pas disponible ;
* intervention éventuelle de l'Admin.

### 8. ENCAISSEMENT COD

Vérifier :

* paiement à la livraison ;
* état `to_collect` ;
* état `paid` ;
* validation de l'encaissement ;
* séparation entre livraison et paiement ;
* accès du livreur ;
* accès de l'Admin ;
* compteurs/métriques d'encaissement.

Ne jamais considérer `delivered` comme équivalent à `paid` sans preuve dans le code.

### 9. TRACKING

Vérifier :

* identifiant/token de tracking ;
* génération ;
* stockage ;
* récupération ;
* URL ou mécanisme de consultation ;
* priorité éventuelle d'un token fourni ;
* comportement invité/client ;
* données visibles via le tracking.

### 10. ADMINISTRATION

Vérifier précisément ce que peut faire l'Administration / Super Admin :

* commandes ;
* cuisine ;
* livreurs ;
* attribution/réattribution ;
* stock ;
* produits ;
* utilisateurs ;
* encaissements ;
* supervision ;
* statistiques ;
* autres fonctionnalités.

Identifier les restrictions réellement appliquées.

### 11. STATISTIQUES ET TABLEAUX DE BORD

Vérifier :

* statistiques ;
* compteurs ;
* commandes du jour ;
* livraisons ;
* encaissements ;
* reste à encaisser ;
* stock ;
* autres indicateurs.

Pour chaque indicateur, identifier sa source de données lorsque cela est vérifiable.

### 12. AUTHENTIFICATION ET RÔLES

Inventorier les rôles réellement présents.

Vérifier :

* Client ;
* Cuisine ;
* Livreur ;
* Administration / Super Admin ;
* authentification ;
* stockage de session/token ;
* protection des routes ;
* filtrage des données ;
* contrôles côté serveur ;
* contrôles côté interface.

Documenter les restrictions réellement démontrées par le code.

## RÈGLES MÉTIER À CONSERVER

Identifier explicitement les règles métier qui devront survivre à la migration vers WordPress.

Vérifier notamment :

* préparation des repas après commande ;
* paiement COD ;
* livraison ≠ encaissement ;
* statuts des commandes ;
* attribution des livreurs ;
* gestion du stock ;
* accès Admin/Super Admin ;
* règles clients ;
* tracking.

Ne pas inventer de règle métier absente du code.

Si une règle est déduite d'un comportement observé mais n'est pas explicitement codifiée, signaler clairement :

`RÈGLE OBSERVÉE MAIS NON EXPLICITEMENT CODIFIÉE`

## DISTINCTION MÉTIER / TECHNOLOGIE

Pour chaque fonctionnalité importante, distinguer autant que possible :

### MÉTIER

Ce que BEBBA doit faire indépendamment de la technologie.

### TECHNOLOGIE ACTUELLE

La manière dont cette fonctionnalité est actuellement réalisée avec React, TypeScript, Node.js, Express, Firestore/JSON ou autres composants existants.

Cette distinction servira ultérieurement à décider ce qui sera :

* natif WordPress ;
* WooCommerce ;
* plugin BEBBA personnalisé ;
* table MySQL BEBBA dédiée.

Ne prendre aucune décision d'architecture WordPress dans ce bloc.

## FORMAT DES PREUVES

Pour chaque constat important, fournir :

* fichier ;
* chemin ;
* fonction/composant/route si identifiable ;
* lignes lorsque disponibles ;
* comportement observé ;
* conclusion limitée à ce que la preuve permet d'affirmer.

Ne jamais écrire simplement :

`fonctionnalité présente`

sans indiquer la preuve correspondante.

Ne jamais considérer comme preuve :

* un commentaire ;
* un nom de fichier ;
* un README non corroboré ;
* une ancienne conversation ;
* une déclaration d'un autre agent ;
* `DONE` ;
* `OK` ;
* un build réussi.

La preuve doit provenir de l'état réel du projet.

## GESTION DES INCERTITUDES

Si une fonctionnalité ne peut pas être confirmée :

`NON CONFIRMÉE — preuve insuffisante`

Si elle semble partiellement implémentée :

`PARTIELLEMENT CONFIRMÉE`

Si elle existe mais présente une anomalie :

`CONFIRMÉE — ANOMALIE OBSERVÉE`

Ne transforme jamais une absence de preuve en absence de fonctionnalité.

## LIVRABLE ATTENDU

À la fin de l'audit, produire un rapport structuré comprenant :

### A. ÉTAT DU PÉRIMÈTRE AUDITÉ

Liste des fichiers et répertoires réellement examinés.

### B. INVENTAIRE FONCTIONNEL

Tableau :

| Domaine | Fonctionnalité | État constaté | Preuve | Règle métier |
| ------- | -------------- | ------------- | ------ | ------------ |

### C. RÈGLES MÉTIER À CONSERVER

Liste numérotée des règles confirmées par les preuves.

### D. DISTINCTION MÉTIER / TECHNOLOGIE

Pour les principales fonctionnalités :

| Fonction métier | Implémentation actuelle | Élément métier à conserver |
| --------------- | ----------------------- | -------------------------- |

### E. ANOMALIES OU LACUNES OBSERVÉES

Uniquement les problèmes constatés pendant cet audit.

Ne corriger aucun problème.

### F. POINTS NON CONFIRMÉS

Lister explicitement les éléments pour lesquels les preuves sont insuffisantes.

### G. CONCLUSION DU BLOC

Indiquer :

* ce qui est confirmé ;
* ce qui reste incertain ;
* ce qui devra être traité dans les phases suivantes.

Ne pas produire de plan d'implémentation WordPress dans ce bloc.

## CONTRÔLE GIT FINAL

Avant de terminer, vérifier en lecture seule que l'audit n'a modifié aucun fichier.

Vérifier notamment :

```bash
git status --short
git diff --stat
git diff
```

Si un fichier a été modifié par erreur, NE PAS le corriger automatiquement.

Signaler l'anomalie et STOP.

## RÈGLE DE FIN

Ce bloc ne doit pas enchaîner automatiquement vers la Phase 2.

Le BLOC 3 se termine après :

1. audit ;
2. preuves ;
3. rapport ;
4. contrôle Git ;
5. STOP.

Terminer exactement par :

`STOP — BLOC 3 : audit fonctionnel terminé, aucune modification effectuée.`

