import { initFirebase, getFirestoreDb, isRealFirebaseConfigured } from '../src/modules/firebase/firebaseClient.js';
import { crmRepository } from '../src/modules/firebase/crmRepository.js';
import {
  CustomerRecord,
  RfqRecord,
  VendorRecord,
  QuoteRecord,
  SalesOrderRecord,
  InvoiceRecord
} from '../src/types/crm.js';

const nowIso = new Date().toISOString();

export const SAMPLE_VENDORS: VendorRecord[] = [
  {
    id: 'v-101',
    name: 'Precision Steel & Alloys Ltd',
    company: 'Precision Steel & Alloys Ltd',
    contact: 'Amit Verma',
    email: 'amit@precisionsteel.in',
    phone: '+91 98200 44556',
    category: 'Raw Materials & Metals',
    gstin: '27AABCP1234F1Z5',
    pan: 'AABCP1234F',
    paymentTerms: 'Net 30',
    status: 'Active',
    address: { street: 'Phase II, MIDC Bhosari', city: 'Pune', state: 'Maharashtra', zip: '411026', country: 'India' },
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: nowIso
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
    pan: 'AABCT5678M',
    paymentTerms: 'Net 45',
    status: 'Active',
    address: { street: 'Peenya Industrial Area 4th Phase', city: 'Bengaluru', state: 'Karnataka', zip: '560058', country: 'India' },
    createdAt: '2026-10-02T10:00:00Z',
    updatedAt: nowIso
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
    pan: 'AABCE9012K',
    paymentTerms: 'Net 15',
    status: 'Active',
    address: { street: 'Ambattur Industrial Estate', city: 'Chennai', state: 'Tamil Nadu', zip: '600058', country: 'India' },
    createdAt: '2026-10-05T08:30:00Z',
    updatedAt: nowIso
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
    pan: 'AABCZ3456L',
    paymentTerms: 'Advance',
    status: 'Active',
    address: { street: 'GIDC Industrial Estate, Vatva', city: 'Ahmedabad', state: 'Gujarat', zip: '382445', country: 'India' },
    createdAt: '2026-10-08T11:15:00Z',
    updatedAt: nowIso
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
    pan: 'AABCO7890N',
    paymentTerms: 'Net 30',
    status: 'Active',
    address: { street: 'Sector V, Salt Lake', city: 'Kolkata', state: 'West Bengal', zip: '700091', country: 'India' },
    createdAt: '2026-10-10T14:00:00Z',
    updatedAt: nowIso
  }
];

export const SAMPLE_CUSTOMERS: CustomerRecord[] = [
  {
    id: 'c-0083',
    name: 'Delta Automation Tech',
    company: 'Delta Automation Tech',
    contact: 'Siddharth Rao',
    email: 'siddharth@deltaautomation.in',
    phone: '+91 98450 12345',
    createdAt: '2026-10-29T04:37:00.083Z',
    updatedAt: nowIso
  },
  {
    id: 'c-1',
    name: 'Aarav Controls',
    company: 'Aarav Controls',
    contact: 'Rohit Mehta',
    email: 'rohit@aaravcontrols.com',
    phone: '+91 98765 12345',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: nowIso
  },
  {
    id: 'c-2',
    name: 'BluePeak Automation',
    company: 'BluePeak Automation',
    contact: 'Neha Verma',
    email: 'neha@bluepeakautomation.in',
    phone: '+91 98200 11223',
    createdAt: '2026-10-02T08:00:00Z',
    updatedAt: nowIso
  },
  {
    id: 'c-3',
    name: 'Crestline Switchgear',
    company: 'Crestline Switchgear',
    contact: 'Vikram Shah',
    email: 'vikram@crestlineswitchgear.com',
    phone: '+91 98901 55567',
    createdAt: '2026-10-03T08:00:00Z',
    updatedAt: nowIso
  },
  {
    id: 'c-6',
    name: 'Fabricate One',
    company: 'Fabricate One',
    contact: 'Priya Nair',
    email: 'priya@fabricateone.in',
    phone: '+91 96543 22009',
    createdAt: '2026-10-06T08:00:00Z',
    updatedAt: nowIso
  }
];

