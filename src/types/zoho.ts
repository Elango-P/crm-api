export interface ZohoTokenResponse {
  access_token: string;
  api_domain: string;
  token_type: string;
  expires_in: number;
  error?: string;
}

export interface ZohoContactPayload {
  contact_name: string;
  company_name?: string;
  contact_type?: 'customer' | 'vendor';
  customer_sub_type?: 'individual' | 'business';
  email?: string;
  phone?: string;
  notes?: string;
  contact_persons?: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    is_primary_contact?: boolean;
  }>;
  custom_fields?: Array<{
    label?: string;
    api_name?: string;
    value: any;
  }>;
}

export interface ZohoItemPayload {
  name: string;
  sku: string;
  rate: number;
  description?: string;
  product_type?: 'goods' | 'service';
  item_type?: 'inventory' | 'sales_and_purchases';
}

export interface ZohoSalesOrderPayload {
  customer_id: string;
  salesorder_number?: string;
  reference_number?: string;
  date?: string;
  shipment_date?: string;
  line_items: Array<{
    item_id?: string;
    name: string;
    description?: string;
    rate: number;
    quantity: number;
  }>;
  notes?: string;
  terms?: string;
}

export interface ZohoInvoicePayload {
  customer_id: string;
  invoice_number?: string;
  reference_number?: string;
  date?: string;
  due_date?: string;
  line_items: Array<{
    item_id?: string;
    name: string;
    rate: number;
    quantity: number;
  }>;
  notes?: string;
}

export interface ZohoEstimatePayload {
  customer_id: string;
  estimate_number?: string;
  reference_number?: string;
  date?: string;
  expiry_date?: string;
  line_items: Array<{
    item_id?: string;
    name: string;
    description?: string;
    rate: number;
    quantity: number;
  }>;
  notes?: string;
  terms?: string;
  discount?: number;
}

export interface ZohoBomComponent {
  item_id: string;
  quantity: number;
  rate?: number;
  unit?: string;
  notes?: string;
}

export interface ZohoBomPayload {
  bom_name: string;
  item_id: string;
  output_quantity: number;
  components: ZohoBomComponent[];
  version?: string;
  notes?: string;
}

export interface ZohoApiResponse<T = any> {
  code: number;
  message: string;
  contact?: T;
  contacts?: T[];
  item?: T;
  items?: T[];
  salesorder?: T;
  salesorders?: T[];
  invoice?: T;
  invoices?: T[];
  estimate?: T;
  estimates?: T[];
  quote?: T;
  quotes?: T[];
  bom?: T;
  billofmaterials?: T[];
  data?: T[];
}
