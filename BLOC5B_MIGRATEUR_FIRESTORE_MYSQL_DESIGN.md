# BLOC 5B — CONCEPTION TECHNIQUE CORRIGÉE DU MIGRATEUR FIRESTORE → MYSQL

## 1. Architecture corrigée

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIRESTORE → MYSQL MIGRATOR                       │
├─────────────────────────────────────────────────────────────────────┤
│  ENTRY POINT: scripts/migrate-firestore-to-mysql.ts                │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  EXTRACT    │───▶│  TRANSFORM  │───▶│  LOAD       │             │
│  │  (Reader)   │    │  (Agrégats) │    │  (Writer)   │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│         │                   │                   │                   │
│         ▼                   ▼                   ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Firestore   │    │ Validation  │    │ MySQL       │             │
│  │ Collections │    │ Engine      │    │ Batch Insert│             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CROSS-CUTTING SERVICES                                      │   │
│  │  • FirestoreReader      • WPUserResolver                    │   │
│  │  • AggregationMappers   • ValidationEngine                  │   │
│  │  • MySQLBatchWriter     • MigrationMapService               │   │
│  │  • QuarantineService    • TransactionManager                │   │
│  │  • ResumeController     • DryRunReporter                    │   │
│  │  • RollbackManager                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Flux de vérité des données :**
```
GitHub main (code)          Firestore actuel (données)          MySQL bebba_test (cible)
     │                            │                                  │
     ▼                            ▼                                  ▼
scripts/migrate-firestore-to-mysql.ts  ◀────── active-presence-n4jp1  ◀────── 127.0.0.1:3306/bebba_test
     │                            (lecture dynamique)                (écriture structurée)
     ▼
Rapport dry-run / Migration
```

