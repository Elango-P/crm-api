import {
  EntityType,
  SyncCheckpoint,
  SyncJobLog,
  SyncMapping,
  SyncStatus
} from '../../types/sync.js';
import { getFirestoreDb, isRealFirebaseConfigured } from '../firebase/firebaseClient.js';
import { logger } from '../../utils/logger.js';

export class SyncRepository {
  private inMemoryMappings = new Map<string, SyncMapping>();
  private inMemoryCheckpoints = new Map<EntityType, SyncCheckpoint>();
  private inMemoryLogs: SyncJobLog[] = [];

  /**
   * Get sync mapping by entityType and firebaseId
   */
  async getMapping(entityType: EntityType, firebaseId: string): Promise<SyncMapping | null> {
    const key = `${entityType}_${firebaseId}`;
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        // Try zoho_sync_map first, then fallback to _sync_mappings
        let doc = await db.collection('zoho_sync_map').doc(key).get();
        if (!doc.exists) {
          doc = await db.collection('_sync_mappings').doc(key).get();
        }
        if (doc.exists) {
          const data = doc.data() as SyncMapping;
          // Invalidate mock records if live credentials are active
          if (data.zohoId && data.zohoId.startsWith('mock_')) {
            return null;
          }
          return data;
        }
        return null;
      } catch (err: any) {
        logger.error({ error: err.message, key }, 'Failed to fetch mapping from Firestore');
      }
    }

    const inMem = this.inMemoryMappings.get(key) || null;
    if (inMem && inMem.zohoId && inMem.zohoId.startsWith('mock_')) {
      return null;
    }
    return inMem;
  }

  /**
   * Save or update sync mapping
   */
  async saveMapping(mapping: SyncMapping): Promise<void> {
    const key = `${mapping.entityType}_${mapping.firebaseId}`;
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const batch = db.batch();
        batch.set(db.collection('zoho_sync_map').doc(key), mapping, { merge: true });
        batch.set(db.collection('_sync_mappings').doc(key), mapping, { merge: true });
        await batch.commit();
        return;
      } catch (err: any) {
        logger.error({ error: err.message, key }, 'Failed to save mapping to Firestore');
      }
    }

    this.inMemoryMappings.set(key, mapping);
  }

  /**
   * Get all failed mappings eligible for retry
   */
  async getFailedMappings(maxRetries: number): Promise<SyncMapping[]> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const snapshot = await db
          .collection('_sync_mappings')
          .where('syncStatus', '==', 'FAILED')
          .where('attemptCount', '<', maxRetries)
          .limit(100)
          .get();

        return snapshot.docs.map((doc) => doc.data() as SyncMapping);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to query failed mappings from Firestore');
      }
    }

    return Array.from(this.inMemoryMappings.values()).filter(
      (m) => m.syncStatus === 'FAILED' && m.attemptCount < maxRetries
    );
  }

  /**
   * Get watermark checkpoint for entity type
   */
  async getCheckpoint(entityType: EntityType): Promise<SyncCheckpoint> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const doc = await db.collection('_sync_checkpoints').doc(entityType).get();
        if (doc.exists) {
          return doc.data() as SyncCheckpoint;
        }
      } catch (err: any) {
        logger.error({ error: err.message, entityType }, 'Failed to get checkpoint from Firestore');
      }
    }

    const cached = this.inMemoryCheckpoints.get(entityType);
    if (cached) return cached;

    const initialCheckpoint: SyncCheckpoint = {
      id: entityType,
      lastWatermark: new Date(0).toISOString(),
      lastSyncCompletedAt: new Date(0).toISOString(),
      status: 'IDLE',
      totalProcessedCount: 0
    };
    return initialCheckpoint;
  }

  /**
   * Update watermark checkpoint
   */
  async updateCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        await db.collection('_sync_checkpoints').doc(checkpoint.id).set(checkpoint, { merge: true });
        return;
      } catch (err: any) {
        logger.error({ error: err.message, entityType: checkpoint.id }, 'Failed to save checkpoint to Firestore');
      }
    }

    this.inMemoryCheckpoints.set(checkpoint.id, checkpoint);
  }

  /**
   * Reset checkpoint to epoch (for full sync)
   */
  async resetCheckpoint(entityType: EntityType): Promise<void> {
    const resetVal: SyncCheckpoint = {
      id: entityType,
      lastWatermark: new Date(0).toISOString(),
      lastSyncCompletedAt: new Date().toISOString(),
      status: 'IDLE',
      totalProcessedCount: 0
    };
    await this.updateCheckpoint(resetVal);
  }

  /**
   * Record audit log of a synchronization run
   */
  async logJob(job: SyncJobLog): Promise<void> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        await db.collection('_sync_logs').doc(job.id).set(job);
        return;
      } catch (err: any) {
        logger.error({ error: err.message, jobId: job.id }, 'Failed to save sync log to Firestore');
      }
    }

    this.inMemoryLogs.unshift(job);
    if (this.inMemoryLogs.length > 50) {
      this.inMemoryLogs.pop();
    }
  }

  /**
   * Get recent sync job logs
   */
  async getLogs(limitCount = 20): Promise<SyncJobLog[]> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const snapshot = await db
          .collection('_sync_logs')
          .orderBy('startedAt', 'desc')
          .limit(limitCount)
          .get();

        return snapshot.docs.map((d) => d.data() as SyncJobLog);
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to query sync logs from Firestore');
      }
    }

    return this.inMemoryLogs.slice(0, limitCount);
  }

  /**
   * Get sync summary stats
   */
  async getStats(): Promise<{ totalSynced: number; totalFailed: number; totalPending: number }> {
    const db = getFirestoreDb();

    if (isRealFirebaseConfigured() && db) {
      try {
        const snapshot = await db.collection('_sync_mappings').get();
        let synced = 0;
        let failed = 0;
        let pending = 0;

        snapshot.forEach((doc) => {
          const status = doc.get('syncStatus');
          if (status === 'SYNCED') synced++;
          else if (status === 'FAILED') failed++;
          else pending++;
        });

        return { totalSynced: synced, totalFailed: failed, totalPending: pending };
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to aggregate sync stats from Firestore');
      }
    }

    let synced = 0;
    let failed = 0;
    let pending = 0;
    for (const m of this.inMemoryMappings.values()) {
      if (m.syncStatus === 'SYNCED') synced++;
      else if (m.syncStatus === 'FAILED') failed++;
      else pending++;
    }

    return { totalSynced: synced, totalFailed: failed, totalPending: pending };
  }
}

export const syncRepository = new SyncRepository();
