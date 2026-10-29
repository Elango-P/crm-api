import { initFirebase, getFirestoreDb, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';

async function removeCollections() {
  console.log('📡 Connecting to Firebase Firestore...');
  initFirebase();
  const isReal = isRealFirebaseConfigured();
  console.log(`Connected status: ${isReal ? 'Live Cloud Firestore' : 'Fallback Mock'}`);

  const db = getFirestoreDb();
  if (!db) {
    console.error('❌ Could not obtain Firestore DB instance.');
    process.exit(1);
  }

  const collectionsToDelete = ['customers', 'invoices', 'vendors', 'invoice'];

  for (const colName of collectionsToDelete) {
    try {
      const snap = await db.collection(colName).get();
      if (snap.empty) {
        console.log(`ℹ️ Collection '${colName}' is empty or does not exist.`);
        continue;
      }

      console.log(`🗑️ Deleting ${snap.size} documents from '${colName}'...`);
      const batch = db.batch();
      snap.forEach((doc) => {
        console.log(`   - Deleting [${doc.id}]`);
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`✅ Successfully cleared '${colName}'.`);
    } catch (err: any) {
      console.error(`❌ Failed to delete from '${colName}':`, err.message);
    }
  }

  // Also clean up sync mappings for customer, vendor, and invoice if any
  try {
    const syncMappingsSnap = await db.collection('_sync_mappings').get();
    const mappingsToDelete = syncMappingsSnap.docs.filter((doc) => {
      const data = doc.data();
      return (
        data.entityType === 'customer' ||
        data.entityType === 'vendor' ||
        data.entityType === 'invoice' ||
        doc.id.startsWith('customer_') ||
        doc.id.startsWith('vendor_') ||
        doc.id.startsWith('invoice_')
      );
    });

    if (mappingsToDelete.length > 0) {
      console.log(`🗑️ Deleting ${mappingsToDelete.length} sync mapping documents related to removed entities...`);
      const batch = db.batch();
      mappingsToDelete.forEach((doc) => {
        console.log(`   - Deleting mapping [${doc.id}]`);
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Successfully cleaned up related _sync_mappings.`);
    }
  } catch (err: any) {
    console.warn(`⚠️ Could not clean up _sync_mappings:`, err.message);
  }

  console.log('\n✨ Removal operation complete.');
}

removeCollections()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error during deletion:', err);
    process.exit(1);
  });

