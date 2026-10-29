import { hashPayload } from '../../utils/crypto.js';
import { SyncMapping } from '../../types/sync.js';
import { IZohoAdapter } from '../../adapters/zohoAdapterInterface.js';
import { logger } from '../../utils/logger.js';

export class IdempotencyManager {
  /**
   * Determine if the payload has changed since the last successful sync
   */
  hasChanged(payload: unknown, existingMapping: SyncMapping | null): boolean {
    if (!existingMapping || existingMapping.syncStatus !== 'SYNCED') {
      return true;
    }

    const currentHash = hashPayload(payload);
    return currentHash !== existingMapping.lastSyncedHash;
  }

  /**
   * Check if a record already exists in Zoho to recover from timeouts
   */
  async discoverExistingZohoRecord(
    adapter: IZohoAdapter,
    entityType: 'customer' | 'item' | 'sales_order' | 'quote',
    identifier: { firebaseId: string; email?: string; sku?: string; referenceNumber?: string }
  ): Promise<string | null> {
    try {
      if (entityType === 'customer') {
        return await adapter.findContactByExternalId(identifier.firebaseId, identifier.email);
      }
      if (entityType === 'item' && identifier.sku) {
        return await adapter.findItemBySku(identifier.sku);
      }
      if (entityType === 'sales_order' && identifier.referenceNumber) {
        return await adapter.findSalesOrderByReference(identifier.referenceNumber);
      }
      if (entityType === 'quote' && identifier.referenceNumber) {
        return await adapter.findQuoteByReference(identifier.referenceNumber);
      }
    } catch (err: any) {
      logger.warn({ error: err.message, entityType, identifier }, 'Failed to query Zoho for existing record during idempotency check');
    }
    return null;
  }
}

export const idempotencyManager = new IdempotencyManager();
