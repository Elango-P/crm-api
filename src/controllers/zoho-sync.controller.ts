import { Request, Response } from 'express';
import { usersSyncService } from '../services/users-sync.service.js';
import { quotesSyncService } from '../services/quotes-sync.service.js';
import { ordersSyncService } from '../services/orders-sync.service.js';
import { bomSyncService } from '../services/bom-sync.service.js';
import { syncLogService } from '../services/sync-log.service.js';
import { zohoAuthService } from '../services/zoho-auth.service.js';
import { isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export class ZohoSyncController {
  /**
   * POST /api/zoho/sync/users
   */
  async syncUsers(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : config.SYNC_BATCH_SIZE;
      const result = await usersSyncService.syncUsers(batchSize);
      await syncLogService.recordSync(result);
      res.status(200).json({
        success: true,
        message: 'Users synchronization completed',
        ...result
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during users sync');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zoho/sync/quotes
   */
  async syncQuotes(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : config.SYNC_BATCH_SIZE;
      const result = await quotesSyncService.syncQuotes(batchSize);
      await syncLogService.recordSync(result);
      res.status(200).json({
        success: true,
        message: 'Quotes synchronization completed',
        ...result
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during quotes sync');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zoho/sync/orders
   */
  async syncOrders(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : config.SYNC_BATCH_SIZE;
      const result = await ordersSyncService.syncOrders(batchSize);
      await syncLogService.recordSync(result);
      res.status(200).json({
        success: true,
        message: 'Orders synchronization completed',
        ...result
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during orders sync');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zoho/sync/bom
   */
  async syncBom(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : config.SYNC_BATCH_SIZE;
      const result = await bomSyncService.syncBom(batchSize);
      await syncLogService.recordSync(result);
      res.status(200).json({
        success: true,
        message: 'Bill of Materials synchronization completed',
        ...result
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during BOM sync');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/zoho/sync/all
   */
  async syncAll(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : config.SYNC_BATCH_SIZE;
      const usersResult = await usersSyncService.syncUsers(batchSize);
      await syncLogService.recordSync(usersResult);

      const bomResult = await bomSyncService.syncBom(batchSize);
      await syncLogService.recordSync(bomResult);

      const quotesResult = await quotesSyncService.syncQuotes(batchSize);
      await syncLogService.recordSync(quotesResult);

      const ordersResult = await ordersSyncService.syncOrders(batchSize);
      await syncLogService.recordSync(ordersResult);

      const totalProcessed = usersResult.processed + bomResult.processed + quotesResult.processed + ordersResult.processed;
      const totalCreated = usersResult.created + bomResult.created + quotesResult.created + ordersResult.created;
      const totalUpdated = usersResult.updated + bomResult.updated + quotesResult.updated + ordersResult.updated;
      const totalSkipped = usersResult.skipped + bomResult.skipped + quotesResult.skipped + ordersResult.skipped;
      const totalFailed = usersResult.failed + bomResult.failed + quotesResult.failed + ordersResult.failed;

      res.status(200).json({
        success: true,
        message: 'Full synchronization completed across all collections',
        summary: {
          processed: totalProcessed,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          failed: totalFailed
        },
        details: {
          users: usersResult,
          bom: bomResult,
          quotes: quotesResult,
          orders: ordersResult
        }
      });
    } catch (err: any) {
      logger.error({ error: err.message }, 'Error during full sync');
      res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/zoho/sync/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const isZohoReady = zohoAuthService.isConfigured();
      const isFirebaseLive = isRealFirebaseConfigured();
      const recentLogs = syncLogService.getRecentLogs(10);

      res.status(200).json({
        success: true,
        status: {
          product: config.ZOHO_PRODUCT,
          apiBaseUrl: config.ZOHO_API_BASE_URL,
          accountsUrl: config.ZOHO_ACCOUNTS_URL,
          organizationConfigured: Boolean(config.ZOHO_ORGANIZATION_ID),
          oauthConfigured: isZohoReady,
          firebaseLive: isFirebaseLive,
          dryRun: config.SYNC_DRY_RUN,
          batchSize: config.SYNC_BATCH_SIZE
        },
        recentActivity: recentLogs
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

export const zohoSyncController = new ZohoSyncController();

