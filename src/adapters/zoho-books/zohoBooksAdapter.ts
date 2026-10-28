import { IZohoAdapter, SyncResult } from '../zohoAdapterInterface.js';
import { ZohoClient } from '../../modules/zoho/zohoClient.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload
} from '../../types/zoho.js';
import { logger } from '../../utils/logger.js';

export class ZohoBooksAdapter implements IZohoAdapter {
  productName: string = 'zoho_books';

  constructor(protected client: ZohoClient) {}

  async syncContact(contact: ZohoContactPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, contactName: contact.contact_name }, 'Updating Zoho Books contact');
      const res = await this.client.put(`/contacts/${existingZohoId}`, contact);
      const zohoId = res.contact?.contact_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ contactName: contact.contact_name }, 'Creating new Zoho Books contact');
    const res = await this.client.post('/contacts', contact);
    const zohoId = res.contact?.contact_id || (res as any).data?.id || `books_c_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async syncItem(item: ZohoItemPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, sku: item.sku }, 'Updating Zoho Books item');
      const res = await this.client.put(`/items/${existingZohoId}`, item);
      const zohoId = res.item?.item_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ sku: item.sku, name: item.name }, 'Creating new Zoho Books item');
    const res = await this.client.post('/items', item);
    const zohoId = res.item?.item_id || (res as any).data?.id || `books_item_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async syncSalesOrder(order: ZohoSalesOrderPayload, existingZohoId?: string): Promise<SyncResult> {
    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, soNumber: order.salesorder_number }, 'Updating Zoho Books sales order');
      const res = await this.client.put(`/salesorders/${existingZohoId}`, order);
      const zohoId = res.salesorder?.salesorder_id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ soNumber: order.salesorder_number }, 'Creating new Zoho Books sales order');
    const res = await this.client.post('/salesorders', order);
    const zohoId = res.salesorder?.salesorder_id || (res as any).data?.id || `books_so_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async findContactByExternalId(firebaseId: string, email?: string): Promise<string | null> {
    try {
      if (email) {
        const res = await this.client.get('/contacts', { email });
        const contacts = res.contacts || [];
        if (contacts.length > 0) {
          return contacts[0].contact_id;
        }
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, firebaseId, email }, 'Error querying contact in Zoho Books');
      return null;
    }
  }

  async findItemBySku(sku: string): Promise<string | null> {
    try {
      const res = await this.client.get('/items', { sku });
      const items = res.items || [];
      if (items.length > 0) {
        return items[0].item_id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, sku }, 'Error querying item by SKU in Zoho Books');
      return null;
    }
  }

  async findSalesOrderByReference(referenceNumber: string): Promise<string | null> {
    try {
      const res = await this.client.get('/salesorders', { reference_number: referenceNumber });
      const orders = res.salesorders || [];
      if (orders.length > 0) {
        return orders[0].salesorder_id;
      }
      return null;
    } catch (err: any) {
      logger.warn({ error: err.message, referenceNumber }, 'Error querying sales order by reference in Zoho Books');
      return null;
    }
  }
}
