---
name: bebba-wordpress
description: >
  Use when working on the BEBBA WordPress architecture, WooCommerce,
  plugins, themes, custom post types, hooks, REST APIs, administration,
  checkout, orders, kitchen, delivery, or WordPress integrations. Avoid when
  the task is unrelated to WordPress architecture or BEBBA.
---

# BEBBA WordPress

## 1. Purpose

Cette skill encadre la conception, l'intégration et la modification de
l'architecture WordPress du projet BEBBA Healthy Food.

Elle couvre notamment :

- WordPress ;
- WooCommerce ;
- plugins ;
- thèmes ;
- hooks et actions ;
- filtres ;
- REST API ;
- administration ;
- commandes ;
- checkout ;
- clients ;
- cuisine/KDS ;
- livreurs ;
- stocks ;
- encaissement ;
- intégrations externes.

---

## 2. Architecture First

Avant toute modification :

1. identifier le composant WordPress concerné ;
2. identifier son rôle dans l'architecture ;
3. vérifier les fonctionnalités natives disponibles ;
4. vérifier les extensions déjà présentes ;
5. vérifier les personnalisations existantes ;
6. éviter de recréer une fonctionnalité déjà correctement fournie par
   WordPress ou WooCommerce.

Ne jamais ajouter un plugin ou une personnalisation sans identifier
précisément le besoin.

---

## 3. Evidence First

Ne jamais considérer une fonctionnalité comme installée, active ou fonctionnelle
sur la seule base d'une affirmation.

Vérifier lorsque possible :

- fichiers du plugin ;
- configuration WordPress ;
- plugins actifs ;
- code source ;
- hooks utilisés ;
- routes REST ;
- données réellement enregistrées ;
- comportement réel de l'application ;
- version contrôlée dans Git.

Les messages `DONE`, `OK` ou `build passed` ne constituent pas une preuve
fonctionnelle suffisante.

---

## 4. WooCommerce

Lorsqu'une fonctionnalité concerne les commandes ou le checkout, vérifier
d'abord si WooCommerce fournit déjà un mécanisme adapté.

Analyser notamment :

- produits ;
- variations ;
- panier ;
- checkout ;
- commandes ;
- statuts ;
- clients ;
- métadonnées ;
- frais de livraison ;
- méthodes de paiement ;
- coupons ;
- emails ;
- hooks ;
- API.

Ne pas remplacer inutilement un mécanisme WooCommerce existant par du code
personnalisé.

---

## 5. BEBBA Business Rules

L'architecture WordPress doit préserver les règles métier BEBBA.

Notamment :

- paiement V1 en espèces à la livraison ;
- livraison et encaissement séparés ;
- une commande livrée n'implique pas automatiquement qu'elle est payée ;
- statut de paiement `to_collect` ou `paid` ;
- flux commande :
  `received → preparing → ready → waiting_for_driver → delivering →
  delivered/cancelled` ;
- rôles Client, Cuisine/KDS, Livreur et Administration/Super Admin ;
- l'Administration/Super Admin possède l'accès absolu ;
- téléphone et adresse de livraison sont obligatoires ;
- les repas sont préparés après commande ;
- les stocks doivent rester cohérents avec les commandes ;
- les informations nécessaires au suivi d'une commande doivent rester
  disponibles.

Une adaptation technique ne doit pas supprimer une règle métier existante.

---

## 6. Plugins

Avant d'ajouter un plugin :

1. définir le besoin exact ;
2. vérifier si WordPress/WooCommerce le couvre nativement ;
3. vérifier les plugins déjà installés ;
4. vérifier les dépendances ;
5. vérifier les conflits potentiels ;
6. vérifier l'impact sur les données ;
7. vérifier l'impact sur les permissions ;
8. vérifier la possibilité de maintenance et de remplacement.

Éviter l'accumulation de plugins redondants.

---

## 7. Code personnalisé

Le code personnalisé doit rester ciblé.

Préférer :

- un plugin métier BEBBA dédié lorsque la logique est spécifique ;
- des hooks WordPress/WooCommerce appropriés ;
- des fonctions clairement séparées ;
- des interfaces avec responsabilités limitées.

Éviter :

- modifier directement le cœur WordPress ;
- modifier directement le cœur WooCommerce ;
- copier du code du core pour le remplacer ;
- multiplier les plugins pour une même responsabilité ;
- créer des dépendances inutiles.

---

## 8. Administration

Toute fonctionnalité d'administration doit être examinée avec :

- capacité WordPress ;
- rôle utilisateur ;
- permission nécessaire ;
- séparation des responsabilités ;
- validation serveur ;
- protection CSRF lorsque pertinente ;
- validation et assainissement des données.

L'interface seule ne constitue jamais une barrière de sécurité.

---

## 9. REST API

Pour toute route REST personnalisée, vérifier :

- méthode HTTP ;
- route ;
- paramètres ;
- validation ;
- authentification ;
- autorisation ;
- réponse ;
- erreurs ;
- données exposées.

Une route accessible depuis le navigateur ne doit pas être considérée comme
sécurisée simplement parce que l'interface masque le bouton correspondant.

---

## 10. Données

Toute personnalisation WordPress qui stocke des données doit définir :

- où les données sont stockées ;
- leur structure ;
- leur relation avec les commandes ou utilisateurs ;
- leur cycle de vie ;
- leur stratégie de migration ;
- leur stratégie de suppression ;
- leur impact sur les sauvegardes.

Les données métier importantes ne doivent pas être dispersées sans nécessité.

---

## 11. Performance

Avant d'ajouter une fonctionnalité coûteuse, vérifier :

- nombre de requêtes ;
- requêtes répétées ;
- chargement inutile ;
- appels REST ;
- traitements synchrones ;
- tâches pouvant être différées ;
- volumétrie future.

Ne pas optimiser prématurément, mais ne pas introduire volontairement des
requêtes répétitives évidentes.

---

## 12. Compatibilité

Toute modification doit tenir compte :

- de la version WordPress ;
- de la version WooCommerce ;
- des plugins dépendants ;
- du thème ;
- des extensions BEBBA ;
- des données existantes.

Ne jamais supposer qu'une API ou un hook est disponible sans vérifier la
version réellement utilisée.

---

## 13. Minimal Change

Lorsqu'une correction est nécessaire :

- modifier uniquement le composant concerné ;
- éviter les refactors globaux ;
- ne pas modifier le core ;
- ne pas remplacer plusieurs plugins sans nécessité ;
- préserver les données existantes ;
- documenter toute migration nécessaire.

---

## 14. Validation

Après modification, vérifier lorsque pertinent :

- activation du plugin ;
- chargement WordPress ;
- chargement WooCommerce ;
- absence d'erreur PHP ;
- fonctionnalité concernée ;
- permissions ;
- routes REST ;
- création/modification des données ;
- checkout ;
- commandes ;
- compatibilité avec les fonctionnalités existantes.

La validation doit reposer sur des preuves réelles.

---

## 15. Reporting

Toute intervention importante doit préciser :

- problème ;
- composant concerné ;
- fichiers concernés ;
- état avant ;
- modification ;
- état après ;
- preuves ;
- impacts ;
- migrations éventuelles ;
- rollback si nécessaire.

---

## 16. STOP

À la fin d'un bloc WordPress :

- ne pas lancer automatiquement un autre bloc ;
- présenter les preuves ;
- signaler les incertitudes ;
- STOP.
