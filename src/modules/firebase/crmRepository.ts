import {
  CustomerRecord,
  RfqRecord,
  VendorRecord,
  QuoteRecord,
  SalesOrderRecord,
  InvoiceRecord
} from '../../types/crm.js';
import { getFirestoreDb, isRealFirebaseConfigured } from './firebaseClient.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// Fallback seed data mirroring the exact dummycrm dataset
const SEED_CUSTOMERS: CustomerRecord[] = [
  { id: 'c-1', name: 'Aarav Controls', contact: 'Rohit Mehta', email: 'rohit@aaravcontrols.com', phone: '+91 98765 12345', company: 'Aarav Controls', updatedAt: '2026-10-27T11:00:00Z', createdAt: '2026-10-01T08:00:00Z' },
  { id: 'c-2', name: 'BluePeak Automation', contact: 'Neha Verma', email: 'neha@bluepeakautomation.in', phone: '+91 98200 11223', company: 'BluePeak Automation', updatedAt: '2026-10-25T15:45:00Z', createdAt: '2026-10-02T08:00:00Z' },
  { id: 'c-3', name: 'Crestline Switchgear', contact: 'Vikram Shah', email: 'vikram@crestlineswitchgear.com', phone: '+91 98901 55567', company: 'Crestline Switchgear', updatedAt: '2026-10-23T14:20:00Z', createdAt: '2026-10-03T08:00:00Z' },
  { id: 'c-4', name: 'Dynamo Industries', contact: 'Sana Khan', email: 'sana@dynamoindustries.in', phone: '+91 98111 87513', company: 'Dynamo Industries', updatedAt: '2026-10-26T09:50:00Z', createdAt: '2026-10-04T08:00:00Z' },
  { id: 'c-5', name: 'Elite Robotics', contact: 'Arjun Pillai', email: 'arjun@eliterobotics.co', phone: '+91 99600 33445', company: 'Elite Robotics', updatedAt: '2026-10-27T08:15:00Z', createdAt: '2026-10-05T08:00:00Z' },
  { id: 'c-6', name: 'Fabricate One', contact: 'Priya Nair', email: 'priya@fabricateone.in', phone: '+91 96543 22009', company: 'Fabricate One', updatedAt: '2026-10-21T16:10:00Z', createdAt: '2026-10-06T08:00:00Z' },
  { id: 'c-7', name: 'Gleam Components', contact: 'Rahul Sinha', email: 'rahul@gleamcomponents.com', phone: '+91 93455 67890', company: 'Gleam Components', updatedAt: '2026-10-18T13:10:00Z', createdAt: '2026-10-07T08:00:00Z' },
  { id: 'c-8', name: 'Horizon Drives', contact: 'Aditi Joshi', email: 'aditi@horizondrives.in', phone: '+91 99080 44167', company: 'Horizon Drives', updatedAt: '2026-10-24T10:00:00Z', createdAt: '2026-10-08T08:00:00Z' },
  { id: 'c-9', name: 'IronFlow Systems', contact: 'Karan Singh', email: 'karan@ironflowsystems.in', phone: '+91 97313 88790', company: 'IronFlow Systems', updatedAt: '2026-10-27T10:35:00Z', createdAt: '2026-10-09T08:00:00Z' },
  { id: 'c-10', name: 'Jupiter Electric', contact: 'Deepa Menon', email: 'deepa@jupiterelectric.com', phone: '+91 92999 10321', company: 'Jupiter Electric', updatedAt: '2026-10-19T16:40:00Z', createdAt: '2026-10-10T08:00:00Z' }
];

