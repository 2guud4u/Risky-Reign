import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password hashing for persisted games (scrypt, stdlib only) plus a small
 * per-socket rate limiter so a brute-force loop can't run at wire speed.
 *
 * Hash format: `scrypt:<saltHex>:<hashHex>`. Anything else is treated as
 * unhashable input — verification fails, never throws.
 */

const SCRYPT_KEYLEN = 32;
/** scrypt work factor: ~10ms on the container CPU — cheap for us, slow for a bot. */
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt:')) return false;
  const [, saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
    if (expected.length !== SCRYPT_KEYLEN) return false;
  } catch {
    return false;
  }
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN, SCRYPT_OPTS);
  return timingSafeEqual(actual, expected);
}

/**
 * Per-socket attempt limiter for password checks. `key` is the socket id;
 * each `check` consumes one attempt. `windowMs` after the first failure the
 * counter resets. Not persisted — a reconnect resets it, which is fine.
 */
export function createAttemptLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, { count: number; first: number }>();
  return {
    /** True = allowed to try; false = over the limit for this window. */
    check(key: string): boolean {
      const now = Date.now();
      const rec = attempts.get(key);
      if (!rec || now - rec.first > windowMs) {
        attempts.set(key, { count: 1, first: now });
        return true;
      }
      rec.count += 1;
      return rec.count <= maxAttempts;
    },
    /** Drop the socket's counter (on disconnect / successful attempt). */
    reset(key: string): void {
      attempts.delete(key);
    },
  };
}
