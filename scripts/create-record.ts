import { initFirebase, isRealFirebaseConfigured, getFirestoreDb } from '../src/modules/firebase/firebaseClient.js';
import { crmRepository } from '../src/modules/firebase/crmRepository.js';
import {
  CustomerRecord,
  RfqRecord,
  VendorRecord,
  QuoteRecord,
  SalesOrderRecord,
  InvoiceRecord
} from '../src/types/crm.js';

/**
 * CLI script to create records directly in Firestore store
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
📝 Firebase Store Record Creator CLI
====================================
Create Records directly in your Firebase Firestore store.

Usage:
  # Create a Customer record:
  npm.cmd run record:create -- --customer --name "Apex Technologies" --email "sales@apex.com" --phone "+91 9876543210"

  # Create a Vendor record:
  npm.cmd run record:create -- --vendor --name "Precision Alloys" --category "Raw Materials" --email "vendor@alloys.com"

  # Create an RFQ record:
  npm.cmd run record:create -- --rfq --rfqNumber "RFQ-2026-900" --customer "Apex Technologies" --product "CNC Machined Enclosure" --qty 100 --price 1500

  # Create a Quote record:
  npm.cmd run record:create -- --quote --quoteNumber "QUO-2026-900" --customer "Apex Technologies" --amount 150000

  # Create a Sales Order record:
  npm.cmd run record:create -- --sales-order --soNumber "SO-2026-900" --customer "Apex Technologies" --amount 150000

  # Create an Invoice record:
  npm.cmd run record:create -- --invoice --invoiceNumber "INV-2026-900" --customer "Apex Technologies" --amount 150000

  # Seed all rich sample data:
  npm.cmd run data:seed
`);
    return;
  }

  // Initialize Firebase client
  initFirebase();
  const isReal = isRealFirebaseConfigured();
  const db = getFirestoreDb();

  console.log(`\n🔌 Firebase Store Connection: ${isReal ? 'Live Cloud Firestore' : 'Active Local/Mock Firestore Repository'}`);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return undefined;
  }

  const nowIso = new Date().toISOString();

  const isVendor = args.includes('--vendor') || args.includes('-v');
  const isQuote = args.includes('--quote');
  const isSalesOrder = args.includes('--sales-order') || args.includes('--so');
  const isInvoice = args.includes('--invoice') || args.includes('-i');
  const isRfq = args.includes('--rfq') || args.includes('-r');
  const isCustomer = args.includes('--customer') || args.includes('-c');

  if (isVendor) {
    const name = getArg('--name') || getArg('-n') || 'Industrial Components Co';
    const company = getArg('--company') || name;
    const category = getArg('--category') || 'General Supplier';
    const email = getArg('--email') || getArg('-e') || 'sales@vendor.com';
    const phone = getArg('--phone') || getArg('-p') || '+91 98000 11111';
    const vendorId = getArg('--id') || `v-${Date.now().toString().slice(-4)}`;

    const vendor: VendorRecord = {
      id: vendorId,
      name,
      company,
      contact: getArg('--contact') || name,
      email,
      phone,
      category,
      paymentTerms: getArg('--terms') || 'Net 30',
      status: 'Active',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isReal && db) {
      await db.collection('vendors').doc(vendor.id).set(vendor, { merge: true });
    }
    await crmRepository.upsertVendor(vendor);
    console.log(`✅ Successfully created Vendor: ${vendor.id} (${vendor.name})`);
    console.log(JSON.stringify(vendor, null, 2));
  } else if (isQuote) {
    const quoteNumber = getArg('--quoteNumber') || `QUO-2026-${Date.now().toString().slice(-4)}`;
    const customerName = getArg('--customer') || 'Apex Robotics Ltd';
    const customerId = getArg('--customerId') || 'c-101';
    const amount = Number(getArg('--amount') || 100000);
    const taxAmount = Math.round(amount * 0.18 * 100) / 100;
    const totalAmount = amount + taxAmount;

    const quote: QuoteRecord = {
      id: quoteNumber.toLowerCase(),
      quoteNumber,
      customerId,
      customerName,
      issueDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'Sent',
      lineItems: [
        { sku: `${quoteNumber}-ITEM-1`, description: 'Custom Engineered Assembly', qty: 10, unitPrice: amount / 10, total: amount }
      ],
      subtotal: amount,
      taxRate: 18,
      taxAmount,
      totalAmount,
      currency: 'INR',
      paymentTerms: 'Net 30',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isReal && db) {
      await db.collection('quotes').doc(quote.id).set(quote, { merge: true });
    }
    await crmRepository.upsertQuote(quote);
    console.log(`✅ Successfully created Quote: ${quote.quoteNumber} (${quote.customerName})`);
    console.log(JSON.stringify(quote, null, 2));
  } else if (isSalesOrder) {
    const soNumber = getArg('--soNumber') || `SO-2026-${Date.now().toString().slice(-4)}`;
    const customerName = getArg('--customer') || 'Apex Robotics Ltd';
    const customerId = getArg('--customerId') || 'c-101';
    const amount = Number(getArg('--amount') || 150000);
    const taxAmount = Math.round(amount * 0.18 * 100) / 100;
    const totalAmount = amount + taxAmount;

    const salesOrder: SalesOrderRecord = {
      id: soNumber.toLowerCase(),
      salesOrderNumber: soNumber,
      customerId,
      customerName,
      orderDate: new Date().toISOString().split('T')[0],
      expectedShipmentDate: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
      status: 'Confirmed',
      lineItems: [
        { sku: `${soNumber}-ITEM-1`, description: 'Industrial Automation Unit', qty: 5, unitPrice: amount / 5, total: amount }
      ],
      subtotal: amount,
      taxRate: 18,
      taxAmount,
      shippingCharges: 2000,
      totalAmount: totalAmount + 2000,
      currency: 'INR',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isReal && db) {
      await db.collection('sales_orders').doc(salesOrder.id).set(salesOrder, { merge: true });
    }
    await crmRepository.upsertSalesOrder(salesOrder);
    console.log(`✅ Successfully created Sales Order: ${salesOrder.salesOrderNumber} (${salesOrder.customerName})`);
    console.log(JSON.stringify(salesOrder, null, 2));
  } else if (isInvoice) {
    const invoiceNumber = getArg('--invoiceNumber') || `INV-2026-${Date.now().toString().slice(-4)}`;
    const customerName = getArg('--customer') || 'Apex Robotics Ltd';
    const customerId = getArg('--customerId') || 'c-101';
    const amount = Number(getArg('--amount') || 100000);
    const taxAmount = Math.round(amount * 0.18 * 100) / 100;
    const totalAmount = amount + taxAmount;

    const invoice: InvoiceRecord = {
      id: invoiceNumber.toLowerCase(),
      invoiceNumber,
      customerId,
      customerName,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      paymentStatus: 'Unpaid',
      paymentTerms: 'Net 30',
      lineItems: [
        { sku: `${invoiceNumber}-LINE-1`, description: 'Finished Goods Assembly', qty: 10, unitPrice: amount / 10, total: amount }
      ],
      subtotal: amount,
      taxRate: 18,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      balanceDue: totalAmount,
      currency: 'INR',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isReal && db) {
      await db.collection('invoices').doc(invoice.id).set(invoice, { merge: true });
    }
    await crmRepository.upsertInvoice(invoice);
    console.log(`✅ Successfully created Invoice: ${invoice.invoiceNumber} (${invoice.customerName})`);
    console.log(JSON.stringify(invoice, null, 2));
  } else if (isRfq) {
    const rfqNumber = getArg('--rfqNumber') || getArg('--rfq') || `RFQ-2026-${Date.now().toString().slice(-4)}`;
    const customerName = getArg('--customer') || getArg('--customerName') || 'Sample Customer Ltd';
    const customerId = getArg('--customerId') || `c-${rfqNumber.toLowerCase()}`;
    const productName = getArg('--product') || getArg('-p') || 'Precision Industrial Component';
    const qty = Number(getArg('--qty') || getArg('-q') || 50);
    const price = Number(getArg('--price') || 2500);
    const sku = getArg('--sku') || `${rfqNumber}-SKU-1`;
    const status = (getArg('--status') as any) || 'Approved';
    const stage = (getArg('--stage') as any) || (status === 'Sales Order' ? 'Sales Order' : 'Plant Head approval');
    const totalValue = qty * price;

    const rfq: RfqRecord = {
      id: rfqNumber.toLowerCase(),
      rfqNumber,
      customerId,
      customerName,
      productName,
      partNumber: sku,
      quantity: qty,
      targetDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status,
      stage,
      assignee: 'Operations',
      department: 'Operations',
      currentRole: 'Operations',
      totalValue,
      notes: ['Created via Firebase Store Record Creator CLI'],
      productLines: [
        {
          sku,
          description: productName,
          qty,
          unitPrice: price,
          total: totalValue
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
      lastUpdated: nowIso
    };

    if (isReal && db) {
      await db.collection('rfqs').doc(rfq.id).set(rfq, { merge: true });
    }
    await crmRepository.upsertRfq(rfq);
    console.log(`✅ Successfully created RFQ: ${rfq.rfqNumber} (${rfq.productName})`);
    console.log(JSON.stringify(rfq, null, 2));
  } else if (isCustomer) {
    const name = getArg('--name') || getArg('-n') || 'Sample Customer Ltd';
    const email = getArg('--email') || getArg('-e') || 'contact@sample.com';
    const phone = getArg('--phone') || getArg('-p') || '+91 98765 00000';
    const contact = getArg('--contact') || name;
    const company = getArg('--company') || name;
    const customerId = getArg('--id') || `c-${Date.now()}`;

    const customer: CustomerRecord = {
      id: customerId,
      name,
      contact,
      email,
      phone,
      company,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    if (isReal && db) {
      await db.collection('customers').doc(customer.id).set(customer, { merge: true });
    }
    await crmRepository.upsertCustomer(customer);
    console.log(`✅ Successfully created customer: ${customer.id} (${customer.name})`);
    console.log(JSON.stringify(customer, null, 2));
  } else {
    console.log(`Run 'npm.cmd run data:seed' to seed all sample data, or use --help for CLI flags.`);
  }
}

main().catch((err) => {
  console.error('❌ Error creating record:', err);
  process.exit(1);
});