const SEED_RFQS: RfqRecord[] = [
  {
    id: 'rfq-001', rfqNumber: 'RFQ-2026-001', customerId: 'c-1', customerName: 'Aarav Controls', productName: 'Control Panel Assembly', partNumber: 'CPA-08', quantity: 180, targetDeliveryDate: '2026-11-05', status: 'With Technical', stage: 'Technical', assignee: 'Nisha', department: 'Technical', currentRole: 'Technical', lastUpdated: '2026-10-27T11:00:00Z', createdAt: '2026-10-21T09:30:00Z', updatedAt: '2026-10-27T11:00:00Z', totalValue: 85600, notes: ['BOM under review', 'Client requested compact enclosure'], productLines: [{ sku:'CPA-08-A', description:'Assembly enclosure', qty: 180, unitPrice: 420, total: 75600 }, { sku:'CPA-08-B', description:'Control unit', qty: 180, unitPrice: 55, total: 9900 }]
  },
  {
    id: 'rfq-002', rfqNumber: 'RFQ-2026-002', customerId: 'c-2', customerName: 'BluePeak Automation', productName: 'VFD Control Cabinet', partNumber: 'VCC-12', quantity: 64, targetDeliveryDate: '2026-11-12', status: 'Approved', stage: 'Plant Head approval', assignee: 'Suresh', department: 'Plant Head', currentRole: 'Plant Head', lastUpdated: '2026-10-25T15:45:00Z', createdAt: '2026-10-18T08:15:00Z', updatedAt: '2026-10-25T15:45:00Z', totalValue: 124000, notes: ['Pricing reviewed', 'Need customer confirmation'], productLines: [{ sku:'VCC-12-A', description:'Cabinet assembly', qty: 64, unitPrice: 1500, total: 96000 }, { sku:'VCC-12-B', description:'VFD integration kit', qty: 64, unitPrice: 437.5, total: 28000 }]
  },
  {
    id: 'rfq-003', rfqNumber: 'RFQ-2026-003', customerId: 'c-3', customerName: 'Crestline Switchgear', productName: 'Power Distribution Unit', partNumber: 'PDU-44', quantity: 92, targetDeliveryDate: '2026-11-10', status: 'Quoted to Customer', stage: 'BDE sends invoice', assignee: 'Arun', department: 'BDE', currentRole: 'BDE', lastUpdated: '2026-10-23T14:20:00Z', createdAt: '2026-10-16T12:00:00Z', updatedAt: '2026-10-23T14:20:00Z', totalValue: 98000, notes: ['Quotation sent'], productLines: [{ sku:'PDU-44-A', description:'Distribution panel', qty: 92, unitPrice: 950, total: 87400 }, { sku:'PDU-44-B', description:'External breaker kit', qty: 92, unitPrice: 115, total: 10580 }]
  },
  {
    id: 'rfq-006', rfqNumber: 'RFQ-2026-006', customerId: 'c-6', customerName: 'Fabricate One', productName: 'Custom Heat Exchanger', partNumber: 'CHE-24', quantity: 50, targetDeliveryDate: '2026-11-22', status: 'Sales Order', stage: 'Sales Order', assignee: 'Mahesh', department: 'Operations', currentRole: 'Operations', lastUpdated: '2026-10-21T16:10:00Z', createdAt: '2026-10-12T09:44:00Z', updatedAt: '2026-10-21T16:10:00Z', totalValue: 186500, salesOrderNumber: 'SO-2026-014', invoiceId: 'INV-2026-091', notes: ['Production release completed'], productLines: [{ sku:'CHE-24-A', description:'Heat exchanger body', qty: 50, unitPrice: 3000, total: 150000 }, { sku:'CHE-24-B', description:'Core assembly', qty: 50, unitPrice: 730, total: 36500 }]
  }
];