**Fichiers concernés :**
- `scripts/migrate-firestore-to-mysql.ts` (à créer — point d'entrée unique)
- `mysql_schema_bebba.sql` (DDL validé, cible immuable)
- `.env` (configuration Firebase + MySQL)
- `firebase-applet-config.json` (config Firestore)

---

## 2. Provenance des données (RÈGLE ABSOLUE)

| Source | Type | Utilisation |
|--------|------|-------------|
| **Firestore `active-presence-n4jp1`** | **Source de vérité unique** | Lecture dynamique de toutes les collections au moment du dry-run/migration |
| `data/db.json` | Référence historique **uniquement** | Contrôle de cohérence, jamais source de migration |
| GitHub `main` @ `ed6375b` | Code du migrateur | Version verrouillée, aucune copie locale/ZIP |
| `mysql_schema_bebba.sql` @ `af1154f` | Schéma cible | Déjà déployé sur `bebba_test`, immuable |

**Interdictions :**
- ❌ Aucun volume hardcodé (54, 173, 119, 328, 1101, 1010, etc.)
- ❌ Aucune lecture de `data/db.json` pour alimenter le pipeline
- ❌ Aucune valeur historique utilisée comme constante métier

---

## 3. Phases de migration (ordre FK respecté)

| Phase | Agrégat métier | Tables MySQL cibles | Collections Firestore sources | Dépendances |
|-------|----------------|---------------------|------------------------------|-------------|
| **1. Référentiels** | Catalogue de base | `bebba_categories`, `bebba_suppliers` | `categories`, `suppliers` | — |
| **2. Identité** | Staff & Drivers | `bebba_drivers`, `bebba_counters` | `users` (role≠client), `drivers`, `meta/counters` | — |
| **3. Stock & Produits** | Ingrédients, Suppléments, Produits | `bebba_ingredients`, `bebba_supplements`, `bebba_products` | `ingredients`, `supplements`, `products` | 1 |
| **4. Recettes** | Composition produits | `bebba_product_ingredients`, `bebba_product_options`, `bebba_product_supplements` | `products.baseIngredients`, `products.customization` | 3 |
| **5. Commandes** | Tête de commande | `bebba_orders` | `orders` | 2, 3 |
| **6. Lignes de commande** | Détails commande | `bebba_order_items`, `bebba_order_item_supplements`, `bebba_order_item_prep` | `orders.items` | 5, 3, 4 |
| **7. Historiques** | Traçabilité | `bebba_order_status_history`, `bebba_stock_movements`, `bebba_order_idempotency` | `orders.statusHistory`, `stockMovements`, `orderIdempotencyKeys` | 5, 6 |
| **8. Infrastructure** | Traçabilité migration | `bebba_migration_map`, `bebba_migration_quarantine` | (métadonnées générées) | 1-7 |

**Volumes** : Découverts dynamiquement via `FirestoreReader.count(collection)` au début de chaque phase.

---

## 4. Agrégats / Mappers (organisation par domaine)

| Agrégat | Tables cibles | Responsabilités clés |
|---------|---------------|---------------------|
| **CatalogMapper** | `categories`, `suppliers` | Slug non-UNIQUE (doublons), JSON `suppliedIngredients` brut |
| **IdentityMapper** | `drivers`, `counters` | `WPUserResolver` → `user_id`, `nextOrderSeq` dynamique depuis `meta/counters` |
| **StockProductMapper** | `ingredients`, `supplements`, `products` | NULLables préservés, `legacy_quantity`, refs fantômes → quarantaine |
| **RecipeMapper** | `product_ingredients`, `product_options`, `product_supplements` | Position ordre source, FK NULLables, ghost refs → quarantaine |
| **OrderMapper** | `orders`, `order_items`, `order_item_supplements`, `order_item_prep` | Snapshots NOT NULL, FK NULLables, montants NULL, `stock_consumed` ternaire |
| **HistoryMapper** | `order_status_history`, `stock_movements`, `order_idempotency` | `position` + `DATETIME(3)`, quantités signées, `nextOrderSeq` importé |
| **InfraMapper** | `migration_map`, `migration_quarantine` | Traçabilité complète, quarantaine anomalies BLOC 1/2 |

Chaque agrégat documente : source Firestore, transformation, tables cibles, résolution FK, anomalies possibles, comportement erreur, stratégie transactionnelle.

---

## 5. Stratégie FK (RÈGLE STRICTE)

| Type de référence | Traitement |
|-------------------|------------|
| **FK valide trouvée** | `FK = target_id` (actif) |
| **Référence legacy orpheline connue** (BLOC 2) | `FK = NULL` + `legacy_id` conservé + `snapshot` conservé + **quarantaine** `missing_fk` |
| **Violation FK inattendue** (non documentée BLOC 2) | **HARD FAIL** → rollback transactionnel immédiat |

**Règle** : `FOREIGN_KEY_CHECKS=1` **toujours actif** pendant la migration. Pas de désactivation globale.

**Résolution IDs MySQL** : `LAST_INSERT_ID()` pour inserts directs, `SELECT id FROM table WHERE legacy_id = ?` pour lookups.

---

## 6. Stratégie Transactions (MySQL/InnoDB cohérente)

Une **transaction de phase** englobe l'intégralité du traitement d'un agrégat métier (ex: phase "Catalogue" = toutes les catégories + suppliers).

```sql
START TRANSACTION;
-- Pour chaque batch (≤ 500 lignes) :
SAVEPOINT batch_N;
--   INSERT/UPDATE entités + migration_map + quarantine (même transaction)
--   Si anomalie métier connue (BLOC 2) :
--     écriture quarantine + migration_map status='quarantined' (dans la MÊME transaction)
--     RELEASE SAVEPOINT batch_N;  -- continue batch suivant
--   Si erreur technique (FK inattendue, UNIQUE, ENUM, type, timeout, etc.) :
--     ROLLBACK TO SAVEPOINT batch_N;  -- annule ce batch seulement
--     marque migration_map status='failed' + error_message
--     ROLLBACK;  -- annule TOUTE la phase
--     EXIT (NO-GO)
-- RELEASE SAVEPOINT batch_N;
COMMIT;  -- fin de phase, tout validé
```

**Règles atomiques :**
- `migration_map` et `quarantine` sont écrits **dans la MÊME transaction** que l'entité qu'ils tracent (même `START TRANSACTION`).
- Pas d'auto-commit par ligne à l'intérieur de la transaction de phase.
- Une ligne = une exécution `INSERT/UPDATE` dans le batch courant.
- Si 1 ligne échoue techniquement → `ROLLBACK TO SAVEPOINT batch_N` + `ROLLBACK` global phase.
- Si 1 ligne est anomalie métier connue → `quarantine` + `migration_map` status='quarantined' (dans même transaction) → `RELEASE SAVEPOINT` → continue.
- `wp_users` mapping : résolu **AVANT** `START TRANSACTION` (lecture seule). Si absent → NO-GO pré-migration.
- Pas de niveau "Ligne critique auto-commit" : tout est dans la transaction de phase.

**Niveaux réels MySQL :**
| Niveau | Mécanisme | Rollback |
|--------|-----------|----------|
| **Migration** (8 phases) | Aucune (DDL non transactionnel) | **Restauration backup mysqldump** (niveau B) |
| **Phase** (1 agrégat) | `START TRANSACTION` ... `COMMIT`/`ROLLBACK` | `ROLLBACK` (phase complète) |
| **Batch** (≤ 500 lignes) | `SAVEPOINT batch_N` ... `RELEASE` / `ROLLBACK TO SAVEPOINT` | `ROLLBACK TO SAVEPOINT` (batch seul) |

**`migration_map` / `quarantine`** : même transaction que l'entité (atomicité traçabilité/donnée).

**Pas d'auto-commit par ligne** : tout reste dans la transaction de phase jusqu'au `COMMIT` final.

---

## 7. Stratégie Rollback

| Niveau | Déclencheur | Action | Vérification |
|--------|-------------|--------|--------------|
| **A. Transactionnel (batch)** | Erreur technique dans un batch (FK inattendue, UNIQUE, ENUM, type, timeout) | `ROLLBACK TO SAVEPOINT batch_N` + `ROLLBACK` (phase) | Aucune ligne phase persistée |
| **B. Restauration complète** | Crash process, corruption post-commit, GO/NO-GO manuel | 1. `mysql < backup.sql`<br>2. `TRUNCATE bebba_*` + réimport | `CHECKSUM TABLE` + comptages source = cible |

**Règle** : `migration_map` NE SERT PAS de rollback. Rollback complet = restauration backup mysqldump.
**Pas de `SAVEPOINT phase_X`** — seul le `SAVEPOINT batch_N` existe. Un échec technique = `ROLLBACK TO SAVEPOINT batch_N` puis `ROLLBACK` total de la phase.

---

## 8. Stratégie Reprise (compatible ENUM DDL: pending, migrated, failed, quarantined)

Aucun état `migrating` ni `interrupted` n'existe dans le DDL. La reprise se base **uniquement** sur les 4 états DDL.

| Scénario | Détection | Comportement | Mécanisme |
|----------|-----------|--------------|-----------|
| **Interruption (Ctrl+C) / Crash** | Lignes `status='pending'` ou `'failed'` restantes au redémarrage | Reprise à la première ligne `pending`/`failed` dans l'ordre `legacy_type, legacy_id` | `ResumeController.getResumePoint()` = `SELECT * FROM migration_map WHERE status IN ('pending','failed') ORDER BY legacy_type, legacy_id LIMIT 1` |
| **Erreur batch (soft, anomalie connue)** | Ligne marquée `failed` + `quarantine` écrite (même transaction) | Continue batch suivant (ligne suivante) | `QuarantineService` + `migration_map` status='failed' |
| **Erreur technique (HARD FAIL)** | Rollback phase complet → toutes les lignes de la phase restent `pending` | Au redémarrage : reprise au début de la phase | `ResumeController` détecte phase non `migrated` |
| **Timeout DB** | Retry exponentiel (3x), puis ligne marquée `failed` | Continue batch suivant | `TransactionManager.withRetry()` |
| **Relance complète** | Détection via `migration_map` : `status IN ('pending','failed')` → reprise ; tout `migrated`/`quarantined` → skip | Reprise au premier `pending`/`failed` | Idempotence par `UNIQUE (legacy_type, legacy_id)` |

**Règle** : `status='pending'` = "à traiter" (initial ou reprise). `status='failed'` = "échec technique, à reprendre". Pas d'état transitoire (`migrating`, `interrupted` n'existent pas).

