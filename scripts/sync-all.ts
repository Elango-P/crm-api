import { initFirebase, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';
import { quotesSyncService } from '../src/services/quotes-sync.service.js';
import { ordersSyncService } from '../src/services/orders-sync.service.js';
import { usersSyncService } from '../src/services/users-sync.service.js';
import { bomSyncService } from '../src/services/bom-sync.service.js';
import { zohoTokenManager } from '../src/modules/zoho/zohoTokenManager.js';
import { config } from '../src/config/index.js';

async function main() {
  console.log('====================================================');
  console.log('🚀 Zoho ERP Full Synchronization CLI');
  console.log('====================================================');

  initFirebase();
  console.log(`📡 Firestore: ${isRealFirebaseConfigured() ? '✅ Live Cloud Firestore' : '⚠️ Fallback'}`);
  console.log(`🏢 Zoho Org:  ${config.ZOHO_ORGANIZATION_ID} (${config.ZOHO_PRODUCT})`);
  console.log(`🔑 OAuth:     ${zohoTokenManager.isConfigured() ? '✅ Active' : '❌ Inactive'}`);

  console.log('\n--- 1. Syncing Customers / Contacts ---');
  try {
    const custRes = await usersSyncService.syncUsers(50);
    console.log(`   Processed: ${custRes.processed} | Created: ${custRes.created} | Updated: ${custRes.updated} | Failed: ${custRes.failed}`);
  } catch (e: any) {
    console.warn(`   ⚠️ Customer sync note: ${e.message}`);
  }

  console.log('\n--- 2. Syncing Quotes / Estimates ---');
  try {
    const quoteRes = await quotesSyncService.syncQuotes(50);
    console.log(`   Processed: ${quoteRes.processed} | Created: ${quoteRes.created} | Updated: ${quoteRes.updated} | Failed: ${quoteRes.failed}`);
  } catch (e: any) {
    console.error(`   ❌ Quote sync error: ${e.message}`);
  }

  console.log('\n--- 3. Syncing Sales Orders ---');
  try {
    const orderRes = await ordersSyncService.syncOrders(50);
    console.log(`   Processed: ${orderRes.processed} | Created: ${orderRes.created} | Updated: ${orderRes.updated} | Failed: ${orderRes.failed}`);
  } catch (e: any) {
    console.error(`   ❌ Sales Order sync error: ${e.message}`);
  }

  console.log('\n--- 4. Syncing Bills of Materials (BOM) ---');
  try {
    const bomRes = await bomSyncService.syncBom(50);
    console.log(`   Processed: ${bomRes.processed} | Created: ${bomRes.created} | Updated: ${bomRes.updated} | Failed: ${bomRes.failed}`);
  } catch (e: any) {
    console.warn(`   ℹ️ BOM sync note: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log('🎉 Full ERP Synchronization Completed!');
  console.log('====================================================');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal sync failure:', err);
    process.exit(1);
  });

