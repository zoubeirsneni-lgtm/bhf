import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch
} from 'firebase/firestore';

// Read Firebase config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('ERREUR: firebase-applet-config.json introuvable.');
  process.exit(1);
}
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export function normalizePhoneNumber(phoneRaw: string): string | null {
  if (!phoneRaw || typeof phoneRaw !== 'string') return null;
  const digits = phoneRaw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.slice(-8);
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

async function commitInBatches(docsToSet: Array<{ ref: any; data: any }>) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < docsToSet.length; i += BATCH_SIZE) {
    const chunk = docsToSet.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batch.set(item.ref, item.data);
    }
    await batch.commit();
  }
}

async function runMigration() {
  console.log('=== DÉBUT DE LA MIGRATION VERS FIRESTORE (V2.2.5) ===');

  if (!fs.existsSync(DB_FILE)) {
    throw new Error(`Fichier source data/db.json introuvable à ${DB_FILE}`);
  }

  const rawData = fs.readFileSync(DB_FILE, 'utf8');
  const sourceData = JSON.parse(rawData);

  // 1. Verrouillage du système: état IN_PROGRESS
  console.log('1. Mise à jour de /meta/system -> IN_PROGRESS');
  await setDoc(doc(db, 'meta', 'system'), {
    state: 'IN_PROGRESS',
    startedAt: new Date().toISOString(),
    version: 'V2.2.5'
  });

  try {
    const docsToSet: Array<{ ref: any; data: any }> = [];

    // 2. Collections historiques
    const collectionsToMigrate = [
      'categories',
      'products',
      'supplements',
      'ingredients',
      'suppliers',
      'drivers',
      'orders',
      'stockMovements',
      'users'
    ] as const;

    for (const colName of collectionsToMigrate) {
      const items = (sourceData[colName] || []) as Array<{ id: string; [key: string]: any }>;
      console.log(`Préparation de ${colName} (${items.length} éléments)...`);
      for (const item of items) {
        if (!item.id) {
          throw new Error(`Élément sans id dans la collection ${colName}: ${JSON.stringify(item)}`);
        }
        docsToSet.push({
          ref: doc(db, colName, item.id),
          data: item
        });
      }
    }

    // 3. Construction de l'index clientPhoneIndex avec détection stricte des collisions
    console.log('Préparation de clientPhoneIndex pour les clients...');
    const users = (sourceData.users || []) as Array<{ id: string; role: string; phone?: string; name?: string; createdAt?: string }>;
    const phoneMap = new Map<string, string>(); // normPhone -> userId (anti-collision)
    let clientPhoneCount = 0;

    for (const u of users) {
      if (u.role === 'client' && u.phone) {
        const normPhone = normalizePhoneNumber(u.phone);
        if (normPhone) {
          if (phoneMap.has(normPhone) && phoneMap.get(normPhone) !== u.id) {
            throw new Error(`Collision bloquante détectée dans clientPhoneIndex : le numéro normalisé ${normPhone} est partagé par ${u.id} et ${phoneMap.get(normPhone)}`);
          }
          phoneMap.set(normPhone, u.id);
          docsToSet.push({
            ref: doc(db, 'clientPhoneIndex', normPhone),
            data: {
              userId: u.id,
              phone: u.phone,
              normalizedPhone: normPhone,
              name: u.name || '',
              createdAt: u.createdAt || new Date().toISOString()
            }
          });
          clientPhoneCount++;
        }
      }
    }
    console.log(`${clientPhoneCount} entrées préparées pour clientPhoneIndex sans collision.`);

    // 4. Initialisation du compteur /meta/counters avec nextOrderSeq = 1101
    const nextOrderSeq = sourceData.nextOrderSeq || 1101;
    if (nextOrderSeq !== 1101) {
      throw new Error(`Anomalie critique : nextOrderSeq source est ${nextOrderSeq}, impérativement attendu 1101`);
    }
    docsToSet.push({
      ref: doc(db, 'meta', 'counters'),
      data: {
        nextOrderSeq: nextOrderSeq,
        updatedAt: new Date().toISOString()
      }
    });

    // 5. Exécution des écritures par lots
    console.log(`Écriture de ${docsToSet.length} documents au total dans Firestore...`);
    await commitInBatches(docsToSet);
    console.log('Toutes les écritures batch ont été validées avec succès.');

    // 6. PHASE DE RÉCONCILIATION COMPLÈTE
    console.log('\n--- DÉBUT DE LA RÉCONCILIATION ---');
    const reconciliationStats: Record<string, any> = {};

    for (const colName of collectionsToMigrate) {
      const sourceItems = sourceData[colName] || [];
      const snapshot = await getDocs(collection(db, colName));
      const firestoreItemsMap = new Map<string, any>();
      snapshot.forEach(d => firestoreItemsMap.set(d.id, d.data()));

      // 6.1 Vérification des counts
      if (snapshot.size !== sourceItems.length) {
        throw new Error(
          `Échec réconciliation count pour ${colName}: Source = ${sourceItems.length}, Firestore = ${snapshot.size}`
        );
      }

      // 6.2 Vérification de chaque ID & champs critiques
      for (const src of sourceItems) {
        const fsDoc = firestoreItemsMap.get(src.id);
        if (!fsDoc) {
          throw new Error(`Échec réconciliation ID manquant dans ${colName}: id=${src.id}`);
        }

        // Vérification de champs critiques spécifiques
        if (colName === 'categories' && fsDoc.name !== src.name) {
          throw new Error(`Mismatch catégorie ${src.id}: nom source="${src.name}", fs="${fsDoc.name}"`);
        }
        if (colName === 'products' && (fsDoc.name !== src.name || fsDoc.basePrice !== src.basePrice)) {
          throw new Error(`Mismatch produit ${src.id}: basePrice ou nom divergent`);
        }
        if (colName === 'ingredients' && fsDoc.currentStock !== src.currentStock) {
          throw new Error(`Mismatch ingrédient ${src.id}: stock divergent (${src.currentStock} vs ${fsDoc.currentStock})`);
        }
        if (colName === 'orders' && (fsDoc.orderNumber !== src.orderNumber || fsDoc.totalAmount !== src.totalAmount)) {
          throw new Error(`Mismatch commande ${src.id}: orderNumber ou total divergent`);
        }
        if (colName === 'users' && (fsDoc.role !== src.role || fsDoc.passwordHash !== src.passwordHash)) {
          throw new Error(`Mismatch utilisateur ${src.id}: rôle ou hash divergent`);
        }
      }

      // 6.3 Absence d'invention (aucun document imprévu)
      const sourceIds = new Set(sourceItems.map((i: any) => i.id));
      for (const fsId of firestoreItemsMap.keys()) {
        if (!sourceIds.has(fsId)) {
          throw new Error(`Invention détectée dans ${colName}: ID Firestore imprévu ${fsId}`);
        }
      }

      reconciliationStats[colName] = {
        count: snapshot.size,
        verified: true
      };
      console.log(`✓ Collection ${colName}: ${snapshot.size} documents réconciliés sans perte ni invention.`);
    }

    // 6.4 Réconciliation bidirectionnelle stricte de clientPhoneIndex (Section 11)
    const phoneSnap = await getDocs(collection(db, 'clientPhoneIndex'));
    const phoneIndexDocs = new Map<string, any>();
    phoneSnap.forEach(d => phoneIndexDocs.set(d.id, d.data()));

    // Vérifier que chaque client source possède son index exact
    const clientUsers = (sourceData.users || []).filter((u: any) => u.role === 'client' && u.phone);
    for (const c of clientUsers) {
      const norm = normalizePhoneNumber(c.phone);
      if (norm) {
        const entry = phoneIndexDocs.get(norm);
        if (!entry) {
          throw new Error(`Échec réconciliation clientPhoneIndex : entrée manquante pour ${c.phone} (client ${c.id})`);
        }
        if (entry.userId !== c.id) {
          throw new Error(`Échec réconciliation clientPhoneIndex : mismatch userId pour ${norm} (attendu ${c.id}, obtenu ${entry.userId})`);
        }
      }
    }
    // Vérifier l'absence d'orphelins dans clientPhoneIndex
    const validClientIds = new Set(clientUsers.map((u: any) => u.id));
    for (const [normPhone, entry] of phoneIndexDocs.entries()) {
      if (!validClientIds.has(entry.userId)) {
        throw new Error(`Index orphelin détecté dans clientPhoneIndex: ${normPhone} -> ${entry.userId}`);
      }
    }
    console.log(`✓ Index clientPhoneIndex: ${phoneSnap.size} entrées réconciliées sans orphelin ni divergence.`);

    // 6.5 Vérification bloquante que orderIdempotencyKeys est initialement vide (Section 12)
    const idemSnap = await getDocs(collection(db, 'orderIdempotencyKeys'));
    if (idemSnap.size !== 0) {
      throw new Error(`Anomalie bloquante de migration : orderIdempotencyKeys doit être impérativement vide lors de la migration initiale (0 clés), trouvé ${idemSnap.size}`);
    }
    console.log('✓ orderIdempotencyKeys initialement vide (0 clés).');

    // 6.6 Vérification du compteur nextOrderSeq (Section 13)
    const countersDoc = await getDoc(doc(db, 'meta', 'counters'));
    if (!countersDoc.exists() || countersDoc.data()?.nextOrderSeq !== 1101) {
      throw new Error(`Échec réconciliation /meta/counters: nextOrderSeq attendu 1101, obtenu ${countersDoc.data()?.nextOrderSeq}`);
    }
    console.log('✓ /meta/counters.nextOrderSeq === 1101 validé avec succès.');

    // 7. Mise à jour de /meta/system -> READY UNIQUEMENT après succès complet
    console.log('\n7. Mise à jour de /meta/system -> READY');
    await setDoc(doc(db, 'meta', 'system'), {
      state: 'READY',
      migratedAt: new Date().toISOString(),
      version: 'V2.2.5',
      stats: reconciliationStats
    });

    console.log('=== MIGRATION ET RÉCONCILIATION FIRESTORE TERMINÉES AVEC SUCCÈS ===');
    process.exit(0);
  } catch (err: any) {
    console.error('!!! ÉCHEC CRITIQUE DE LA MIGRATION !!!', err.message);
    try {
      await setDoc(doc(db, 'meta', 'system'), {
        state: 'FAILED',
        error: err.message,
        failedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Impossible d'enregistrer l'état FAILED:", e);
    }
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('Erreur inattendue:', err);
  process.exit(1);
});
