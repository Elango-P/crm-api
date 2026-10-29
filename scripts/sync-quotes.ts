import { initFirebase, getFirestoreDb, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';
import { quotesSyncService } from '../src/services/quotes-sync.service.js';
import { zohoTokenManager } from '../src/modules/zoho/zohoTokenManager.js';
import { syncRepository } from '../src/modules/sync/syncRepository.js';
import { config } from '../src/config/index.js';

async function main() {
  console.log('====================================================');
  console.log('🔄 Zoho ERP Quote Synchronization Tool');
  console.log('====================================================');

  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f') || args.includes('--reset');

  // 1. Initialize Firebase
  console.log('📡 Connecting to Firebase Firestore...');
  initFirebase();
  const isReal = isRealFirebaseConfigured();
  console.log(`   Firestore status: ${isReal ? '✅ Connected to Live Cloud Firestore' : '⚠️ Fallback Mock Memory'}`);

  // 2. Check Zoho Connection
  const isZohoConfigured = zohoTokenManager.isConfigured();
  console.log(`   Zoho Product:    ${config.ZOHO_PRODUCT}`);
  console.log(`   Zoho API Base:   ${config.ZOHO_API_BASE_URL}`);
  console.log(`   Zoho Org ID:     ${config.ZOHO_ORGANIZATION_ID || 'Not set'}`);
  console.log(`   Zoho OAuth:      ${isZohoConfigured ? '✅ Live Zoho OAuth Active' : '⚠️ Unconfigured / Mock Mode (ZOHO_REFRESH_TOKEN is test or placeholder)'}`);

  const db = getFirestoreDb();
  if (db && isReal) {
    const quotesSnap = await db.collection('quotes').get();
    console.log(`\n📋 Found ${quotesSnap.size} quote(s) in Firestore 'quotes' collection:`);
    quotesSnap.forEach((doc) => {
      const q = doc.data();
      console.log(`   - [${doc.id}] ${q.quoteNumber || doc.id} | ${q.customerName || 'No Name'} | ₹${q.totalAmount || 0} | Status: ${q.status}`);
    });

    if (force) {
      console.log('\n🧹 Option --force provided: Clearing stale mock quote sync mappings and resetting checkpoint...');
      for (const doc of quotesSnap.docs) {
        await db.collection('_sync_mappings').doc(`quote_${doc.id}`).delete();
        await db.collection('zoho_sync_map').doc(`quote_${doc.id}`).delete();
      }
      await syncRepository.resetCheckpoint('quote');
      console.log('   ✅ Stale quote mappings and watermark reset successfully.');
    }
  }

  // 3. Run quotes synchronization
  console.log('\n🚀 Starting synchronization to Zoho ERP...');
  const result = await quotesSyncService.syncQuotes(50);

  console.log('\n====================================================');
  console.log('📊 Synchronization Summary:');
  console.log('====================================================');
  console.log(`   Total Processed: ${result.processed}`);
  console.log(`   Created in Zoho: ${result.created}`);
  console.log(`   Updated in Zoho: ${result.updated}`);
  console.log(`   Skipped:         ${result.skipped}`);
  console.log(`   Failed:          ${result.failed}`);
  console.log(`   Duration:        ${result.durationMs}ms`);

  if (result.errors && result.errors.length > 0) {
    console.log('\n⚠️ Errors encountered:');
    result.errors.forEach((e) => console.log(`   - [${e.id}]: ${e.message}`));
  }

  // 4. Print updated mappings
  if (db && isReal) {
    console.log('\n📌 Current Zoho Mappings in Firestore:');
    const quotesSnap = await db.collection('quotes').get();
    for (const doc of quotesSnap.docs) {
      const mapping = await syncRepository.getMapping('quote', doc.id);
      const isMock = mapping?.zohoId?.startsWith('mock_');
      const statusIcon = mapping?.syncStatus === 'SYNCED' ? (isMock ? '🟡 (MOCK ID)' : '🟢 (LIVE ZOHO ID)') : '🔴 (FAILED)';
      console.log(`   - ${doc.id} -> Zoho Estimate ID: ${mapping?.zohoId || 'None'} ${statusIcon} [Status: ${mapping?.syncStatus || 'PENDING'}]`);
    }
  }

  if (!isZohoConfigured) {
    console.log('\n💡 Notice:');
    console.log('   Your quotes were processed in Mock Simulation mode because a valid live ZOHO_REFRESH_TOKEN is not yet set in .env.');
    console.log('   To sync directly to your real Zoho ERP account:');
    console.log('   1. Obtain a grant code from Zoho API Console: https://api-console.zoho.in/');
    console.log('   2. Run: npm.cmd run zoho:token <YOUR_AUTH_CODE>');
    console.log('   3. Run: npm.cmd run sync:quotes -- --force');
  } else {
    console.log('\n🎉 Quotes synchronization completed successfully!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });

