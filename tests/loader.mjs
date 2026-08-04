/**
 * A tiny module loader so lib/ can be tested with plain `node --test`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything worth testing in Truce lives in lib/, and most of it starts with
 * `import 'server-only'` — a package that deliberately throws outside a React
 * Server Component. A couple of modules also reach for `next/headers` or the
 * Supabase client. None of that is available to a bare Node process, which is
 * how the project ended up with no tests at all and shipped a send bug that one
 * test would have caught.
 *
 * So: stub the three things that cannot load, and let everything else resolve
 * normally. No test framework, no transpiler, no dependencies — `npm test`
 * works on a clean checkout before `npm install` has finished.
 *
 * The Supabase stub is programmable. A test sets globalThis.__truceSupabase to
 * whatever fake client it wants and lib/supabase.js hands that to lib/couple.js,
 * which is how the real query paths get exercised without a database.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = pathToFileURL(path.resolve(import.meta.dirname, '..') + '/').href;
const PREFIX = 'truce-stub:';

const STUBS = {
  /* Throws by design outside an RSC. Here it is simply nothing. */
  'server-only': 'export {};',

  /* Reading headers in a test means "there are none", which is exactly the
     no-proxy fallback path clientKey() is supposed to handle. */
  'next/headers': `
    export async function headers() {
      const map = globalThis.__truceHeaders || new Map();
      return { get: (k) => map.get(String(k).toLowerCase()) ?? null };
    }
    export async function cookies() {
      const jar = (globalThis.__truceCookies ||= new Map());
      return {
        get: (k) => (jar.has(k) ? { name: k, value: jar.get(k) } : undefined),
        set: (k, v) => jar.set(k, v),
      };
    }
  `,

  /* Whatever the test put there, or a client that fails loudly if a test
     forgot to install one. */
  /* A live proxy, not the fake itself.
     lib/supabase.js caches its client in module scope, and re-importing
     lib/couple.js with a cache-busting query does not re-import lib/supabase.js
     — same URL, same module instance. Handing back the fake directly meant the
     first test in a file pinned its fake for every test after it. Forwarding on
     every call instead means a test can swap the fake whenever it likes. */
  '@supabase/supabase-js': `
    function live() {
      if (!globalThis.__truceSupabase) {
        throw new Error('test did not set globalThis.__truceSupabase');
      }
      return globalThis.__truceSupabase;
    }
    export function createClient() {
      return {
        from: (...args) => live().from(...args),
        storage: { from: (...args) => live().storage.from(...args) },
      };
    }
  `,

  /* Only used when node_modules is not installed — see resolve() below. */
  nanoid: `
    export function customAlphabet(alphabet, size) {
      return () => {
        let out = '';
        for (let i = 0; i < size; i += 1) out += alphabet[i % alphabet.length];
        return out;
      };
    }
  `,
};

export async function resolve(specifier, context, next) {
  /* The '@/…' alias jsconfig.json gives the app. */
  if (specifier.startsWith('@/')) {
    const target = new URL(specifier.slice(2), ROOT).href;
    try {
      return await next(target, context);
    } catch {
      return next(/\.[a-z]+$/i.test(target) ? target : `${target}.js`, context);
    }
  }

  if (specifier === 'server-only' || specifier === 'next/headers' || specifier === '@supabase/supabase-js') {
    return { url: PREFIX + specifier, shortCircuit: true };
  }

  /* Real nanoid if it is installed, a deterministic stand-in if it is not, so
     the suite runs before `npm install` has finished. */
  if (specifier === 'nanoid') {
    try {
      return await next(specifier, context);
    } catch {
      return { url: PREFIX + 'nanoid', shortCircuit: true };
    }
  }

  /* lib/couple.js says `from './supabase'`. Next's bundler fills in the
     extension; Node's ESM resolver refuses to guess. Try it verbatim, then try
     it with .js — which is the only extension in this project. */
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}

export async function load(url, context, next) {
  if (url.startsWith(PREFIX)) {
    return { format: 'module', source: STUBS[url.slice(PREFIX.length)], shortCircuit: true };
  }
  return next(url, context);
}
