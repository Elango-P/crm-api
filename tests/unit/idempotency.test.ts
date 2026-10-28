import { describe, it, expect, vi } from 'vitest';
import { idempotencyManager } from '../../src/modules/sync/idempotency.js';
import { hashPayload } from '../../src/utils/crypto.js';
import { SyncMapping } from '../../src/types/sync.js';

describe('IdempotencyManager Unit Tests', () => {
  it('should detect no change when payload and stored hash match', () => {
    const payload = { contact_name: 'Alpha Ltd', email: 'alpha@ltd.com' };
    const hash = hashPayload(payload);

    const mapping: SyncMapping = {
      id: 'customer_1',
      entityType: 'customer',
      firebaseId: 'c-1',
      zohoId: 'zoho-1',
      lastSyncedHash: hash,
      syncStatus: 'SYNCED',
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString()
    };

    expect(idempotencyManager.hasChanged(payload, mapping)).toBe(false);
  });

  it('should detect change when payload properties are modified', () => {
    const originalPayload = { contact_name: 'Alpha Ltd', email: 'alpha@ltd.com' };
    const hash = hashPayload(originalPayload);

    const mapping: SyncMapping = {
      id: 'customer_1',
      entityType: 'customer',
      firebaseId: 'c-1',
      zohoId: 'zoho-1',
      lastSyncedHash: hash,
      syncStatus: 'SYNCED',
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString()
    };

    const modifiedPayload = { contact_name: 'Alpha Ltd Updated', email: 'alpha@ltd.com' };
    expect(idempotencyManager.hasChanged(modifiedPayload, mapping)).toBe(true);
  });

  it('should treat mapping with FAILED status as requiring sync regardless of hash', () => {
    const payload = { contact_name: 'Alpha Ltd' };
    const hash = hashPayload(payload);

    const failedMapping: SyncMapping = {
      id: 'customer_1',
      entityType: 'customer',
      firebaseId: 'c-1',
      zohoId: '',
      lastSyncedHash: hash,
      syncStatus: 'FAILED',
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString()
    };

    expect(idempotencyManager.hasChanged(payload, failedMapping)).toBe(true);
  });

  it('should discover existing Zoho record to recover after timeouts', async () => {
    const mockAdapter: any = {
      findContactByExternalId: vi.fn().mockResolvedValue('existing_zoho_123')
    };

    const result = await idempotencyManager.discoverExistingZohoRecord(mockAdapter, 'customer', {
      firebaseId: 'c-99',
      email: 'timeout@test.com'
    });

    expect(result).toBe('existing_zoho_123');
    expect(mockAdapter.findContactByExternalId).toHaveBeenCalledWith('c-99', 'timeout@test.com');
  });
});
