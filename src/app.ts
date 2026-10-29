import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthRouter } from './routes/healthRoutes.js';
import { syncRouter } from './routes/syncRoutes.js';
import { crmRouter } from './routes/crmRoutes.js';
import { zohoRouter } from './routes/zohoRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    })
  );

  // Body parsing
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/', healthRouter);
  app.use('/api/v1/sync', syncRouter);
  app.use('/api/v1', crmRouter);
  app.use('/api/zoho', zohoRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: `The requested endpoint ${req.method} ${req.path} does not exist.`
    });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
