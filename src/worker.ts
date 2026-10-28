import { initFirebase } from './modules/firebase/firebaseClient.js';
import { syncScheduler } from './jobs/syncScheduler.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

async function runWorker() {
  logger.info({ environment: config.NODE_ENV }, 'Starting standalone Sync Background Worker');

  initFirebase();
  syncScheduler.start();

  logger.info('Standalone background sync worker is running');

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Stopping worker...`);
    syncScheduler.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

runWorker().catch((err) => {
  logger.fatal({ error: err.message }, 'Fatal error in worker process');
  process.exit(1);
});
