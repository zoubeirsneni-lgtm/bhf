---
name: bebba-audit
description: >
  Use when auditing the BEBBA Healthy Food project, its architecture, code,
  database, WordPress integration, security, migration, functionality, or
  configuration. Use for evidence-based diagnosis before correction. Avoid
  when the task only requires implementation without an audit.
---

# BEBBA Audit

## 1. Purpose

Cette skill encadre les audits techniques et fonctionnels du projet
BEBBA Healthy Food.

Un audit sert à établir l'état réel d'un système avant de décider d'une
correction.

Il ne doit pas devenir une modification déguisée du projet.

---

## 2. Audit Read-Only by Default

Un audit est en lecture seule par défaut.

Pendant un audit :

- ne pas modifier les fichiers ;
- ne pas créer de fichiers ;
- ne pas supprimer de fichiers ;
- ne pas modifier la base ;
- ne pas lancer de migration réelle ;
- ne pas corriger directement un problème découvert ;
- ne pas faire de commit.

Une correction doit faire l'objet d'un bloc séparé.

---

## 3. Evidence First

Toute conclusion importante doit être appuyée par une preuve.

Chercher les preuves dans :

- code source ;
- configuration ;
- schéma ;
- données ;
- tests ;
- commandes exécutées ;
- Git ;
- GitHub ;
- environnement réel lorsque accessible.

Un message `DONE`, `OK`, `build passed` ou équivalent ne constitue pas, à
lui seul, une preuve fonctionnelle ou structurelle.

Ne jamais transformer une hypothèse en fait.

Si une information ne peut pas être vérifiée, l'indiquer clairement.

---

## 4. Scope

Avant de commencer :

1. définir le périmètre ;
2. définir les questions à vérifier ;
3. identifier les fichiers ou composants concernés ;
4. éviter d'examiner des zones sans rapport avec le périmètre.

Un audit doit être proportionné à son objectif.

Ne pas transformer systématiquement un audit ciblé en audit complet du projet.

---

## 5. Classification

Lorsqu'un problème est trouvé, distinguer :

- problème confirmé ;
- risque probable ;
- amélioration possible ;
- information manquante ;
- comportement conforme.

Ne pas présenter une amélioration comme une vulnérabilité ou un bug.

---

## 6. Severity

Lorsque la gravité est utile, la justifier par des éléments concrets :

- impact ;
- probabilité ou conditions nécessaires ;
- données concernées ;
- possibilité d'exploitation ;
- conséquences métier ou techniques.

Éviter les niveaux de gravité arbitraires.

---

## 7. Functional Audit

Lors d'un audit fonctionnel, vérifier les règles métier réelles.

Pour BEBBA, examiner lorsque le périmètre le demande :

- clients ;
- produits ;
- catégories ;
- panier ;
- commandes ;
- cuisine ;
- ingrédients ;
- stocks ;
- livreurs ;
- livraison ;
- encaissement ;
- tracking ;
- administration ;
- statistiques ;
- authentification ;
- rôles.

Distinguer systématiquement :

```text
règle métier
vs
implémentation technique
vs
comportement observé
```

Un écart ne doit être déclaré que lorsque la règle métier, son implémentation
et le comportement observé sont réellement comparés.

Vérifier notamment :

- flux de statuts de commande ;
- séparation livraison / encaissement ;
- statut de paiement `to_collect` / `paid` ;
- rôles et permissions ;
- stocks et ingrédients ;
- suivi (`trackingToken`) ;
- préparation après commande.

---

## 8. Fichiers concernés

Pour chaque constat, identifier :

- les fichiers concernés ;
- la ligne ou la zone concernée lorsque possible ;
- le composant concerné (serveur, base, WordPress, migration, sécurité) ;
- la sévérité.

Une conclusion sans fichier ni zone identifiée reste une supposition.

---

## 9. Diagnostic précis

Un audit doit produire un diagnostic précis, pas une impression générale.

Pour chaque problème :

- décrire l'écart observé ;
- donner la preuve réelle (extrait, commande, résultat) ;
- situer précisément dans le code ou la configuration ;
- distinguer ce qui est confirmé de ce qui est probable ;
- indiquer ce qui n'a pas pu être vérifié.

Ne pas corriger pendant l'audit.

---

## 10. Preuve avant conclusion

Ne déclarer un point conforme ou non conforme qu'avec des preuves.

Exemples de preuves acceptables :

- contenu réel des fichiers ;
- `git diff`, `git status`, `git log` ;
- résultat d'une commande ;
- résultat d'un test ou d'un build réellement exécuté ;
- état réel de GitHub.

La preuve prime sur la déclaration d'un agent.

---

## 11. Minimal Change

Les corrections proposées à l'issue d'un audit doivent :

- être minimales ;
- être ciblées sur le composant concerné ;
- ne pas effectuer de refactoring global ;
- ne pas modifier des fichiers hors périmètre ;
- être compatibles avec les règles métier existantes.

Ne pas mélanger plusieurs corrections indépendantes dans un même bloc.

---

## 12. Validation indépendante

La validation d'une correction doit être indépendante de la correction
elle-même.

Après une correction liée à un constat d'audit :

- vérifier le diff réel ;
- vérifier l'absence de modification parasite ;
- exécuter les validations disponibles dans le projet ;
- comparer le résultat avec l'objectif initial ;
- ne pas déclarer le bloc terminé sans preuve.

---

## 13. Contrôle Git

Avant de conclure l'audit ou une modification :

- vérifier `git status` ;
- vérifier `git diff` ;
- vérifier `git diff --stat` ;
- vérifier la liste des fichiers modifiés ;
- confirmer l'absence de secrets ou fichiers `.env` dans le diff.

Ne jamais effectuer un commit ou un push automatiquement.

Un commit ne peut être créé que si l'utilisateur le demande explicitement.

---

## 14. Contrôle GitHub

Ne jamais confondre :

```text
fichier modifié
vs
commit local
vs
commit poussé
vs
contenu présent sur GitHub
```

Vérifier l'état réel sur GitHub (`git ls-remote` ou API) avant toute
affirmation de synchronisation.

---

## 15. Reporting

Chaque audit doit produire un rapport structuré indiquant :

- état avant ;
- défaut exact ;
- preuves ;
- fichiers concernés ;
- modification effectuée (si applicable) ;
- état après ;
- vérifications réalisées ;
- résultats (lignes, SHA256, fences, frontmatter, STOP) ;
- actions suivantes.

Indiquer clairement ce qui reste à vérifier.

---

## 16. STOP

À la fin d'un bloc d'audit ou de correction :

- présenter les preuves obtenues ;
- signaler les éléments restant à vérifier ;
- ne pas enchaîner automatiquement une autre action ;
- ne pas lancer automatiquement un commit ou un push ;
- ne pas mélanger les blocs.

```text
STOP — <résumé du bloc terminé>, aucun commit effectué.
```

STOP.