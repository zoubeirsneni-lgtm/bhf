---
name: bebba-database
description: >
  Use when working on BEBBA data, database architecture, MySQL, schemas,
  tables, relationships, indexes, constraints, queries, data integrity,
  migrations, backups, or database-related changes. Avoid when the task is
  unrelated to BEBBA data or database concerns.
---

# BEBBA Database

## 1. Purpose

Cette skill encadre tout travail concernant les données et la base de données
du projet BEBBA Healthy Food.

Elle s'applique notamment à :

- MySQL ;
- schéma relationnel ;
- tables et colonnes ;
- clés primaires et étrangères ;
- contraintes ;
- index ;
- relations entre entités ;
- intégrité des données ;
- requêtes SQL ;
- transactions ;
- concurrence ;
- sauvegardes ;
- restauration ;
- import/export ;
- migration des données ;
- correspondance entre anciennes et nouvelles structures.

La source de vérité doit toujours être vérifiée avant toute conclusion.

---

## 2. Evidence First

Ne jamais déclarer une structure, une table, une colonne, une relation ou une
contrainte comme existante sur la seule base d'une affirmation d'un agent.

Toujours rechercher les preuves dans :

- les fichiers du projet ;
- les migrations SQL ;
- le schéma réel ;
- les scripts de migration ;
- les requêtes utilisées par l'application ;
- la base réellement connectée lorsque cela est possible ;
- Git et GitHub lorsque l'état versionné est concerné.

Une documentation ou une réponse d'un outil ne constitue pas à elle seule une
preuve de l'état réel de la base.

---

## 3. Analyse avant modification

Avant toute modification de base de données :

1. identifier le problème exact ;
2. identifier les tables et fichiers concernés ;
3. vérifier les relations existantes ;
4. vérifier les contraintes existantes ;
5. vérifier les dépendances applicatives ;
6. identifier les données potentiellement impactées ;
7. déterminer si une migration est nécessaire ;
8. définir une stratégie de retour arrière lorsque le risque le justifie.

Ne jamais modifier plusieurs domaines de données sans nécessité.

---

## 4. Intégrité des données

Toute conception ou modification doit préserver autant que possible :

- l'unicité ;
- la cohérence des relations ;
- les clés étrangères ;
- les valeurs obligatoires ;
- les types de données ;
- les contraintes métier ;
- l'historique nécessaire ;
- la traçabilité des opérations.

Les suppressions doivent être analysées avec attention lorsqu'elles peuvent
casser des références historiques.

---

## 5. Transactions

Utiliser une transaction lorsque plusieurs opérations doivent réussir ou
échouer ensemble.

Une opération critique ne doit pas être considérée comme atomique simplement
parce qu'elle est exécutée rapidement ou dans une seule fonction applicative.

Pour chaque opération transactionnelle importante, vérifier :

- quelles écritures sont incluses ;
- quelles lectures sont nécessaires ;
- ce qui se passe en cas d'erreur ;
- ce qui se passe en cas de concurrence ;
- ce qui se passe après un retry ;
- si une opération partiellement exécutée peut laisser un état incohérent.

---

## 6. Conventions BEBBA

Préserver les règles métier connues du projet.

Notamment :

- une commande peut être créée avec un statut de paiement
  `to_collect` ;
- `paid` signifie que l'encaissement a été confirmé ;
- livraison et encaissement sont deux événements distincts ;
- une commande livrée ne doit pas être considérée automatiquement comme
  encaissée ;
- les stocks doivent rester cohérents avec les commandes et mouvements de
  stock ;
- les annulations doivent être analysées concernant la restitution éventuelle
  du stock ;
- les identifiants de commande doivent rester traçables et uniques ;
- les données historiques nécessaires au suivi des commandes doivent être
  conservées.

Ne jamais modifier une règle métier simplement pour simplifier le schéma.

---

## 7. Migration de données

Lors d'une migration :

1. établir le mapping source → destination ;
2. identifier les champs obligatoires ;
3. identifier les transformations ;
4. identifier les valeurs par défaut ;
5. identifier les données impossibles à convertir ;
6. prévoir les contrôles de comptage ;
7. vérifier les relations après migration ;
8. prévoir une stratégie de rollback.

Une migration réussie techniquement n'est pas nécessairement une migration
correcte fonctionnellement.

---

## 8. Validation

Après une modification ou migration, vérifier au minimum lorsque pertinent :

- nombre de lignes ;
- identifiants uniques ;
- références étrangères ;
- valeurs nulles inattendues ;
- doublons ;
- totaux importants ;
- relations entre commandes, clients, produits et stocks ;
- cohérence des statuts ;
- cohérence des montants ;
- cohérence des mouvements de stock.

La validation doit être indépendante de l'affirmation de l'outil qui a effectué
la modification.

---

## 9. Sauvegarde et rollback

Avant une opération destructive ou une migration importante :

- identifier la sauvegarde disponible ;
- vérifier qu'elle est exploitable ;
- documenter le point de retour ;
- éviter toute opération irréversible sans nécessité.

Une stratégie de rollback doit être concrète : elle doit préciser ce qui permet
de revenir à l'état précédent.

---

## 10. Scope

Cette skill traite les données et la base.

Elle ne doit pas être utilisée pour :

- modifier arbitrairement l'interface utilisateur ;
- refactoriser le frontend sans rapport avec les données ;
- modifier l'architecture WordPress sans impact database identifié ;
- modifier les permissions sans rapport avec les données ;
- lancer une migration réelle sans validation préalable du plan.

Dans ces cas, utiliser la skill spécialisée correspondante.

---

## 11. Minimal Change

Lorsqu'une correction est nécessaire :

- modifier uniquement ce qui est nécessaire ;
- ne pas effectuer de refactor global ;
- ne pas créer de tables ou colonnes inutiles ;
- ne pas supprimer de données sans justification ;
- ne pas changer les noms existants sans nécessité ;
- préserver la compatibilité applicative lorsque possible.

Toute modification de schéma doit être explicitement justifiée.

---

## 12. Reporting

Toute intervention importante sur la base doit pouvoir fournir :

- problème identifié ;
- tables/fichiers concernés ;
- état avant ;
- modification prévue ;
- modification effectuée ;
- preuves de validation ;
- impact sur les données ;
- stratégie de rollback si nécessaire.

Ne jamais remplacer les preuves par une simple affirmation du type :

- DONE ;
- OK ;
- build passed ;
- migration successful.

---

## 13. STOP

À la fin d'un bloc de travail database :

- ne pas enchaîner automatiquement une autre modification ;
- présenter les preuves obtenues ;
- signaler les éléments restant à vérifier ;
- STOP.
