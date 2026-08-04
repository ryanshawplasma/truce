import test from 'node:test';
import assert from 'node:assert/strict';
import { DELETE_WINDOW_MS, readDeleteState } from '../lib/couple.js';
import { fakeSupabase, useFakeSupabase } from './helpers.mjs';

/**
 * Closing a corner takes two people, inside ten minutes.
 *
 * readDeleteState is the whole rule in one pure function, so this is where the
 * rule is actually pinned down. Everything else — the password check, the
 * delete itself — is plumbing around this decision.
 */

const NOW = Date.parse('2026-08-05T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

test('nobody has asked', () => {
  const s = readDeleteState({ delete_asked_1: null, delete_asked_2: null }, NOW);
  assert.deepEqual(s.asked, { 1: false, 2: false });
  assert.equal(s.both, false);
  assert.equal(s.msLeft, 0);
});

test('one side asks — nothing happens, and the clock starts', () => {
  const s = readDeleteState({ delete_asked_1: ago(60_000), delete_asked_2: null }, NOW);
  assert.deepEqual(s.asked, { 1: true, 2: false });
  assert.equal(s.both, false, 'one hand on the button is never enough');
  assert.equal(s.msLeft, DELETE_WINDOW_MS - 60_000);
});

test('both sides ask inside the window — that is the only way through', () => {
  const s = readDeleteState({ delete_asked_1: ago(5 * 60_000), delete_asked_2: ago(30_000) }, NOW);
  assert.equal(s.both, true);
});

test('both asked, but too far apart — the older one has expired', () => {
  const s = readDeleteState({ delete_asked_1: ago(11 * 60_000), delete_asked_2: ago(30_000) }, NOW);
  assert.equal(s.both, false, 'a stale ask is not an ask');
  assert.deepEqual(s.asked, { 1: false, 2: true }, 'and it stops being shown as one');
});

test('an ask exactly at the boundary still counts; one millisecond later does not', () => {
  const onTheLine = readDeleteState({ delete_asked_1: ago(DELETE_WINDOW_MS), delete_asked_2: ago(0) }, NOW);
  assert.equal(onTheLine.both, true);

  const justOver = readDeleteState({ delete_asked_1: ago(DELETE_WINDOW_MS + 1), delete_asked_2: ago(0) }, NOW);
  assert.equal(justOver.both, false);
});

test('the countdown belongs to the EARLIER ask, so it can only ever shrink', () => {
  const s = readDeleteState({ delete_asked_1: ago(9 * 60_000), delete_asked_2: ago(1000) }, NOW);
  assert.equal(s.msLeft, DELETE_WINDOW_MS - 9 * 60_000, 'showing the later ask would be a lie that grows');
});

test('withdrawing clears that side and stops the whole thing', () => {
  const before = readDeleteState({ delete_asked_1: ago(1000), delete_asked_2: ago(2000) }, NOW);
  assert.equal(before.both, true);

  const after = readDeleteState({ delete_asked_1: null, delete_asked_2: ago(2000) }, NOW);
  assert.equal(after.both, false, 'either person can call it off');
});

test('nonsense timestamps are treated as no ask at all, not as a crash', () => {
  for (const junk of ['', 'not-a-date', 0, undefined]) {
    const s = readDeleteState({ delete_asked_1: junk, delete_asked_2: ago(1000) }, NOW);
    assert.equal(s.both, false, `junk value ${JSON.stringify(junk)} must not open the door`);
  }
});

test('a missing row does not throw', () => {
  assert.equal(readDeleteState(null, NOW).both, false);
  assert.equal(readDeleteState(undefined, NOW).both, false);
});

/* ------------------------------------------------------------- destroyRoom */

test('the photos are removed BEFORE the room row', async () => {
  /* couple_messages cascades from couple_rooms. Deleting the room first takes
     the media_path values with it and leaves every object orphaned in the
     bucket — invisible, unreferenced, still billed. Order is the whole test. */
  const order = [];
  const removed = [];

  useFakeSupabase(
    fakeSupabase({
      respond(q) {
        if (q.deleted) {
          order.push(`delete:${q.table}`);
          return { data: null, error: null };
        }
        if (q.table === 'couple_messages') {
          order.push('list-photos');
          return {
            data: [{ media_path: 'room00000001/aaaaaaaaaaaa.jpg' }, { media_path: 'room00000001/bbbbbbbbbbbb.jpg' }],
            error: null,
          };
        }
        return { data: [], error: null };
      },
      storage: {
        createSignedUrls: async () => ({ data: [], error: null }),
        remove: async (paths) => {
          order.push('remove-objects');
          removed.push(...paths);
          return { data: [], error: null };
        },
      },
    }),
  );

  const { destroyRoom } = await import(`../lib/couple.js?destroy=${Math.random()}`);
  const result = await destroyRoom('room00000001');

  assert.equal(result.ok, true);
  assert.deepEqual(order, ['list-photos', 'remove-objects', 'delete:couple_rooms']);
  assert.equal(removed.length, 2, 'both photos are cleaned up');
});

test('a storage failure does not stop the room from being deleted', async () => {
  /* Somebody who asked twice, with a password, inside ten minutes has been
     unambiguous. Keeping their messages because a bucket call timed out would
     be the wrong way to fail. */
  let roomDeleted = false;

  useFakeSupabase(
    fakeSupabase({
      respond(q) {
        if (q.deleted) {
          roomDeleted = true;
          return { data: null, error: null };
        }
        if (q.table === 'couple_messages') {
          return { data: [{ media_path: 'room00000001/aaaaaaaaaaaa.jpg' }], error: null };
        }
        return { data: [], error: null };
      },
      storage: {
        createSignedUrls: async () => ({ data: [], error: null }),
        remove: async () => ({ data: null, error: { message: 'bucket unreachable', status: 500 } }),
      },
    }),
  );

  const { destroyRoom } = await import(`../lib/couple.js?destroy=${Math.random()}`);
  const result = await destroyRoom('room00000001');

  assert.equal(result.ok, true);
  assert.equal(roomDeleted, true, 'the corner still closes');
});
