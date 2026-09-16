# BLOC CORRECTION — `bebba-migration`

## RÔLE

Tu agis comme contrôleur technique du projet **BEBBA Healthy Food**.

Le BLOC AUDIT de `bebba-migration` est terminé et documenté.

L'audit a démontré que :

* `.opencode/skills/bebba-migration/SKILL.md` est tronqué ;
* le fichier contient un bloc Markdown non fermé ;
* il s'arrête au milieu d'un exemple de mapping ;
* aucune copie complète récupérable n'a été trouvée dans le dépôt Git, les branches, l'historique ou les autres emplacements vérifiés ;
* plusieurs sections essentielles de la Skill sont absentes ;
* les règles métier BEBBA ne sont pas suffisamment protégées dans cette Skill.

La correction doit donc **reconstruire proprement la Skill à partir de son contenu existant et des règles BEBBA établies**, sans inventer de comportement applicatif.

---

# 1. PÉRIMÈTRE ABSOLU

Tu peux modifier **UN SEUL fichier** :

```text
.opencode/skills/bebba-migration/SKILL.md
```

Interdiction absolue de modifier, créer ou supprimer :

* un autre Skill ;
* `.opencode/run-prompt.sh` ;
* `.opencode/prompts/*` ;
* `src/*` ;
* `server/*` ;
* `data/*` ;
* `package.json` ;
* `package-lock.json` ;
* `firestore.rules` ;
* `security_spec.md` ;
* des fichiers WordPress ;
* des fichiers MySQL ;
* tout autre fichier du projet.

Aucune modification du runtime BEBBA.

Aucune migration de données réelle.

Aucune modification de base de données.

Aucun commit.

Aucun push.

---

# 2. AVANT LA MODIFICATION : LIRE ET ALIGNER

Lis d'abord, en lecture seule :

```text
.opencode/skills/bebba-migration/SKILL.md
.opencode/skills/bebba-workflow/SKILL.md
.opencode/skills/bebba-database/SKILL.md
.opencode/skills/bebba-wordpress/SKILL.md
.opencode/skills/bebba-security/SKILL.md
.opencode/skills/bebba-testing/SKILL.md
.opencode/skills/bebba-audit/SKILL.md
```

Objectif :

* conserver les parties valides déjà présentes dans `bebba-migration` ;
* respecter les frontières entre Skills ;
* ne pas recopier inutilement les responsabilités détaillées des autres Skills ;
* supprimer les ambiguïtés de responsabilité ;
* rendre `bebba-migration` autonome et cohérente.

Ne modifie aucune autre Skill.

---

# 3. FRONTMATTER

Conserve le frontmatter actuel s'il est valide.

Il doit rester conforme à OpenCode :

```yaml
---
name: bebba-migration
description: >
  Use when migrating BEBBA data, application components, database structures,
  WordPress data, WooCommerce data, legacy JSON data, or systems between
  environments. Use for mapping, transformation, import, export, validation,
  rollback, and migration planning. Avoid when no BEBBA migration is involved.
---
```

Vérifie réellement que :

* `name` = `bebba-migration` ;
* le nom correspond exactement au dossier ;
* `description` est valide ;
* le YAML est parsable par OpenCode.

---

# 4. CONSERVER LE CONTENU EXISTANT VALIDE

Ne supprime pas les sections existantes simplement pour réécrire le fichier.

Conserve et améliore notamment les parties déjà présentes concernant :

* le purpose ;
* l'inventaire ;
* la source de vérité ;
* le mapping ;
* la distinction source/destination.

Corrige le bloc actuellement tronqué.

L'exemple existant :

```text
source.customer.id
        ↓
destination.wp_user.ID
```

doit être correctement fermé.

Aucun bloc Markdown ne doit rester ouvert.

---

# 5. RECONSTRUIRE LES SECTIONS MANQUANTES

Complète la Skill avec une structure claire et cohérente.

Elle doit couvrir au minimum les thèmes suivants.

## 5.1 Transformation

Définir :

* transformation des champs ;
* renommage ;
* conversion des types ;
* normalisation ;
* valeurs par défaut ;
* gestion des valeurs nulles ;
* gestion des champs supprimés ;
* conversion des dates ;
* conversion des montants ;
* conversion des références.

Toute transformation doit être explicitement documentée.

Interdiction d'inventer silencieusement une correspondance.

