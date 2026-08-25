import test from 'node:test';
import assert from 'node:assert/strict';
import { LATER_COLUMNS, fakeSupabase, useFakeSupabase, withoutColumns } from './helpers.mjs';

/**
 * The database that has not run the upgrade yet.
 *
 * This is not a hypothetical: between deploying a release and pasting its SQL
 * into the dashboard, every corner is running new code against an old table.
 * That window is however long it takes somebody to find a laptop, and the
 * whole promise of the additive-column design is that nothing breaks inside it.
 *
 * So the question each of these asks is the same one: with the columns absent,
 * does the CONVERSATION still work? Reactions can be off. Replies can flatten.
 * A message must never fail to send.
 *
 * Every case re-imports lib/couple.js with a cache-busting query, because the
 * 'unknown' | 'present' | 'missing' flags are module state and a test that
 * inherited them from the previous test would be testing nothing.
 */

async function freshCouple() {
  return import(`../lib/couple.js?degrade=${Math.random()}`);
}

/* The four columns added after photos — the exact set a corner is missing if it
   ran the photos migration and nothing since. */
const NEW = LATER_COLUMNS;

function rowFrom(insert, id = 1) {
  return { id, author: insert.author, body: insert.body, created_at: 'now' };
}

/* -- the ordinary case: words, on a table that predates all of this --------- */

test('a plain message still sends when none of the new columns exist', async () => {
  const written = [];
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, (q) => {
        if (q.insert) {
          written.push(q.insert);
          return { data: rowFrom(q.insert), error: null };
        }
        return { data: [], error: null };
      }),
    }),
  );

  const { insertMessage } = await freshCouple();
  const result = await insertMessage('room00000001', 1, 'are you awake?', null);

  assert.equal(result.error, undefined, 'the send must not fail');
  assert.equal(result.message.body, 'are you awake?');
  assert.equal(written.length, 1, 'written exactly once, not once per retry');
});

test('the conversation still loads when none of the new columns exist', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, () => ({
        data: [{ id: 2, author: 2, body: 'always', created_at: 'now' }],
        error: null,
      })),
    }),
  );

  const { listMessages } = await freshCouple();
  const rows = await listMessages('room00000001', 0);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].body, 'always');
});

/* -- a reply, with nowhere to put the reply ------------------------------- */

test('a reply becomes an ordinary message rather than a failed send', async () => {
  const written = [];
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, (q) => {
        if (q.insert) {
          written.push(q.insert);
          return { data: rowFrom(q.insert, 7), error: null };
        }
        return { data: [], error: null };
      }),
    }),
  );

  const { insertMessage } = await freshCouple();
  const result = await insertMessage('room00000001', 1, 'this one', null, 4);

  assert.equal(result.error, undefined, 'answering something must not fail the send');
  assert.equal(result.message.body, 'this one');

  const landed = written[written.length - 1];
  assert.equal('reply_to' in landed, false, 'and lands without the column that is not there');
});

/* -- a voice note, with nowhere to put its length -------------------------- */

test('a voice note still sends when media_ms is missing; it just loses its length', async () => {
  const written = [];
  useFakeSupabase(
    fakeSupabase({
      /* media_ms alone — the state of a corner that ran the reply/reactions
         upgrade and not the one after it. */
      respond: withoutColumns(['media_ms'], (q) => {
        if (q.insert) {
          written.push(q.insert);
          return { data: { ...rowFrom(q.insert, 9), media_path: q.insert.media_path }, error: null };
        }
        return { data: [], error: null };
      }),
    }),
  );

  const { insertMessage } = await freshCouple();
  const result = await insertMessage('room00000001', 1, '', 'room00000001/abcdef123456.webm', null, 4200);

  assert.equal(result.error, undefined, 'a recording must not fail to send over its own duration');
  const landed = written[written.length - 1];
  assert.equal(landed.media_path, 'room00000001/abcdef123456.webm');
  assert.equal('media_ms' in landed, false);
});

test('a missing media_ms does not take reactions down with it', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(['media_ms'], (q) => {
        if (q.insert) return { data: rowFrom(q.insert), error: null };
        return { data: [], error: null };
      }),
    }),
  );

  const { insertMessage, areExtrasMissing } = await freshCouple();
  await insertMessage('room00000001', 1, 'hello', null);

  /* The whole reason media_ms has its own flag. Grouped with the others, one
     absent column would switch off three working features. */
  assert.equal(areExtrasMissing(), false, 'reply and reactions must stay on');
});

/* -- the features that genuinely cannot work ------------------------------- */

test('reacting says setup rather than throwing', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, () => ({ data: [], error: null })),
    }),
  );

  const { toggleReaction, listMessages } = await freshCouple();
  /* A read first, so the flag is set the way it would be in a live process. */
  await listMessages('room00000001', 0);

  const result = await toggleReaction('room00000001', 1, 1, '❤️');
  assert.equal(result.setup, true);
  assert.equal(result.reactions, undefined);
});

test('unsending says setup rather than throwing', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, () => ({ data: [], error: null })),
    }),
  );

  const { softDeleteMessage, listMessages } = await freshCouple();
  await listMessages('room00000001', 0);

  const result = await softDeleteMessage('room00000001', 1, 1);
  assert.equal(result.setup, true);
});

/* -- the flags themselves -------------------------------------------------- */

