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

const url = process.env.SUPABASE_URL;
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
  return category;
}