---

## 5.2 IDs et relations

Définir les règles pour :

* IDs ;
* clés étrangères ;
* relations parent/enfant ;
* références croisées ;
* utilisateurs ;
* commandes ;
* produits ;
* ingrédients ;
* livreurs ;
* stocks ;
* historiques.

Une migration ne doit jamais casser une relation sans preuve et stratégie explicite.

Les identifiants doivent rester stables lorsque le modèle destination le permet.

Si une transformation d'ID est nécessaire :

```text
source ID
→ table de correspondance
→ destination ID
```

Cette correspondance doit être conservée et vérifiable.

---

# 6. RÈGLES MÉTIER BEBBA À PRÉSERVER

La Skill doit explicitement protéger les règles métier suivantes lors de toute migration.

## Commandes et paiement

Le paiement V1 est **Cash on Delivery uniquement**.

Les états de paiement sont :

```text
to_collect
paid
```

Une commande nouvellement créée doit conserver :

```text
paymentStatus = to_collect
```

La livraison et l'encaissement sont deux événements distincts.

Une commande :

```text
delivered
```

ne signifie pas automatiquement :

```text
paid
```

Ne jamais transformer implicitement `delivered` en `paid`.

---

## Cycle de commande

Le flux métier est :

```text
received
→ preparing
→ ready
→ waiting_for_driver
→ delivering
→ delivered
```

avec possibilité de :

```text
cancelled
```

Ne pas modifier cet ordre lors d'une migration sans règle métier explicitement documentée.

---

## Rôles

Les rôles BEBBA sont :

```text
Client
Cuisine
Livreur
Administration
```

L'Administration / Super Administrateur dispose de l'accès absolu prévu par le modèle métier.

Une migration ne doit pas :

* transformer un rôle en un autre ;
* supprimer un rôle ;
* donner des privilèges supplémentaires ;
* perdre les restrictions d'accès.

---

## Livraison

La migration doit préserver :

* le livreur assigné ;
* les changements d'affectation ;
* le statut de livraison ;
* les informations nécessaires à la livraison ;
* la distinction entre livraison et encaissement.

---

## Client

Les informations nécessaires à une commande doivent rester cohérentes, notamment :

* téléphone ;
* adresse de livraison.

---

## Tracking

Préserver les mécanismes de suivi existants lorsque concernés, notamment :

```text
trackingToken
```

et la clé locale :

```text
bebba_last_tracking_token
```

Ne pas remplacer ou générer arbitrairement des tokens existants.

---

## Stock

Une migration doit préserver :

* quantité ;
* coût ;
* seuil d'alerte ;
* relations avec les ingrédients ;
* historique des mouvements lorsque présent ;
* cohérence entre stock source et stock destination.

Une migration ne doit pas provoquer de consommation ou restitution implicite de stock.

---

## Historique

Les historiques métier doivent être conservés lorsque leur conservation est prévue par le modèle source/destination.

Ne jamais supprimer silencieusement :

* événements ;
* changements de statut ;
* mouvements de stock ;
* informations financières ;
* affectations de livraison.

---

## Production des repas

Lorsque la donnée concerne le cycle de production, préserver la règle métier selon laquelle les repas sont préparés après commande et ne sont pas considérés comme préparés en avance.

---

# 7. IMPORT / EXPORT

Définir une méthode contrôlée pour :

* export ;
* sauvegarde ;
* transformation ;
* import ;
* vérification post-import.

Toute migration doit être :

* traçable ;
* reproductible ;
* vérifiable.

Privilégier lorsque possible :

```text
backup
→ extraction
→ transformation
→ dry-run
→ import
→ validation
```

---

# 8. IDEMPOTENCE

Toute migration répétable doit définir comment éviter :

* doublons ;
* doubles imports ;
* duplication des utilisateurs ;
* duplication des commandes ;
* duplication des produits ;
* duplication des ingrédients ;
* duplication des historiques.

Lorsque possible, utiliser une clé stable ou une table de correspondance.

Une seconde exécution ne doit pas produire silencieusement une seconde copie des mêmes données.

---

# 9. TRANSACTIONS ET LOTS

Pour les opérations sensibles :

* utiliser des transactions lorsque le moteur destination le permet ;
* utiliser des traitements par lots pour les volumes importants ;
* définir les limites de batch ;
* éviter les imports partiellement réussis sans trace ;
* journaliser les erreurs.

