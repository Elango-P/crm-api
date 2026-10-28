import { ZohoBooksAdapter } from '../zoho-books/zohoBooksAdapter.js';
import { ZohoClient } from '../../modules/zoho/zohoClient.js';

export class ZohoInventoryAdapter extends ZohoBooksAdapter {
  override productName = 'zoho_inventory';

  constructor(client: ZohoClient) {
    super(client);
  }
}
