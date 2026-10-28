import { CustomerRecord, RfqRecord } from '../../types/crm.js';
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

export interface QueryOptions {
  batchSize?: number;
  watermark?: string;
  tenantId?: string;
  startAfterId?: string;
}

export class CrmRepository {
  private inMemoryCustomers: CustomerRecord[] = [...SEED_CUSTOMERS];
  private inMemoryRfqs: RfqRecord[] = [...SEED_RFQS];

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
}

export const crmRepository = new CrmRepository();