const SEED_VENDORS: VendorRecord[] = [
  {
    id: 'v-101',
    name: 'Precision Steel & Alloys Ltd',
    company: 'Precision Steel & Alloys Ltd',
    contact: 'Amit Verma',
    email: 'amit@precisionsteel.in',
    phone: '+91 98200 44556',
    category: 'Raw Materials & Metals',
    gstin: '27AABCP1234F1Z5',
    paymentTerms: 'Net 30',
    status: 'Active',
    address: { street: 'Phase II, MIDC Bhosari', city: 'Pune', state: 'Maharashtra', zip: '411026', country: 'India' },
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-25T11:00:00Z'
  },
  {
    id: 'v-102',
    name: 'TechnoCore CNC Machining Works',
    company: 'TechnoCore CNC Machining Works',
    contact: 'Rakesh Sharma',
    email: 'rakesh@technocore-cnc.com',
    phone: '+91 97110 88231',
    category: 'CNC Machining & Tooling',
    gstin: '29AABCT5678M1Z2',
    paymentTerms: 'Net 45',
    status: 'Active',
    address: { street: 'Peenya Industrial Area 4th Phase', city: 'Bengaluru', state: 'Karnataka', zip: '560058', country: 'India' },
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: '2026-10-26T14:30:00Z'
  },
  {
    id: 'v-103',
    name: 'ElectraMotion Dynamics Pvt Ltd',
    company: 'ElectraMotion Dynamics Pvt Ltd',
    contact: 'Meera Krishnan',
    email: 'meera@electramotion.co',
    phone: '+91 98450 77112',
    category: 'Motors & Actuators',
    gstin: '33AABCE9012K1Z8',
    paymentTerms: 'Net 15',
    status: 'Active',
    address: { street: 'Ambattur Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', zip: '600058', country: 'India' },
    createdAt: '2026-10-05T08:30:00Z',
    updatedAt: '2026-10-27T16:00:00Z'
  },
  {
    id: 'v-104',
    name: 'Zenith Fasteners & Hardware',
    company: 'Zenith Fasteners & Hardware',
    contact: 'Dilip Patel',
    email: 'dilip@zenithfasteners.in',
    phone: '+91 98980 33211',
    category: 'Industrial Hardware & Fasteners',
    gstin: '24AABCZ3456L1Z4',
    paymentTerms: 'Advance',
    status: 'Active',
    address: { street: 'GIDC Industrial Estate, Vatva', city: 'Ahmedabad', state: 'Gujarat', zip: '382445', country: 'India' },
    createdAt: '2026-10-08T11:15:00Z',
    updatedAt: '2026-10-24T09:40:00Z'
  },
  {
    id: 'v-105',
    name: 'OptiSensor Technologies',
    company: 'OptiSensor Technologies',
    contact: 'Sneha Roy',
    email: 'sneha@optisensor.io',
    phone: '+91 98310 99443',
    category: 'Sensors & Instrumentation',
    gstin: '19AABCO7890N1Z9',
    paymentTerms: 'Net 30',
    status: 'Active',
    address: { street: 'Sector V, Salt Lake', city: 'Kolkata', state: 'West Bengal', zip: '700091', country: 'India' },
    createdAt: '2026-10-10T14:00:00Z',
    updatedAt: '2026-10-27T12:00:00Z'
  }
];

const SEED_QUOTES: QuoteRecord[] = [
  {
    id: 'quo-001',
    quoteNumber: 'QUO-2026-001',
    rfqId: 'rfq-003',
    rfqNumber: 'RFQ-2026-003',
    customerId: 'c-3',
    customerName: 'Crestline Switchgear',
    contactPerson: 'Vikram Shah',
    email: 'vikram@crestlineswitchgear.com',
    phone: '+91 98901 55567',
    issueDate: '2026-10-23',
    expiryDate: '2026-11-23',
    status: 'Sent',
    lineItems: [
      { sku: 'PDU-44-A', description: 'Power distribution panel assembly', qty: 92, unitPrice: 950, total: 87400 },
      { sku: 'PDU-44-B', description: 'External circuit breaker kit', qty: 92, unitPrice: 115, total: 10580 }
    ],
    subtotal: 97980,
    taxRate: 18,
    taxAmount: 17636.4,
    discount: 0,
    totalAmount: 115616.4,
    currency: 'INR',
    paymentTerms: '50% advance, balance against PI before dispatch',
    validityDays: 30,
    notes: ['Includes 1-year on-site replacement warranty', 'Delivery lead time: 3 weeks'],
    createdAt: '2026-10-23T14:20:00Z',
    updatedAt: '2026-10-23T14:20:00Z'
  },
  {
    id: 'quo-002',
    quoteNumber: 'QUO-2026-002',
    rfqId: 'rfq-002',
    rfqNumber: 'RFQ-2026-002',
    customerId: 'c-2',
    customerName: 'BluePeak Automation',
    contactPerson: 'Neha Verma',
    email: 'neha@bluepeakautomation.in',
    phone: '+91 98200 11223',
    issueDate: '2026-10-20',
    expiryDate: '2026-11-20',
    status: 'Converted to Order',
    lineItems: [
      { sku: 'VCC-12-A', description: 'IP65 Rated VFD Control Cabinet', qty: 64, unitPrice: 1500, total: 96000 },
      { sku: 'VCC-12-B', description: 'VFD integration kit & busbars', qty: 64, unitPrice: 437.5, total: 28000 }
    ],
    subtotal: 124000,
    taxRate: 18,
    taxAmount: 22320,
    discount: 0,
    totalAmount: 146320,
    currency: 'INR',
    paymentTerms: 'Net 30 days',
    validityDays: 30,
    notes: ['Customer accepted terms and released Sales Order SO-2026-015'],
    createdAt: '2026-10-20T11:00:00Z',
    updatedAt: '2026-10-25T15:45:00Z'
  },
  {
    id: 'quo-003',
    quoteNumber: 'QUO-2026-003',
    rfqId: 'rfq-2026-083',
    rfqNumber: 'RFQ-2026-083',
    customerId: 'c-0083',
    customerName: 'Delta Automation Tech',
    contactPerson: 'Siddharth Rao',
    email: 'siddharth@deltaautomation.in',
    phone: '+91 98450 12345',
    issueDate: '2026-10-26',
    expiryDate: '2026-11-15',
    status: 'Approved',
    lineItems: [
      { sku: 'MSAA-100-ACT', description: 'Actuator Motor Unit', qty: 120, unitPrice: 2200, total: 264000 },
      { sku: 'MSAA-100-ENC', description: 'Feedback Encoder Housing', qty: 120, unitPrice: 800, total: 96000 }
    ],
    subtotal: 360000,
    taxRate: 18,
    taxAmount: 64800,
    discount: 0,
    totalAmount: 424800,
    currency: 'INR',
    paymentTerms: '30% advance, 70% Net 30',
    validityDays: 20,
    notes: ['Plant Head technical clearance approved', 'Dispatched for customer PO issuance'],
    createdAt: '2026-10-26T09:30:00Z',
    updatedAt: '2026-10-28T16:00:00Z'
  }
];