Pour toute opération non atomique, prévoir un mécanisme permettant d'identifier exactement :

```text
succès
échec
non traité
```

---

# 10. SYNCHRONISATION ENTRE ENVIRONNEMENTS

Définir clairement :

* source ;
* destination ;
* environnement de test ;
* environnement de production.

Interdire une migration directe vers la production sans :

```text
inventaire
→ mapping
→ dry-run
→ sauvegarde
→ validation
```

Si une synchronisation est nécessaire, documenter :

* sens de synchronisation ;
* fréquence ;
* conflit ;
* source de vérité ;
* stratégie de résolution.

---

# 11. VALIDATION

La validation doit être indépendante de l'exécution de la migration.

Elle doit comparer au minimum :

### Quantités

```text
nombre d'enregistrements source
vs
nombre d'enregistrements destination
```

### Relations

Vérifier :

* utilisateurs ;
* commandes ;
* produits ;
* ingrédients ;
* livreurs ;
* relations entre entités.

### Commandes

Vérifier :

* identifiant ;
* client ;
* montant ;
* statut ;
* paymentStatus ;
* livreur ;
* dates.

### Finances

Vérifier notamment :

```text
to_collect
paid
```

et empêcher toute conversion implicite de statut.

### Stock

Comparer :

* quantités ;
* coûts ;
* seuils ;
* relations ;
* historiques.

### Tracking

Vérifier la conservation des tokens lorsqu'ils existent.

### Intégrité

Rechercher :

* doublons ;
* références orphelines ;
* champs obligatoires manquants ;
* valeurs impossibles ;
* statuts invalides ;
* montants incohérents.

---

# 12. DRY-RUN

Toute migration importante doit prévoir un dry-run lorsque techniquement possible.

Le dry-run doit permettre d'obtenir :

```text
records lus
records transformés
records ignorés
records en erreur
records créés
records mis à jour
doublons détectés
relations invalides
```

Le dry-run ne doit pas modifier la destination.

---

# 13. BACKUP ET ROLLBACK

Toute migration destructive ou difficilement réversible doit disposer d'une sauvegarde avant exécution.

Définir explicitement :

```text
ÉTAT AVANT
→ BACKUP
→ MIGRATION
→ VALIDATION
```

En cas d'échec :

```text
MIGRATION
→ DIAGNOSTIC
→ ROLLBACK
→ VALIDATION DE L'ÉTAT RESTAURÉ
```

Le rollback doit préciser :

* ce qui est restauré ;
* depuis quelle sauvegarde ;
* comment vérifier la restauration ;
* comment éviter un rollback partiel.

Ne jamais considérer qu'un rollback existe simplement parce qu'une sauvegarde existe.

Le rollback doit être exécutable ou suffisamment précisément spécifié pour être exécuté.

---

# 14. SÉCURITÉ DES DONNÉES

La Skill doit couvrir uniquement les aspects de sécurité directement liés à la migration :

* protection des exports ;
* protection des sauvegardes ;
* secrets ;
* données personnelles ;
* permissions nécessaires à l'import/export ;
* suppression sécurisée des fichiers temporaires ;
* interdiction d'exposer des données sensibles dans les logs.

Les règles générales d'authentification, d'autorisation et d'IDOR restent de la responsabilité de `bebba-security`.

Ne pas dupliquer toute la Skill de sécurité.

---

# 15. FRONTIÈRES AVEC LES AUTRES SKILLS

Définir explicitement les responsabilités.

### `bebba-migration`

Responsable de :

* stratégie de migration ;
* inventaire source/destination ;
* mapping ;
* transformation ;
* import/export ;
* synchronisation ;
* idempotence ;
* dry-run ;
* validation spécifique à la migration ;
* sauvegarde ;
* rollback.

### `bebba-database`

Responsable de :

* architecture de données ;
* schémas ;
* tables ;
* relations ;
* indexes ;
* contraintes ;
* intégrité générale de la base.

### `bebba-wordpress`

Responsable de :

* WordPress ;
* WooCommerce ;
* plugins ;
* hooks ;
* REST WordPress ;
* administration WordPress.

### `bebba-security`

Responsable de :

* authentification ;
* autorisation ;
* rôles ;
* permissions ;
* sessions ;
* tokens ;
* protection des opérations sensibles.

