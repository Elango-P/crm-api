import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { crmRepository } from '../modules/firebase/crmRepository.js';
import { syncRepository } from '../modules/sync/syncRepository.js';
import { fieldMapper } from '../modules/sync/fieldMapper.js';
import { computeIdempotencyHash } from '../modules/sync/idempotency.js';
import { zohoApiService } from './zoho-api.service.js';
import { CustomerRecord } from '../types/crm.js';
import { logger } from '../utils/logger.js';
import { SyncOperationResult } from './sync-log.service.js';
import crypto from 'node:crypto';

export class UsersSyncService {
  /**
   * Fetch all user and customer records from Firestore (checking 'user', 'users', and 'customers')
   */
  async fetchUserRecords(batchSize = 100): Promise<CustomerRecord[]> {
    const db = getFirestoreDb();
    const recordsMap = new Map<string, CustomerRecord>();

    if (isRealFirebaseConfigured() && db) {
      const collectionsToCheck = ['user', 'users', 'customers'];
      for (const colName of collectionsToCheck) {
        try {
          const snapshot = await db.collection(colName).limit(batchSize).get();
          snapshot.forEach((doc) => {
            const data = doc.data() as any;
            if (!recordsMap.has(doc.id)) {
              recordsMap.set(doc.id, {
                id: doc.id,
                name: data.name || data.displayName || data.contact || data.company || 'User',
                email: data.email || `${doc.id}@example.com`,
                contact: data.contact || data.name || data.displayName,
                phone: data.phone || data.phoneNumber,
                company: data.company || data.name,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
              });
            }
          });
        } catch (err: any) {
          logger.warn({ error: err.message, collection: colName }, 'Failed to query users collection');
        }
      }
    }

    if (recordsMap.size === 0) {
      // In-memory fallback
      const inMemory = await crmRepository.getCustomers({ batchSize });
      inMemory.forEach((c) => recordsMap.set(c.id, c));
    }

    return Array.from(recordsMap.values());
  }

  /**
   * Synchronize Users / Customers to Zoho ERP
   */
  async syncUsers(batchSize = 100): Promise<SyncOperationResult> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();
    const records = await this.fetchUserRecords(batchSize);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    logger.info({ count: records.length, jobId }, 'Starting Users/Customers sync to Zoho ERP');

    for (const record of records) {
      try {
        const payload = fieldMapper.mapCustomerToZoho(record);
        const hash = computeIdempotencyHash(payload);

        // Check existing mapping
        const mapping = await syncRepository.getMapping('customer', record.id);

        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === hash) {
          skipped++;
          continue;
        }

        let existingZohoId = mapping?.zohoId;
        if (!existingZohoId) {
          existingZohoId = (await zohoApiService.findContactByExternalId(record.id, record.email)) || undefined;
        }

        const result = await zohoApiService.syncContact(payload, existingZohoId);

        if (result.action === 'created') created++;
        else updated++;

        await syncRepository.saveMapping({
          id: `customer_${record.id}`,
          entityType: 'customer',
          firebaseId: record.id,
          zohoId: result.zohoId,
          sourceCollection: 'customers',
          zohoModule: 'contacts',
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
        logger.error({ error: err.message, id: record.id }, 'Failed to sync user/customer record');

        await syncRepository.saveMapping({
          id: `customer_${record.id}`,
          entityType: 'customer',
          firebaseId: record.id,
          zohoId: '',
          sourceCollection: 'customers',
          zohoModule: 'contacts',
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
      entityType: 'users',
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

export const usersSyncService = new UsersSyncService();

