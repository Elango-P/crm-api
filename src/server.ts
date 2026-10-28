import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initFirebase } from './modules/firebase/firebaseClient.js';
import { syncScheduler } from './jobs/syncScheduler.js';

async function bootstrap() {
  logger.info({ environment: config.NODE_ENV, port: config.PORT }, 'Initializing Firebase-to-Zoho Sync Service');

  // Initialize Firebase Admin connection
  initFirebase();

  // Create Express App
  const app = createApp();
  const server = http.createServer(app);

  // Start background cron scheduler
  syncScheduler.start();

  server.listen(config.PORT, () => {
    logger.info(`🚀 Sync API server listening on http://localhost:${config.PORT}`);
    logger.info(`Health check available at http://localhost:${config.PORT}/health`);
    logger.info(`Sync API available at http://localhost:${config.PORT}/api/v1/sync/status`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop scheduler from initiating new jobs
    syncScheduler.stop();

    // 2. Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcefully terminating.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ error: err.message, stack: err.stack }, 'Fatal failure during server bootstrap');
  process.exit(1);
});
