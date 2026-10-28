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
