import 'server-only';
import { headers } from 'next/headers';

/**
 * Rate limiting, with a shared counter when there is one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO BACKENDS, ONE DOOR
 * ─────────────────────────────────────────────────────────────────────────────
 * `takeLimit()` is what callers use. It counts in Upstash Redis when
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, and in this
 * module's memory when they are not.
 *
 * The difference matters. In-memory counters belong to ONE serverless instance,
 * and Vercel runs many: an attacker who spreads requests across instances gets
 * a much higher effective limit, and a cold start forgets everything. That is a
 * speed bump, and it was honestly labelled as one for a long time — it exists
 * because the alternative, no limit at all, lets one laptop pin a CPU with
 * password hashing (scrypt costs ~46ms and 16MB per attempt).
 *
 * A shared counter is the actual wall: every instance increments the same
 * integer, so the limit is the limit. Provisioning it is two environment
 * variables and a free Upstash database — see .env.example. Nothing breaks if
 * you never do; the in-memory path is exactly what shipped before.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAIL OPEN, ALWAYS
 * ─────────────────────────────────────────────────────────────────────────────
 * Every path here allows the request if the limiter itself errors, and the
 * Redis call is given a short deadline so a slow store can never hold a page
 * hostage. A broken speed bump must not take the site down — a rate limiter
 * that fails closed is a self-inflicted outage waiting for a network blip.
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
    /* A limit that is not a number is a wiring mistake, and this module's whole
       promise is that a wiring mistake does not lock anybody out. `undefined`
       already fell through harmlessly (`1 > undefined` is false) but `null`
       coerced to 0 and refused everything — the same bug wearing a different
       hat. State the rule instead of relying on coercion. A deliberate 0 still
       means zero. */
    if (limit === null || limit === undefined || !Number.isFinite(Number(limit))) {
      return { ok: true, retryAfterMs: 0, strikes: 0 };
    }

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

/* ============================================================================
   The shared counter
   ========================================================================== */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/** True when this deployment has somewhere shared to count. */
export function hasSharedStore() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/* A limiter must never be the slowest thing in a request. If Redis has not
   answered by then, the request is allowed and we move on. */
const REDIS_TIMEOUT_MS = 800;

/**
 * INCR the counter, and set its expiry only if it does not have one.
 *
 * Both commands travel in a single pipelined request, which makes this one
 * round trip rather than two. `EXPIRE key seconds NX` is what makes it a fixed
 * window: the first request of a window starts the clock, and every later one
 * leaves it alone, so the window cannot be pushed forward indefinitely by
 * traffic — which is exactly the bug a plain EXPIRE would introduce.
 */
async function redisIncr(id, windowMs) {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);

  try {
    const res = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', id],
        ['EXPIRE', id, String(seconds), 'NX'],
      ]),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const body = await res.json();
    const count = Number(body && body[0] && body[0].result);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null; // timeout, network, malformed answer — all mean "allow"
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Take one token from `name:key`, using whichever counter this deployment has.
 *
 * Same return shape as take(), so callers do not care which backend answered:
 *   { ok, retryAfterMs, strikes }
 *
 * `strikes` is derived from how far over the limit the count has gone, which
 * means repeat offenders keep their rising backoff across instances too —
 * something the in-memory version could never do.
 */
export async function takeLimit(name, key, limit, windowMs) {
  if (!hasSharedStore()) return take(name, key, limit, windowMs);

  const id = `truce:rl:${name}:${key}`;
  const count = await redisIncr(id, windowMs);

  /* Redis did not answer. Rather than allowing outright, fall back to the local
     counter — it is weaker, but it is not nothing, and it is already warm. */
  if (count === null) return take(name, key, limit, windowMs);

  if (count > limit) {
    return { ok: false, retryAfterMs: windowMs, strikes: count - limit };
  }
  return { ok: true, retryAfterMs: 0, strikes: 0 };
}

/**
 * Note a failed attempt (a wrong password) in the shared counter.
 *
 * Strikes are advisory — they only decide how long somebody waits — so this
 * deliberately does not block on Redis being reachable, and the local strike is
 * always recorded as well.
 */
export async function strikeLimit(name, key, windowMs = 60000) {
  const local = strike(name, key);
  if (!hasSharedStore()) return local;

  const count = await redisIncr(`truce:rl:strike:${name}:${key}`, windowMs);
  return count === null ? local : Math.max(local, count);
}