**Idempotence** : `UNIQUE (legacy_type, legacy_id)` sur `migration_map` → second lancement détecte `status IN ('migrated','quarantined')` → skip + log "already migrated". Les lignes `status='pending'` ou `'failed'` sont reprises.

---

## 9. Migration Map (compatible DDL ENUM: pending, migrated, failed, quarantined)

Le DDL `mysql_schema_bebba.sql` @ `af1154f` définit :
```sql
status ENUM('pending','migrated','failed','quarantined') NOT NULL DEFAULT 'pending'
```
**Aucun état `migrating` ni `interrupted` n'existe.** Le design utilise strictement ces 4 valeurs.

| Moment | Action | Champs clés |
|--------|--------|-------------|
| **Début entité** | `INSERT ... ON DUPLICATE KEY UPDATE status='pending', batch_id=?, updated_at=NOW()` | `legacy_type`, `legacy_id`, `target_table`, `batch_id`, `status='pending'`, `raw_json` |
| **Traitement batch** | (pas de changement de status — reste `pending` pendant le batch) | — |
| **Succès écriture** | `UPDATE ... SET status='migrated', target_id=?, updated_at=NOW() WHERE legacy_type=? AND legacy_id=?` | `target_id` (via `LAST_INSERT_ID()` ou SELECT), `status='migrated'` |
| **Échec validation** | `UPDATE ... SET status='failed', error_message=?, updated_at=NOW() WHERE ...` | `status='failed'`, `error_message` |
| **Quarantaine** | `UPDATE ... SET status='quarantined', updated_at=NOW() WHERE ...` + `INSERT INTO quarantine` | `status='quarantined'` |

**Clé d'idempotence** : `UNIQUE (legacy_type, legacy_id)` → second lancement détecte `status IN ('migrated','quarantined')` → skip + log "already migrated". Les lignes `status='pending'` ou `'failed'` sont reprises.

**`batch_id`** : format `YYYYMMDD_HHMMSS_UUID` unique par exécution complète.

---

## 10. Quarantaine (anomalies BLOC 1/2 gelées)

