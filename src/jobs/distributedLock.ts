import crypto from 'node:crypto';
import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { SyncLock } from '../types/sync.js';

export class DistributedLock {
  private inMemoryLocks = new Map<string, SyncLock>();
  readonly instanceId = crypto.randomUUID();

  /**
   * Attempt to acquire a distributed lock with TTL
   */
  async acquire(lockName: string, ttlSeconds = config.SYNC_LOCK_TTL_SECONDS): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const lockRef = db.collection('_sync_locks').doc(lockName);

        return await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(lockRef);

          if (doc.exists) {
            const data = doc.data() as SyncLock;
            const currentExpiresAt = new Date(data.expiresAt);

            // If lock is still valid and held by someone else, cannot acquire
            if (currentExpiresAt > now && data.lockedBy !== this.instanceId) {
              logger.warn(
                { lockName, heldBy: data.lockedBy, expiresAt: data.expiresAt },
                'Distributed lock is currently held by another worker instance'
              );
              return false;
            }
          }

          // Lock is free or expired, acquire it
          transaction.set(lockRef, {
            id: lockName,
            lockedBy: this.instanceId,
            lockedAt: now.toISOString(),
            expiresAt
          });

          return true;
        });
      } catch (err: any) {
        logger.error({ error: err.message, lockName }, 'Failed to acquire distributed lock in Firestore');
        return false;
      }
    }

    // In-memory fallback for local development or single-node mode
    const existing = this.inMemoryLocks.get(lockName);
    if (existing && new Date(existing.expiresAt) > now && existing.lockedBy !== this.instanceId) {
      return false;
    }

    this.inMemoryLocks.set(lockName, {
      id: lockName,
      lockedBy: this.instanceId,
      lockedAt: now.toISOString(),
      expiresAt
    });

    return true;
  }

  /**
   * Release the distributed lock if held by this instance
   */
  async release(lockName: string): Promise<void> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const lockRef = db.collection('_sync_locks').doc(lockName);
        await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(lockRef);
          if (doc.exists && doc.data()?.lockedBy === this.instanceId) {
            transaction.delete(lockRef);
          }
        });
        return;
      } catch (err: any) {
        logger.error({ error: err.message, lockName }, 'Failed to release distributed lock in Firestore');
      }
    }

    const existing = this.inMemoryLocks.get(lockName);
    if (existing?.lockedBy === this.instanceId) {
      this.inMemoryLocks.delete(lockName);
    }
  }

  /**
   * Execute an action safely wrapped within a distributed lock
   */
  async runWithLock<T>(lockName: string, action: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire(lockName);
    if (!acquired) {
      logger.info({ lockName }, 'Skipping job execution because lock is held by another instance');
      return null;
    }

    try {
      return await action();
    } finally {
      await this.release(lockName);
    }
  }
}

export const distributedLock = new DistributedLock();
