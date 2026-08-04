import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client.
 *
 * SECURITY MODEL
 * --------------
 * This uses the **service_role** key, which bypasses Row Level Security. It must
 * therefore never reach the browser:
 *   - the key is read from SUPABASE_SERVICE_ROLE_KEY (NOT NEXT_PUBLIC_*), so
 *     Next.js will not inline it into client bundles;
 *   - `import 'server-only'` makes the build fail loudly if a client component
 *     ever imports this file by accident;
 *   - every database call lives in a server component or a server action.
 *
 * Both tables have RLS enabled with no public policies, so even if the anon key
 * leaked, an anonymous client could read and write nothing. See supabase/schema.sql.
 */

/**
 * The project URL, normalised.
 *
 * supabase-js builds every request as `${url}/rest/v1/<table>`, so anything
 * extra on the end produces a path PostgREST does not recognise and every
 * single query fails with PGRST125 "Invalid path specified in request URL".
 *
 * The two ways to get this wrong are one keystroke apart in the dashboard:
 *
 *   https://abc.supabase.co/          a trailing slash -> a doubled slash
 *   https://abc.supabase.co/rest/v1   the Data API URL, which sits directly
 *                                     under "Project URL" and is the more
 *                                     tempting thing to copy
 *
 * Neither is a typo anybody spots by staring at it, and the error names the
 * URL rather than the setting, so it reads like the database is down. Trim
 * both, and say so in the log — a deployment that has been quietly repaired
 * should still tell its owner what it repaired.
 */
export function normaliseSupabaseUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/\/+$/, '')          // trailing slashes
    .replace(/\/rest\/v1$/i, '')   // the Data API URL pasted whole
    .replace(/\/+$/, '');         // and any slash that was hiding behind it

  if (cleaned !== raw) {
    console.warn(
      '[truce] SUPABASE_URL had a path or trailing slash on it and has been trimmed:',
      JSON.stringify({ given: raw, using: cleaned }),
      '\n[truce] Set it to just https://<project-ref>.supabase.co — supabase-js adds /rest/v1 itself.',
    );
  }
  return cleaned;
}

const url = normaliseSupabaseUrl(process.env.SUPABASE_URL);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the app has a database. When false, Truce runs in "no-setup mode". */
export function isSupabaseConfigured() {
  return Boolean(url && serviceKey);
}

let cached = null;

/**
 * Returns the Supabase client, or null when the project has no env vars yet.
 * Callers must handle null — the whole app is designed to work without a database.
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/* ============================================================================
   Reading a PostgREST failure properly
   ----------------------------------------------------------------------------
   Written after a production bug where creating a couple room failed on Vercel
   and worked in every local test. The cause was invisible for one reason: every
   database refusal — a missing table, a bad date, a duplicate name — collapsed
   into the same generic sentence, and only `error.message` was logged. Nothing
   in Vercel Logs said *which* refusal it was.
   ========================================================================== */

/**
 * Sort a PostgREST/Postgres error into something we can act on.
 *
 *  'schema'   the deployed database does not match this code — a table or
 *             column is missing. Almost always: supabase/schema.sql has not
 *             been re-run since the last feature landed. Not retryable.
 *  'duplicate'a unique index rejected the row (name taken, id clash).
 *  'badvalue' the value is the wrong shape for the column — the classic being
 *             '' sent to a `date` column, which Postgres rejects outright.
 *  'missing'  a NOT NULL column arrived empty.
 *  'fk'       the parent row is not there.
 *  'auth'     the key is wrong, or RLS refused it.
 *  'config'   this deployment's SUPABASE_URL is wrong — a path or a trailing
 *             slash. Not retryable, and not the database's fault.
 *  'network'  fetch never reached PostgREST.
 *  'unknown'  everything else — treat as transient and retryable.
 */