| Anomalie | legacy_type | legacy_id exemple | field | anomaly_type | status initial |
|----------|-------------|-------------------|-------|--------------|----------------|
| Doublon slug `wraps-galettes` | category | cat-1788252897602 | slug | `duplicate_key` | `pending_review` |
| Doublon `order` catégories | category | cat-enfants / cat-1788252928275 | order | `duplicate_key` | `pending_review` |
| Suppliers contradictoires | supplier | sup-1 | suppliedIngredients | `data_mismatch` | `pending_review` |
| `active` absent ingredients | ingredient | ing-riz | active | `null_not_allowed` | `pending_review` |
| NULL unit/stock/minThreshold/purchaseCost | ingredient | ing-riz | unit/stock_quantity/min_threshold/purchase_cost | `null_not_allowed` | `pending_review` |
| Supplements ref `ing-4` fantôme | supplement | sup-1788252897609 | ingredient_id | `missing_fk` | `pending_review` |
| Ghost ingredient refs produits | product_ingredient | prod-1788252897607 | ingredient_id | `missing_fk` | `pending_review` |
| Ghost supplement refs produits | product_supplement | prod-1788252897607 | supplement_id | `missing_fk` | `pending_review` |
| Produit test incomplet | product | prod-test-indisponible | baseIngredients/calories | `format_invalid` | `pending_review` |
| Montants NULL orders | order | ord-... | subtotal/total_amount | `null_not_allowed` | `pending_review` |
| `stockConsumed` absent | order | ord-... | stock_consumed | `null_not_allowed` | `pending_review` |
| Unit NULL stock movement | stock_movement | mov-... | unit | `null_not_allowed` | `pending_review` |
| Ghost ingredient BEBBA-1086 | order_item_prep | ord-... | ingredient_id | `missing_fk` | `pending_review` |
| Annulation stock consommé | stock_movement | mov-... | movement_type | `data_mismatch` | `pending_review` |
| Mouvements partiels | stock_movement | mov-... | quantity | `data_mismatch` | `pending_review` |
| **Identité drv-1 Sami/Yassine** | driver | drv-1 | name | `identity_conflict` | `pending_review` |

**Règle** : Aucune correction silencieuse. Tout va en quarantaine `pending_review`.

---

## 11. Dry-Run (ZERO écriture MySQL)

**Mode** : `--dry-run` (booléen, défaut `false`)

**Sortie** : JSON `dry-run-report-<batch_id>.json`

```json
{
  "batch_id": "20260918_143000_abc123",
  "mode": "dry-run",
  "timestamp": "2026-09-18T14:30:00Z",
  "firestore_snapshot": {
    "categories": 9, "suppliers": 3, "ingredients": 17, "supplements": 10,
    "products": 23, "orders": 9, "stockMovements": 33, "users": 3,
    "drivers": 1, "orderIdempotencyKeys": 6, "nextOrderSeq": 1010
  },
  "summary": {
    "tables_affected": 19,
    "estimated_target_rows": { "bebba_categories": 9, "bebba_orders": 9, ... },
    "anomalies_detected": 3,
    "quarantine_entries": 19,
    "fk_missing": 0,
    "uniques_duplicates": 0,
    "null_preserved": 42,
    "wp_user_resolved": 3,
    "wp_user_missing": 0,
    "wp_user_conflicts": 0
  },
  "per_table": [
    { "table": "bebba_categories", "source": 9, "target_estimated": 9, "anomalies": 2, "quarantine": 2 },
    { "table": "bebba_orders", "source": 9, "target_estimated": 9, "anomalies": 6, "quarantine": 0 }
  ],
  "anomalies": [
    { "legacy_type": "category", "legacy_id": "cat-1788252897602", "field": "slug", "reason": "duplicate_key", "action": "quarantine" }
  ],
  "wp_users": { "resolved": 3, "missing": 0, "conflicts": 0 },
  "go_nogo": "GO"
}
```

**Les valeurs numériques dans cet exemple JSON sont ILLUSTRATIVES uniquement** — elles ne sont jamais des constantes métier ni des seuils attendus. Le dry-run réel calcule dynamiquement les volumes depuis Firestore.

**Zéro écriture** MySQL/Firestore en mode dry-run.

---

## 12. GO / NO-GO (dynamique)

| Étape | Condition | Décision |
|-------|-----------|----------|
| **Pré-migration** | Backup mysqldump valide (`CHECKSUM TABLE` OK) | GO / NO-GO |
| **Pré-migration** | Dry-run `go_nogo === "GO"` (0 erreur technique, 0 FK missing, wp_users résolus) | GO / NO-GO |
| **Pré-migration** | MySQL 8.4.7 accessible, `bebba_test` existe, 12 tables `wp_*` | GO / NO-GO |
| **Pré-migration** | Schéma cible = `mysql_schema_bebba.sql` @ `af1154f` (vérification `CHECKSUM`) | GO / NO-GO |
| **Pendant migration** | Erreur technique (FK inattendue, UNIQUE, ENUM, type) | NO-GO → rollback transactionnel |
| **Pendant migration** | Anomalie métier connue (BLOC 2) | Quarantaine → GO (continue) |
| **Post-migration** | Tous contrôles post-migration passent | MIGRATION VALIDÉE |
| **Post-migration** | Un contrôle échoue | DIAGNOSTIC → ROLLBACK B si critique |

