import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { crmRepository } from '../modules/firebase/crmRepository.js';
import { syncRepository } from '../modules/sync/syncRepository.js';
import { fieldMapper } from '../modules/sync/fieldMapper.js';
import { computeIdempotencyHash } from '../modules/sync/idempotency.js';
import { zohoApiService } from './zoho-api.service.js';
import { QuoteRecord } from '../types/crm.js';
import { logger } from '../utils/logger.js';
import { SyncOperationResult } from './sync-log.service.js';
import crypto from 'node:crypto';

export class QuotesSyncService {
  async fetchQuoteRecords(batchSize = 100): Promise<QuoteRecord[]> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      try {
        const snapshot = await db.collection('quotes').limit(batchSize).get();
        if (!snapshot.empty) {
          return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<QuoteRecord, 'id'>)
          }));
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, 'Failed to query quotes from Firestore, falling back');
      }
    }
    return crmRepository.getQuotes({ batchSize });
  }

  async syncQuotes(batchSize = 100): Promise<SyncOperationResult> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();
    const records = await this.fetchQuoteRecords(batchSize);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    logger.info({ count: records.length, jobId }, 'Starting Quotes sync to Zoho ERP');

    for (const record of records) {
      try {
        // 1. Resolve customer mapping
        let customerMapping = await syncRepository.getMapping('customer', record.customerId);
        let zohoCustomerId = customerMapping?.zohoId;

        if (!zohoCustomerId) {
          zohoCustomerId = (await zohoApiService.findContactByExternalId(record.customerName || record.customerId, record.email)) || undefined;
        }

        // If customer doesn't exist yet, auto-create contact in Zoho ERP
        if (!zohoCustomerId) {
          const contactRes = await zohoApiService.syncContact({
            contact_name: record.customerName || `Customer-${record.customerId}`,
            company_name: record.customerName,
            email: record.email,
            phone: record.phone,
            contact_type: 'customer',
            notes: `Auto-created during quote sync for customer ID: ${record.customerId}`
          });
          zohoCustomerId = contactRes.zohoId;

          await syncRepository.saveMapping({
            id: `customer_${record.customerId}`,
            entityType: 'customer',
            firebaseId: record.customerId,
            zohoId: zohoCustomerId,
            sourceCollection: 'customers',
            zohoModule: 'contacts',
            lastSyncedHash: '',
            syncStatus: 'SYNCED',
            attemptCount: 1,
            lastAttemptAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString()
          });
        }

        // 2. Resolve line items in Zoho ERP
        const resolvedItemMap = new Map<string, string>();
        for (const line of record.lineItems || []) {
          let itemMapping = await syncRepository.getMapping('item', line.sku);
          let zohoItemId = itemMapping?.zohoId;

          if (!zohoItemId) {
            zohoItemId = (await zohoApiService.findItemBySku(line.sku)) || undefined;
          }

          if (!zohoItemId) {
            const itemPayload = fieldMapper.mapProductLineToZoho(line);
            const itemRes = await zohoApiService.syncItem(itemPayload);
            zohoItemId = itemRes.zohoId;

            await syncRepository.saveMapping({
              id: `item_${line.sku}`,
              entityType: 'item',
              firebaseId: line.sku,
              zohoId: zohoItemId,
              sourceCollection: 'items',
              zohoModule: 'items',
              lastSyncedHash: computeIdempotencyHash(itemPayload),
              syncStatus: 'SYNCED',
              attemptCount: 1,
              lastAttemptAt: new Date().toISOString(),
              lastSuccessAt: new Date().toISOString()
            });
          }

          if (zohoItemId) {
            resolvedItemMap.set(line.sku, zohoItemId);
          }
        }

        // 3. Map Quote -> Zoho Estimate
        const payload = fieldMapper.mapQuoteToZohoEstimate(record, zohoCustomerId, resolvedItemMap);
        const hash = computeIdempotencyHash(payload);

        // 4. Check idempotency mapping
        const mapping = await syncRepository.getMapping('quote', record.id);
        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === hash) {
          skipped++;
          continue;
        }

        let existingZohoId = mapping?.zohoId;
        if (!existingZohoId) {
          existingZohoId = (await zohoApiService.findQuoteByReference(record.quoteNumber)) || undefined;
        }

        const result = await zohoApiService.syncQuote(payload, existingZohoId);

        if (result.action === 'created') created++;
        else updated++;

        await syncRepository.saveMapping({
          id: `quote_${record.id}`,
          entityType: 'quote',
          firebaseId: record.id,
          zohoId: result.zohoId,
          sourceCollection: 'quotes',
          zohoModule: 'estimates',
          sourceUpdatedAt: record.updatedAt || new Date().toISOString(),
          lastSyncedHash: hash,
          syncStatus: 'SYNCED',
          attemptCount: (mapping?.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          lastError: null
        });
      } catch (err: any) {
        failed++;
        errors.push({ id: record.id, message: err.message });
        logger.error({ error: err.message, id: record.id }, 'Failed to sync quote to Zoho ERP');

        await syncRepository.saveMapping({
          id: `quote_${record.id}`,
          entityType: 'quote',
          firebaseId: record.id,
          zohoId: '',
          sourceCollection: 'quotes',
          zohoModule: 'estimates',
          lastSyncedHash: '',
          syncStatus: 'FAILED',
          attemptCount: 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: err.message
        });
      }
    }

    return {
      jobId,
      entityType: 'quotes',
      processed: records.length,
      created,
      updated,
      skipped,
      failed,
      durationMs: Date.now() - startTime,
      errors
    };
  }
}

export const quotesSyncService = new QuotesSyncService();

