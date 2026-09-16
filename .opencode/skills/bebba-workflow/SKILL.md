---
name: bebba-workflow
description: >
  Use when working on the BEBBA Healthy Food project and when a task requires
  audit, diagnosis, correction, validation, Git review, commit, or migration
  work. Triggers on files such as server.ts, server/, src/, data/,
  firestore.rules, security_spec.md, package.json, and future WordPress/MySQL
  project files. Avoid when answering general questions unrelated to auditing
  or modifying the BEBBA project.
---

# BEBBA Workflow

## Mission

Cette skill impose une méthode de travail contrôlée et vérifiable pour le
projet BEBBA Healthy Food.

Objectif principal :

**BLOC → AUDIT → PREUVE → STOP → CORRECTION → VALIDATION → COMMIT → VÉRIFICATION GITHUB → STOP**

Elle ne définit pas la logique métier de BEBBA et ne remplace pas les règles
techniques propres aux différentes parties du projet.

---

## 1. Principe fondamental

Ne jamais déclarer une modification correcte uniquement parce que :

* un agent affirme que c'est `DONE` ;
* AI Studio ou OpenCode (ou leur interface) affirme que c'est terminé ;
* un message `OK`, `build passed` ou équivalent est affiché ;
* une interface indique que l'opération est terminée ;
* un build passe ;
* un fichier semble correct superficiellement.

Toute conclusion doit être basée sur des éléments vérifiables :

* contenu réel des fichiers ;
* diff Git ;
* résultats de commandes ;
* tests ;
* comportement observé ;
* état réel du dépôt.

**La preuve prime sur la déclaration de l'agent.**

AI Studio, OpenCode, leur interface ainsi que leurs messages `DONE`, `OK`,
`build passed` ou équivalents ne constituent pas, à eux seuls, une preuve de
l'état réel du projet ou de GitHub. La preuve doit venir de l'examen réel des
fichiers, de Git et, lorsque requis, de GitHub.

---

## 2. Définition du BLOC

Chaque intervention doit avoir un périmètre précis.

Un BLOC doit définir :

* l'objectif ;
* les fichiers concernés ou la zone concernée ;
* ce qui doit être vérifié ;
* ce qui est explicitement hors périmètre.

Ne pas mélanger plusieurs corrections indépendantes dans un même BLOC.

Ne pas profiter d'un BLOC pour effectuer :

* refactoring opportuniste ;
* nettoyage général ;
* changement d'architecture non demandé ;
* amélioration esthétique non demandée ;
* modification de fichiers hors périmètre.

Si un problème supplémentaire est découvert, le signaler et le conserver
pour un BLOC ultérieur.

---

## 3. MODE AUDIT

Lorsqu'un BLOC est en phase AUDIT :

* lecture seule ;
* aucune modification de fichier ;
* aucun commit ;
* aucun push ;
* aucun changement de configuration ;
* aucune correction automatique.

L'audit doit déterminer l'état réel avant toute proposition de correction.

Le rapport doit identifier :

1. ce qui est conforme ;
2. ce qui est non conforme ;
3. le niveau de gravité lorsque pertinent ;
4. les fichiers concernés ;
5. les lignes ou zones concernées lorsque possible ;
6. les preuves utilisées ;
7. les conséquences éventuelles.

À la fin de l'audit :

**STOP.**

Ne pas commencer la correction dans la même étape.

---

## 4. PREUVE

Une affirmation technique doit être accompagnée de sa preuve.

Exemples de preuves acceptables :

* extrait du fichier ;
* résultat d'une commande ;
* `git diff` ;
* `git status` ;
* résultat d'un test ;
* résultat d'un lint/typecheck/build ;
* comparaison avec une version Git connue ;
* comportement réellement observé.

Ne jamais transformer une hypothèse en fait.

Si une information n'est pas vérifiable, l'indiquer clairement.

---

## 5. CORRECTION

Une correction ne doit commencer qu'après confirmation du diagnostic et
autorisation de poursuivre la correction.

Avant de modifier :

1. relire les fichiers concernés ;
2. confirmer le problème ;
3. confirmer le périmètre ;
4. identifier la modification minimale nécessaire.

Pendant la correction :

* modifier uniquement ce qui est nécessaire ;
* conserver l'architecture existante lorsque possible ;
* ne pas créer de nouveaux fichiers sans nécessité ;
* ne pas modifier des fichiers hors périmètre ;
* ne pas effectuer de refactoring global.

Après la correction, afficher exactement les fichiers modifiés.

---

## 6. VALIDATION

La phase VALIDATION désigne la vérification indépendante de la correction,
avant tout commit.

Après chaque correction :

1. inspecter le diff ;
2. vérifier qu'aucune modification parasite n'est présente ;
3. exécuter les validations réellement disponibles dans le projet ;
4. vérifier le comportement concerné lorsque possible ;
5. comparer avec l'objectif initial du BLOC.

Ne jamais considérer un build seul comme une preuve fonctionnelle suffisante.

Si la validation échoue :

* identifier précisément l'échec ;
* ne pas masquer l'erreur ;
* ne pas déclarer le BLOC terminé ;
* corriger uniquement dans le périmètre du BLOC.

