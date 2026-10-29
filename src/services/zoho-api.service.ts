import { getZohoAdapter } from '../adapters/adapterFactory.js';
import { IZohoAdapter, SyncResult } from '../adapters/zohoAdapterInterface.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload,
  ZohoEstimatePayload,
  ZohoBomPayload
} from '../types/zoho.js';
import { logger } from '../utils/logger.js';

/**
 * Service providing direct access to Zoho ERP resources
 */
export class ZohoApiService {
  private get adapter(): IZohoAdapter {
    return getZohoAdapter();
  }

  async syncContact(contact: ZohoContactPayload, existingZohoId?: string): Promise<SyncResult> {
    return this.adapter.syncContact(contact, existingZohoId);
  }

  async syncItem(item: ZohoItemPayload, existingZohoId?: string): Promise<SyncResult> {
    return this.adapter.syncItem(item, existingZohoId);
  }

  async syncSalesOrder(order: ZohoSalesOrderPayload, existingZohoId?: string): Promise<SyncResult> {
    return this.adapter.syncSalesOrder(order, existingZohoId);
  }

  async syncQuote(quote: ZohoEstimatePayload, existingZohoId?: string): Promise<SyncResult> {
    return this.adapter.syncQuote(quote, existingZohoId);
  }

  async syncBom(bom: ZohoBomPayload, existingZohoId?: string): Promise<SyncResult> {
    if (!this.adapter.syncBom) {
      throw new Error(`BOM synchronization is not supported by adapter: ${this.adapter.productName}`);
    }
    return this.adapter.syncBom(bom, existingZohoId);
  }

  async findContactByExternalId(firebaseId: string, email?: string): Promise<string | null> {
    return this.adapter.findContactByExternalId(firebaseId, email);
  }

  async findItemBySku(sku: string): Promise<string | null> {
    return this.adapter.findItemBySku(sku);
  }

  async findSalesOrderByReference(referenceNumber: string): Promise<string | null> {
    return this.adapter.findSalesOrderByReference(referenceNumber);
  }

  async findQuoteByReference(referenceNumber: string): Promise<string | null> {
    return this.adapter.findQuoteByReference(referenceNumber);
  }

  async findBomByFinishedItem(itemId: string): Promise<string | null> {
    if (this.adapter.findBomByFinishedItem) {
      return this.adapter.findBomByFinishedItem(itemId);
    }
    return null;
  }
}

export const zohoApiService = new ZohoApiService();

