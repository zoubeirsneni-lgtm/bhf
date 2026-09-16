---
name: bebba-testing
description: >
  Use when testing BEBBA functionality, regressions, integrations, APIs,
  database operations, WordPress behavior, orders, kitchen, delivery,
  payment collection, roles, or migration results. Use for validation and
  verification before declaring a change correct. Avoid when no testing or
  validation is required.
---

# BEBBA Testing

## 1. Purpose

Cette skill encadre les tests et validations du projet BEBBA Healthy Food.

Objectif : établir par des preuves observables que le comportement réel de
BEBBA correspond au comportement attendu, avant de déclarer une modification
correcte.

Elle couvre :

- objectif des tests ;
- tests unitaires ;
- tests d'intégration ;
- tests API ;
- tests frontend ;
- tests fonctionnels métier BEBBA ;
- tests des rôles Client / Cuisine / Livreur / Administration ;
- tests d'authentification et d'autorisation ;
- tests des commandes ;
- tests des statuts de commande ;
- séparation livraison / encaissement ;
- PaymentStatus ;
- tests des stocks et de la consommation d'ingrédients ;
- tests du trackingToken ;
- tests des données invalides et cas limites ;
- tests d'idempotence et de doublons ;
- tests de régression ;
- tests de migration lorsque pertinent ;
- validation indépendante ;
- preuve avant conclusion ;
- modification minimale ;
- reporting.

---

## 2. Evidence First

Un test doit produire une preuve observable.

Ne jamais considérer comme preuve suffisante :

- `DONE` ;
- `OK` ;
- `build passed` ;
- « cela devrait fonctionner » ;
- une capture d'écran sans contexte ;
- une affirmation de l'agent.

Lorsque possible, conserver :

- commande exécutée ;
- résultat ;
- fichier concerné ;
- données avant/après ;
- statut HTTP ;
- sortie du test ;
- logs pertinents.

---

## 3. Test Before Change

Lorsqu'un bug est signalé :

1. reproduire le problème lorsque possible ;
2. identifier le comportement attendu ;
3. identifier le comportement observé ;
4. localiser la cause probable ;
5. seulement ensuite préparer une correction.

Ne pas modifier le code avant d'avoir établi suffisamment de preuves.

---

## 4. Regression

Après une correction, vérifier :

1. le comportement corrigé ;
2. les comportements directement liés ;
3. les chemins critiques susceptibles d'être affectés.

Ne pas transformer chaque correction en une campagne de tests illimitée.

Le périmètre de régression doit être proportionnel au risque.

---

## 5. BEBBA Critical Flows

Les parcours suivants sont critiques :

### Commande

```text
client
→ panier
→ checkout
→ création commande
→ received
→ preparing
→ ready
→ waiting_for_driver
→ delivering
→ delivered
```

### Statuts de commande

```text
received → preparing → ready → waiting_for_driver → delivering → delivered

cancelled
```

L'annulation peut intervenir à un statut encore annulable, conformément aux
règles métier BEBBA existantes.

### Livraison et encaissement

```text
delivered (livré)
vs
to_collect → paid (encaissé)
```

Ces deux parcours sont distincts.

---

## 6. Unit Tests

Les tests unitaires doivent couvrir les fonctions et modules isolés :

- logique métier ;
- calculs sur les commandes ;
- gestion des statuts ;
- gestion du paiement ;
- gestion des stocks ;
- validation des données.

Chaque test unitaire doit vérifier un comportement précis et reproductible.

---

## 7. Integration Tests

Les tests d'intégration doivent vérifier les interactions entre composants :

- serveur et base de données ;
- authentification et protection des routes ;
- commandes et stocks ;
- livraison et statuts ;
- encaissement et PaymentStatus.

Une intégration réussie techniquement n'est pas une preuve fonctionnelle
suffisante.

---

## 8. API Tests

Pour chaque route API testée, vérifier au minimum lorsque pertinent :

- authentification requise ;
- autorisation du rôle concerné ;
- validation des paramètres ;
- statut HTTP ;
- corps de réponse ;
- erreurs de données invalides ;
- comportement du flux de statuts ;
- absence de fuite de données.

Ne pas considérer une route comme correcte parce qu'elle répond `200`.

---

## 9. Frontend Tests

Les tests frontend doivent vérifier lorsque pertinent :

- affichage des données ;
- parcours utilisateur ;
- gestion des erreurs ;
- affichage des statuts de commande ;
- tracking ;
- comportements selon le rôle.

Un rendu visuel correct ne prouve pas le comportement des données.

---

## 10. BEBBA Functional Tests

Les tests fonctionnels métier BEBBA doivent couvrir les règles métier
existantes :

- commandes ;
- cuisine/préparation ;
- stocks et ingrédients ;
- livraison ;
- encaissement ;
- paiement ;
- tracking ;
- administration.

Ne pas inventer de règle métier : se référer aux règles existantes du projet.

---

## 11. Roles Tests

Tester les parcours selon les rôles BEBBA :

- Client ;
- Cuisine/KDS ;
- Livreur ;
- Administration / Super Admin.

Pour chaque rôle, vérifier :

