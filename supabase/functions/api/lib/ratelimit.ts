// Fixed-window throttling backed by the rate_limits table (D-004). Fails open on DB errors.
import type { Db } from './db.ts';
import { sha256Hex } from './crypto.ts';
import { ApiError } from './http.ts';

export async function rateLimit(db: Db, key: string, max: number, windowSec: number): Promise<void> {
  const ms = windowSec * 1000;
  const start = new Date(Math.floor(Date.now() / ms) * ms).toISOString();
  const { data, error } = await db.rpc('rate_limit_hit', { p_key: key, p_window_start: start });
  if (error) {
    console.error('[ratelimit]', error.message);
    return;
  }
  if (typeof data === 'number' && data > max)
    throw new ApiError('rate_limited', 'محاولات كتير ورا بعض. استنى شوية وجرّب تاني.', 429);
}

/** IP is hashed before use as a key, so raw IPs are never stored. */
export const ipKey = async (ip: string) => (await sha256Hex('ip:' + ip)).slice(0, 32);
