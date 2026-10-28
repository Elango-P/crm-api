import { describe, it, expect } from 'vitest';
import { syncEngine } from '../../src/modules/sync/syncEngine.js';
import { syncRepository } from '../../src/modules/sync/syncRepository.js';

describe('SyncEngine Integration Tests', () => {
  it('should execute full initial synchronization and create mappings', async () => {
    const jobLog = await syncEngine.runSync({ mode: 'FULL' });

    expect(jobLog.jobType).toBe('FULL');
    expect(jobLog.status).toBe('SUCCESS');
    expect(jobLog.totalProcessed).toBeGreaterThan(0);
    expect(jobLog.totalCreated).toBeGreaterThan(0);
    expect(jobLog.totalFailed).toBe(0);

    // Verify checkpoint was updated
    const customerCheckpoint = await syncRepository.getCheckpoint('customer');
    expect(new Date(customerCheckpoint.lastWatermark).getTime()).toBeGreaterThan(0);

    // Verify sync mapping exists
    const mapping = await syncRepository.getMapping('customer', 'c-1');
    expect(mapping).not.toBeNull();
    expect(mapping?.syncStatus).toBe('SYNCED');
    expect(mapping?.zohoId).toBeDefined();
  });

  it('should execute incremental sync idempotently without creating duplicate records', async () => {
    // Run incremental sync immediately after full sync
    const jobLog = await syncEngine.runSync({ mode: 'INCREMENTAL' });

    expect(jobLog.jobType).toBe('INCREMENTAL');
    expect(jobLog.status).toBe('SUCCESS');
    // Since no records were updated, created count should be 0
    expect(jobLog.totalCreated).toBe(0);
  });

  it('should support retrying failed records', async () => {
    // Inject a failed mapping for testing
    await syncRepository.saveMapping({
      id: 'customer_failed-test',
      entityType: 'customer',
      firebaseId: 'c-1',
      zohoId: '',
      lastSyncedHash: '',
      syncStatus: 'FAILED',
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: 'Simulated network timeout'
    });

    const retryResult = await syncEngine.retryFailedRecords();
    expect(retryResult.retriedCount).toBeGreaterThanOrEqual(1);
    expect(retryResult.succeededCount).toBeGreaterThanOrEqual(1);

    const mapping = await syncRepository.getMapping('customer', 'c-1');
    expect(mapping?.syncStatus).toBe('SYNCED');
  });
});