- les opérations autorisées ;
- les opérations refusées ;
- l'absence d'accès horizontal à une ressource d'un autre utilisateur ;
- l'absence d'élévation de privilèges.

---

## 12. Authentication and Authorization Tests

Tester au minimum lorsque pertinent :

- création de compte et connexion ;
- mot de passe incorrect ;
- session expirée ;
- accès non authentifié à une route protégée ;
- accès non autorisé à une route protégée ;
- ressource d'un autre utilisateur ;
- changement de rôle.

Tester les chemins positifs et négatifs.

---

## 13. Order Tests

Les tests des commandes doivent vérifier :

- création d'une commande ;
- contenu du panier ;
- montants ;
- statut initial `received` ;
- évolution des statuts ;
- annulation ;
- livraison ;
- encaissement (`to_collect` → `paid`) ;
- lien avec le trackingToken ;
- lien avec la commande, les stocks et le paiement.

---

## 14. Status Flow Tests

Tester la chaîne de statuts :

```text
received → preparing → ready → waiting_for_driver → delivering → delivered
```

avec la branche d'annulation :

```text
cancelled
```

Vérifier pour chaque transition :

- transition autorisée ou refusée ;
- transition vers `cancelled` conforme aux règles métier existantes ;
- cohérence persistée ;
- rejet des transitions interdites.

---

## 15. Delivery / Payment Separation

Livraison et encaissement sont deux événements distincts pour BEBBA :

- une commande livrée n'est pas automatiquement encaissée ;
- une commande encaissée n'implique pas la livraison ;
- les tests doivent vérifier les deux dimensions séparément.

---

## 16. Payment Status Tests

Le statut de paiement BEBBA est :

```text
to_collect | paid
```

Tester :

- création de commande en `to_collect` ;
- passage à `paid` uniquement après confirmation d'encaissement ;
- modification de PaymentStatus soumise aux règles d'autorisation ;
- absence de bascule automatique vers `paid` à la livraison.

---

## 17. Stock and Ingredient Tests

Les tests doivent vérifier :

- consommation d'ingrédients à la préparation ;
- cohérence des stocks après commande ;
- comportement en cas de stock insuffisant ;
- annulation et restitution éventuelle de stock conformément aux règles
  métier existantes ;
- corrections de stock tracées.

---

## 18. trackingToken Tests

Les tests du trackingToken doivent vérifier :

- génération à la création de la commande ;
- unicité ;
- accès au suivi par un possesseur du token ;
- impossibilité d'accéder au suivi d'une autre commande avec un token erroné ;
- non-exposition des données sensibles via le suivi public ;
- cohérence avec `tracking_token` côté données.

---

## 19. Invalid Data and Edge Cases Tests

Tester les données invalides et les cas limites :

- champs manquants ;
- mauvais types ;
- identifiants inexistants ;
- montants négatifs ou nuls ;
- quantités nulles ;
- statuts inconnus ;
- transitions interdites ;
- rôles inattendus ;
- bornes et valeurs limites.

---

## 20. Idempotency and Duplicate Tests

Tester lorsque pertinent :

- double soumission d'une commande ;
- création de doublons ;
- retry d'une opération après erreur ;
- résultat identique après répétition ;
- absence de consommation double de stock ou de double encaissement.

---

## 21. Migration Tests

Lorsqu'une migration est impliquée, les tests doivent vérifier :

- correspondance source → destination ;
- comptage des données ;
- identifiants et relations ;
- intégrité des statuts et montants ;
- cohérence des stocks ;
- comparaison avec un résultat indépendant du processus de migration.

---

## 22. Independent Validation

La validation d'une modification doit être indépendante de l'affirmation de
l'outil ou de l'agent qui a effectué la modification.

Ne jamais considérer un message `DONE`, `OK` ou `build passed` comme une
validation indépendante.

Réexécuter ou refaire la vérification selon des moyens distincts lorsque
possible.

---

## 23. Proof Before Conclusion

Ne jamais conclure qu'une modification est correcte sans preuve.

Une conclusion doit reposer sur des éléments vérifiables :

- contenu réel des fichiers ;
- résultats de tests ;
- sorties de commandes ;
- comportement observé.

Une déclaration d'agent sans preuve n'est pas une conclusion valide.

---

## 24. Minimal Change

Les corrections liées aux tests doivent :

- modifier uniquement ce qui est nécessaire ;
- ne pas changer les règles métier BEBBA existantes ;
- ne pas introduire de règles métier nouvelles ;
- ne pas refactoriser hors périmètre ;
- être justifiées et délimitées.

---

## 25. Reporting

Chaque intervention de test ou validation doit préciser :

- problème vérifié ou modification testée ;
- commandes exécutées ;
- preuves obtenues ;
- fichiers concernés ;
- état avant / après ;
- résultat conforme ou non ;
- éléments restant à vérifier.

Ne jamais remplacer les preuves par une affirmation du type `DONE`.

---

## 26. STOP

À la fin d'un bloc de tests :

- ne pas enchaîner automatiquement une autre correction ;
- présenter les preuves obtenues ;
- signaler les limites restantes ;
- STOP.