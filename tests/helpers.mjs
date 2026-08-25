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
 * The same refusal, about a named column.
 *
 * Which column 42703 names is not decoration: lib/couple.js reads the name to
 * decide WHICH group of features to switch off, so a test that always says
 * "media_path" cannot tell a working dispatcher from one that guesses.
 */
export function missingColumn(name) {
  return {
    code: '42703',
    message: `column couple_messages.${name} does not exist`,
    details: null,
    hint: null,
  };
}

/** The columns added after the first release, newest group last. */
export const LATER_COLUMNS = ['reply_to', 'reactions', 'deleted_at', 'media_ms'];

/**
 * A database that has some columns and not others.
 *
 * `respond` is handed the query with the missing ones already accounted for:
 * a select naming an absent column fails the way PostgREST fails, and so does
 * an insert that tries to write one.
 */
export function withoutColumns(missing, onQuery) {
  const absent = (text) => missing.find((c) => String(text).includes(c));

  return (q) => {
    const badSelect = q.select ? absent(q.select) : null;
    if (badSelect) return { data: null, error: missingColumn(badSelect) };

    const written = q.insert || q.update;
    if (written) {
      const badWrite = absent(Object.keys(written).join(','));
      if (badWrite) return { data: null, error: missingColumn(badWrite) };
    }

    return onQuery(q);
  };
}

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
        like(col, pattern) {
          q.filters.push(['like', col, pattern]);
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
