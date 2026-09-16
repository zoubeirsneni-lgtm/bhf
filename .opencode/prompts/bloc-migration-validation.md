# BLOC VALIDATION — `bebba-migration`

## OBJECTIF

Effectuer maintenant la **validation indépendante** de la correction qui vient d'être apportée à :

```text
.opencode/skills/bebba-migration/SKILL.md
```

Le BLOC CORRECTION est terminé.

Cette étape doit uniquement vérifier la correction.

**Aucune modification n'est autorisée pendant cette validation.**

---

# 1. PÉRIMÈTRE ABSOLU

Lecture seule.

Interdiction de :

* modifier un fichier ;
* créer un fichier ;
* supprimer un fichier ;
* modifier un autre Skill ;
* modifier BEBBA ;
* modifier `.opencode/run-prompt.sh` ;
* faire un commit ;
* faire un push.

---

# 2. ÉTAT À CONTRÔLER

Lire intégralement :

```text
.opencode/skills/bebba-migration/SKILL.md
```

Lire également les Skills de référence uniquement pour contrôler la cohérence :

```text
.opencode/skills/bebba-workflow/SKILL.md
.opencode/skills/bebba-database/SKILL.md
.opencode/skills/bebba-wordpress/SKILL.md
.opencode/skills/bebba-security/SKILL.md
.opencode/skills/bebba-testing/SKILL.md
.opencode/skills/bebba-audit/SKILL.md
```

---

# 3. CONTRÔLES OBLIGATOIRES

## A — Frontmatter

Vérifier réellement :

* YAML valide ;
* `name: bebba-migration` ;
* nom correspondant au dossier ;
* description présente ;
* OpenCode 1.18.31 capable de charger la Skill.

---

## B — Intégrité Markdown

Vérifier :

* tous les blocs ``` sont fermés ;
* nombre de fences pair ;
* aucun bloc interrompu ;
* aucun exemple tronqué ;
* aucun titre interrompu ;
* fichier terminé proprement.

---

## C — Complétude

Vérifier que la Skill contient effectivement des sections couvrant :

* purpose ;
* inventaire ;
* source de vérité ;
* mapping ;
* transformation ;
* IDs et relations ;
* règles métier ;
* import/export ;
* idempotence ;
* transactions/batches ;
* synchronisation ;
* dry-run ;
* validation ;
* backup ;
* rollback ;
* sécurité spécifique à la migration ;
* frontières avec les autres Skills ;
* preuve avant action ;
* modification minimale ;
* reporting ;
* STOP final.

---

# 4. RÈGLES MÉTIER BEBBA

Vérifier textuellement la présence et la cohérence des règles suivantes.

### Paiement

```text
to_collect
paid
```

et la règle :

```text
livraison ≠ encaissement
```

Une commande `delivered` ne doit pas être automatiquement considérée `paid`.

### Cycle de commande

```text
received
→ preparing
→ ready
→ waiting_for_driver
→ delivering
→ delivered
```

avec :

```text
cancelled
```

### Rôles

```text
Client
Cuisine
Livreur
Administration
```

### Tracking

Vérifier la présence de :

```text
trackingToken
bebba_last_tracking_token
```

### Stock

Vérifier la protection de :

* quantités ;
* coûts ;
* seuils ;
* relations ;
* historique.

### Données client

Vérifier la protection du :

* téléphone ;
* adresse de livraison.

---

# 5. FRONTIÈRES DES SKILLS

Vérifier que `bebba-migration` ne tente pas de devenir :

* la Skill database ;
* la Skill security ;
* la Skill WordPress ;
* la Skill testing ;
* la Skill audit ;
* la Skill workflow.

Elle doit rester responsable principalement de :

```text
inventaire
mapping
transformation
migration
import/export
synchronisation
idempotence
dry-run
validation de migration
backup
rollback
```

---

# 6. PREUVE

Exécuter réellement les contrôles disponibles, notamment :

```bash
wc -l .opencode/skills/bebba-migration/SKILL.md
wc -c .opencode/skills/bebba-migration/SKILL.md
sha256sum .opencode/skills/bebba-migration/SKILL.md
```

Contrôler également les fences Markdown.

Utiliser OpenCode 1.18.31 pour vérifier que :

```text
bebba-migration
```

est détectée et chargée.

Si disponible :

```text
opencode debug skill
```

ou le mécanisme équivalent déjà utilisé.

---

# 7. CONTRÔLE GIT

Lecture seule :

```bash
git status --short
git diff --name-only
git diff --stat
```

Ne faire aucun commit.

Ne faire aucun push.

Important :

la présence éventuelle de `.opencode/` comme non suivi ne constitue pas une preuve de commit.

---

# 8. CRITÈRE DE VALIDATION

Classer le résultat :

### CONFORME

Uniquement si :

* le fichier est complet ;
* Markdown valide ;
* YAML valide ;
* OpenCode le charge ;
* toutes les sections obligatoires sont présentes ;
* les règles métier sont protégées ;
* les frontières entre Skills sont cohérentes ;
* aucune modification supplémentaire n'est nécessaire.

### NON CONFORME

Si un seul problème important subsiste.

Dans ce cas, identifier précisément :

```text
problème
→ preuve
→ section concernée
→ correction nécessaire
```

Ne pas corriger pendant cette étape.

---

# 9. RAPPORT FINAL

Produire :

## A. État contrôlé

Lignes, taille et SHA256.

## B. Résultat YAML

Preuve réelle.

## C. Résultat Markdown

Nombre de fences et résultat.

## D. Résultat OpenCode

Détection et chargement réels.

## E. Règles métier

Liste des règles effectivement trouvées.

## F. Frontières Skills

Résultat du contrôle.

## G. Git

État réel, sans commit.

## H. Verdict

Un seul :

```text
CONFORME
```

ou

```text
NON CONFORME
```

Si NON CONFORME, donner immédiatement la liste précise des corrections nécessaires.

---

# 10. IMPORTANT

Cette étape est une **validation indépendante**.

Ne considère pas le rapport précédent comme une preuve suffisante.

Ne considère pas le message « correction terminée » comme une preuve suffisante.

La preuve doit venir du fichier réellement contrôlé et des commandes réellement exécutées.

---

# 11. STOP FINAL

Terminer exactement par :

```text
STOP — validation indépendante de bebba-migration terminée, aucun fichier modifié, aucun commit effectué.
```

