import crypto from 'node:crypto';
import { crmRepository } from '../firebase/crmRepository.js';
import { syncRepository } from './syncRepository.js';
import { fieldMapper } from './fieldMapper.js';
import { idempotencyManager } from './idempotency.js';
import { getZohoAdapter } from '../../adapters/adapterFactory.js';
import { hashPayload } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import { CustomerRecord, RfqRecord } from '../../types/crm.js';
import { SyncJobLog, SyncMapping } from '../../types/sync.js';
import { config } from '../../config/index.js';

export class SyncEngine {
  /**
   * Run synchronization (either incremental or full)
   */
  async runSync(options: { mode: 'FULL' | 'INCREMENTAL'; tenantId?: string }): Promise<SyncJobLog> {
    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const adapter = getZohoAdapter();

    const jobLog: SyncJobLog = {
      id: jobId,
      jobType: options.mode,
      status: 'RUNNING',
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalFailed: 0,
      startedAt,
      errors: []
    };

    logger.info({ jobId, mode: options.mode, adapter: adapter.productName }, 'Starting synchronization job');

    try {
      // 1. If full sync, reset checkpoints
      if (options.mode === 'FULL') {
        await syncRepository.resetCheckpoint('customer');
        await syncRepository.resetCheckpoint('item');
        await syncRepository.resetCheckpoint('sales_order');
      }

      // 2. Sync Customers first (dependency for orders)
      await this.syncCustomers(jobLog, options);

      // 3. Sync RFQs & Line Items (Orders depend on customers and items)
      await this.syncRfqs(jobLog, options);

      jobLog.completedAt = new Date().toISOString();
      jobLog.durationMs = Date.now() - new Date(startedAt).getTime();
      jobLog.status = jobLog.totalFailed === 0 ? 'SUCCESS' : jobLog.totalProcessed > jobLog.totalFailed ? 'PARTIAL' : 'FAILED';

      logger.info(
        {
          jobId,
          status: jobLog.status,
          processed: jobLog.totalProcessed,
          created: jobLog.totalCreated,
          updated: jobLog.totalUpdated,
          failed: jobLog.totalFailed,
          durationMs: jobLog.durationMs
        },
        'Synchronization job finished'
      );
    } catch (criticalError: any) {
      jobLog.status = 'FAILED';
      jobLog.completedAt = new Date().toISOString();
      jobLog.durationMs = Date.now() - new Date(startedAt).getTime();
      jobLog.errors.push({
        entityType: 'customer',
        firebaseId: 'SYSTEM',
        message: `Fatal error: ${criticalError.message}`,
        timestamp: new Date().toISOString()
      });
      logger.error({ jobId, error: criticalError.message }, 'Fatal error in synchronization engine');
    }

    await syncRepository.logJob(jobLog);
    return jobLog;
  }