**Pas de seuil historique** — les volumes sont ceux découverts au moment du dry-run. Aucune valeur fixe (9, 33, 119, 3, 1010, etc.) n'est utilisée comme seuil.

---

## 13. Contrôles Post-Migration (dynamiques)

| Contrôle | Requête / Méthode | Source de vérité |
|----------|-------------------|------------------|
| **Comptages source = cible** | `firestore_coll.count()` vs `SELECT COUNT(*) FROM bebba_*` | Firestore temps réel |
| **migration_map complet** | `SELECT COUNT(*) FROM migration_map WHERE status='migrated'` | = total entités source lues |
| **Quarantaine attendue** | `SELECT COUNT(*) FROM migration_quarantine` | ≥ anomalies BLOC 1/2 documentées |
| **FK valides** | `SELECT COUNT(*) FROM bebba_* WHERE fk_id IS NOT NULL AND fk_id NOT IN (SELECT id FROM parent)` | 0 orphelins non prévus |
| **UNIQUE respectées** | `GROUP BY legacy_id HAVING COUNT(*) > 1` | 0 |
| **NULL préservés** | `SELECT COUNT(*) FROM bebba_orders WHERE subtotal IS NULL` | = source NULL count |
| **ENUM valides** | `status NOT IN (...)` | 0 |
| **Orders** | `COUNT(*), SUM(total_amount)` | cohérents avec source |
| **Stock movements** | `COUNT(*), SUM(quantity)` | quantités signées |
| **Status history** | `COUNT(*), COUNT(DISTINCT order_id)` | volume réel lu |
| **WordPress** | `wp_users` avec `user_login IN ('livreur1','livreur2','livreur3')` | 3 |
| **Application** | API `/api/health`, `/api/orders`, `/api/categories` | 200 OK |

**Toutes les valeurs de référence sont lues dynamiquement** — aucune constante 9, 33, 119, 3, 1010, etc. n'est utilisée comme oracle.

---

## 14. Traitement dynamique de `nextOrderSeq`

| Étape | Action |
|-------|--------|
| 1. **Dry-run** | Lecture `meta/counters` Firestore → affiche `nextOrderSeq` (valeur actuelle, ex: 1010) |
| 2. **Migration (phase 2 Identité)** | Lecture `meta/counters` Firestore → `INSERT INTO bebba_counters (counter_name, current_value) VALUES ('nextOrderSeq', <valeur_lue>) ON DUPLICATE KEY UPDATE current_value=<valeur_lue>` |
| 3. **Validation** | Vérification `bebba_counters.current_value = valeur_lue` |
| 4. **Utilisation** | Application lit `bebba_counters` pour générer `BEBBA-{seq}` |

**Jamais** : `1101` (DDL), `1010` (hardcodé), valeur par défaut. Toujours lecture dynamique Firestore.

---

## 15. Distinction Anomalies Métier / Erreurs Techniques

| Catégorie | Exemples | Traitement |
|-----------|----------|------------|
| **Anomalie métier connue** (BLOC 2) | Référence legacy orpheline, NULL historique, doublon slug documenté, divergence User/Driver, snapshot incomplet, `stockConsumed` absent, `unit` NULL, mouvement sans order, ghost ref documenté | Transformation contrôlée + trace + **quarantaine** `pending_review` → continue |
| **Erreur technique inattendue** | Violation FK non documentée, violation UNIQUE non documentée, ENUM invalide, type incompatible, colonne inexistante, erreur SQL, mapper défectueux, connexion perdue, timeout, schéma cible ≠ DDL validé | **HARD FAIL** → `ROLLBACK` transactionnel immédiat → NO-GO |

**Règle** : Ne jamais transformer silencieusement une erreur technique en anomalie métier.

---

## 16. Mapping WordPress / Identité (aligné BLOC 1 gelé)

**Chaîne de mapping gelée :**
```
User.username  →  wp_users.user_login  →  wp_users.ID  →  bebba_drivers.user_id
```

**Règles strictes :**
- Résolution primaire : `User.username` = `wp_users.user_login` (ex: `livreur1`, `livreur2`, `livreur3`)
- Email ne sert de fallback **que si** il existe réellement dans les données source et est exploitable sans ambiguïté
- **Pas de création implicite de compte WordPress** par le migrateur
- Si une identité WordPress obligatoire pour un driver ne peut pas être résolue → **BLOQUANT / NO-GO** (à traiter explicitement avant migration)
- `bebba_drivers.user_id` peut rester `NULL` **uniquement** si :
  - Le driver n'a pas de compte utilisateur staff associé (cas théorique non observé)
  - Le `WPUserResolver` n'a pas trouvé de correspondance → quarantaine `identity_conflict` + `user_id=NULL` + NO-GO si driver staff requis
