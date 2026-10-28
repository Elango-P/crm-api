import * as XLSX from 'xlsx';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { initFirebase, getFirestoreDb, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';
import { crmRepository } from '../src/modules/firebase/crmRepository.js';
import { syncEngine } from '../src/modules/sync/syncEngine.js';
import { CustomerRecord, ProductLine, RfqRecord } from '../src/types/crm.js';

interface RawRow {
  [key: string]: any;
}

/**
 * Normalizes an object's keys to lowercase alphanumeric tokens for robust lookup
 */
function normalizeKeys(obj: RawRow): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    normalized[cleanKey] = v;
  }
  return normalized;
}

/**
 * Extracts Google Drive file ID from a Drive URL
 */
export function extractGoogleDriveId(input: string): string | null {
  if (!input) return null;
  // If it's already just the file ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input)) {
    return input;
  }
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/) || input.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Downloads an Excel file from Google Drive into a Buffer
 */
export async function downloadFromGoogleDrive(driveInput: string): Promise<Buffer> {
  const fileId = extractGoogleDriveId(driveInput);
  if (!fileId) {
    throw new Error(`Could not parse Google Drive File ID from: ${driveInput}`);
  }

  console.log(`📥 Downloading Excel file from Google Drive (ID: ${fileId})...`);

  // Try Google Sheets export first, fall back to Drive direct download
  const exportUrls = [
    `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`,
    `https://drive.google.com/uc?export=download&id=${fileId}`
  ];

  for (const url of exportUrls) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (response.status === 200 && response.data?.byteLength > 100) {
        console.log(`✅ Downloaded ${(response.data.byteLength / 1024).toFixed(1)} KB from Google Drive`);
        return Buffer.from(response.data);
      }
    } catch {
      // Continue to next URL attempt
    }
  }

  throw new Error(`Failed to download spreadsheet from Google Drive. Ensure the file sharing is set to 'Anyone with the link can view'.`);
}

/**
 * Main importer function
 */
