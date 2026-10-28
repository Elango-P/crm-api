import crypto from 'node:crypto';

/**
 * Creates a deterministic SHA-256 hash of an object to detect changes
 */
export function hashPayload(payload: unknown): string {
  const json = JSON.stringify(payload, Object.keys(payload as object || {}).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Timing-safe string comparison to protect against timing attacks on API keys
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