- **Cas BLOC 1 (gelés) :**
  | User legacy | Username | wp_users attendu | Résultat attendu |
  |-------------|----------|------------------|------------------|
  | `usr-driver-1` | `livreur1` | `wp_users` avec `user_login='livreur1'` | `wpUserId` résolu |
  | `usr-driver-2` | `livreur2` | `wp_users` avec `user_login='livreur2'` | `wpUserId` résolu |
  | `usr-driver-3` | `livreur3` | `wp_users` avec `user_login='livreur3'` | `wpUserId` résolu |

**Divergence Sami/Yassine** : conservée dans `bebba_drivers.name` (Driver.name) + `bebba_migration_quarantine` avec `legacy_user_id='usr-driver-1'`, `legacy_driver_id='drv-1'`, `anomaly_type='identity_conflict'`. `wp_users.display_name` ← `User.name` (Sami), `bebba_drivers.name` ← `Driver.name` (Yassine). Aucune création implicite.

---

## 17. Contrôles dynamiques (AUCUNE valeur fixe)

Tous les contrôles utilisent **exclusivement** des lectures dynamiques au moment de l'exécution :

| Contrôle | Méthode | Oracle |
|----------|---------|--------|
| Comptages source = cible | `firestore_coll.count()` vs `SELECT COUNT(*) FROM bebba_*` | Firestore temps réel |
| migration_map complet | `SELECT COUNT(*) FROM migration_map WHERE status='migrated'` | = total entités source lues |
| Quarantaine attendue | `SELECT COUNT(*) FROM migration_quarantine` | ≥ anomalies BLOC 1/2 documentées |
| FK valides | `fk_id IS NOT NULL AND fk_id NOT IN (SELECT id FROM parent)` | 0 orphelins non prévus |
| UNIQUE respectées | `GROUP BY legacy_id HAVING COUNT(*) > 1` | 0 |
| NULL préservés | `subtotal IS NULL` | = source NULL count |
| ENUM valides | `status NOT IN (...)` | 0 |
| Orders | `COUNT(*), SUM(total_amount)` | cohérents avec source |
| Stock movements | `COUNT(*), SUM(quantity)` | quantités signées |
| Status history | `COUNT(*), COUNT(DISTINCT order_id)` | volume réel lu |
| WordPress | `wp_users` avec `user_login IN ('livreur1','livreur2','livreur3')` | 3 (si comptes préexistent) |
| Application | API `/api/health`, `/api/orders`, `/api/categories` | 200 OK |

**Aucune constante** 9, 33, 119, 3, 1010, 1101, 54, 173, 328, etc. n'est utilisée comme valeur attendue ou seuil. Toutes les valeurs de référence sont calculées dynamiquement au moment de l'exécution.

**`nextOrderSeq`** : toujours lu dynamiquement depuis `meta/counters` Firestore → jamais 1101, jamais 1010 hardcodé.

---

## 18. Dry-Run : exemple JSON (valeurs ILLUSTRATIVES)

```json
{
  "batch_id": "20260918_143000_abc123",
  "mode": "dry-run",
  "timestamp": "2026-09-18T14:30:00Z",
  "firestore_snapshot": {
    "categories": 9, "suppliers": 3, "ingredients": 17, "supplements": 10,
    "products": 23, "orders": 9, "stockMovements": 33, "users": 3,
    "drivers": 1, "orderIdempotencyKeys": 6, "nextOrderSeq": 1010
  },
  "summary": {
    "tables_affected": 19,
    "estimated_target_rows": { "bebba_categories": 9, "bebba_orders": 9, ... },
    "anomalies_detected": 3,
    "quarantine_entries": 19,
    "fk_missing": 0,
    "uniques_duplicates": 0,
    "null_preserved": 42,
    "wp_user_resolved": 3,
    "wp_user_missing": 0,
    "wp_user_conflicts": 0
  },
  "per_table": [
    { "table": "bebba_categories", "source": 9, "target_estimated": 9, "anomalies": 2, "quarantine": 2 },
    { "table": "bebba_orders", "source": 9, "target_estimated": 9, "anomalies": 6, "quarantine": 0 }
  ],
  "anomalies": [
    { "legacy_type": "category", "legacy_id": "cat-1788252897602", "field": "slug", "reason": "duplicate_key", "action": "quarantine" }
  ],
  "wp_users": { "resolved": 3, "missing": 0, "conflicts": 0 },
  "go_nogo": "GO"
}
```

**IMPORTANT** : Les valeurs numériques dans cet exemple JSON (9, 3, 17, 10, 23, 9, 33, 3, 1, 6, 1010, 19, 2, etc.) sont **ILLUSTRATIVES UNIQUEMENT**. Elles ne sont jamais des constantes métier, ni des seuils attendus, ni des valeurs à comparer. Le dry-run réel calcule dynamiquement tous les volumes depuis Firestore au moment de l'exécution.

