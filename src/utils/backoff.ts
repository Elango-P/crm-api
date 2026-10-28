import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  operationName?: string;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Execute an async operation with exponential backoff and jitter
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const retryableStatuses = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  const operationName = options.operationName ?? 'Operation';

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      const status = error?.response?.status || error?.status;
      const isRateLimit = status === 429;
      const isRetryable = retryableStatuses.includes(status) || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';

      if (!isRetryable || attempt > maxRetries) {
        throw error;
      }

      // Check for standard Retry-After header (in seconds)
      const retryAfterHeader = error?.response?.headers?.['retry-after'];
      let delayMs: number;

      if (retryAfterHeader && !isNaN(Number(retryAfterHeader))) {
        delayMs = Number(retryAfterHeader) * 1000;
      } else {
        // Exponential backoff with full jitter
        const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
        delayMs = Math.floor(Math.random() * exponentialDelay);
      }

      logger.warn(
        {
          operation: operationName,
          attempt,
          maxRetries,
          delayMs,
          status,
          message: error.message
        },
        `${operationName} encountered error (status ${status}). Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Max retries exceeded for ${operationName}`);
}
