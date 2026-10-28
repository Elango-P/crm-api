import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { syncRepository } from '../modules/sync/syncRepository.js';
import { syncEngine } from '../modules/sync/syncEngine.js';
import { syncScheduler } from '../jobs/syncScheduler.js';
import { isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { zohoTokenManager } from '../modules/zoho/zohoTokenManager.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';
import { distributedLock } from '../jobs/distributedLock.js';

export const syncRouter = Router();

// Apply rate limiter and auth to all admin sync endpoints
syncRouter.use(adminRateLimiter);
syncRouter.use(requireAdminAuth);

/**
 * GET /api/v1/sync/status
 * Return synchronization status, last run, processed records, failures, and pending work.
 */
syncRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await syncRepository.getStats();
    const customerCheckpoint = await syncRepository.getCheckpoint('customer');
    const orderCheckpoint = await syncRepository.getCheckpoint('sales_order');
    const recentLogs = await syncRepository.getLogs(1);

    res.json({
      success: true,
      data: {
        isConfigured: {
          firebase: isRealFirebaseConfigured(),
          zoho: zohoTokenManager.isConfigured()
        },
        scheduler: syncScheduler.getStatus(),
        stats,
        checkpoints: {
          customer: customerCheckpoint,
          sales_order: orderCheckpoint
        },
        lastJob: recentLogs[0] || null
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sync/logs
 * Return paginated synchronization logs for authorized administrators.
 */
syncRouter.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const logs = await syncRepository.getLogs(limit);

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (err) {
    next(err);
  }
});

const runSyncBodySchema = z.object({
  mode: z.enum(['FULL', 'INCREMENTAL']).default('INCREMENTAL'),
  tenantId: z.string().optional()
});

/**
 * POST /api/v1/sync/run
 * Protected endpoint to trigger a sync manually for administration and testing.
 */
syncRouter.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = runSyncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'ValidationError', details: parsed.error.format() });
      return;
    }

    const { mode, tenantId } = parsed.data;

    // Use distributed lock to prevent overlapping sync with background scheduler
    const result = await distributedLock.runWithLock('sync_manual_lock', async () => {
      return await syncEngine.runSync({ mode, tenantId });
    });

    if (!result) {
      res.status(409).json({
        error: 'Conflict',
        message: 'A synchronization job is already running on another worker instance'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Manual ${mode} synchronization completed`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sync/retry-failed
 * Protected endpoint to retry eligible failed records.
 */
syncRouter.post('/retry-failed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncEngine.retryFailedRecords();
    res.json({
      success: true,
      message: 'Retry operation completed',
      data: result
    });
  } catch (err) {
    next(err);
  }
});