### `bebba-testing`

Responsable de :

* tests fonctionnels ;
* tests de régression ;
* tests d'intégration ;
* validation globale après correction.

### `bebba-audit`

Responsable de :

* audit ;
* diagnostic ;
* collecte des preuves ;
* classification des problèmes ;
* contrôle avant correction.

### `bebba-workflow`

Responsable du processus global :

```text
BLOC
→ AUDIT
→ PREUVE
→ STOP
→ CORRECTION
→ VALIDATION
→ COMMIT
→ VÉRIFICATION GITHUB
→ STOP
```

`bebba-migration` ne doit pas remplacer ce workflow.

---

# 16. PREUVE AVANT ACTION

Toute migration doit partir de preuves.

Interdiction de considérer comme preuve :

* une hypothèse ;
* un nom de champ supposé ;
* un résultat déclaré "DONE" par un outil ;
* un build vert seul ;
* une interface qui semble fonctionner ;
* une correspondance supposée.

Avant toute migration :

```text
diagnostic
→ inventaire
→ preuve
→ mapping
→ migration
```

---

# 17. MODIFICATION MINIMALE

La Skill doit rester :

* claire ;
* opérationnelle ;
* concise ;
* orientée procédure.

Ne pas ajouter de théorie inutile.

Ne pas créer de doublons avec les autres Skills.

Ne pas transformer cette Skill en documentation complète de toute l'architecture BEBBA.

---

# 18. VALIDATION TECHNIQUE APRÈS MODIFICATION

Après avoir modifié uniquement :

```text
.opencode/skills/bebba-migration/SKILL.md
```

effectue les contrôles suivants.

### A. YAML

Vérifier que le frontmatter est parsable.

### B. Markdown

Vérifier :

* tous les blocs ``` sont fermés ;
* aucun bloc n'est imbriqué incorrectement ;
* les titres sont cohérents ;
* le fichier ne se termine pas au milieu d'une section ou d'un exemple.

### C. OpenCode

Vérifier avec OpenCode 1.18.31 que :

```text
bebba-migration
```

est :

* détecté ;
* chargé ;
* parsé ;
* utilisable.

Utiliser si disponible :

```text
opencode debug skill
```

ou le mécanisme équivalent déjà utilisé lors des audits précédents.

### D. Intégrité du fichier

Afficher :

```text
wc -l
wc -c
sha256sum
```

### E. Périmètre Git

Vérifier :

```bash
git diff --name-only
git status --short
```

Le seul fichier modifié doit être :

```text
.opencode/skills/bebba-migration/SKILL.md
```

Si un autre fichier a été modifié par ton action, tu dois immédiatement le signaler et ne pas le laisser dans la correction.

### F. Aucun commit

Ne fais :

```text
git commit
git push
```

sous aucune circonstance.

---

# 19. RAPPORT FINAL

À la fin, produis un rapport structuré contenant exactement :

## A. État avant correction

* taille ;
* nombre de lignes ;
* SHA256 ;
* problème constaté.

## B. Corrections réalisées

Liste précise des sections ajoutées ou réparées.

## C. Règles métier protégées

Confirmer explicitement la présence des règles :

* COD ;
* `to_collect` / `paid` ;
* séparation livraison/encaissement ;
* cycle de commande ;
* rôles ;
* tracking ;
* stock ;
* historique.

## D. Frontières entre Skills

Confirmer que les responsabilités ne sont pas inutilement dupliquées.

## E. Validation technique

Donner les résultats réels de :

* YAML ;
* Markdown ;
* OpenCode ;
* `wc` ;
* SHA256 ;
* Git.

## F. Fichiers modifiés

Le résultat doit être exactement :

```text
.opencode/skills/bebba-migration/SKILL.md
```

## G. Commit

Indiquer explicitement :

```text
Aucun commit effectué.
```

## H. Push

Indiquer explicitement :

```text
Aucun push effectué.
```

Ne jamais déclarer la correction conforme si une validation réelle échoue.

---

# 20. STOP FINAL

Après le rapport, terminer exactement par :

```text
STOP — correction de bebba-migration terminée, validation indépendante requise, aucun commit effectué.
```

Ne demande pas d'autorisation supplémentaire avant d'effectuer cette correction : le présent prompt constitue l'autorisation de réaliser cette correction ciblée.

Ne modifie aucun autre fichier.