export function pgCategory(error) {
  if (!error) return null;
  const code = String(error.code || '');
  if (['PGRST204', 'PGRST205', '42P01', '42703'].includes(code)) return 'schema';
  if (code === '23505') return 'duplicate';
  if (['22007', '22P02', '22008', '22021'].includes(code)) return 'badvalue';
  if (code === '23502') return 'missing';
  if (code === '23503') return 'fk';
  if (['42501', 'PGRST301', 'PGRST302'].includes(code)) return 'auth';
  /* PGRST125 is not a database problem at all — PostgREST is saying the URL it
     was asked for is not one of its routes, which in practice always means
     SUPABASE_URL has a path or a trailing slash on it. It sat in 'unknown' and
     produced "we could not reach the database", which sent one deployment
     hunting a healthy database for hours. */
  if (['PGRST125', 'PGRST126'].includes(code)) return 'config';
  /* supabase-js wraps a failed fetch with no code at all. */
  if (!code && /fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(String(error.message || ''))) {
    return 'network';
  }
  return 'unknown';
}

/**
 * Log a database failure so Vercel Logs names the cause on its own.
 *
 * One line, one JSON object, always the same keys — greppable, and it includes
 * the `code` that `message` alone never tells you. Returns the category so the
 * caller can decide what the person on the other end should read.
 */
export function logPgError(scope, error, extra) {
  const category = pgCategory(error);
  console.error(
    `[truce] ${scope} failed:`,
    JSON.stringify({
      category,
      code: (error && error.code) || null,
      message: (error && error.message) || null,
      details: (error && error.details) || null,
      hint: (error && error.hint) || null,
      ...(extra || {}),
    }),
  );
  if (category === 'schema') {
    console.error(
      `[truce] ${scope}: the database is missing a table or column this build expects. ` +
        'Re-run supabase/schema.sql in the Supabase SQL editor, then redeploy.',
    );
  }
  if (category === 'config') {
    console.error(
      `[truce] ${scope}: PostgREST does not recognise the request path, which means ` +
        'SUPABASE_URL is wrong. It must be exactly https://<project-ref>.supabase.co — no ' +
        'trailing slash and no /rest/v1; supabase-js appends that itself. Fix it in your ' +
        'host\'s environment variables and REDEPLOY (env changes do not reach a running ' +
        'deployment on their own).',
    );
  }
  return category;
}

/* ============================================================================
   Reading a Supabase STORAGE failure properly
   ----------------------------------------------------------------------------
   Photos in Our corner live in a private bucket. The failure that actually
   happens in the wild is "the owner has not made the bucket yet", and it looks
   nothing like a Postgres error — it is a 404 with the words "Bucket not found"
   in it. Telling that apart from a genuine outage is the difference between
   "one quick setup step" and "try again later".
   ========================================================================== */

/**
 * Sort a storage error into something we can act on.
 *
 *  'nobucket' the bucket does not exist — supabase/schema.sql has a note on
 *             making it. Not retryable, and not the visitor's problem.
 *  'missing'  the OBJECT is not there (a deleted or never-finished upload).
 *  'auth'     the key was refused.
 *  'toobig'   the file exceeded the bucket's own size limit.
 *  'network'  the request never arrived.
 *  'unknown'  everything else — treat as transient.
 */
export function storageCategory(error) {
  if (!error) return null;
  const status = Number(error.status || error.statusCode || 0);
  const text = `${error.message || ''} ${error.error || ''}`.toLowerCase();

  if (text.includes('bucket not found')) return 'nobucket';
  if (text.includes('object not found') || text.includes('not_found')) return 'missing';
  if (status === 413 || text.includes('payload too large') || text.includes('maximum allowed size')) return 'toobig';
  if (status === 401 || status === 403 || text.includes('unauthorized') || text.includes('invalid signature')) return 'auth';
  if (!status && /fetch failed|network|enotfound|econnrefused|timeout/.test(text)) return 'network';
  if (status === 404) return 'missing';
  return 'unknown';
}

/**
 * Log a storage failure in the same one-line, greppable shape as logPgError,
 * and spell out the fix when the bucket is simply not there yet.
 */
export function logStorageError(scope, error, extra) {
  const category = storageCategory(error);
  console.error(
    `[truce] ${scope} failed:`,
    JSON.stringify({
      category,
      status: (error && (error.status || error.statusCode)) || null,
      message: (error && error.message) || null,
      ...(extra || {}),
    }),
  );
  if (category === 'nobucket') {
    console.error(
      `[truce] ${scope}: the storage bucket is missing. In Supabase → Storage → New bucket, ` +
        'create a PRIVATE bucket named exactly "corner-media". No policies are needed — only ' +
        'the service role ever touches it. See supabase/schema.sql.',
    );
  }
  return category;
}
