---
name: bebba-security
description: >
  Use when working on BEBBA authentication, authorization, roles, permissions,
  sessions, passwords, tokens, access control, security boundaries, or
  protection of sensitive operations. Avoid when the task is unrelated to
  BEBBA security.
---

# BEBBA Security

## 1. Purpose

Cette skill encadre la sécurité de BEBBA Healthy Food.

Elle couvre notamment :

- authentification ;
- autorisation ;
- rôles ;
- permissions ;
- sessions ;
- mots de passe ;
- tokens ;
- contrôle d'accès ;
- protection des données ;
- API ;
- administration ;
- opérations sensibles.

---

## 2. Security First

Toute opération sensible doit être analysée selon deux niveaux distincts :

1. authentification : qui est l'utilisateur ?
2. autorisation : cet utilisateur a-t-il le droit d'effectuer cette opération ?

Être connecté ne signifie pas être autorisé.

Masquer un bouton dans l'interface ne constitue pas une protection.

Les contrôles importants doivent être appliqués côté serveur ou dans la couche
de sécurité réellement responsable de l'opération.

---

## 3. BEBBA Roles

Les rôles métier BEBBA à préserver sont :

- Client ;
- Cuisine/KDS ;
- Livreur ;
- Administration / Super Admin.

Le Super Admin dispose de l'accès absolu prévu par les règles métier.

Toute modification de rôle ou permission doit vérifier les conséquences sur :

- commandes ;
- cuisine ;
- stocks ;
- livraison ;
- encaissement ;
- utilisateurs ;
- administration.

Ne jamais donner des privilèges supplémentaires uniquement pour contourner
un problème fonctionnel.

---

## 4. Evidence First

Avant de conclure qu'une zone est sécurisée, vérifier les preuves réelles :

- middleware ;
- contrôles d'accès ;
- routes ;
- permissions ;
- vérification côté serveur ;
- stockage des sessions/tokens ;
- traitement des mots de passe ;
- logs ;
- configuration ;
- tests.

Ne jamais accepter comme preuve suffisante :

- `DONE` ;
- `OK` ;
- `build passed` ;
- bouton absent de l'interface ;
- affirmation d'un agent.

---

## 5. Authentication

Pour l'authentification, vérifier :

- création du compte ;
- vérification des identifiants ;
- stockage sécurisé des mots de passe ;
- expiration des sessions ;
- invalidation lorsque nécessaire ;
- gestion des erreurs ;
- protection contre les tentatives répétées ;
- absence de fuite d'informations sensibles.

Les mots de passe ne doivent jamais être stockés en clair.

Les secrets et tokens ne doivent pas être exposés inutilement au frontend,
aux logs ou au dépôt Git.

---

## 6. Authorization

Pour chaque opération sensible, déterminer :

- rôle requis ;
- permission requise ;
- ressource concernée ;
- propriétaire de la ressource lorsque pertinent ;
- possibilité d'accès horizontal à une autre ressource ;
- possibilité d'élévation de privilèges.

Vérifier particulièrement les risques d'IDOR :

un utilisateur autorisé à accéder à une ressource ne doit pas pouvoir simplement
modifier un identifiant pour accéder à celle d'un autre utilisateur.

---

## 7. Operations sensibles BEBBA

Les opérations suivantes doivent faire l'objet d'un contrôle d'autorisation
explicite :

- création/modification/suppression d'utilisateur ;
- changement de rôle ;
- gestion des livreurs ;
- attribution d'une commande à un livreur ;
- modification d'une commande ;
- validation d'une livraison ;
- validation d'un encaissement ;
- modification du statut de paiement ;
- gestion du stock ;
- correction de stock ;
- accès aux données administratives ;
- configuration du système.

---

## 8. API Security

Toute route API doit être analysée selon :

- authentification ;
- autorisation ;
- validation des paramètres ;
- validation du corps ;
- contrôle des identifiants ;
- données retournées ;
- gestion des erreurs ;
- limitation des abus lorsque nécessaire.

Ne jamais considérer une route comme sécurisée parce qu'elle est appelée
uniquement depuis une interface interne.

---

## 9. Input Validation

Les données provenant de :

- navigateur ;
- formulaire ;
- API ;
- URL ;
- paramètres ;
- fichiers ;
- intégrations externes

doivent être considérées comme non fiables jusqu'à validation.

Vérifier :

- type ;
- format ;
- longueur ;
- valeurs autorisées ;
- bornes numériques ;
- valeurs obligatoires ;
- relations métier.

Éviter les conversions implicites dangereuses.

---

## 10. Secrets

Ne jamais :

- placer un mot de passe en dur dans le code ;
- committer une clé secrète ;
- exposer une clé privée au frontend ;
- écrire des tokens sensibles dans les logs ;
- publier des credentials dans un rapport.

Les fichiers de configuration contenant des secrets doivent être traités
séparément du code versionné.

---

## 11. Web Security

Pour les applications web, vérifier lorsque pertinent :

- CSRF ;
- XSS ;
- injection SQL ;
- injection de commandes ;
- validation serveur ;
- cookies ;
- headers de sécurité ;
- CORS ;
- exposition d'informations ;
- uploads ;
- rate limiting.

Ne pas ajouter une protection uniquement pour cocher une case : vérifier le
chemin d'attaque réellement concerné.

---

## 12. Least Privilege

Accorder uniquement les permissions nécessaires.

Lorsqu'un rôle demande un accès supplémentaire :

1. identifier l'opération exacte ;
2. déterminer la permission minimale ;
3. vérifier les opérations qu'elle permet également ;
4. vérifier qu'elle ne donne pas indirectement un accès excessif.

Éviter les permissions globales lorsqu'une permission ciblée est possible.

---

## 13. Audit Security

Lors d'un audit :

1. identifier la surface d'attaque ;
2. vérifier les protections existantes ;
3. produire les preuves ;
4. distinguer vulnérabilité réelle et simple amélioration ;
5. classer la gravité uniquement avec une justification factuelle ;
6. proposer une correction minimale et ciblée.

Ne pas déclarer une vulnérabilité sans preuve suffisante.

---

## 14. Correction

Une correction de sécurité doit :

- viser la cause réelle ;
- être minimale ;
- ne pas casser les permissions légitimes ;
- ne pas contourner une autre protection ;
- être validée indépendamment après modification.

Ne pas effectuer plusieurs corrections de sécurité non liées dans le même bloc.

---

## 15. Validation

Après une correction, vérifier au minimum lorsque pertinent :

- accès autorisé ;
- accès refusé ;
- rôle correct ;
- rôle incorrect ;
- ressource correcte ;
- ressource d'un autre utilisateur ;
- comportement API ;
- absence de fuite de données ;
- comportement après expiration de session ;
- comportement après modification de permission.

La validation doit tester les chemins positifs **et** négatifs.

---

## 16. Reporting

Toute intervention de sécurité importante doit préciser :

- menace ou problème ;
- surface concernée ;
- preuve ;
- impact ;
- correction ;
- fichiers concernés ;
- validation ;
- éventuelles limites restantes.

Ne jamais présenter une sécurité comme garantie absolue.

---

## 17. STOP

À la fin d'un bloc de sécurité :

- ne pas lancer automatiquement une autre correction ;
- présenter les preuves ;
- signaler les limites ;
- STOP.