  /**
   * Synchronize customer records
   */
  private async syncCustomers(
    jobLog: SyncJobLog,
    options: { mode: 'FULL' | 'INCREMENTAL'; tenantId?: string }
  ): Promise<void> {
    const adapter = getZohoAdapter();
    const checkpoint = await syncRepository.getCheckpoint('customer');
    const watermark = options.mode === 'INCREMENTAL' ? checkpoint.lastWatermark : undefined;

    let highestWatermark = checkpoint.lastWatermark;
    const customers = await crmRepository.getCustomers({
      watermark,
      tenantId: options.tenantId,
      batchSize: config.SYNC_BATCH_SIZE
    });

    for (const customer of customers) {
      jobLog.totalProcessed++;
      const mapping = await syncRepository.getMapping('customer', customer.id);

      try {
        const payload = fieldMapper.mapCustomerToZoho(customer);
        const payloadHash = hashPayload(payload);

        // Check if unchanged (idempotency)
        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === payloadHash) {
          logger.debug({ customerId: customer.id }, 'Customer payload unchanged. Skipping.');
          continue;
        }

        // Check if existing in Zoho via timeout recovery
        let zohoId = mapping?.zohoId;
        if (!zohoId) {
          zohoId = (await idempotencyManager.discoverExistingZohoRecord(adapter, 'customer', {
            firebaseId: customer.id,
            email: customer.email
          })) || undefined;
        }

        const result = await adapter.syncContact(payload, zohoId);

        if (result.action === 'created') jobLog.totalCreated++;
        else jobLog.totalUpdated++;

        // Save mapping
        await syncRepository.saveMapping({
          id: `customer_${customer.id}`,
          entityType: 'customer',
          firebaseId: customer.id,
          zohoId: result.zohoId,
          lastSyncedHash: payloadHash,
          syncStatus: 'SYNCED',
          attemptCount: (mapping?.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          lastError: null
        });

        if (customer.updatedAt && customer.updatedAt > highestWatermark) {
          highestWatermark = customer.updatedAt;
        }
      } catch (err: any) {
        jobLog.totalFailed++;
        const errorMessage = err.message || 'Unknown customer sync error';
        jobLog.errors.push({
          entityType: 'customer',
          firebaseId: customer.id,
          message: errorMessage,
          timestamp: new Date().toISOString()
        });

        await syncRepository.saveMapping({
          id: `customer_${customer.id}`,
          entityType: 'customer',
          firebaseId: customer.id,
          zohoId: mapping?.zohoId || '',
          lastSyncedHash: mapping?.lastSyncedHash || '',
          syncStatus: 'FAILED',
          attemptCount: (mapping?.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: errorMessage
        });

        logger.error({ customerId: customer.id, error: errorMessage }, 'Failed to sync customer');
      }
    }

    // Update customer checkpoint
    await syncRepository.updateCheckpoint({
      id: 'customer',
      lastWatermark: highestWatermark,
      lastSyncCompletedAt: new Date().toISOString(),
      status: 'IDLE',
      totalProcessedCount: checkpoint.totalProcessedCount + customers.length
    });
  }

  /**
   * Synchronize RFQs, line items, and sales orders
   */
  private async syncRfqs(
    jobLog: SyncJobLog,
    options: { mode: 'FULL' | 'INCREMENTAL'; tenantId?: string }
  ): Promise<void> {
    const adapter = getZohoAdapter();
    const checkpoint = await syncRepository.getCheckpoint('sales_order');
    const watermark = options.mode === 'INCREMENTAL' ? checkpoint.lastWatermark : undefined;

    let highestWatermark = checkpoint.lastWatermark;
    const rfqs = await crmRepository.getRfqs({
      watermark,
      tenantId: options.tenantId,
      batchSize: config.SYNC_BATCH_SIZE
    });

    for (const rfq of rfqs) {
      jobLog.totalProcessed++;
      const mapping = await syncRepository.getMapping('sales_order', rfq.id);

      try {
        // 1. Resolve Customer Zoho ID
        const customerMapping = await syncRepository.getMapping('customer', rfq.customerId);
        let zohoCustomerId = customerMapping?.zohoId;

        if (!zohoCustomerId) {
          // Attempt to sync the missing customer just-in-time
          const customer = await crmRepository.getCustomerById(rfq.customerId);
          if (customer) {
            const custPayload = fieldMapper.mapCustomerToZoho(customer);
            const custRes = await adapter.syncContact(custPayload);
            zohoCustomerId = custRes.zohoId;
            await syncRepository.saveMapping({
              id: `customer_${customer.id}`,
              entityType: 'customer',
              firebaseId: customer.id,
              zohoId: custRes.zohoId,
              lastSyncedHash: hashPayload(custPayload),
              syncStatus: 'SYNCED',
              attemptCount: 1,
              lastAttemptAt: new Date().toISOString(),
              lastSuccessAt: new Date().toISOString()
            });
          }
        }

        if (!zohoCustomerId) {
          throw new Error(`Customer mapping not found for customerId: ${rfq.customerId}`);
        }

        // 2. Sync product line items to Zoho Items
        const resolvedItemMap = new Map<string, string>();
        for (const line of rfq.productLines || []) {
          const itemMapping = await syncRepository.getMapping('item', line.sku);
          let zohoItemId = itemMapping?.zohoId;

          if (!zohoItemId) {
            zohoItemId = (await idempotencyManager.discoverExistingZohoRecord(adapter, 'item', {
              firebaseId: line.sku,
              sku: line.sku
            })) || undefined;
          }

          const itemPayload = fieldMapper.mapProductLineToZoho(line);
          const itemRes = await adapter.syncItem(itemPayload, zohoItemId);
          resolvedItemMap.set(line.sku, itemRes.zohoId);

          await syncRepository.saveMapping({
            id: `item_${line.sku}`,
            entityType: 'item',
            firebaseId: line.sku,
            zohoId: itemRes.zohoId,
            lastSyncedHash: hashPayload(itemPayload),
            syncStatus: 'SYNCED',
            attemptCount: (itemMapping?.attemptCount || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            lastSuccessAt: new Date().toISOString()
          });
        }

        // 3. Map and sync Sales Order / Quote
        const orderPayload = fieldMapper.mapRfqToZohoSalesOrder(rfq, zohoCustomerId, resolvedItemMap);
        const orderHash = hashPayload(orderPayload);

        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === orderHash) {
          logger.debug({ rfqId: rfq.id }, 'Sales Order payload unchanged. Skipping.');
          continue;
        }

        let zohoOrderId = mapping?.zohoId;
        if (!zohoOrderId) {
          zohoOrderId = (await idempotencyManager.discoverExistingZohoRecord(adapter, 'sales_order', {
            firebaseId: rfq.id,
            referenceNumber: rfq.rfqNumber
          })) || undefined;
        }

        const result = await adapter.syncSalesOrder(orderPayload, zohoOrderId);

        if (result.action === 'created') jobLog.totalCreated++;
        else jobLog.totalUpdated++;

        await syncRepository.saveMapping({
          id: `sales_order_${rfq.id}`,
          entityType: 'sales_order',
          firebaseId: rfq.id,
          zohoId: result.zohoId,
          lastSyncedHash: orderHash,
          syncStatus: 'SYNCED',
          attemptCount: (mapping?.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          lastError: null
        });

        if (rfq.updatedAt && rfq.updatedAt > highestWatermark) {
          highestWatermark = rfq.updatedAt;
        }
      } catch (err: any) {
        jobLog.totalFailed++;
        const errorMessage = err.message || 'Unknown RFQ sync error';
        jobLog.errors.push({
          entityType: 'sales_order',
          firebaseId: rfq.id,
          message: errorMessage,
          timestamp: new Date().toISOString()
        });

        await syncRepository.saveMapping({
          id: `sales_order_${rfq.id}`,
          entityType: 'sales_order',
          firebaseId: rfq.id,
          zohoId: mapping?.zohoId || '',
          lastSyncedHash: mapping?.lastSyncedHash || '',
          syncStatus: 'FAILED',
          attemptCount: (mapping?.attemptCount || 0) + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: errorMessage
        });

        logger.error({ rfqId: rfq.id, error: errorMessage }, 'Failed to sync RFQ/Sales Order');
      }
    }

    // Update sales_order checkpoint
    await syncRepository.updateCheckpoint({
      id: 'sales_order',
      lastWatermark: highestWatermark,
      lastSyncCompletedAt: new Date().toISOString(),
      status: 'IDLE',
      totalProcessedCount: checkpoint.totalProcessedCount + rfqs.length
    });
  }

  /**
   * Retry failed records up to maxRetries
   */
  async retryFailedRecords(): Promise<{ retriedCount: number; succeededCount: number; stillFailedCount: number }> {
    const failedMappings = await syncRepository.getFailedMappings(config.SYNC_MAX_RETRIES);
    let succeededCount = 0;
    let stillFailedCount = 0;
    const adapter = getZohoAdapter();

    logger.info({ count: failedMappings.length }, 'Retrying failed sync mappings');

    for (const mapping of failedMappings) {
      try {
        if (mapping.entityType === 'customer') {
          const customer = await crmRepository.getCustomerById(mapping.firebaseId);
          if (customer) {
            const payload = fieldMapper.mapCustomerToZoho(customer);
            const res = await adapter.syncContact(payload, mapping.zohoId || undefined);
            await syncRepository.saveMapping({
              ...mapping,
              zohoId: res.zohoId,
              syncStatus: 'SYNCED',
              lastSyncedHash: hashPayload(payload),
              lastAttemptAt: new Date().toISOString(),
              lastSuccessAt: new Date().toISOString(),
              lastError: null
            });
            succeededCount++;
            continue;
          }
        } else if (mapping.entityType === 'sales_order') {
          const rfq = await crmRepository.getRfqById(mapping.firebaseId);
          if (rfq) {
            const customerMapping = await syncRepository.getMapping('customer', rfq.customerId);
            if (customerMapping?.zohoId) {
              const orderPayload = fieldMapper.mapRfqToZohoSalesOrder(rfq, customerMapping.zohoId, new Map());
              const res = await adapter.syncSalesOrder(orderPayload, mapping.zohoId || undefined);
              await syncRepository.saveMapping({
                ...mapping,
                zohoId: res.zohoId,
                syncStatus: 'SYNCED',
                lastSyncedHash: hashPayload(orderPayload),
                lastAttemptAt: new Date().toISOString(),
                lastSuccessAt: new Date().toISOString(),
                lastError: null
              });
              succeededCount++;
              continue;
            }
          }
        }
        stillFailedCount++;
      } catch (err: any) {
        stillFailedCount++;
        await syncRepository.saveMapping({
          ...mapping,
          attemptCount: mapping.attemptCount + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: err.message
        });
      }
    }

    return {
      retriedCount: failedMappings.length,
      succeededCount,
      stillFailedCount
    };
  }
}

export const syncEngine = new SyncEngine();
