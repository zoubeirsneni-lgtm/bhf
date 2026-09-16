Tu dois effectuer un AUDIT GLOBAL des Skills OpenCode du projet BEBBA Healthy Food.

IMPORTANT :
- AUDIT EN LECTURE SEULE UNIQUEMENT.
- Ne modifie aucun fichier.
- Ne crée aucun fichier.
- Ne supprime aucun fichier.
- Ne fais aucun commit.
- Ne fais aucun push.
- Ne modifie pas le code BEBBA.
- Ne modifie pas la base de données.
- Ne lance aucune migration.
- Ne corrige aucun problème découvert.
- À la fin du rapport : STOP.

## 1. PÉRIMÈTRE

Auditer exactement ces 7 Skills :

.opencode/skills/bebba-workflow/SKILL.md
.opencode/skills/bebba-database/SKILL.md
.opencode/skills/bebba-wordpress/SKILL.md
.opencode/skills/bebba-security/SKILL.md
.opencode/skills/bebba-migration/SKILL.md
.opencode/skills/bebba-testing/SKILL.md
.opencode/skills/bebba-audit/SKILL.md

Ne pas transformer cet audit en audit général du projet BEBBA.

## 2. OBJECTIF

Déterminer si l'ensemble des 7 Skills est :

- correctement détectable par OpenCode ;
- correctement structuré ;
- cohérent ;
- non contradictoire ;
- suffisamment précis ;
- utilisable pour le projet BEBBA ;
- correctement séparé par responsabilité ;
- compatible avec le workflow défini dans bebba-workflow.

## 3. VALIDATION OPENCode

Utiliser le mécanisme réellement utilisé par OpenCode 1.18.31 pour vérifier :

- frontmatter ;
- name ;
- description ;
- correspondance nom/dossier ;
- détection des Skills ;
- chargement des Skills.

Vérifier les 7 Skills individuellement.

Ne pas se contenter d'une inspection visuelle du YAML.

## 4. STRUCTURE

Pour chaque Skill, vérifier :

- frontmatter valide ;
- name valide ;
- description présente ;
- description cohérente avec le périmètre ;
- corps Markdown valide ;
- absence de contenu manifestement contradictoire ;
- absence de références à des fichiers inexistants lorsque ces références sont
  censées être obligatoires.

## 5. COHÉRENCE ENTRE SKILLS

Vérifier les frontières entre :

- bebba-workflow
- bebba-database
- bebba-wordpress
- bebba-security
- bebba-migration
- bebba-testing
- bebba-audit

Rechercher notamment :

- contradictions ;
- responsabilités dupliquées ;
- règles incompatibles ;
- workflows différents ;
- règles de STOP contradictoires ;
- règles de modification contradictoires ;
- règles Git contradictoires ;
- confusion entre audit, correction, validation et migration.

## 6. WORKFLOW

Vérifier que les Skills respectent le workflow global :

BLOC
→ AUDIT
→ PREUVE
→ STOP
→ CORRECTION
→ VALIDATION
→ COMMIT
→ VÉRIFICATION GITHUB
→ STOP

Vérifier particulièrement que :

- un audit reste en lecture seule ;
- une correction ne se fait pas pendant un audit ;
- une validation est indépendante ;
- le commit arrive après validation ;
- GitHub est vérifié après commit ;
- aucune Skill n'autorise implicitement un commit ou un push ;
- aucune Skill ne transforme automatiquement une découverte en correction.

## 7. RESPONSABILITÉS MÉTIER

Vérifier que chaque Skill reste dans son domaine :

bebba-workflow
→ méthode de travail et contrôle du processus.

bebba-database
→ données, schéma, intégrité, MySQL et opérations database.

bebba-wordpress
→ WordPress, WooCommerce, plugins, hooks et architecture WordPress.

bebba-security
→ authentification, autorisation, rôles, permissions et sécurité.

bebba-migration
→ mapping, transformation, import/export, migration et rollback.

bebba-testing
→ tests, validation, régression et preuves de fonctionnement.

bebba-audit
→ diagnostic et constat en lecture seule.

Signaler toute responsabilité qui semble appartenir clairement à une autre
Skill.

## 8. RÈGLES BEBBA

Vérifier que les Skills ne contredisent pas les règles métier connues de BEBBA,
notamment :

- paiement V1 en COD ;
- `to_collect` et `paid` distincts ;
- livraison et encaissement séparés ;
- flux des commandes ;
- rôles Client, Cuisine/KDS, Livreur et Administration/Super Admin ;
- cohérence des stocks ;
- préparation des repas après commande ;
- conservation des données historiques nécessaires ;
- migration sans modification arbitraire des règles métier.

## 9. QUALITÉ

Pour chaque problème trouvé, fournir :

- Skill concernée ;
- fichier ;
- section ou ligne si possible ;
- problème exact ;
- preuve ;
- impact ;
- catégorie :
  - BLOQUANT
  - IMPORTANT
  - MINEUR
  - INFORMATION.

Ne jamais inventer une preuve.

Si aucun problème n'est trouvé, le dire explicitement.

## 10. GIT

À la fin, vérifier en lecture seule :

- git status ;
- fichiers non suivis ;
- modifications ;
- branche courante ;
- dernier commit.

Ne faire aucune modification.

## 11. RAPPORT FINAL

Produire :

### A. Inventaire
Les 7 Skills détectées.

### B. Détection OpenCode
Résultat de la validation OpenCode 1.18.31.

### C. Audit individuel
Résultat pour chaque Skill.

### D. Cohérence globale
Contradictions, chevauchements et lacunes.

### E. Workflow
Conformité au workflow global.

### F. Règles métier
Conformité aux règles BEBBA connues.

### G. Git
État Git observé.

### H. Anomalies
Liste précise des problèmes avec preuves.

### I. Conclusion
État global :
- CONFORME
- CONFORME AVEC RÉSERVES
- NON CONFORME

Cette conclusion doit être fondée uniquement sur les preuves recueillies.

## 12. INTERDICTION DE CORRECTION

Même si un problème est trouvé :

NE PAS LE CORRIGER.

Le rapport doit uniquement identifier le problème et proposer, si nécessaire,
une correction à effectuer dans un bloc séparé.

Terminer exactement par :

STOP — audit global des Skills terminé, aucune modification effectuée.
