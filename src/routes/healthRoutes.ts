import { Router, Request, Response } from 'express';
import { isRealFirebaseConfigured } from '../modules/firebase/firebaseClient.js';
import { zohoTokenManager } from '../modules/zoho/zohoTokenManager.js';
import { syncScheduler } from '../jobs/syncScheduler.js';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'CRM Sync API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      customers: '/api/v1/customers',
      rfqs: '/api/v1/rfqs',
      syncStatus: '/api/v1/sync/status',
      syncRun: '/api/v1/sync/run',
      zohoAuth: '/api/zoho/auth',
      zohoCallback: '/api/zoho/callback',
      zohoOrganization: '/api/zoho/organization',
      zohoContacts: '/api/zoho/contacts'
    }
  });
});

healthRouter.get('/health', async (req: Request, res: Response) => {
  const firebaseStatus = isRealFirebaseConfigured() ? 'connected' : 'simulated_fallback';
  const zohoConfigured = zohoTokenManager.isConfigured();

  const isHealthy = true; // Service is running and capable of processing

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    dependencies: {
      firebase: {
        status: firebaseStatus,
        projectId: config.FIREBASE_PROJECT_ID,
        databaseType: config.FIREBASE_DATABASE_TYPE
      },
      zoho: {
        product: config.ZOHO_PRODUCT,
        accountsUrl: config.ZOHO_ACCOUNTS_URL,
        isConfigured: zohoConfigured
      },
      scheduler: syncScheduler.getStatus()
    }
  });
});
