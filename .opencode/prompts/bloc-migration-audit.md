# AUDIT CIBLÉ — `bebba-migration`

## OBJECTIF

Auditer exclusivement le Skill :

`.opencode/skills/bebba-migration/SKILL.md`

L’objectif est de déterminer précisément l’état réel du fichier après l’audit global des Skills.

L’audit global a identifié :

* Skill détecté par OpenCode 1.18.31 ;
* YAML/frontmatter valide ;
* fichier de seulement 89 lignes ;
* un nombre impair de blocs Markdown ` ``` ` ;
* dernier contenu observé : `destination.wp_user.ID` ;
* fichier probablement tronqué ;
* sections attendues après cette zone absentes ou inaccessibles ;
* absence explicite ou insuffisance concernant certaines règles métier BEBBA.

## RÈGLE ABSOLUE

Ceci est un AUDIT EN LECTURE SEULE.

INTERDIT :

* modifier `bebba-migration/SKILL.md` ;
* modifier un autre Skill ;
* créer ou supprimer un fichier ;
* modifier `.opencode/run-prompt.sh` ;
* modifier les prompts ;
* modifier le projet BEBBA ;
* modifier Git ;
* créer un commit ;
* faire un push ;
* reconstituer arbitrairement le contenu manquant.

Ne considère jamais un message `DONE`, `OK`, `success` ou un build réussi comme preuve de conformité.

## 1. ÉTAT RÉEL DU FICHIER

Lire intégralement :

`.opencode/skills/bebba-migration/SKILL.md`

Rapporter :

* nombre exact de lignes ;
* taille exacte du fichier ;
* SHA256 ;
* contenu de la dernière ligne ;
* dernière section identifiable ;
* nombre de blocs ` ``` ` ;
* indiquer précisément si les blocs Markdown sont équilibrés ;
* indiquer si le fichier se termine brutalement au milieu d'une section ou d'un exemple.

## 2. FRONTMATTER

Vérifier avec le parser réellement utilisé par OpenCode :

* `name`
* `description`
* validité YAML
* correspondance entre `name` et dossier
* détection par OpenCode 1.18.31.

Ne rien modifier.

## 3. CONTENU RÉELLEMENT PRÉSENT

Lister les sections réellement présentes dans le fichier, dans leur ordre.

Pour chaque section :

* titre ;
* lignes ;
* rôle ;
* état : complète / partielle / interrompue.

Ne pas déduire les sections absentes.

## 4. LOCALISER LA TRONCATURE

Déterminer exactement :

* à quelle ligne la troncature commence ;
* quelle structure Markdown est ouverte ;
* quel texte semble interrompu ;
* si la dernière partie correspond à un exemple de mapping, à une procédure ou à une autre section ;
* quelles sections sont absentes après ce point.

Ne pas inventer leur contenu.

## 5. RECHERCHE D'UNE SOURCE DE VÉRITÉ EXISTANTE

Chercher uniquement dans les sources disponibles localement et dans Git :

* historique Git du fichier ;
* commits précédents ;
* autres branches locales disponibles ;
* éventuelles copies ou sauvegardes du même Skill ;
* fichiers `.bak`, `.old`, `.save`, etc. s'ils existent déjà ;
* éventuelle version complète dans l'historique Git.

Utiliser les preuves réelles.

Si une version complète est trouvée :

* donner son emplacement ;
* donner le commit/ref ;
* donner sa taille ;
* comparer avec la version actuelle ;
* déterminer exactement ce qui a été perdu.

Si aucune version complète n'est trouvée, le dire explicitement.

INTERDIT de fabriquer une « version probable ».

## 6. VÉRIFICATION DES RÈGLES MÉTIER BEBBA

Sans modifier le Skill, vérifier si le contenu actuellement présent couvre explicitement :

* `to_collect`
* `paid`
* séparation livraison / encaissement
* stock
* historique des commandes
* statuts de commande
* `received`
* `preparing`
* `ready`
* `waiting_for_driver`
* `delivering`
* `delivered`
* `cancelled`
* rôles Client / Cuisine / Livreur / Administration
* ID et identifiants
* tracking
* données client
* règles de conservation des données.

Distinguer :

1. règle explicitement présente ;
2. règle absente ;
3. règle seulement implicite ;
4. règle impossible à vérifier parce que le fichier est tronqué.

## 7. COHÉRENCE AVEC LES AUTRES SKILLS

Lire uniquement ce qui est nécessaire dans :

* `bebba-database`
* `bebba-workflow`
* `bebba-security`
* `bebba-testing`
* `bebba-wordpress`
* `bebba-audit`

Identifier les responsabilités qui appartiennent réellement à `bebba-migration`.

Signaler les chevauchements sans proposer encore de refactor.

## 8. GIT

Vérifier en lecture seule :

```bash
git status --short
git branch --show-current
git log --oneline --all -- .opencode/skills/bebba-migration/SKILL.md
git diff -- .opencode/skills/bebba-migration/SKILL.md
```

Ne faire aucune écriture Git.

## 9. DIAGNOSTIC FINAL

Produire exactement :

### A — État réel

### B — Preuves de troncature

### C — Sections présentes

### D — Sections manquantes

### E — Source complète retrouvée ou non

### F — Règles métier couvertes / absentes / impossibles à vérifier

### G — Chevauchements avec les autres Skills

### H — Gravité

Classer chaque problème :

* BLOCKING
* IMPORTANT
* MINOR
* INFO

### I — Correction à préparer

Ne pas effectuer la correction.

Si une source complète existe, indiquer précisément quelle source doit servir de base.

Si aucune source complète n'existe, indiquer précisément quelles sections devront être reconstruites, sans les écrire maintenant.

### J — Validation à effectuer après correction

Décrire uniquement les vérifications qui devront être réalisées après la future correction.

## 10. RAPPORT

Le rapport doit être complet et factuel.

Ne pas tronquer volontairement le rapport.

Ne pas modifier le fichier audité.

Terminer exactement par :

`STOP — audit ciblé de bebba-migration terminé, aucune modification effectuée.`

