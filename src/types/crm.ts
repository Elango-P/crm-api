export type Role = 'Super Admin' | 'BDE' | 'Operations' | 'Technical' | 'Purchase' | 'Plant Head';

export type RfqStatus =
  | 'Draft'
  | 'With Operations'
  | 'With Technical'
  | 'Awaiting Customer Input'
  | 'With Purchase'
  | 'Pricing & Operations'
  | 'Pending Plant Head'
  | 'Approved'
  | 'Quoted to Customer'
  | 'Won'
  | 'Lost'
  | 'On Hold (Sales)'
  | 'Sales Order'
  | 'Rejected';

export type Stage =
  | 'BDE creates RFQ'
  | 'Operations'
  | 'Technical'
  | 'Purchase'
  | 'Plant Head approval'
  | 'BDE sends invoice'
  | 'Won / Lost / On Hold'
  | 'Sales Order';

export interface CustomerRecord {
  id: string;
  name: string;
  contact?: string;
  email: string;
  phone?: string;
  company?: string;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductLine {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  url: string;
  type: string;
}

export interface ActivityLog {
  id: string;
  at: string;
  action: string;
  user: string;
  details: string;
}

export interface RfqRecord {
  id: string;
  rfqNumber: string;
  customerId: string;
  customerName?: string;
  productName: string;
  partNumber?: string;
  quantity: number;
  targetDeliveryDate?: string;
  status: RfqStatus;
  stage: Stage;
  assignee?: string;
  department?: Role;
  currentRole?: string;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
  totalValue: number;
  salesOrderNumber?: string;
  invoiceId?: string;
  notes?: string[];
  documents?: DocumentItem[];
  activity?: ActivityLog[];
  productLines: ProductLine[];
  tenantId?: string;
}

export interface AddressInfo {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  contact?: string;
  email: string;
  phone?: string;
  company?: string;
  category?: string; // e.g., 'Raw Materials', 'CNC Machining', 'Electronics', 'Packaging'
  gstin?: string;
  pan?: string;
  paymentTerms?: string; // e.g., 'Net 30', 'Net 15', 'Advance'
  address?: AddressInfo;
  status?: 'Active' | 'Inactive' | 'Under Review';
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuoteRecord {
  id: string;
  quoteNumber: string; // e.g., 'QUO-2026-001'
  rfqId?: string;
  rfqNumber?: string;
  customerId: string;
  customerName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  status: 'Draft' | 'Sent' | 'Approved' | 'Declined' | 'Converted to Order';
  lineItems: ProductLine[];
  subtotal: number;
  taxRate?: number; // e.g. 18 for 18% GST
  taxAmount?: number;
  discount?: number;
  totalAmount: number;
  currency?: string;
  paymentTerms?: string;
  validityDays?: number;
  notes?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalesOrderRecord {
  id: string;
  salesOrderNumber: string; // e.g., 'SO-2026-001'
  quoteId?: string;
  quoteNumber?: string;
  rfqId?: string;
  rfqNumber?: string;
  customerId: string;
  customerName: string;
  orderDate: string; // YYYY-MM-DD
  expectedShipmentDate?: string; // YYYY-MM-DD
  status: 'Draft' | 'Confirmed' | 'In Production' | 'Shipped' | 'Delivered' | 'Closed' | 'Cancelled';
  lineItems: ProductLine[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  shippingCharges?: number;
  totalAmount: number;
  currency?: string;
  billingAddress?: AddressInfo;
  shippingAddress?: AddressInfo;
  notes?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string; // e.g., 'INV-2026-001'
  salesOrderNumber?: string;
  rfqNumber?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Void';
  paymentTerms?: string;
  lineItems: ProductLine[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount?: number;
  balanceDue: number;
  currency?: string;
  billingAddress?: AddressInfo;
  notes?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}
