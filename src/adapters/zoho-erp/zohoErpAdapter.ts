import { IZohoAdapter, SyncResult } from '../zohoAdapterInterface.js';
import { ZohoClient } from '../../modules/zoho/zohoClient.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload,
  ZohoEstimatePayload,
  ZohoBomPayload
} from '../../types/zoho.js';
import { logger } from '../../utils/logger.js';

/**
 * Direct Zoho ERP v3 Adapter
 * Connects directly to Zoho ERP (https://erp.zoho.in / https://www.zohoapis.in/erp/v3)
 * without using Zoho Books or Zoho CRM as an intermediary.
 */
export class ZohoErpAdapter implements IZohoAdapter {
  readonly productName: string = 'zoho_erp';

  constructor(protected client: ZohoClient) {}

  /**
   * Sync a User/Customer contact directly to Zoho ERP (/erp/v3/contacts)
   */
  async syncContact(contact: ZohoContactPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, contactName: contact.contact_name }, 'Updating Zoho ERP contact');
      const res = await this.client.put(`/contacts/${existingZohoId}`, contact);
      const zohoId = res.contact?.contact_id || (res as any).contact_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ contactName: contact.contact_name }, 'Creating new Zoho ERP contact');
    try {
      const res = await this.client.post('/contacts', contact);
      const zohoId = res.contact?.contact_id || (res as any).contact_id || (res as any).data?.id || `erp_contact_${Date.now()}`;
      return { zohoId, action: 'created' };
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('Duplicate contact') || err.message?.includes('code 36014')) {
        const found = await this.findContactByExternalId(contact.contact_name, contact.email);
        if (found) {
          return { zohoId: found, action: 'updated' };
        }
      }
      throw err;
    }
  }

  /**
   * Sync raw material or finished product item directly to Zoho ERP (/erp/v3/items)
   */
  async syncItem(item: ZohoItemPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, sku: item.sku }, 'Updating Zoho ERP item');
      const res = await this.client.put(`/items/${existingZohoId}`, item);
      const zohoId = res.item?.item_id || (res as any).item_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ sku: item.sku, name: item.name }, 'Creating new Zoho ERP item');
    try {
      const res = await this.client.post('/items', item);
      const zohoId = res.item?.item_id || (res as any).item_id || (res as any).data?.id || `erp_item_${Date.now()}`;
      return { zohoId, action: 'created' };
    } catch (err: any) {
      if (err.message?.includes('already exists') || err.message?.includes('duplicate') || err.message?.includes('code 36014') || err.message?.includes('already been taken')) {
        const found = await this.findItemBySku(item.sku);
        if (found) {
          return { zohoId: found, action: 'updated' };
        }
      }
      throw err;
    }
  }

  /**
   * Sync sales order directly to Zoho ERP (/erp/v3/salesorders)
   */
  async syncSalesOrder(order: ZohoSalesOrderPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, soNumber: order.salesorder_number }, 'Updating Zoho ERP sales order');
      const res = await this.client.put(`/salesorders/${existingZohoId}`, order);
      const zohoId = res.salesorder?.salesorder_id || (res as any).salesorder_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ soNumber: order.salesorder_number }, 'Creating new Zoho ERP sales order');
    const res = await this.client.post('/salesorders', order, { ignore_auto_number_generation: 'true' });
    const zohoId = res.salesorder?.salesorder_id || (res as any).salesorder_id || (res as any).data?.id || `erp_so_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  /**
   * Sync quote / quotation directly to Zoho ERP (/erp/v3/estimates)
   */
  async syncQuote(quote: ZohoEstimatePayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, estimateNumber: quote.estimate_number }, 'Updating Zoho ERP estimate/quote');
      const res = await this.client.put(`/estimates/${existingZohoId}`, quote);
      const zohoId = res.estimate?.estimate_id || (res as any).quote?.quote_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ estimateNumber: quote.estimate_number }, 'Creating new Zoho ERP estimate/quote');
    const res = await this.client.post('/estimates', quote, { ignore_auto_number_generation: 'true' });
    const zohoId = res.estimate?.estimate_id || (res as any).quote?.quote_id || (res as any).data?.id || `erp_est_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  /**
   * Sync Bill of Materials (BOM) directly to Zoho ERP Manufacturing (/erp/v3/billofmaterials)
   */
  async syncBom(bom: ZohoBomPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, bomName: bom.bom_name }, 'Updating Zoho ERP Bill of Materials');
      const res = await this.client.put(`/billofmaterials/${existingZohoId}`, bom);
      const zohoId = (res as any).bom?.bom_id || (res as any).bom_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ bomName: bom.bom_name, itemId: bom.item_id }, 'Creating new Zoho ERP Bill of Materials');
    const res = await this.client.post('/billofmaterials', bom);
    const zohoId = (res as any).bom?.bom_id || (res as any).bom_id || (res as any).data?.id || `erp_bom_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  /**
   * Find an existing Zoho ERP contact by email or external ID
   */
  async findContactByExternalId(firebaseId: string, email?: string): Promise<string | null> {
    try {
      if (email) {
        const res = await this.client.get('/contacts', { email });
        const contacts = res.contacts || (res as any).data || [];
        if (contacts.length > 0) {
          return contacts[0].contact_id || contacts[0].id;
        }
      }

      // Search by search_text (name or custom query)
      const res = await this.client.get('/contacts', { search_text: firebaseId });
      const contacts = res.contacts || (res as any).data || [];
      if (contacts.length > 0) {
        return contacts[0].contact_id || contacts[0].id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, firebaseId }, 'Failed to lookup Zoho ERP contact');
      return null;
    }
  }

  /**
   * Find an existing Zoho ERP item by SKU
   */
  async findItemBySku(sku: string): Promise<string | null> {
    try {
      const res = await this.client.get('/items', { sku });
      const items = res.items || (res as any).data || [];
      const match = items.find((i: any) => i.sku?.toLowerCase() === sku.toLowerCase());
      if (match) {
        return match.item_id || match.id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, sku }, 'Failed to lookup Zoho ERP item');
      return null;
    }
  }

  /**
   * Find an existing Zoho ERP sales order by reference number / order number
   */
  async findSalesOrderByReference(referenceNumber: string): Promise<string | null> {
    try {
      const res = await this.client.get('/salesorders', { search_text: referenceNumber });
      const orders = res.salesorders || (res as any).data || [];
      const match = orders.find((o: any) =>
        o.reference_number?.toLowerCase() === referenceNumber.toLowerCase() ||
        o.salesorder_number?.toLowerCase() === referenceNumber.toLowerCase()
      );
      if (match) {
        return match.salesorder_id || match.id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, referenceNumber }, 'Failed to lookup Zoho ERP sales order');
      return null;
    }
  }

  /**
   * Find an existing Zoho ERP quote/estimate by quote number or reference number
   */
  async findQuoteByReference(referenceNumber: string): Promise<string | null> {
    try {
      const res = await this.client.get('/estimates', { search_text: referenceNumber });
      const quotes = res.estimates || (res as any).quotes || (res as any).data || [];
      const match = quotes.find((q: any) =>
        q.reference_number?.toLowerCase() === referenceNumber.toLowerCase() ||
        q.estimate_number?.toLowerCase() === referenceNumber.toLowerCase()
      );
      if (match) {
        return match.estimate_id || match.quote_id || match.id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, referenceNumber }, 'Failed to lookup Zoho ERP estimate');
      return null;
    }
  }

  /**
   * Find existing Bill of Materials for a finished good item
   */
  async findBomByFinishedItem(itemId: string): Promise<string | null> {
    try {
      const res = await this.client.get('/billofmaterials', { item_id: itemId });
      const boms = (res as any).billofmaterials || (res as any).boms || (res as any).data || [];
      const match = boms.find((b: any) => b.item_id === itemId);
      if (match) {
        return match.bom_id || match.id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, itemId }, 'Failed to lookup Zoho ERP BOM');
      return null;
    }
  }
}