const SEED_SALES_ORDERS: SalesOrderRecord[] = [
  {
    id: 'so-014',
    salesOrderNumber: 'SO-2026-014',
    rfqId: 'rfq-006',
    rfqNumber: 'RFQ-2026-006',
    customerId: 'c-6',
    customerName: 'Fabricate One',
    orderDate: '2026-10-21',
    expectedShipmentDate: '2026-11-22',
    status: 'In Production',
    lineItems: [
      { sku: 'CHE-24-A', description: 'Heat exchanger body', qty: 50, unitPrice: 3000, total: 150000 },
      { sku: 'CHE-24-B', description: 'Core assembly', qty: 50, unitPrice: 730, total: 36500 }
    ],
    subtotal: 186500,
    taxRate: 18,
    taxAmount: 33570,
    shippingCharges: 2500,
    totalAmount: 222570,
    currency: 'INR',
    billingAddress: { street: 'Plot 44, Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', zip: '560100', country: 'India' },
    shippingAddress: { street: 'Plot 44, Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', zip: '560100', country: 'India' },
    notes: ['Production scheduled in Bay 3. Invoiced under INV-2026-091.'],
    createdAt: '2026-10-21T16:10:00Z',
    updatedAt: '2026-10-21T16:10:00Z'
  },
  {
    id: 'so-015',
    salesOrderNumber: 'SO-2026-015',
    quoteId: 'quo-002',
    quoteNumber: 'QUO-2026-002',
    rfqId: 'rfq-002',
    rfqNumber: 'RFQ-2026-002',
    customerId: 'c-2',
    customerName: 'BluePeak Automation',
    orderDate: '2026-10-26',
    expectedShipmentDate: '2026-11-12',
    status: 'Confirmed',
    lineItems: [
      { sku: 'VCC-12-A', description: 'Cabinet assembly', qty: 64, unitPrice: 1500, total: 96000 },
      { sku: 'VCC-12-B', description: 'VFD integration kit', qty: 64, unitPrice: 437.5, total: 28000 }
    ],
    subtotal: 124000,
    taxRate: 18,
    taxAmount: 22320,
    shippingCharges: 1800,
    totalAmount: 148120,
    currency: 'INR',
    billingAddress: { street: 'Survey 28, Hinjewadi Phase 2', city: 'Pune', state: 'Maharashtra', zip: '411057', country: 'India' },
    shippingAddress: { street: 'Survey 28, Hinjewadi Phase 2', city: 'Pune', state: 'Maharashtra', zip: '411057', country: 'India' },
    notes: ['PO received via email. Invoiced under INV-2026-092.'],
    createdAt: '2026-10-26T10:00:00Z',
    updatedAt: '2026-10-26T10:00:00Z'
  },
  {
    id: 'so-016',
    salesOrderNumber: 'SO-2026-016',
    quoteId: 'quo-003',
    quoteNumber: 'QUO-2026-003',
    rfqId: 'rfq-2026-083',
    rfqNumber: 'RFQ-2026-083',
    customerId: 'c-0083',
    customerName: 'Delta Automation Tech',
    orderDate: '2026-10-28',
    expectedShipmentDate: '2026-11-20',
    status: 'Confirmed',
    lineItems: [
      { sku: 'MSAA-100-ACT', description: 'Actuator Motor Unit', qty: 120, unitPrice: 2200, total: 264000 },
      { sku: 'MSAA-100-ENC', description: 'Feedback Encoder Housing', qty: 120, unitPrice: 800, total: 96000 }
    ],
    subtotal: 360000,
    taxRate: 18,
    taxAmount: 64800,
    shippingCharges: 4000,
    totalAmount: 428800,
    currency: 'INR',
    billingAddress: { street: 'Industrial Estate Guindy', city: 'Chennai', state: 'Tamil Nadu', zip: '600032', country: 'India' },
    shippingAddress: { street: 'Industrial Estate Guindy', city: 'Chennai', state: 'Tamil Nadu', zip: '600032', country: 'India' },
    notes: ['Customer signed purchase confirmation received.'],
    createdAt: '2026-10-28T14:15:00Z',
    updatedAt: '2026-10-28T14:15:00Z'
  }
];