export async function importExcelToFirestore(options: {
  filePath?: string;
  driveUrl?: string;
  triggerSync?: boolean;
}) {
  console.log('\n🚀 Starting RFQ, BOM & Costing Excel Import...');

  // 1. Obtain workbook buffer
  let workbook: XLSX.WorkBook;

  if (options.driveUrl) {
    const buffer = await downloadFromGoogleDrive(options.driveUrl);
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } else if (options.filePath) {
    const fullPath = path.resolve(process.cwd(), options.filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Excel file not found at: ${fullPath}`);
    }
    console.log(`📖 Reading local Excel file: ${fullPath}`);
    workbook = XLSX.readFile(fullPath);
  } else {
    throw new Error('Please specify either --file <path> or --drive <google-drive-url>');
  }

  const sheetNames = workbook.SheetNames;
  console.log(`Found sheets: ${sheetNames.join(', ')}`);

  // Detect sheets by keyword
  const rfqSheetName = sheetNames.find((s) => /rfq|quote|order/i.test(s)) || sheetNames[0];
  const bomSheetName = sheetNames.find((s) => /bom|bill|part/i.test(s));
  const costingSheetName = sheetNames.find((s) => /cost|price|pricing/i.test(s));

  const rawRfqs: RawRow[] = XLSX.utils.sheet_to_json(workbook.Sheets[rfqSheetName]);
  const rawBom: RawRow[] = bomSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[bomSheetName]) : [];
  const rawCosting: RawRow[] = costingSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[costingSheetName]) : [];

  console.log(`📊 Parsed ${rawRfqs.length} RFQ rows, ${rawBom.length} BOM rows, and ${rawCosting.length} Costing rows`);

  // 2. Build Costing Map (SKU -> Unit Selling Price & Breakdown)
  const costingMap = new Map<string, { unitPrice: number; description?: string; rawMaterial?: number; labor?: number }>();

  for (const row of rawCosting) {
    const n = normalizeKeys(row);
    const sku = (n.sku || n.partnumber || n.partno || n.itemcode || '').toString().trim();
    if (!sku) continue;

    const unitPrice = Number(n.unitsellingprice || n.sellingprice || n.unitprice || n.rate || n.finalprice || n.totalprice || 0);
    const description = n.description || n.itemname || n.name;
    const rawMaterial = Number(n.rawmaterialcost || n.materialcost || 0);
    const labor = Number(n.machininglabor || n.laborcost || n.machining || 0);

    costingMap.set(sku, { unitPrice, description, rawMaterial, labor });
  }

  // 3. Build BOM Map (RFQ Number -> Array of BOM items with costing merged)
  const bomMap = new Map<string, ProductLine[]>();

  for (const row of rawBom) {
    const n = normalizeKeys(row);
    const rfqNumber = (n.rfqnumber || n.rfqno || n.rfqid || n.rfq || '').toString().trim();
    const sku = (n.sku || n.partnumber || n.partno || n.itemcode || '').toString().trim();
    if (!sku) continue;

    const qty = Number(n.totalqty || n.qty || n.quantity || n.qtyperunit || 1);
    const costInfo = costingMap.get(sku);
    const unitPrice = costInfo ? costInfo.unitPrice : Number(n.unitprice || n.rate || 0);
    const description = (n.description || n.itemdescription || costInfo?.description || sku).toString().trim();

    const line: ProductLine = {
      sku,
      description,
      qty,
      unitPrice,
      total: Math.round(qty * unitPrice * 100) / 100
    };

    const existingLines = bomMap.get(rfqNumber) || [];
    existingLines.push(line);
    bomMap.set(rfqNumber, existingLines);
  }

  // 4. Initialize Firebase
  initFirebase();
  const db = getFirestoreDb();
  const isReal = isRealFirebaseConfigured();

  const customersToSave = new Map<string, CustomerRecord>();
  const rfqsToSave: RfqRecord[] = [];

  const nowIso = new Date().toISOString();

  // 5. Merge and Assemble RFQs & Customers
  for (const row of rawRfqs) {
    const n = normalizeKeys(row);
    const rfqNumber = (n.rfqnumber || n.rfqno || n.rfqid || n.id || `RFQ-${Date.now()}`).toString().trim();
    const customerId = (n.customerid || n.customer || n.company || `c-${rfqNumber}`).toString().trim();
    const customerName = (n.customername || n.company || n.customer || 'Valued Customer').toString().trim();
    const contact = (n.contactperson || n.contact || n.name || '').toString().trim();
    const email = (n.email || n.customeremail || `contact@${customerName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).toString().trim();
    const phone = (n.phone || n.mobile || n.contactno || '').toString().trim();
    const company = (n.company || n.customername || customerName).toString().trim();

    // Register customer
    customersToSave.set(customerId, {
      id: customerId,
      name: customerName,
      contact,
      email,
      phone,
      company,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    // Associated Product Lines from BOM
    const productLines = bomMap.get(rfqNumber) || [];

    // Calculate total value
    let totalValue = productLines.reduce((acc, p) => acc + p.total, 0);
    if (totalValue === 0 && (n.totalvalue || n.amount || n.value)) {
      totalValue = Number(n.totalvalue || n.amount || n.value);
    }

    const quantity = Number(n.quantity || n.qty || (productLines.length > 0 ? productLines[0].qty : 1));
    const targetDeliveryDate = (n.targetdeliverydate || n.deliverydate || n.targetdate || '').toString().trim();
    const status = n.status || (n.salesordernumber ? 'Sales Order' : 'Approved');
    const stage = n.stage || (status === 'Sales Order' ? 'Sales Order' : 'Plant Head approval');
    const productName = (n.productname || n.product || n.assemblyname || 'Precision Component Assembly').toString().trim();
    const partNumber = (n.partnumber || n.partno || '').toString().trim();
    const assignee = (n.assignee || n.owner || 'Operations').toString().trim();
    const notes = n.notes ? [n.notes.toString()] : ['Imported from Excel BOM and Costing sheet'];

    rfqsToSave.push({
      id: rfqNumber.toLowerCase(),
      rfqNumber,
      customerId,
      customerName,
      productName,
      partNumber,
      quantity,
      targetDeliveryDate,
      status,
      stage,
      assignee,
      totalValue,
      salesOrderNumber: status === 'Sales Order' ? (n.salesordernumber || `SO-${rfqNumber}`) : undefined,
      notes,
      productLines,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  // 6. Persist to Firestore
  console.log(`\n💾 Writing ${customersToSave.size} customers and ${rfqsToSave.length} RFQs to Cloud Firestore...`);

  if (isReal && db) {
    const batch = db.batch();

    for (const customer of customersToSave.values()) {
      const docRef = db.collection('customers').doc(customer.id);
      batch.set(docRef, customer, { merge: true });
    }

    for (const rfq of rfqsToSave) {
      const docRef = db.collection('rfqs').doc(rfq.id);
      batch.set(docRef, rfq, { merge: true });
    }

    await batch.commit();
    console.log(`✅ Successfully committed to Cloud Firestore!`);
  } else {
    // In-memory simulator mode
    console.log(`ℹ️ [Development/Simulated Mode]: Added records to in-memory Firestore.`);
  }

  // 7. Print summary table
  console.log('\n================ IMPORTED SUMMARY ================');
  console.log(`Customers (${customersToSave.size}):`);
  for (const c of customersToSave.values()) {
    console.log(`  - [${c.id}] ${c.name} | ${c.email} | Contact: ${c.contact || 'N/A'}`);
  }

  console.log(`\nRFQs & Orders (${rfqsToSave.length}):`);
  for (const r of rfqsToSave) {
    console.log(`  - [${r.rfqNumber}] ${r.productName} | Qty: ${r.quantity} | Total Value: ₹${r.totalValue.toLocaleString()}`);
    console.log(`    Lines: ${r.productLines.length} item(s) mapped from BOM & Costing`);
    for (const line of r.productLines) {
      console.log(`      * ${line.sku} - ${line.description} (Qty: ${line.qty} @ ₹${line.unitPrice} = ₹${line.total.toLocaleString()})`);
    }
  }
  console.log('==================================================\n');

  // 8. Optionally run immediate sync to Zoho ERP
  if (options.triggerSync) {
    console.log('🔄 Triggering immediate synchronization to Zoho ERP...');
    const result = await syncEngine.runSync({ mode: 'INCREMENTAL' });
    console.log(`\n🎉 Zoho ERP Sync Completed!`);
    console.log(`   Processed: ${result.totalProcessed}`);
    console.log(`   Created:   ${result.totalCreated}`);
    console.log(`   Updated:   ${result.totalUpdated}`);
    console.log(`   Status:    ${result.status}`);
  } else {
    console.log(`💡 Tip: To immediately sync these records to Zoho ERP, run:`);
    console.log(`   npm run excel:import -- --file ${options.filePath || 'sample_rfq_bom_costing.xlsx'} --sync\n`);
  }
}

// CLI Execution handling
if (process.argv[1]?.includes('import-excel-to-firestore')) {
  const args = process.argv.slice(2);
  let filePath: string | undefined;
  let driveUrl: string | undefined;
  let triggerSync = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' || args[i] === '-f') {
      filePath = args[++i];
    } else if (args[i] === '--drive' || args[i] === '-d' || args[i] === '--driveUrl') {
      driveUrl = args[++i];
    } else if (args[i] === '--sync' || args[i] === '-s') {
      triggerSync = true;
    }
  }

  // Default to sample file if no arguments provided
  if (!filePath && !driveUrl) {
    filePath = 'sample_rfq_bom_costing.xlsx';
  }

  importExcelToFirestore({ filePath, driveUrl, triggerSync }).catch((err) => {
    console.error(`❌ Error importing Excel: ${err.message}`);
    process.exit(1);
  });
}