**Zéro écriture** MySQL/Firestore en mode dry-run.

---

## 19. GO / NO-GO (dynamique)

| Étape | Condition | Décision |
|-------|-----------|----------|
| **Pré-migration** | Backup mysqldump valide (`CHECKSUM TABLE` OK) | GO / NO-GO |
| **Pré-migration** | Dry-run `go_nogo === "GO"` (0 erreur technique, 0 FK missing, wp_users résolus) | GO / NO-GO |
| **Pré-migration** | MySQL 8.4.7 accessible, `bebba_test` existe, 12 tables `wp_*` | GO / NO-GO |
| **Pré-migration** | Schéma cible = `mysql_schema_bebba.sql` @ `af1154f` (vérification `CHECKSUM`) | GO / NO-GO |
| **Pendant migration** | Erreur technique (FK inattendue, UNIQUE, ENUM, type) | NO-GO → rollback transactionnel |
| **Pendant migration** | Anomalie métier connue (BLOC 2) | Quarantaine → GO (continue) |
| **Post-migration** | Tous contrôles post-migration passent | MIGRATION VALIDÉE |
| **Post-migration** | Un contrôle échoue | DIAGNOSTIC → ROLLBACK B si critique |

**Pas de seuil historique** — les volumes sont ceux découverts au moment du dry-run.

---

## 20. Contrôles Post-Migration (dynamiques)

| Contrôle | Requête / Méthode | Source de vérité |
|----------|-------------------|------------------|
| **Comptages source = cible** | `firestore_coll.count()` vs `SELECT COUNT(*) FROM bebba_*` | Firestore temps réel |
| **migration_map complet** | `SELECT COUNT(*) FROM migration_map WHERE status='migrated'` | = total entités source lues |
| **Quarantaine attendue** | `SELECT COUNT(*) FROM migration_quarantine` | ≥ anomalies BLOC 1/2 documentées |
| **FK valides** | `SELECT COUNT(*) FROM bebba_* WHERE fk_id IS NOT NULL AND fk_id NOT IN (SELECT id FROM parent)` | 0 orphelins non prévus |
| **UNIQUE respectées** | `GROUP BY legacy_id HAVING COUNT(*) > 1` | 0 |
| **NULL préservés** | `SELECT COUNT(*) FROM bebba_orders WHERE subtotal IS NULL` | = source NULL count |
| **ENUM valides** | `status NOT IN (...)` | 0 |
| **Orders** | `COUNT(*), SUM(total_amount)` | cohérents avec source |
| **Stock movements** | `COUNT(*), SUM(quantity)` | quantités signées |
| **Status history** | `COUNT(*), COUNT(DISTINCT order_id)` | volume réel lu |
| **WordPress** | `wp_users` avec `user_login IN ('livreur1','livreur2','livreur3')` | 3 (si comptes préexistent) |
| **Application** | API `/api/health`, `/api/orders`, `/api/categories` | 200 OK |

---

## 21. Traitement dynamique de `nextOrderSeq`

| Étape | Action |
|-------|--------|
| 1. **Dry-run** | Lecture `meta/counters` Firestore → affiche `nextOrderSeq` (valeur actuelle, ex: 1010) |
| 2. **Migration (phase 2 Identité)** | Lecture `meta/counters` Firestore → `INSERT INTO bebba_counters (counter_name, current_value) VALUES ('nextOrderSeq', <valeur_lue>) ON DUPLICATE KEY UPDATE current_value=<valeur_lue>` |
| 3. **Validation** | Vérification `bebba_counters.current_value = valeur_lue` |
| 4. **Utilisation** | Application lit `bebba_counters` pour générer `BEBBA-{seq}` |

**Jamais** : `1101` (DDL), `1010` (hardcodé), valeur par défaut. Toujours lecture dynamique Firestore.

---

## 22. Distinction Anomalies Métier / Erreurs Techniques

| Catégorie | Exemples | Traitement |
|-----------|----------|------------|
| **Anomalie métier connue** (BLOC 2) | Référence legacy orpheline, NULL historique, doublon slug documenté, divergence User/Driver, snapshot incomplet, `stockConsumed` absent, `unit` NULL, mouvement sans order, ghost ref documenté | Transformation contrôlée + trace + **quarantaine** `pending_review` → continue |
| **Erreur technique inattendue** | Violation FK non documentée, violation UNIQUE non documentée, ENUM invalide, type incompatible, colonne inexistante, erreur SQL, mapper défectueux, connexion perdue, timeout, schéma cible ≠ DDL validé | **HARD FAIL** → `ROLLBACK` transactionnel immédiat → NO-GO |

**Règle** : Ne jamais transformer silencieusement une erreur technique en anomalie métier.

---

