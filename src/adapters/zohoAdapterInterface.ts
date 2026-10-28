import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload
} from '../types/zoho.js';

export interface SyncResult {
  zohoId: string;
  action: 'created' | 'updated';
}

export interface IZohoAdapter {
  readonly productName: string;

  syncContact(contact: ZohoContactPayload, existingZohoId?: string): Promise<SyncResult>;
  syncItem(item: ZohoItemPayload, existingZohoId?: string): Promise<SyncResult>;
  syncSalesOrder(order: ZohoSalesOrderPayload, existingZohoId?: string): Promise<SyncResult>;

  findContactByExternalId(firebaseId: string, email?: string): Promise<string | null>;
  findItemBySku(sku: string): Promise<string | null>;
  findSalesOrderByReference(referenceNumber: string): Promise<string | null>;
}
