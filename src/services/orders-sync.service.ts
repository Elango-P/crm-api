import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { crmRepository } from '../modules/firebase/crmRepository.js';
import { syncRepository } from '../modules/sync/syncRepository.js';
import { fieldMapper } from '../modules/sync/fieldMapper.js';
import { computeIdempotencyHash } from '../modules/sync/idempotency.js';
import { zohoApiService } from './zoho-api.service.js';
import { SalesOrderRecord } from '../types/crm.js';
import { logger } from '../utils/logger.js';
import { SyncOperationResult } from './sync-log.service.js';
import crypto from 'node:crypto';

export class OrdersSyncService {
  async fetchOrderRecords(batchSize = 100): Promise<SalesOrderRecord[]> {
    const db = getFirestoreDb();
    const ordersMap = new Map<string, SalesOrderRecord>();

    if (isRealFirebaseConfigured() && db) {
      const collectionsToCheck = ['orders', 'sales_orders'];
      for (const colName of collectionsToCheck) {
        try {
          const snapshot = await db.collection(colName).limit(batchSize).get();
          snapshot.forEach((doc) => {
            const data = doc.data() as any;
            if (!ordersMap.has(doc.id)) {
              ordersMap.set(doc.id, {
                id: doc.id,
                salesOrderNumber: data.salesOrderNumber || data.orderNumber || `SO-${doc.id}`,
                customerId: data.customerId,
                customerName: data.customerName || 'Customer',
                orderDate: data.orderDate || (data.createdAt ? data.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
                expectedShipmentDate: data.expectedShipmentDate || data.targetDeliveryDate,
                status: data.status || 'Confirmed',
                lineItems: data.lineItems || data.productLines || [],
                subtotal: data.subtotal || data.totalAmount || 0,
                taxRate: data.taxRate,
                taxAmount: data.taxAmount,
                shippingCharges: data.shippingCharges || 0,
                totalAmount: data.totalAmount || data.subtotal || 0,
                billingAddress: data.billingAddress,
                shippingAddress: data.shippingAddress,
                notes: data.notes,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
              });
            }
          });
        } catch (err: any) {
          logger.warn({ error: err.message, collection: colName }, 'Failed to query orders from Firestore');
        }
      }
    }

    if (ordersMap.size === 0) {
      const inMemory = await crmRepository.getSalesOrders({ batchSize });
      inMemory.forEach((o) => ordersMap.set(o.id, o));
    }

    return Array.from(ordersMap.values());
  }

  async syncOrders(batchSize = 100): Promise<SyncOperationResult> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();
    const records = await this.fetchOrderRecords(batchSize);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ id: string; message: string }> = [];

    logger.info({ count: records.length, jobId }, 'Starting Orders sync to Zoho ERP');

    for (const record of records) {
      try {
        // 1. Resolve customer in Zoho ERP
        let customerMapping = await syncRepository.getMapping('customer', record.customerId);
        let zohoCustomerId = customerMapping?.zohoId;

        if (!zohoCustomerId) {
          zohoCustomerId = (await zohoApiService.findContactByExternalId(record.customerId)) || undefined;
        }

        if (!zohoCustomerId) {
          const contactRes = await zohoApiService.syncContact({
            contact_name: record.customerName || `Customer-${record.customerId}`,
            company_name: record.customerName,
            contact_type: 'customer',
            notes: `Auto-created during order sync for customer ID: ${record.customerId}`
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

        // 3. Map Order -> Zoho Sales Order
        const payload = fieldMapper.mapSalesOrderToZoho(record, zohoCustomerId, resolvedItemMap);
        const hash = computeIdempotencyHash(payload);

        // 4. Check idempotency mapping
        const mapping = await syncRepository.getMapping('sales_order', record.id);
        if (mapping && mapping.syncStatus === 'SYNCED' && mapping.lastSyncedHash === hash) {
          skipped++;
          continue;
        }

        let existingZohoId = mapping?.zohoId;
        if (!existingZohoId) {
          existingZohoId = (await zohoApiService.findSalesOrderByReference(record.salesOrderNumber)) || undefined;
        }

        const result = await zohoApiService.syncSalesOrder(payload, existingZohoId);

        if (result.action === 'created') created++;
        else updated++;

        await syncRepository.saveMapping({
          id: `sales_order_${record.id}`,
          entityType: 'sales_order',
          firebaseId: record.id,
          zohoId: result.zohoId,
          sourceCollection: 'sales_orders',
          zohoModule: 'salesorders',
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
        logger.error({ error: err.message, id: record.id }, 'Failed to sync order to Zoho ERP');

        await syncRepository.saveMapping({
          id: `sales_order_${record.id}`,
          entityType: 'sales_order',
          firebaseId: record.id,
          zohoId: '',
          sourceCollection: 'sales_orders',
          zohoModule: 'salesorders',
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
      entityType: 'orders',
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

export const ordersSyncService = new OrdersSyncService();

