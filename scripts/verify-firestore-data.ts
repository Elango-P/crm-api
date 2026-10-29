import { initFirebase, getFirestoreDb, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';

async function verify() {
  console.log('📡 Connecting to Firebase...');
  initFirebase();
  const isReal = isRealFirebaseConfigured();
  console.log(`Connected status: ${isReal ? 'Live Cloud Firestore' : 'Fallback Mock'}`);

  const db = getFirestoreDb();
  if (!db) {
    console.error('❌ Could not obtain Firestore DB instance.');
    process.exit(1);
  }

  const collections = [
    { name: 'vendors', label: 'VENDORS' },
    { name: 'customers', label: 'CUSTOMERS' },
    { name: 'quotes', label: 'QUOTES' },
    { name: 'sales_orders', label: 'SALES ORDERS' },
    { name: 'invoices', label: 'INVOICES' },
    { name: 'rfqs', label: 'RFQS' }
  ];

  for (const col of collections) {
    try {
      const snap = await db.collection(col.name).get();
      console.log(`\n========================================`);
      console.log(`📂 FIRESTORE '${col.name}' COLLECTION (${snap.size} document${snap.size === 1 ? '' : 's'})`);
      console.log(`========================================`);
      snap.forEach((doc) => {
        const data = doc.data();
        const summary = col.name === 'vendors'
          ? `${data.name} | Category: ${data.category} | ${data.email}`
          : col.name === 'customers'
          ? `${data.name} | Contact: ${data.contact} | ${data.email}`
          : col.name === 'quotes'
          ? `Quote: ${data.quoteNumber} | Customer: ${data.customerName} | Total: ₹${data.totalAmount} | Status: ${data.status}`
          : col.name === 'sales_orders'
          ? `SO: ${data.salesOrderNumber} | Customer: ${data.customerName} | Total: ₹${data.totalAmount} | Status: ${data.status}`
          : col.name === 'invoices'
          ? `Invoice: ${data.invoiceNumber} | Customer: ${data.customerName} | Total: ₹${data.totalAmount} | Paid: ₹${data.paidAmount || 0} | Due: ₹${data.balanceDue} | Status: ${data.paymentStatus}`
          : `RFQ: ${data.rfqNumber} | ${data.productName} | Status: ${data.status} | Value: ₹${data.totalValue}`;
        console.log(`[ID: ${doc.id}] ${summary}`);
      });
    } catch (err: any) {
      console.warn(`⚠️ Could not query collection '${col.name}':`, err.message);
    }
  }

  console.log('\n✅ Firestore verification complete.');
  process.exit(0);
}

verify().catch((err) => {
  console.error('❌ Error fetching from Firestore:', err);
  process.exit(1);
});
