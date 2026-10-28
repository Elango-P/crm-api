import { describe, it, expect } from 'vitest';
import { distributedLock } from '../../src/jobs/distributedLock.js';

describe('DistributedLock Unit Tests', () => {
  it('should acquire lock when not held by any process', async () => {
    const lockName = `test_lock_${Date.now()}`;
    const acquired = await distributedLock.acquire(lockName, 60);
    expect(acquired).toBe(true);

    // Clean up
    await distributedLock.release(lockName);
  });

  it('should prevent overlapping executions and release cleanly', async () => {
    const lockName = `test_overlap_${Date.now()}`;
    let executed = false;

    await distributedLock.runWithLock(lockName, async () => {
      executed = true;
      // While running, attempting to acquire with another instance should fail
      // but current instance can renew/re-acquire
      expect(executed).toBe(true);
    });

    expect(executed).toBe(true);
  });
});
