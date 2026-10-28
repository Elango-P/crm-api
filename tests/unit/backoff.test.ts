import { describe, it, expect, vi } from 'vitest';
import { withExponentialBackoff } from '../../src/utils/backoff.js';

describe('withExponentialBackoff Unit Tests', () => {
  it('should return result immediately if operation succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withExponentialBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient 500 error and succeed on second attempt', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const error: any = new Error('Internal Server Error');
        error.response = { status: 500 };
        throw error;
      }
      return 'recovered';
    });

    const result = await withExponentialBackoff(fn, { baseDelayMs: 10, maxRetries: 2 });
    expect(result).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('should retry on rate limit 429 error and respect retry-after header', async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const error: any = new Error('Rate Limited');
        error.response = { status: 429, headers: { 'retry-after': '0.01' } };
        throw error;
      }
      return 'unblocked';
    });

    const result = await withExponentialBackoff(fn, { baseDelayMs: 10, maxRetries: 2 });
    expect(result).toBe('unblocked');
    expect(callCount).toBe(2);
  });

  it('should not retry non-retryable 400 Bad Request error', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      const error: any = new Error('Bad Request');
      error.response = { status: 400 };
      throw error;
    });

    await expect(withExponentialBackoff(fn, { baseDelayMs: 10, maxRetries: 3 })).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
