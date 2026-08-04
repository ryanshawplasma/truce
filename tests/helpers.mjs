/**
 * A fake Supabase client, good enough for the query shapes lib/couple.js uses.
 *
 * It is deliberately dumb: it records what was asked for and returns whatever
 * the test told it to. The point is not to reimplement PostgREST — it is to let
 * a test say "this deployment's couple_messages has no media_path column" and
 * watch the real code decide what to do about it.
 */

/** The 42703 PostgREST returns when a select names a column that is not there. */
export const MISSING_COLUMN = {
  code: '42703',
  message: 'column couple_messages.media_path does not exist',
  details: null,
  hint: null,
};

/**
 * @param {object} opts
 * @param {(q: object) => object} opts.respond  given the recorded query, return { data, error }
 */
export function fakeSupabase({ respond, storage } = {}) {
  const calls = [];

  const client = {
    calls,
    from(table) {
      const q = { table, select: '', insert: null, update: null, deleted: false, filters: [] };
      calls.push(q);

      const api = {
        select(cols) {
          q.select = cols || '';
          return api;
        },
        insert(row) {
          q.insert = row;
          return api;
        },
        update(patch) {
          q.update = patch;
          return api;
        },
        delete() {
          q.deleted = true;
          return api;
        },
        eq(col, val) {
          q.filters.push(['eq', col, val]);
          return api;
        },
        gt(col, val) {
          q.filters.push(['gt', col, val]);
          return api;
        },
        not(col, op, val) {
          q.filters.push(['not', col, op, val]);
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return api;
        },
        maybeSingle() {
          q.single = true;
          return api;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => respond(q))
            .then(resolve, reject);
        },
      };
      return api;
    },
    storage: {
      from() {
        return (
          storage || {
            createSignedUrls: async () => ({ data: [], error: null }),
            createSignedUploadUrl: async () => ({ data: null, error: { message: 'not configured' } }),
            remove: async () => ({ data: [], error: null }),
          }
        );
      },
    },
  };

  return client;
}

/**
 * Point lib/supabase.js at a fake.
 *
 * The env vars it checks are set in tests/register.mjs, not here — by the time
 * a test body runs, lib/supabase.js has already read them and made up its mind.
 */
export function useFakeSupabase(client) {
  globalThis.__truceSupabase = client;
  return client;
}
