import 'server-only';
import { headers } from 'next/headers';

/**
 * Best-effort, in-memory rate limiting.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS — AND HONESTLY, WHAT IT IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * The counters live in this module's memory. On Vercel that memory belongs to a
 * single serverless instance, and there may be many of them: a determined
 * attacker who spreads requests across instances gets a higher effective limit,
 * and a cold start forgets everything.
 *
 * So this is a speed bump, not a wall. It exists because the alternative — no
 * limit at all — let one laptop pin a CPU with password hashing (scrypt costs
 * ~46ms and 16MB per attempt), or fill the table with cards. It turns "trivial"
 * into "annoying", cheaply and with no extra infrastructure.
 *
 * The real wall, when this product needs one, is a shared store (Upstash /
 * Vercel KV) or a database-side limit. That is a deliberate later step, noted in
 * the README roadmap — not an oversight.
 *
 * Everything here is fail-open: if the limiter itself errors, the request is
 * allowed. A broken speed bump must never take the site down.
 */

/* All buckets live in one map so a single sweep prunes everything.
   key -> { count, resetAt, strikes, lastSeen } */
const buckets = new Map();

/* Hard ceiling on distinct keys, so a spray of forged IPs cannot grow the map
   without bound between sweeps. When it is hit we drop the oldest half. */
const MAX_KEYS = 5000;
const SWEEP_EVERY_MS = 60 * 1000;
let lastSweep = 0;

/** Drop expired buckets. Called opportunistically, never on a timer. */
function sweep(now) {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    /* Keep a bucket while its window is open or it has recent strikes to
       remember; otherwise it is just noise. */
    if (bucket.resetAt <= now && now - bucket.lastSeen > SWEEP_EVERY_MS) {
      buckets.delete(key);
    }
  }
  if (buckets.size > MAX_KEYS) {
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
      .slice(0, Math.floor(buckets.size / 2));
    for (const [key] of oldest) buckets.delete(key);
  }
}

/**
 * The caller's IP, as best we can tell.
 *
 * Behind Vercel, x-forwarded-for is set by the platform and its FIRST entry is
 * the real client. Locally there is no proxy and no header, so everything falls
 * into one shared "local" bucket — which is correct for development.
 *
 * A client can forge this header when the app is run without a trusted proxy in
 * front, which is another reason this is a speed bump rather than a control.
 */
export async function clientKey() {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim().slice(0, 45) || 'unknown';
    return (h.get('x-real-ip') || 'local').slice(0, 45);
  } catch {
    return 'local';
  }
}

/**
 * Take one token from `name:key`.
 *
 * @returns {{ ok: boolean, retryAfterMs: number, strikes: number }}
 */
export function take(name, key, limit, windowMs) {
  try {
    const now = Date.now();
    sweep(now);

    const id = `${name}:${key}`;
    let bucket = buckets.get(id);

    if (!bucket || bucket.resetAt <= now) {
      /* Strikes survive one window boundary so repeat offenders keep their
         rising delay instead of getting a clean slate every minute. */
      const strikes = bucket && now - bucket.lastSeen < windowMs * 3 ? bucket.strikes : 0;
      bucket = { count: 0, resetAt: now + windowMs, strikes, lastSeen: now };
      buckets.set(id, bucket);
    }

    bucket.lastSeen = now;
    bucket.count += 1;

    if (bucket.count > limit) {
      bucket.strikes += 1;
      return { ok: false, retryAfterMs: Math.max(0, bucket.resetAt - now), strikes: bucket.strikes };
    }
    return { ok: true, retryAfterMs: 0, strikes: bucket.strikes };
  } catch {
    return { ok: true, retryAfterMs: 0, strikes: 0 }; // fail open, always
  }
}

/** Note a failed attempt (a wrong password) without spending a token. */
export function strike(name, key) {
  try {
    const now = Date.now();
    const id = `${name}:${key}`;
    const bucket = buckets.get(id) || { count: 0, resetAt: now + 60000, strikes: 0, lastSeen: now };
    bucket.strikes += 1;
    bucket.lastSeen = now;
    buckets.set(id, bucket);
    return bucket.strikes;
  } catch {
    return 0;
  }
}

/**
 * A rising delay for repeat failures: 0, 250ms, 500ms, 1s, 2s … capped at 4s.
 * Slow enough to ruin an online guessing run, short enough that a person who
 * genuinely fat-fingered their password barely notices.
 */
export function backoffMs(strikes) {
  if (strikes <= 1) return 0;
  return Math.min(4000, 250 * 2 ** Math.min(strikes - 2, 4));
}

export function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Test seam — lets a node repro reset state between cases. */
export function __resetThrottles() {
  buckets.clear();
  lastSweep = 0;
}
