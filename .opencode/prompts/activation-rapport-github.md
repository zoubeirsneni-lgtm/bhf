Tu travailles dans le projet BEBBA Healthy Food.

OBJECTIF UNIQUE
Mettre en place l’archivage automatique de la sortie complète de chaque exécution de `.opencode/run-prompt.sh` dans le dépôt GitHub :

`zoubeirsneni-lgtm/audits`

Convention de nommage souhaitée :

`opencode-output-YYYY-MM-DD-HHMMSS`

Le mécanisme doit fonctionner quel que soit le type de prompt exécuté :

* audit
* validation
* correction
* rapport
* diagnostic
* autre sortie OpenCode

IMPORTANT
Ce bloc concerne UNIQUEMENT l’infrastructure `.opencode` permettant d’archiver les sorties.

INTERDICTIONS ABSOLUES

* Ne modifier aucun fichier BEBBA hors `.opencode/run-prompt.sh`.
* Ne modifier aucun `SKILL.md`.
* Ne modifier aucun fichier dans `src/`, `server/`, `data/`, `scripts/`, `package.json` ou autre fichier du projet.
* Ne créer aucun nouveau Skill.
* Ne faire aucune refactorisation générale.
* Ne modifier aucune configuration applicative.
* Ne faire aucun commit Git local.
* Ne faire aucun push vers `zoubeirsneni-lgtm/bhf`.
* Ne modifier aucun fichier du dépôt BEBBA `zoubeirsneni-lgtm/bhf` autre que `.opencode/run-prompt.sh`.
* Le dépôt cible des rapports est exclusivement `zoubeirsneni-lgtm/audits`.

PHASE 1 — AUDIT AVANT MODIFICATION

Lire l’état actuel de :

`.opencode/run-prompt.sh`

Vérifier également, en lecture seule :

1. présence de `gh` ;
2. état de l’authentification GitHub CLI ;
3. possibilité d’accéder au dépôt :
   `zoubeirsneni-lgtm/audits`
4. branche par défaut du dépôt `audits` ;
5. possibilité technique d’utiliser l’API GitHub ou `gh` pour créer/remplacer un fichier ;
6. état Git local avant modification.

Ne modifier aucun fichier pendant cette phase.

Présenter les preuves exactes.

PHASE 2 — CONCEPTION MINIMALE

Le mécanisme doit :

1. exécuter OpenCode exactement comme le script actuel ;
2. conserver la sortie complète stdout/stderr ;
3. préserver le code de sortie d’OpenCode ;
4. écrire temporairement cette sortie dans un fichier local ;
5. créer un nom unique :
   `opencode-output-YYYY-MM-DD-HHMMSS`
6. envoyer le contenu COMPLET dans :
   `zoubeirsneni-lgtm/audits`
7. ne pas tronquer la sortie ;
8. ne pas perdre la sortie même si OpenCode retourne une erreur ;
9. afficher à l’utilisateur le résultat de l’archivage ;
10. retourner finalement le même code de sortie qu’OpenCode.

IMPORTANT :
Le dépôt `audits` est uniquement un dépôt d’archives de rapports.
Aucun fichier du dépôt `bhf` ne doit être envoyé dans ce dépôt sauf la sortie générée par OpenCode.

PHASE 3 — MODIFICATION

Modifier UNIQUEMENT :

`.opencode/run-prompt.sh`

Faire la modification minimale nécessaire.

Ne pas changer son interface :

`./.opencode/run-prompt.sh <nom-du-prompt>`

Le script doit continuer à accepter les prompts existants exactement comme avant.

Utiliser une méthode robuste pour capturer stdout ET stderr.

Attention particulière :
Si OpenCode échoue, son rapport/sortie doit quand même être archivé avant que le script termine.

Le code retour original d’OpenCode doit être conservé puis retourné à la fin.

PHASE 4 — VALIDATION INDÉPENDANTE

Après modification, vérifier :

A. Le script est syntaxiquement valide.

B. Le script exécute toujours OpenCode.

C. stdout et stderr sont capturés.

D. Le code retour d’OpenCode est conservé.

E. Le nom du rapport respecte :
`opencode-output-YYYY-MM-DD-HHMMSS`

F. Le dépôt cible est exactement :
`zoubeirsneni-lgtm/audits`

G. Le contenu envoyé correspond à la sortie complète capturée.

H. Aucun fichier hors `.opencode/run-prompt.sh` n'a été modifié.

I. Aucun commit n'a été créé.

J. Aucun push vers `zoubeirsneni-lgtm/bhf` n'a été effectué.

PHASE 5 — TEST RÉEL CONTRÔLÉ

Effectuer un test avec un prompt minimal qui ne modifie aucun fichier BEBBA.

Le test doit produire une sortie identifiable, par exemple :

`TEST_ARCHIVAGE_OPENCODE_<timestamp>`

Puis vérifier que cette sortie est effectivement présente dans le fichier créé dans :

`zoubeirsneni-lgtm/audits`

Vérifier également que le fichier distant contient la sortie complète et non une version tronquée.

Si le test nécessite la création d'un fichier de test temporaire local, le supprimer immédiatement après le test.

Ne jamais créer de fichier de test dans le dépôt BEBBA ou dans le dépôt `audits`.

PHASE 6 — RAPPORT FINAL

Fournir uniquement les preuves utiles :

* fichier modifié ;
* mécanisme utilisé ;
* dépôt cible ;
* nom exact du fichier de test créé ;
* preuve que le contenu est complet ;
* code retour testé ;
* état Git avant/après ;
* confirmation qu'aucun commit n'a été créé ;
* confirmation qu'aucun autre fichier n'a été modifié.

Ne pas déclarer le mécanisme fonctionnel uniquement parce que la commande s'est terminée sans erreur.
La présence et le contenu du fichier distant doivent être vérifiés.

À LA FIN, écrire exactement :

`STOP — archivage automatique des sorties OpenCode configuré et validé, aucun commit effectué.`

