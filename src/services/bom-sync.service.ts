import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { crmRepository } from '../modules/firebase/crmRepository.js';
import { syncRepository } from '../modules/sync/syncRepository.js';
import { fieldMapper } from '../modules/sync/fieldMapper.js';
import { computeIdempotencyHash } from '../modules/sync/idempotency.js';
import { zohoApiService } from './zoho-api.service.js';
import { RfqRecord } from '../types/crm.js';
import { logger } from '../utils/logger.js';
import { SyncOperationResult } from './sync-log.service.js';
import crypto from 'node:crypto';

export class BomSyncService {
  async fetchBomRecords(batchSize = 100): Promise<RfqRecord[]> {
    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      try {
        const snapshot = await db.collection('rfqs').limit(batchSize).get();
        if (!snapshot.empty) {
          return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<RfqRecord, 'id'>)
          }));
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, 'Failed to query rfqs from Firestore for BOM sync');
      }
    }
    return crmRepository.getRfqs({ batchSize });
  }

  /**
   * Synchronize Bills of Materials (BOM) & dependent inventory to Zoho ERP
   */
  async syncBom(batchSize = 100): Promise<SyncOperationResult> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();
    const records = await this.fetchBomRecords(batchSize);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    logger.info({ count: records.length, jobId }, 'Starting Bill of Materials (BOM) sync to Zoho ERP');

    for (const record of records) {
      try {
        if (!record.productLines || record.productLines.length === 0) {
          logger.info({ rfqNumber: record.rfqNumber }, 'Skipping BOM sync for RFQ with no product lines/components');
          skipped++;
          continue;
        }

        // 1. Sync Component Raw Materials to /erp/v3/items
        const resolvedItemMap = new Map<string, string>();
        for (const line of record.productLines) {
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

        // 2. Sync Finished Product Item to /erp/v3/items
        const finishedSku = record.partNumber || `FG-${record.rfqNumber}`;
        let finishedItemMapping = await syncRepository.getMapping('item', finishedSku);
        let finishedItemId = finishedItemMapping?.zohoId;

        if (!finishedItemId) {
          finishedItemId = (await zohoApiService.findItemBySku(finishedSku)) || undefined;
        }

        if (!finishedItemId) {
          const finishedPayload = {
            name: record.productName,
            sku: finishedSku,
            rate: record.totalValue && record.quantity ? Math.round(record.totalValue / record.quantity) : 0,
            description: `Finished Good Assembly: ${record.productName}`,
            product_type: 'goods' as const,
            item_type: 'inventory' as const
          };
          const res = await zohoApiService.syncItem(finishedPayload);
          finishedItemId = res.zohoId;

          await syncRepository.saveMapping({
            id: `item_${finishedSku}`,
            entityType: 'item',
            firebaseId: finishedSku,
            zohoId: finishedItemId,
            sourceCollection: 'items',
            zohoModule: 'items',
            lastSyncedHash: computeIdempotencyHash(finishedPayload),
            syncStatus: 'SYNCED',
            attemptCount: 1,
            lastAttemptAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString()
          });
        }

        // 3. Map to Zoho ERP Bill of Materials
        const bomPayload = fieldMapper.mapRfqToZohoBom(record, finishedItemId, resolvedItemMap);
        const hash = computeIdempotencyHash(bomPayload);

        // 4. Check BOM mapping
        const mapping = await syncRepository.getMapping('bom', record.id);
        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === hash) {
          skipped++;
          continue;
        }

        let existingZohoId = mapping?.zohoId;
        if (!existingZohoId) {
          existingZohoId = (await zohoApiService.findBomByFinishedItem(finishedItemId)) || undefined;
        }

        const result = await zohoApiService.syncBom(bomPayload, existingZohoId);

        if (result.action === 'created') created++;
        else updated++;

        await syncRepository.saveMapping({
          id: `bom_${record.id}`,
          entityType: 'bom',
          firebaseId: record.id,
          zohoId: result.zohoId,
          sourceCollection: 'rfqs',
          zohoModule: 'billofmaterials',
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
        logger.error({ error: err.message, id: record.id }, 'Failed to sync BOM to Zoho ERP');

        await syncRepository.saveMapping({
          id: `bom_${record.id}`,
          entityType: 'bom',
          firebaseId: record.id,
          zohoId: '',
          sourceCollection: 'rfqs',
          zohoModule: 'billofmaterials',
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
      entityType: 'bom',
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

export const bomSyncService = new BomSyncService();

