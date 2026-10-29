import { SyncJobLog, EntityType } from '../types/sync.js';
import { getFirestoreDb, isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { logger } from '../utils/logger.js';

export interface SyncOperationResult {
  jobId: string;
  entityType: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: Array<{ id: string; message: string }>;
}

export class SyncLogService {
  private inMemoryLogs: SyncOperationResult[] = [];

  async recordSync(result: SyncOperationResult): Promise<void> {
    this.inMemoryLogs.unshift(result);
    if (this.inMemoryLogs.length > 100) {
      this.inMemoryLogs.pop();
    }

    const db = getFirestoreDb();
    if (isRealFirebaseConfigured() && db) {
      try {
        await db.collection('_sync_logs').doc(result.jobId).set({
          ...result,
          timestamp: new Date().toISOString()
        });
      } catch (err: any) {
        logger.warn({ error: err.message, jobId: result.jobId }, 'Failed to write sync log to Firestore');
      }
    }
  }

  getRecentLogs(limit = 20): SyncOperationResult[] {
    return this.inMemoryLogs.slice(0, limit);
  }
}

export const syncLogService = new SyncLogService();

