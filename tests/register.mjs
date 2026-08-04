/**
 * Installs the loader in tests/loader.mjs. Used via `node --import` — see the
 * `test` script in package.json.
 */
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);

/**
 * lib/supabase.js reads its env vars at MODULE LOAD:
 *
 *   const url = process.env.SUPABASE_URL;
 *
 * so isSupabaseConfigured() is decided the first time anything imports it —
 * before a test body has had a chance to run. Setting these from inside a test
 * is too late, and the symptom is baffling: every database call quietly returns
 * "no database configured" and assertions fail with `undefined`.
 *
 * `--import` runs before any test module is evaluated, so this is the only
 * place early enough. The values are nonsense on purpose — the client itself is
 * stubbed in loader.mjs and never makes a request.
 */
process.env.SUPABASE_URL ||= 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.ADMIN_SECRET ||= 'a-long-random-string-for-tests';
