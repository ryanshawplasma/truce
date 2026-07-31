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
 * the real client. It can arrive as a list ("client, proxy1, proxy2") or, on
 * some setups, as several headers joined with a comma — either way the first
 * entry is the one we want.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHEN THERE IS NO IP AT ALL
 * ─────────────────────────────────────────────────────────────────────────────
 * This used to return the literal string "local", which meant every visitor
 * without a forwarding header shared ONE bucket. That is fine on a laptop and
 * genuinely dangerous anywhere else: the first few people to use the site would
 * spend the whole allowance and everybody after them would be told "too many
 * tries" without having tried anything. A limiter that can lock out the world
 * because a header was missing is worse than no limiter.
 *
 * So the fallback is a weak fingerprint of the request instead — user agent,
 * language, encodings. Two different people rarely share one; one person keeps
 * theirs across requests. It is easy to spoof, which is fine: this is a speed
 * bump, and the failure mode we care about is locking out real people.
 */
export async function clientKey() {
  try {
    const h = await headers();

    const forwarded = h.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first.slice(0, 45);
    }

    const real = h.get('x-real-ip');
    if (real && real.trim()) return real.trim().slice(0, 45);

    /* No proxy in front of us. Fall back to a per-client fingerprint rather
       than one bucket for everybody — see the note above. */
    const fingerprint = [
      h.get('user-agent') || '',
      h.get('accept-language') || '',
      h.get('accept-encoding') || '',
      h.get('sec-ch-ua-platform') || '',
    ].join('|');

    if (!fingerprint.replace(/\|/g, '')) return 'anon';
    return `fp:${shortHash(fingerprint)}`;
  } catch {
    /* Even the fallback failed. Give this request its own bucket rather than
       dropping it into a shared one that may already be spent. */
    return `fp:${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** A short, stable, non-cryptographic hash. Only needs to spread keys out. */
function shortHash(value) {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h1 ^= value.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(36);
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
