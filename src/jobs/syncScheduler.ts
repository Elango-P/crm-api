import { Cron } from 'croner';
import { syncEngine } from '../modules/sync/syncEngine.js';
import { distributedLock } from './distributedLock.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class SyncScheduler {
  private incrementalJob: Cron | null = null;
  private reconciliationJob: Cron | null = null;
  private isRunning = false;

  /**
   * Start scheduled background synchronization jobs
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('SyncScheduler is already running');
      return;
    }

    logger.info(
      {
        syncSchedule: config.SYNC_SCHEDULE,
        reconciliationSchedule: config.RECONCILIATION_SCHEDULE,
        dryRun: config.SYNC_DRY_RUN
      },
      'Starting background synchronization scheduler'
    );

    // 1. Incremental Sync Cron
    this.incrementalJob = new Cron(config.SYNC_SCHEDULE, async () => {
      logger.info('Scheduled incremental sync triggered');
      await distributedLock.runWithLock('sync_incremental_lock', async () => {
        await syncEngine.runSync({ mode: 'INCREMENTAL' });
      });
    });

    // 2. Full Reconciliation Cron
    this.reconciliationJob = new Cron(config.RECONCILIATION_SCHEDULE, async () => {
      logger.info('Scheduled reconciliation sync triggered');
      await distributedLock.runWithLock('sync_reconciliation_lock', async () => {
        await syncEngine.runSync({ mode: 'FULL' });
      });
    });

    this.isRunning = true;
  }

  /**
   * Stop scheduled background jobs (for graceful shutdown)
   */
  stop(): void {
    if (!this.isRunning) return;

    logger.info('Stopping background synchronization scheduler');
    if (this.incrementalJob) {
      this.incrementalJob.stop();
      this.incrementalJob = null;
    }
    if (this.reconciliationJob) {
      this.reconciliationJob.stop();
      this.reconciliationJob = null;
    }

    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      syncSchedule: config.SYNC_SCHEDULE,
      reconciliationSchedule: config.RECONCILIATION_SCHEDULE,
      dryRun: config.SYNC_DRY_RUN,
      nextIncrementalRun: this.incrementalJob?.nextRun()?.toISOString() || null,
      nextReconciliationRun: this.reconciliationJob?.nextRun()?.toISOString() || null
    };
  }
}

export const syncScheduler = new SyncScheduler();