test('a database missing everything narrows once and then stops asking', async () => {
  let selects = 0;
  /* Counted OUTSIDE withoutColumns, so the FAILED attempts count too. Counting
     inside only sees the ones that worked, which is the same number whether
     the flag remembers or not — and would pass a build that had forgotten how
     to remember. */
  const answer = withoutColumns(NEW, () => ({ data: [], error: null }));
  useFakeSupabase(
    fakeSupabase({
      respond: (q) => {
        if (q.select) selects += 1;
        return answer(q);
      },
    }),
  );

  const { listMessages } = await freshCouple();

  await listMessages('room00000001', 0);
  const afterFirst = selects;

  await listMessages('room00000001', 0);
  const afterSecond = selects - afterFirst;

  /* The first load pays for the discovery. The second must not: a flag that
     forgets turns every poll into a burst of failing queries, four seconds
     apart, forever. */
  assert.equal(afterSecond, 1, 'the second load asks exactly once');
});

test('the column named in the error is the one that gets switched off', async () => {
  let selects = 0;
  const answer = withoutColumns(['reactions'], (q) => {
    if (q.insert) return { data: rowFrom(q.insert), error: null };
    return { data: [], error: null };
  });
  useFakeSupabase(
    fakeSupabase({
      /* Outside, so the refused attempt counts as well as the one that works. */
      respond: (q) => {
        if (q.select) selects += 1;
        return answer(q);
      },
    }),
  );

  const { listMessages, areExtrasMissing, isMediaColumnMissing, isDurationColumnMissing } =
    await freshCouple();
  await listMessages('room00000001', 0);

  assert.equal(areExtrasMissing(), true, 'reactions is in the extras group');

  /* The two groups that had nothing to do with it must be untouched.
     These are the assertions that fail if the dispatcher stops reading the
     column name out of the error and starts working down the list instead:
     the retry loop still converges on a working query either way, so the only
     visible difference is the working features it turned off to get there. */
  assert.equal(isMediaColumnMissing(), false, 'photos must not be collateral');
  assert.equal(isDurationColumnMissing(), false, 'voice-note lengths must not be collateral');

  /* And it should have cost one narrowing, not three. */
  assert.equal(selects, 2, 'one failed select, then one that works');
});

/* -- voice notes must not turn up in the photo gallery ---------------------
   They share the column and the bucket, so "has a media_path" stopped being
   the same question as "is a photo" the moment recordings existed. */

test('the Gallery asks the database for photos, not for anything with a path', async () => {
  let mediaQuery = null;
  useFakeSupabase(
    fakeSupabase({
      respond: (q) => {
        if (q.filters.some((f) => f[1] === 'media_path')) mediaQuery = q;
        return { data: [], error: null };
      },
    }),
  );

  const { listRoomMedia } = await freshCouple();
  await listRoomMedia('room00000001');

  assert.ok(mediaQuery, 'the gallery query happened');

  const like = mediaQuery.filters.find((f) => f[0] === 'like' && f[1] === 'media_path');
  assert.ok(like, 'it constrains media_path by shape');
  assert.equal(like[2], '%.jpg', 'and the shape is a photo');

  /* Doing this in JavaScript after the fact would work and would also page
     through recordings to find the photos, so the limit would start lying. */
});

/* -- editing, on a table with no edited_at -------------------------------- */

test('editing says setup rather than throwing', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(NEW, () => ({ data: [], error: null })),
    }),
  );

  const { editMessage, listMessages } = await freshCouple();
  await listMessages('room00000001', 0);

  const result = await editMessage('room00000001', 1, 1, 'second thoughts');
  assert.equal(result.setup, true);
});

test('a missing edited_at does not take reply, reactions or lengths with it', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: withoutColumns(['edited_at'], (q) => {
        if (q.insert) return { data: rowFrom(q.insert), error: null };
        return { data: [], error: null };
      }),
    }),
  );

  const { listMessages, areExtrasMissing, isDurationColumnMissing, isEditColumnMissing } =
    await freshCouple();
  await listMessages('room00000001', 0);

  assert.equal(isEditColumnMissing(), true, 'editing is the thing that is off');
  assert.equal(areExtrasMissing(), false, 'reply and reactions keep working');
  assert.equal(isDurationColumnMissing(), false, 'voice-note lengths keep working');
});

/* -- the rules editing enforces regardless of schema ---------------------- */

test('you cannot edit the other person\u2019s message', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: () => ({
        data: { id: 5, author: 2, body: 'theirs', media_path: null, deleted_at: null },
        error: null,
      }),
    }),
  );

  const { editMessage } = await freshCouple();
  const result = await editMessage('room00000001', 5, 1, 'not yours to change');

  assert.match(result.error, /your own/);
});

test('a photo or a voice note cannot be edited into something else', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: () => ({
        data: { id: 6, author: 1, body: 'caption', media_path: 'room00000001/abcdef123456.jpg', deleted_at: null },
        error: null,
      }),
    }),
  );

  const { editMessage } = await freshCouple();
  const result = await editMessage('room00000001', 6, 1, 'a different caption');

  assert.match(result.error, /cannot be edited/);
});

test('an unsent message cannot be edited back into existence', async () => {
  useFakeSupabase(
    fakeSupabase({
      respond: () => ({
        data: { id: 7, author: 1, body: '', media_path: null, deleted_at: 'now' },
        error: null,
      }),
    }),
  );

  const { editMessage } = await freshCouple();
  const result = await editMessage('room00000001', 7, 1, 'undo that');

  assert.match(result.error, /unsent/);
});

test('saving the same words is not an edit, and stamps nothing', async () => {
  let wrote = false;
  useFakeSupabase(
    fakeSupabase({
      respond: (q) => {
        if (q.update) wrote = true;
        return {
          data: { id: 8, author: 1, body: 'unchanged', media_path: null, deleted_at: null },
          error: null,
        };
      },
    }),
  );

  const { editMessage } = await freshCouple();
  const result = await editMessage('room00000001', 8, 1, 'unchanged');

  assert.equal(result.unchanged, true);
  /* Writing anyway would stamp "edited" onto a message nobody changed. */
  assert.equal(wrote, false, 'no write happens at all');
});
