import { config } from '../config/index.js';
import { zohoClient } from '../modules/zoho/zohoClient.js';
import { IZohoAdapter } from './zohoAdapterInterface.js';
import { ZohoBooksAdapter } from './zoho-books/zohoBooksAdapter.js';
import { ZohoInventoryAdapter } from './zoho-inventory/zohoInventoryAdapter.js';
import { ZohoCrmAdapter } from './zoho-crm/zohoCrmAdapter.js';

export function getZohoAdapter(): IZohoAdapter {
  switch (config.ZOHO_PRODUCT) {
    case 'zoho_inventory':
      return new ZohoInventoryAdapter(zohoClient);
    case 'zoho_crm':
      return new ZohoCrmAdapter(zohoClient);
    case 'zoho_books':
    default:
      return new ZohoBooksAdapter(zohoClient);
  }
}
