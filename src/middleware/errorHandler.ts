import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(
    {
      status,
      path: req.path,
      method: req.method,
      errorName: err.name,
      errorMessage: err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined
    },
    'Unhandled request error'
  );

  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: config.NODE_ENV === 'production' && status === 500 ? 'An unexpected internal error occurred' : message,
    timestamp: new Date().toISOString()
  });
}
