import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSING_COLUMN, fakeSupabase, useFakeSupabase } from './helpers.mjs';

/**
 * The bug this file exists for.
 *
 * insertMessage asked for `media_path` back in its RETURNING list before the
 * column was known to exist. On a database that had not run the photos
 * migration, Postgres refused with 42703 and the message was never written —
 * but only on a server instance that had not done a read first, because the
 * flag that remembers "this column is missing" is per process. Same room, same
 * person, different answer depending on which lambda answered.
 *
 * Both cases are below. The first one is the one that shipped.
 */

async function freshCouple() {
  /* Each case needs the module's `mediaColumn` flag back at 'unknown', and that
     flag is module state — so re-import with a cache-busting query. */
  return import(`../lib/couple.js?case=${Math.random()}`);
}

test('a text message survives a database with no media_path column', async (t) => {
  await t.test('even when the send is the first thing this instance does', async () => {
    const rows = [];
    useFakeSupabase(
      fakeSupabase({
        respond(q) {
          if (String(q.select).includes('media_path')) return { data: null, error: MISSING_COLUMN };
          if (q.insert) {
            rows.push(q.insert);
            return { data: { id: 1, author: q.insert.author, body: q.insert.body, created_at: 'now' }, error: null };
          }
          return { data: [], error: null };
        },
      }),
    );

    const { insertMessage } = await freshCouple();
    const result = await insertMessage('room00000001', 1, 'are you awake?', null);

    assert.equal(result.error, undefined, 'the send must not fail');
    assert.equal(result.message.body, 'are you awake?');
    assert.equal(rows.length, 1, 'the row is written exactly once');
    assert.equal('media_path' in rows[0], false, 'and without the column that does not exist');
  });

  await t.test('and still works once a read has flagged the column missing', async () => {
    useFakeSupabase(
      fakeSupabase({
        respond(q) {
          if (String(q.select).includes('media_path')) return { data: null, error: MISSING_COLUMN };
          if (q.insert) return { data: { id: 2, author: 1, body: 'hi', created_at: 'now' }, error: null };
          return { data: [], error: null };
        },
      }),
    );

    const { insertMessage, listMessages, isMediaColumnMissing } = await freshCouple();
    await listMessages('room00000001', 0);
    assert.equal(isMediaColumnMissing(), true, 'the read notices first');

    const result = await insertMessage('room00000001', 1, 'hi', null);
    assert.equal(result.error, undefined);
  });
});

test('a PHOTO on the same database is refused, and says why', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond(q) {
        if (q.insert && 'media_path' in q.insert) return { data: null, error: MISSING_COLUMN };
        if (String(q.select).includes('media_path')) return { data: null, error: MISSING_COLUMN };
        return { data: { id: 3, author: 1, body: '', created_at: 'now' }, error: null };
      },
    }),
  );

  const { insertMessage } = await freshCouple();
  const result = await insertMessage('room00000001', 1, 'caption', 'room00000001/abcdef123456.jpg');

  assert.equal(result.setup, true, 'a photo genuinely has nowhere to go');
  assert.equal(result.message, undefined);
});

test('a healthy database is untouched by any of it', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond(q) {
        if (q.insert) {
          return {
            data: { id: 9, author: 1, body: q.insert.body, created_at: 'now', media_path: q.insert.media_path ?? null },
            error: null,
          };
        }
        return { data: [], error: null };
      },
    }),
  );

  const { insertMessage, isMediaColumnMissing } = await freshCouple();

  assert.equal((await insertMessage('room00000001', 1, 'words', null)).message.body, 'words');
  assert.equal(
    (await insertMessage('room00000001', 1, 'cap', 'room00000001/abcdef123456.jpg')).message.media_path,
    'room00000001/abcdef123456.jpg',
  );
  assert.equal(isMediaColumnMissing(), false, 'nothing was switched off');
});

test('listMessages returns oldest-first on a first load, newest-first from the wire', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond() {
        /* PostgREST was asked for id DESC, so this is what it hands back. */
        return {
          data: [
            { id: 3, author: 1, body: 'third', created_at: 'c' },
            { id: 2, author: 2, body: 'second', created_at: 'b' },
            { id: 1, author: 1, body: 'first', created_at: 'a' },
          ],
          error: null,
        };
      },
    }),
  );

  const { listMessages } = await freshCouple();
  const rows = await listMessages('room00000001', 0);
  assert.deepEqual(
    rows.map((r) => r.id),
    [1, 2, 3],
    'the room reads top to bottom, so the first load is flipped back',
  );

  /* An incremental poll is already ascending and must NOT be flipped. */
  const since = await listMessages('room00000001', 2);
  assert.deepEqual(since.map((r) => r.id), [3, 2, 1], 'a since-poll is passed through as-is');
});
