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
