import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { safeEqual } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  let providedKey = apiKeyHeader;

  if (!providedKey && authHeader?.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7).trim();
  }

  if (!providedKey) {
    logger.warn({ ip: req.ip, path: req.path }, 'Unauthorized request: missing admin API key');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin authorization key is required via x-api-key header or Authorization: Bearer <token>'
    });
    return;
  }

  if (!safeEqual(providedKey, config.ADMIN_API_KEY)) {
    logger.warn({ ip: req.ip, path: req.path }, 'Forbidden request: invalid admin API key provided');
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid administrative API key'
    });
    return;
  }

  next();
}
