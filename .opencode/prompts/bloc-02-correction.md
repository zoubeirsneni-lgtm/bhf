Utilise la skill `bebba-workflow`.

Nous sommes dans la phase CORRECTION du BLOC 2.

L'audit précédent a identifié exactement 6 écarts dans :
.opencode/skills/bebba-workflow/SKILL.md

Corrige uniquement ces 6 points et rien d'autre.

1. CHAÎNE OFFICIELLE

À l'endroit correspondant à la chaîne d'objectif actuelle (§ L21), remplace-la par :

BLOC → AUDIT → PREUVE → STOP → CORRECTION → VALIDATION → COMMIT → VÉRIFICATION GITHUB → STOP

Cette chaîne devient l'identité officielle du workflow.

2. VÉRIFICATION GITHUB APRÈS COMMIT

Ajoute une règle claire indiquant qu'après un commit validé, le workflow doit vérifier l'état réellement présent sur GitHub avant de déclarer le bloc terminé.

La vérification doit notamment pouvoir confirmer la référence distante de main, par exemple avec :

git rev-parse origin/main

ou :

git ls-remote origin main

La procédure doit distinguer clairement :
- commit local ;
- référence distante ;
- contenu réellement présent sur GitHub.

3. CAPTURE DU SHA DU COMMIT

Après chaque commit, impose explicitement la récupération et la conservation de son SHA, par exemple :

git rev-parse HEAD

Le rapport du §15 doit prévoir un emplacement pour renseigner cette référence.

4. AUTORISATION DU COMMIT

À la règle actuelle du §8/L211, supprimer toute ambiguïté permettant à l'agent de s'autoriser lui-même.

La règle doit être équivalente à :

« uniquement lorsque l'utilisateur l'autorise explicitement »

Le workflow ne constitue jamais une autorisation implicite de commit.

5. AI STUDIO ET OPENCODE

Renforcer explicitement le garde-fou afin de préciser que :
- AI Studio ;
- OpenCode ;
- leur interface ;
- leurs messages DONE, OK, build passed ou équivalents

ne constituent pas, à eux seuls, une preuve de l'état réel du projet ou de GitHub.

La preuve doit venir de l'examen réel des fichiers, de Git et, lorsque requis, de GitHub.

6. CLARIFICATION DE « VALIDATION »

Éviter toute confusion entre :
- validation du diagnostic pendant l'audit ou la correction ;
- phase VALIDATION du workflow après correction.

Employer des formulations distinctes afin que la phase VALIDATION désigne clairement la vérification indépendante de la correction avant le commit.

CONTRAINTES ABSOLUES

- Modifier uniquement .opencode/skills/bebba-workflow/SKILL.md.
- Ne toucher à aucun autre fichier.
- Ne modifier aucune autre partie de SKILL.md.
- Ne faire aucun refactoring.
- Ne pas réorganiser inutilement le document.
- Ne créer aucun fichier.
- Ne supprimer aucun fichier.
- Ne faire aucun commit.
- Ne faire aucun push.
- Ne modifier aucun fichier du projet BEBBA.
- Ne traiter aucun autre bloc.

Avant modification, relire les passages concernés afin de conserver le style et la structure existants.

Après modification, effectuer uniquement une vérification locale de la correction.

Le rapport final doit contenir :

A. MODIFICATIONS EFFECTUÉES
Les 6 corrections avec leurs emplacements précis.

B. PREUVES
Les passages avant/après ou les lignes permettant de vérifier chaque correction.

C. PÉRIMÈTRE
Confirmer que seul .opencode/skills/bebba-workflow/SKILL.md a été modifié.

D. GIT
Donner :
git status --short
git diff --stat

Confirmer explicitement qu'aucun commit et aucun push n'ont été effectués.

Terminer impérativement par :

STOP — correction du BLOC 2 terminée, validation indépendante à effectuer.