export const SAMPLE_QUOTES: QuoteRecord[] = [
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
    updatedAt: nowIso
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
    updatedAt: nowIso
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
    updatedAt: nowIso
  },
  {
    id: 'quo-004',
    quoteNumber: 'QUO-2026-004',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-001',
    customerId: 'c-1',
    customerName: 'Aarav Controls',
    contactPerson: 'Rohit Mehta',
    email: 'rohit@aaravcontrols.com',
    phone: '+91 98765 12345',
    issueDate: '2026-10-22',
    expiryDate: '2026-11-22',
    status: 'Approved',
    lineItems: [
      { sku: 'CPA-08-A', description: 'Assembly enclosure', qty: 180, unitPrice: 420, total: 75600 },
      { sku: 'CPA-08-B', description: 'Control unit', qty: 180, unitPrice: 55, total: 9900 }
    ],
    subtotal: 85500,
    taxRate: 18,
    taxAmount: 15390,
    discount: 0,
    totalAmount: 100890,
    currency: 'INR',
    paymentTerms: 'Net 15 days',
    validityDays: 30,
    notes: ['Standard quotation terms apply'],
    createdAt: '2026-10-22T10:00:00Z',
    updatedAt: nowIso
  }
];

export const SAMPLE_SALES_ORDERS: SalesOrderRecord[] = [
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
    updatedAt: nowIso
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
    updatedAt: nowIso
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
    updatedAt: nowIso
  },
  {
    id: 'so-017',
    salesOrderNumber: 'SO-2026-017',
    quoteId: 'quo-004',
    quoteNumber: 'QUO-2026-004',
    rfqId: 'rfq-001',
    rfqNumber: 'RFQ-2026-001',
    customerId: 'c-1',
    customerName: 'Aarav Controls',
    orderDate: '2026-10-14',
    expectedShipmentDate: '2026-10-28',
    status: 'Delivered',
    lineItems: [
      { sku: 'CPA-08-A', description: 'Assembly enclosure', qty: 180, unitPrice: 420, total: 75600 },
      { sku: 'CPA-08-B', description: 'Control unit', qty: 180, unitPrice: 55, total: 9900 }
    ],
    subtotal: 85500,
    taxRate: 18,
    taxAmount: 15390,
    shippingCharges: 1200,
    totalAmount: 102090,
    currency: 'INR',
    billingAddress: { street: 'Industrial Area Phase 3', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', country: 'India' },
    shippingAddress: { street: 'Industrial Area Phase 3', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', country: 'India' },
    notes: ['Delivered and signed off on 2026-10-27.'],
    createdAt: '2026-10-14T11:00:00Z',
    updatedAt: nowIso
  }
];

export const SAMPLE_INVOICES: InvoiceRecord[] = [
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
    updatedAt: nowIso
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
    updatedAt: nowIso
  },
  {
    id: 'inv-090',
    invoiceNumber: 'INV-2026-090',
    salesOrderNumber: 'SO-2026-017',
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
    subtotal: 85500,
    taxRate: 18,
    taxAmount: 15390,
    totalAmount: 100890,
    paidAmount: 100890,
    balanceDue: 0,
    currency: 'INR',
    billingAddress: { street: 'Industrial Area Phase 3', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', country: 'India' },
    notes: ['Full payment received on 2026-10-28 via IMPS ref #9081234.'],
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: nowIso
  },
  {
    id: 'inv-093',
    invoiceNumber: 'INV-2026-093',
    salesOrderNumber: 'SO-2026-016',
    rfqNumber: 'RFQ-2026-083',
    customerId: 'c-0083',
    customerName: 'Delta Automation Tech',
    invoiceDate: '2026-10-28',
    dueDate: '2026-11-27',
    paymentStatus: 'Partially Paid',
    paymentTerms: 'Net 30',
    lineItems: [
      { sku: 'MSAA-100-ACT', description: 'Actuator Motor Unit', qty: 120, unitPrice: 2200, total: 264000 },
      { sku: 'MSAA-100-ENC', description: 'Feedback Encoder Housing', qty: 120, unitPrice: 800, total: 96000 }
    ],
    subtotal: 360000,
    taxRate: 18,
    taxAmount: 64800,
    totalAmount: 424800,
    paidAmount: 127440,
    balanceDue: 297360,
    currency: 'INR',
    billingAddress: { street: 'Industrial Estate Guindy', city: 'Chennai', state: 'Tamil Nadu', zip: '600032', country: 'India' },
    notes: ['30% advance milestone paid.'],
    createdAt: '2026-10-28T16:00:00Z',
    updatedAt: nowIso
  }
];

export const SAMPLE_RFQS: RfqRecord[] = [
  {
    id: 'rfq-2026-083',
    rfqNumber: 'RFQ-2026-083',
    customerId: 'c-0083',
    customerName: 'Delta Automation Tech',
    productName: 'Modular Servo Actuator Assembly',
    partNumber: 'MSAA-100',
    quantity: 120,
    targetDeliveryDate: '2026-11-20',
    status: 'Sales Order',
    stage: 'Sales Order',
    assignee: 'Operations',
    department: 'Operations',
    currentRole: 'Operations',
    salesOrderNumber: 'SO-2026-016',
    invoiceId: 'INV-2026-093',
    totalValue: 360000,
    notes: ['High-precision servo drive module', 'Customer PO release completed'],
    productLines: [
      { sku: 'MSAA-100-ACT', description: 'Actuator Motor Unit', qty: 120, unitPrice: 2200, total: 264000 },
      { sku: 'MSAA-100-ENC', description: 'Feedback Encoder Housing', qty: 120, unitPrice: 800, total: 96000 }
    ],
    createdAt: '2026-10-29T04:37:00.083Z',
    updatedAt: nowIso,
    lastUpdated: nowIso
  },
  {
    id: 'rfq-001',
    rfqNumber: 'RFQ-2026-001',
    customerId: 'c-1',
    customerName: 'Aarav Controls',
    productName: 'Control Panel Assembly',
    partNumber: 'CPA-08',
    quantity: 180,
    targetDeliveryDate: '2026-11-05',
    status: 'Sales Order',
    stage: 'Sales Order',
    assignee: 'Nisha',
    department: 'Operations',
    currentRole: 'Operations',
    salesOrderNumber: 'SO-2026-017',
    invoiceId: 'INV-2026-090',
    totalValue: 85500,
    notes: ['BOM under review', 'Order fulfilled and invoice paid'],
    productLines: [
      { sku: 'CPA-08-A', description: 'Assembly enclosure', qty: 180, unitPrice: 420, total: 75600 },
      { sku: 'CPA-08-B', description: 'Control unit', qty: 180, unitPrice: 55, total: 9900 }
    ],
    createdAt: '2026-10-21T09:30:00Z',
    updatedAt: nowIso,
    lastUpdated: nowIso
  },
  {
    id: 'rfq-002',
    rfqNumber: 'RFQ-2026-002',
    customerId: 'c-2',
    customerName: 'BluePeak Automation',
    productName: 'VFD Control Cabinet',
    partNumber: 'VCC-12',
    quantity: 64,
    targetDeliveryDate: '2026-11-12',
    status: 'Sales Order',
    stage: 'Sales Order',
    assignee: 'Suresh',
    department: 'Plant Head',
    currentRole: 'Plant Head',
    salesOrderNumber: 'SO-2026-015',
    invoiceId: 'INV-2026-092',
    totalValue: 124000,
    notes: ['Pricing reviewed', 'Sales order released under SO-2026-015'],
    productLines: [
      { sku: 'VCC-12-A', description: 'Cabinet assembly', qty: 64, unitPrice: 1500, total: 96000 },
      { sku: 'VCC-12-B', description: 'VFD integration kit', qty: 64, unitPrice: 437.5, total: 28000 }
    ],
    createdAt: '2026-10-18T08:15:00Z',
    updatedAt: nowIso,
    lastUpdated: nowIso
  },
  {
    id: 'rfq-003',
    rfqNumber: 'RFQ-2026-003',
    customerId: 'c-3',
    customerName: 'Crestline Switchgear',
    productName: 'Power Distribution Unit',
    partNumber: 'PDU-44',
    quantity: 92,
    targetDeliveryDate: '2026-11-10',
    status: 'Quoted to Customer',
    stage: 'BDE sends invoice',
    assignee: 'Arun',
    department: 'BDE',
    currentRole: 'BDE',
    totalValue: 97980,
    notes: ['Quotation QUO-2026-001 issued to customer'],
    productLines: [
      { sku: 'PDU-44-A', description: 'Distribution panel', qty: 92, unitPrice: 950, total: 87400 },
      { sku: 'PDU-44-B', description: 'External breaker kit', qty: 92, unitPrice: 115, total: 10580 }
    ],
    createdAt: '2026-10-16T12:00:00Z',
    updatedAt: nowIso,
    lastUpdated: nowIso
  },
  {
    id: 'rfq-006',
    rfqNumber: 'RFQ-2026-006',
    customerId: 'c-6',
    customerName: 'Fabricate One',
    productName: 'Custom Heat Exchanger',
    partNumber: 'CHE-24',
    quantity: 50,
    targetDeliveryDate: '2026-11-22',
    status: 'Sales Order',
    stage: 'Sales Order',
    assignee: 'Mahesh',
    department: 'Operations',
    currentRole: 'Operations',
    salesOrderNumber: 'SO-2026-014',
    invoiceId: 'INV-2026-091',
    totalValue: 186500,
    notes: ['Production release completed, advance invoice generated'],
    productLines: [
      { sku: 'CHE-24-A', description: 'Heat exchanger body', qty: 50, unitPrice: 3000, total: 150000 },
      { sku: 'CHE-24-B', description: 'Core assembly', qty: 50, unitPrice: 730, total: 36500 }
    ],
    createdAt: '2026-10-12T09:44:00Z',
    updatedAt: nowIso,
    lastUpdated: nowIso
  }
];

export async function seedAllSampleData() {
  console.log('🌱 Starting CRM & ERP Sample Data Seeding...');
  initFirebase();
  const isReal = isRealFirebaseConfigured();
  const db = getFirestoreDb();

  console.log(`📡 Storage Backend: ${isReal ? 'Live Cloud Firestore' : 'In-Memory Repository'}`);

  // 1. Seed Vendors
  console.log(`\n🏢 Seeding ${SAMPLE_VENDORS.length} Vendors...`);
  for (const vendor of SAMPLE_VENDORS) {
    if (isReal && db) {
      await db.collection('vendors').doc(vendor.id).set(vendor, { merge: true });
    }
    await crmRepository.upsertVendor(vendor);
    console.log(`  ✅ Vendor [${vendor.id}]: ${vendor.name} (${vendor.category})`);
  }

  // 2. Seed Customers
  console.log(`\n👥 Seeding ${SAMPLE_CUSTOMERS.length} Customers...`);
  for (const customer of SAMPLE_CUSTOMERS) {
    if (isReal && db) {
      await db.collection('customers').doc(customer.id).set(customer, { merge: true });
    }
    await crmRepository.upsertCustomer(customer);
    console.log(`  ✅ Customer [${customer.id}]: ${customer.name}`);
  }

  // 3. Seed Quotes
  console.log(`\n📑 Seeding ${SAMPLE_QUOTES.length} Quotes...`);
  for (const quote of SAMPLE_QUOTES) {
    if (isReal && db) {
      await db.collection('quotes').doc(quote.id).set(quote, { merge: true });
    }
    await crmRepository.upsertQuote(quote);
    console.log(`  ✅ Quote [${quote.quoteNumber}]: ${quote.customerName} - Total: ₹${quote.totalAmount.toLocaleString()} (${quote.status})`);
  }

  // 4. Seed Sales Orders
  console.log(`\n📦 Seeding ${SAMPLE_SALES_ORDERS.length} Sales Orders...`);
  for (const order of SAMPLE_SALES_ORDERS) {
    if (isReal && db) {
      await db.collection('sales_orders').doc(order.id).set(order, { merge: true });
    }
    await crmRepository.upsertSalesOrder(order);
    console.log(`  ✅ Sales Order [${order.salesOrderNumber}]: ${order.customerName} - Total: ₹${order.totalAmount.toLocaleString()} (${order.status})`);
  }

  // 5. Seed Invoices
  console.log(`\n🧾 Seeding ${SAMPLE_INVOICES.length} Invoices...`);
  for (const invoice of SAMPLE_INVOICES) {
    if (isReal && db) {
      await db.collection('invoices').doc(invoice.id).set(invoice, { merge: true });
    }
    await crmRepository.upsertInvoice(invoice);
    console.log(`  ✅ Invoice [${invoice.invoiceNumber}]: ${invoice.customerName} - Total: ₹${invoice.totalAmount.toLocaleString()} (Status: ${invoice.paymentStatus}, Due: ₹${invoice.balanceDue.toLocaleString()})`);
  }

  // 6. Seed / Update RFQs
  console.log(`\n📋 Seeding / Updating ${SAMPLE_RFQS.length} RFQ Records...`);
  for (const rfq of SAMPLE_RFQS) {
    if (isReal && db) {
      await db.collection('rfqs').doc(rfq.id).set(rfq, { merge: true });
    }
    await crmRepository.upsertRfq(rfq);
    console.log(`  ✅ RFQ [${rfq.rfqNumber}]: ${rfq.productName} (${rfq.status})`);
  }

  console.log('\n🎉 Successfully seeded sample data for quotes, sales orders, invoices, and vendors!\n');
}

if (process.argv[1]?.endsWith('seed-sample-data.ts') || process.argv[1]?.endsWith('seed-sample-data.js')) {
  seedAllSampleData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error during seeding:', err);
      process.exit(1);
    });
}