const SEED_INVOICES: InvoiceRecord[] = [
  {
    id: 'inv-091',
    invoiceNumber: 'INV-2026-091',
    salesOrderNumber: 'SO-2026-014',
    rfqNumber: 'RFQ-2026-006',
    customerId: 'c-6',
    customerName: 'Fabricate One',
    invoiceDate: '2026-10-22',
    dueDate: '2026-11-21',
    paymentStatus: 'Partially Paid',
    paymentTerms: 'Net 30',
    lineItems: [
      { sku: 'CHE-24-A', description: 'Heat exchanger body', qty: 50, unitPrice: 3000, total: 150000 },
      { sku: 'CHE-24-B', description: 'Core assembly', qty: 50, unitPrice: 730, total: 36500 }
    ],
    subtotal: 186500,
    taxRate: 18,
    taxAmount: 33570,
    totalAmount: 220070,
    paidAmount: 110000,
    balanceDue: 110070,
    currency: 'INR',
    billingAddress: { street: 'Plot 44, Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', zip: '560100', country: 'India' },
    notes: ['Advance payment of INR 1,10,000 received via NEFT/RTGS.'],
    createdAt: '2026-10-22T09:00:00Z',
    updatedAt: '2026-10-25T11:00:00Z'
  },
  {
    id: 'inv-092',
    invoiceNumber: 'INV-2026-092',
    salesOrderNumber: 'SO-2026-015',
    rfqNumber: 'RFQ-2026-002',
    customerId: 'c-2',
    customerName: 'BluePeak Automation',
    invoiceDate: '2026-10-27',
    dueDate: '2026-11-26',
    paymentStatus: 'Unpaid',
    paymentTerms: 'Net 30',
    lineItems: [
      { sku: 'VCC-12-A', description: 'Cabinet assembly', qty: 64, unitPrice: 1500, total: 96000 },
      { sku: 'VCC-12-B', description: 'VFD integration kit', qty: 64, unitPrice: 437.5, total: 28000 }
    ],
    subtotal: 124000,
    taxRate: 18,
    taxAmount: 22320,
    totalAmount: 146320,
    paidAmount: 0,
    balanceDue: 146320,
    currency: 'INR',
    billingAddress: { street: 'Survey 28, Hinjewadi Phase 2', city: 'Pune', state: 'Maharashtra', zip: '411057', country: 'India' },
    notes: ['Tax invoice sent to finance team for processing.'],
    createdAt: '2026-10-27T10:30:00Z',
    updatedAt: '2026-10-27T10:30:00Z'
  },
  {
    id: 'inv-090',
    invoiceNumber: 'INV-2026-090',
    salesOrderNumber: 'SO-2026-010',
    rfqNumber: 'RFQ-2026-001',
    customerId: 'c-1',
    customerName: 'Aarav Controls',
    invoiceDate: '2026-10-15',
    dueDate: '2026-10-30',
    paymentStatus: 'Paid',
    paymentTerms: 'Net 15',
    lineItems: [
      { sku: 'CPA-08-A', description: 'Assembly enclosure', qty: 180, unitPrice: 420, total: 75600 },
      { sku: 'CPA-08-B', description: 'Control unit', qty: 180, unitPrice: 55, total: 9900 }
    ],
    subtotal: 85600,
    taxRate: 18,
    taxAmount: 15408,
    totalAmount: 101008,
    paidAmount: 101008,
    balanceDue: 0,
    currency: 'INR',
    billingAddress: { street: 'Industrial Area Phase 3', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', country: 'India' },
    notes: ['Full payment received on 2026-10-28 via IMPS ref #9081234.'],
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-10-28T15:00:00Z'
  }
];

export interface QueryOptions {
  batchSize?: number;
  watermark?: string;
  tenantId?: string;
  startAfterId?: string;
}

export class CrmRepository {
  private inMemoryCustomers: CustomerRecord[] = [...SEED_CUSTOMERS];
  private inMemoryRfqs: RfqRecord[] = [...SEED_RFQS];
  private inMemoryVendors: VendorRecord[] = [...SEED_VENDORS];
  private inMemoryQuotes: QuoteRecord[] = [...SEED_QUOTES];
  private inMemorySalesOrders: SalesOrderRecord[] = [...SEED_SALES_ORDERS];
  private inMemoryInvoices: InvoiceRecord[] = [...SEED_INVOICES];

  /**
   * Fetch customer records with optional watermark and tenant filtering
   */
  async getCustomers(options: QueryOptions = {}): Promise<CustomerRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('customers');

        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }

        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }

        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<CustomerRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query customers from Cloud Firestore');
        throw error;
      }
    }

    // In-memory fallback
    return this.inMemoryCustomers.filter((c) => {
      if (options.tenantId && c.tenantId !== options.tenantId) return false;
      if (options.watermark && (c.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  /**
   * Fetch RFQ records with optional watermark and tenant filtering
   */
  async getRfqs(options: QueryOptions = {}): Promise<RfqRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('rfqs');

        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }

        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }

        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RfqRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query RFQs from Cloud Firestore');
        throw error;
      }
    }

    // In-memory fallback
    return this.inMemoryRfqs.filter((r) => {
      if (options.tenantId && r.tenantId !== options.tenantId) return false;
      if (options.watermark && (r.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  /**
   * Fetch customer by source ID
   */
  async getCustomerById(id: string): Promise<CustomerRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('customers').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<CustomerRecord, 'id'>) };
    }
    return this.inMemoryCustomers.find((c) => c.id === id) || null;
  }

  /**
   * Fetch RFQ by source ID
   */
  async getRfqById(id: string): Promise<RfqRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('rfqs').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<RfqRecord, 'id'>) };
    }
    return this.inMemoryRfqs.find((r) => r.id === id) || null;
  }

  /**
   * Upsert customer record
   */
  async upsertCustomer(customer: CustomerRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('customers').doc(customer.id).set(customer, { merge: true });
      return;
    }
    const idx = this.inMemoryCustomers.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      this.inMemoryCustomers[idx] = { ...this.inMemoryCustomers[idx], ...customer };
    } else {
      this.inMemoryCustomers.push(customer);
    }
  }

  /**
   * Upsert RFQ record
   */
  async upsertRfq(rfq: RfqRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('rfqs').doc(rfq.id).set(rfq, { merge: true });
      return;
    }
    const idx = this.inMemoryRfqs.findIndex((r) => r.id === rfq.id);
    if (idx >= 0) {
      this.inMemoryRfqs[idx] = { ...this.inMemoryRfqs[idx], ...rfq };
    } else {
      this.inMemoryRfqs.push(rfq);
    }
  }

  /**
   * Fetch vendor records
   */
  async getVendors(options: QueryOptions = {}): Promise<VendorRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('vendors');
        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }
        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }
        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<VendorRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query vendors from Cloud Firestore');
        throw error;
      }
    }

    return this.inMemoryVendors.filter((v) => {
      if (options.tenantId && v.tenantId !== options.tenantId) return false;
      if (options.watermark && (v.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  async getVendorById(id: string): Promise<VendorRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('vendors').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<VendorRecord, 'id'>) };
    }
    return this.inMemoryVendors.find((v) => v.id === id) || null;
  }

  async upsertVendor(vendor: VendorRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('vendors').doc(vendor.id).set(vendor, { merge: true });
      return;
    }
    const idx = this.inMemoryVendors.findIndex((v) => v.id === vendor.id);
    if (idx >= 0) {
      this.inMemoryVendors[idx] = { ...this.inMemoryVendors[idx], ...vendor };
    } else {
      this.inMemoryVendors.push(vendor);
    }
  }

  /**
   * Fetch quote records
   */
  async getQuotes(options: QueryOptions = {}): Promise<QuoteRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('quotes');
        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }
        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }
        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<QuoteRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query quotes from Cloud Firestore');
        throw error;
      }
    }

    return this.inMemoryQuotes.filter((q) => {
      if (options.tenantId && q.tenantId !== options.tenantId) return false;
      if (options.watermark && (q.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  async getQuoteById(id: string): Promise<QuoteRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('quotes').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<QuoteRecord, 'id'>) };
    }
    return this.inMemoryQuotes.find((q) => q.id === id) || null;
  }

  async upsertQuote(quote: QuoteRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('quotes').doc(quote.id).set(quote, { merge: true });
      return;
    }
    const idx = this.inMemoryQuotes.findIndex((q) => q.id === quote.id);
    if (idx >= 0) {
      this.inMemoryQuotes[idx] = { ...this.inMemoryQuotes[idx], ...quote };
    } else {
      this.inMemoryQuotes.push(quote);
    }
  }

  /**
   * Fetch sales orders
   */
  async getSalesOrders(options: QueryOptions = {}): Promise<SalesOrderRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('sales_orders');
        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }
        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }
        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<SalesOrderRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query sales orders from Cloud Firestore');
        throw error;
      }
    }

    return this.inMemorySalesOrders.filter((so) => {
      if (options.tenantId && so.tenantId !== options.tenantId) return false;
      if (options.watermark && (so.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  async getSalesOrderById(id: string): Promise<SalesOrderRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('sales_orders').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<SalesOrderRecord, 'id'>) };
    }
    return this.inMemorySalesOrders.find((so) => so.id === id) || null;
  }

  async upsertSalesOrder(order: SalesOrderRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('sales_orders').doc(order.id).set(order, { merge: true });
      return;
    }
    const idx = this.inMemorySalesOrders.findIndex((so) => so.id === order.id);
    if (idx >= 0) {
      this.inMemorySalesOrders[idx] = { ...this.inMemorySalesOrders[idx], ...order };
    } else {
      this.inMemorySalesOrders.push(order);
    }
  }

  /**
   * Fetch invoices
   */
  async getInvoices(options: QueryOptions = {}): Promise<InvoiceRecord[]> {
    const db = getFirestoreDb();
    const batchSize = options.batchSize || config.SYNC_BATCH_SIZE;

    if (isRealFirebaseConfigured() && db) {
      try {
        let query: FirebaseFirestore.Query = db.collection('invoices');
        if (options.tenantId || config.TENANT_ID) {
          query = query.where('tenantId', '==', options.tenantId || config.TENANT_ID);
        }
        if (options.watermark) {
          query = query.where('updatedAt', '>', options.watermark);
        }
        query = query.orderBy('updatedAt', 'asc').limit(batchSize);

        const snapshot = await query.get();
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<InvoiceRecord, 'id'>)
        }));
      } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to query invoices from Cloud Firestore');
        throw error;
      }
    }

    return this.inMemoryInvoices.filter((inv) => {
      if (options.tenantId && inv.tenantId !== options.tenantId) return false;
      if (options.watermark && (inv.updatedAt || '') <= options.watermark) return false;
      return true;
    }).slice(0, batchSize);
  }

  async getInvoiceById(id: string): Promise<InvoiceRecord | null> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      const doc = await db.collection('invoices').doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<InvoiceRecord, 'id'>) };
    }
    return this.inMemoryInvoices.find((inv) => inv.id === id) || null;
  }

  async upsertInvoice(invoice: InvoiceRecord): Promise<void> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      await db.collection('invoices').doc(invoice.id).set(invoice, { merge: true });
      return;
    }
    const idx = this.inMemoryInvoices.findIndex((inv) => inv.id === invoice.id);
    if (idx >= 0) {
      this.inMemoryInvoices[idx] = { ...this.inMemoryInvoices[idx], ...invoice };
    } else {
      this.inMemoryInvoices.push(invoice);
    }
  }
}

export const crmRepository = new CrmRepository();
