export type EntityType = 'customer' | 'item' | 'sales_order' | 'invoice';

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface SyncMapping {
  id: string; // `${entityType}_${firebaseId}`
  entityType: EntityType;
  firebaseId: string;
  zohoId: string;
  lastSyncedHash: string;
  syncStatus: SyncStatus;
  attemptCount: number;
  lastAttemptAt: string;
  lastSuccessAt?: string;
  lastError?: string | null;
  zohoUpdatedAt?: string;
}

export interface SyncCheckpoint {
  id: EntityType;
  lastWatermark: string; // ISO string
  lastSyncCompletedAt: string;
  status: 'IDLE' | 'RUNNING';
  totalProcessedCount: number;
}

export interface SyncLock {
  id: string;
  lockedBy: string; // instance UUID
  lockedAt: string;
  expiresAt: string;
}

export interface SyncJobLog {
  id: string;
  jobType: 'FULL' | 'INCREMENTAL' | 'RECONCILIATION' | 'RETRY';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalProcessed: number;
  totalCreated: number;
  totalUpdated: number;
  totalFailed: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errors: Array<{
    entityType: EntityType;
    firebaseId: string;
    message: string;
    timestamp: string;
  }>;
}

export interface SyncEngineStatus {
  isConfigured: {
    firebase: boolean;
    zoho: boolean;
  };
  scheduler: {
    isRunning: boolean;
    syncSchedule: string;
    reconciliationSchedule: string;
    dryRun: boolean;
  };
  lastJob?: SyncJobLog | null;
  checkpoints: Record<string, SyncCheckpoint>;
  stats: {
    totalSynced: number;
    totalFailed: number;
    totalPending: number;
  };
}