---

## 7. GIT

Git doit être vérifié avant toute création de commit.

Toujours contrôler :

```text
git status
git diff
git diff --stat
```

Lorsque nécessaire, vérifier également :

```text
git log
git branch
git remote -v
```

Avant un commit :

* confirmer les fichiers inclus ;
* confirmer qu'aucun fichier parasite n'est inclus ;
* confirmer que les secrets ou fichiers `.env` ne sont pas commités ;
* confirmer que le diff correspond exactement au BLOC.

Ne jamais déclarer qu'une modification est sur GitHub simplement parce qu'elle
existe localement.

Distinction obligatoire :

**fichier modifié ≠ commit local ≠ commit poussé ≠ commit présent sur GitHub.**

---

## 8. COMMITS

Créer un commit uniquement lorsque l'utilisateur l'autorise explicitement.

L'agent ne doit jamais interpréter le workflow lui-même comme une autorisation
implicite de commit.

Le commit doit :

* correspondre à un seul BLOC cohérent ;
* avoir un message explicite ;
* ne contenir que les changements validés du BLOC.

Ne jamais mélanger plusieurs BLOCs dans un commit sans raison explicitement
validée.

Après le commit, récupérer et conserver la référence du commit :

```text
git rev-parse HEAD
```

Après un commit validé, vérifier l'état réellement présent sur le dépôt
GitHub avant de déclarer le bloc terminé. Cette vérification n'est pas
limitée au cas où un `push` est demandé.

Toujours distinguer :

* le commit local ;
* la référence distante (`git rev-parse origin/main` ou `git ls-remote origin main`) ;
* le contenu réellement présent sur GitHub.

---

## 9. PUSH

Ne jamais effectuer automatiquement un `git push`.

Le push est une action distincte.

Si un push est demandé :

1. vérifier le commit local ;
2. pousser vers la branche demandée ;
3. vérifier le résultat ;
4. vérifier que le commit attendu existe réellement sur le remote.

Après vérification :

**STOP.**

---

## 10. GitHub comme source de vérité

Pour BEBBA, GitHub `main` constitue la référence officielle sauf indication
contraire explicite.

Toujours distinguer :

```text
HEAD local
↓
branche locale
↓
origin/main
↓
GitHub
```

Ne jamais supposer qu'un état local est synchronisé avec GitHub sans le
vérifier.

Le commit `7825664` constitue la référence gelée de l'ancienne version
Firestore du projet.

Cette référence ne doit pas être modifiée ou rouverte simplement pour
contourner un problème IAM ou Firebase déjà abandonné.

---

## 11. Sécurité

Ne jamais :

* afficher les valeurs de `.env` ;
* afficher des secrets ;
* afficher des tokens ;
* afficher des mots de passe ;
* committer des credentials ;
* contourner une protection de sécurité pour accélérer une tâche.

Lorsqu'un fichier sensible doit être inspecté, ne montrer que les éléments
strictement nécessaires.

---

## 12. Commandes et environnement

Avant d'utiliser une commande importante :

* vérifier qu'elle existe dans l'environnement ;
* vérifier son objectif ;
* éviter les commandes destructives.

Pour les validations du projet, consulter d'abord `package.json` et les
scripts réellement disponibles.

Ne jamais inventer une commande de test.

Pour les commandes destructives (`rm`, reset Git, force push, suppression de
fichiers, etc.), demander une autorisation explicite lorsqu'elles ne sont pas
nécessaires au périmètre déjà validé.

---

## 13. Skills et agents

Ne charger une autre skill que si elle est réellement pertinente au BLOC
courant.

Ne pas multiplier les skills inutilement.

Une skill spécialisée ne doit pas modifier le périmètre du BLOC.

La skill `bebba-workflow` reste la règle de processus générale.

Les règles métier, WordPress, MySQL, migration, sécurité ou tests spécifiques
doivent être placées dans des skills spécialisées ultérieures uniquement si
leur création devient réellement nécessaire.

---

## 14. Gestion des découvertes hors périmètre

Si l'analyse révèle un autre problème :

* ne pas le corriger automatiquement ;
* le documenter brièvement ;
* indiquer le fichier concerné ;
* indiquer pourquoi il est hors périmètre ;
* proposer de le traiter dans un BLOC séparé.

Une découverte ne devient pas automatiquement une autorisation de modification.

---

## 15. Format de fin obligatoire

À la fin de chaque BLOC, produire un état clair :

```text
BLOC : <nom>

ÉTAT :
- conforme / non conforme / corrigé / bloqué

PREUVES :
- <preuve 1>
- <preuve 2>

FICHIERS :
- <fichier 1>
- <fichier 2>

GIT :
- <état Git réel>

COMMIT :
- <référence du commit (SHA)>

ACTION SUIVANTE :
- <prochaine étape>

STOP.
```

Ne pas continuer automatiquement vers le BLOC suivant.

---

## 16. Règle absolue

En cas de doute :

**NE PAS MODIFIER.**

Lire.
Vérifier.
Prouver.
Délimiter.
Puis seulement modifier.

Le workflow doit toujours privilégier :

**contrôle humain + preuve technique + modification minimale + traçabilité Git.**

