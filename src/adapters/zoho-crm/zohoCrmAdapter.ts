import { IZohoAdapter, SyncResult } from '../zohoAdapterInterface.js';
import { ZohoClient } from '../../modules/zoho/zohoClient.js';
import {
  ZohoContactPayload,
  ZohoItemPayload,
  ZohoSalesOrderPayload
} from '../../types/zoho.js';
import { logger } from '../../utils/logger.js';

export class ZohoCrmAdapter implements IZohoAdapter {
  readonly productName = 'zoho_crm';

  constructor(private client: ZohoClient) {}

  async syncContact(contact: ZohoContactPayload, existingZohoId?: string): Promise<SyncResult> {
    const names = (contact.contact_name || 'Valued Customer').split(' ');
    const firstName = names.length > 1 ? names.slice(0, -1).join(' ') : '';
    const lastName = names[names.length - 1] || 'Customer';

    const payload = {
      data: [
        {
          id: existingZohoId,
          First_Name: firstName,
          Last_Name: lastName,
          Email: contact.email,
          Phone: contact.phone,
          Account_Name: contact.company_name
        }
      ]
    };

    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId }, 'Updating Zoho CRM contact');
      const res = await this.client.put('/Contacts', payload);
      const zohoId = res.data?.[0]?.details?.id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ contactName: contact.contact_name }, 'Creating new Zoho CRM contact');
    const res = await this.client.post('/Contacts', payload);
    const zohoId = res.data?.[0]?.details?.id || `crm_c_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async syncItem(item: ZohoItemPayload, existingZohoId?: string): Promise<SyncResult> {
    const payload = {
      data: [
        {
          id: existingZohoId,
          Product_Name: item.name,
          Product_Code: item.sku,
          Unit_Price: item.rate,
          Description: item.description
        }
      ]
    };

    if (existingZohoId) {
      logger.info({ zohoId: existingZohoId, sku: item.sku }, 'Updating Zoho CRM product');
      const res = await this.client.put('/Products', payload);
      const zohoId = res.data?.[0]?.details?.id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    logger.info({ sku: item.sku }, 'Creating new Zoho CRM product');
    const res = await this.client.post('/Products', payload);
    const zohoId = res.data?.[0]?.details?.id || `crm_prod_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async syncSalesOrder(order: ZohoSalesOrderPayload, existingZohoId?: string): Promise<SyncResult> {
    const payload = {
      data: [
        {
          id: existingZohoId,
          Subject: `Order ${order.salesorder_number}`,
          Contact_Name: { id: order.customer_id },
          Ordered_Items: order.line_items.map((line) => ({
            Product_Name: line.item_id ? { id: line.item_id } : undefined,
            Product_Description: line.description || line.name,
            List_Price: line.rate,
            Quantity: line.quantity
          }))
        }
      ]
    };

    if (existingZohoId) {
      const res = await this.client.put('/Sales_Orders', payload);
      const zohoId = res.data?.[0]?.details?.id || existingZohoId;
      return { zohoId, action: 'updated' };
    }

    const res = await this.client.post('/Sales_Orders', payload);
    const zohoId = res.data?.[0]?.details?.id || `crm_so_${Date.now()}`;
    return { zohoId, action: 'created' };
  }

  async findContactByExternalId(firebaseId: string, email?: string): Promise<string | null> {
    try {
      if (email) {
        const res = await this.client.get('/Contacts/search', { email });
        const record = res.data?.[0];
        if (record?.id) return record.id;
      }
      return null;
    } catch {
      return null;
    }
  }

  async findItemBySku(sku: string): Promise<string | null> {
    try {
      const res = await this.client.get('/Products/search', { criteria: `Product_Code:equals:${sku}` });
      const record = res.data?.[0];
      if (record?.id) return record.id;
      return null;
    } catch {
      return null;
    }
  }

  async findSalesOrderByReference(referenceNumber: string): Promise<string | null> {
    return null;
  }
}