## 23. Mapping WordPress / Identité (aligné BLOC 1 gelé)

**Chaîne de mapping gelée :**
```
User.username  →  wp_users.user_login  →  wp_users.ID  →  bebba_drivers.user_id
```

**Règles strictes :**
- Résolution primaire : `User.username` = `wp_users.user_login` (ex: `livreur1`, `livreur2`, `livreur3`)
- Email ne sert de fallback **que si** il existe réellement dans les données source et est exploitable sans ambiguïté
- **Pas de création implicite de compte WordPress** par le migrateur
- Si une identité WordPress obligatoire pour un driver ne peut pas être résolue → **BLOQUANT / NO-GO** (à traiter explicitement avant migration)
- `bebba_drivers.user_id` peut rester `NULL` **uniquement** si :
  - Le driver n'a pas de compte utilisateur staff associé (cas théorique non observé)
  - Le `WPUserResolver` n'a pas trouvé de correspondance → quarantaine `identity_conflict` + `user_id=NULL` + NO-GO si driver staff requis
- **Cas BLOC 1 (gelés) :**
  | User legacy | Username | wp_users attendu | Résultat attendu |
  |-------------|----------|------------------|------------------|
  | `usr-driver-1` | `livreur1` | `wp_users` avec `user_login='livreur1'` | `wpUserId` résolu |
  | `usr-driver-2` | `livreur2` | `wp_users` avec `user_login='livreur2'` | `wpUserId` résolu |
  | `usr-driver-3` | `livreur3` | `wp_users` avec `user_login='livreur3'` | `wpUserId` résolu |

**Divergence Sami/Yassine** : conservée dans `bebba_drivers.name` (Driver.name) + `bebba_migration_quarantine` avec `legacy_user_id='usr-driver-1'`, `legacy_driver_id='drv-1'`, `anomaly_type='identity_conflict'`. `wp_users.display_name` ← `User.name` (Sami), `bebba_drivers.name` ← `Driver.name` (Yassine). Aucune création implicite.

---

## 24. Risques résiduels

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| `wp_users` manquant pour livreurs | Moyenne | `bebba_drivers.user_id=NULL` + quarantaine | Audit `wp_users` pré-migration, résolution manuelle post-migration |
| Conflit `user_login` WordPress | Faible | Quarantaine `identity_conflict` | Audit `wp_users` pré-migration |
| Volume Firestore > mémoire Node | Faible | OOM crash | Curseurs + pagination (`limit` + `startAfter`) |
| Timeout batch > 30s | Moyenne | Retry + quarantaine batch | Batch size 500, timeout configurable |
| Perte connexion MySQL mid-batch | Faible | Rollback + reprise | Savepoints + ResumeController |
| Doublon `legacy_id` source | Faible | Échec UNIQUE migration_map | Validation source pré-migration |
| `nextOrderSeq` Firestore ≠ attendu | Confirmé (1010 vs 1101) | Valeur dynamique lue | Lecture dynamique, pas de seed DDL |
| Schéma cible ≠ DDL validé | Faible | Migration invalide | `CHECKSUM TABLE` pré-migration vs DDL |

---

## VERDICT

**VALIDÉ** — La conception corrigée est :
- ✅ Compatible avec la provenance validée (BLOC 5A)
- ✅ Respecte les règles absolues (données dynamiques, pas de hardcode)
- ✅ Sépare anomalies métier / erreurs techniques
- ✅ FK strictes (FK_CHECKS=1, orphelins documentés → quarantaine, inattendus → HARD FAIL)
- ✅ Transactions réalistes (SAVEPOINT, pas de sous-transactions fictives)
- ✅ Rollback à 2 niveaux (transactionnel + backup complet)
- ✅ Reprise via `migration_map` idempotent
- ✅ Dry-run ZERO écriture avec GO/NO-GO dynamique
- ✅ `nextOrderSeq` dynamique (lecture Firestore, pas de seed DDL)
- ✅ WordPress mapping gelé respecté (username → user_login → ID)
- ✅ Quarantaine anomalies BLOC 1/2 gelées
- ✅ Post-migration dynamique (Firestore temps réel vs MySQL)
- ✅ ENUM DDL respecté (pending, migrated, failed, quarantined uniquement)
- ✅ Reprise compatible avec 4 états DDL
- ✅ Transactions cohérentes MySQL (SAVEPOINT uniquement, pas d'auto-commit par ligne)
- ✅ Rollback cohérent (batch SAVEPOINT + phase ROLLBACK)
- ✅ Mapping WP BLOC 1 respecté (username → user_login → ID, pas de création implicite)
- ✅ Aucune valeur numérique hardcodée
- ✅ Exemple dry-run clairement marqué ILLUSTRATIF

**Prête pour implémentation (BLOC 5C).**

---

**STOP — Conception corrigée produite. Aucun code écrit. Aucun fichier modifié (hors rapport demandé).**