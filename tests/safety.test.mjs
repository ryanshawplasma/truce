import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlausibleMediaPath, mediaPathFor } from '../lib/media.js';
import { countChars, tidyAndTruncate, truncate } from '../lib/truncate.js';
import { __resetThrottles, backoffMs, take } from '../lib/throttle.js';

/* -------------------------------------------------------------- media paths */

test('a room can only ever claim a photo in its own folder', () => {
  const mine = 'room00000001';
  const theirs = 'room00000002';

  assert.equal(isPlausibleMediaPath(mediaPathFor(mine, 'abcdef1234567890'), mine), true);
  assert.equal(isPlausibleMediaPath(mediaPathFor(theirs, 'abcdef1234567890'), mine), false);
});

test('nothing shaped like an escape gets through', () => {
  const room = 'room00000001';
  const nope = [
    '../room00000002/abcdef123456.jpg',
    'room00000001/../room00000002/abcdef123456.jpg',
    '/room00000001/abcdef123456.jpg',
    'room00000001/abcdef123456.jpg?x=1',
    'room00000001/abcdef123456.png',
    'room00000001/short.jpg',
    'room00000001/sub/folder/abcdef123456.jpg',
    'room00000001%2Fabcdef123456.jpg',
    'room00000001/' + 'a'.repeat(200) + '.jpg',
    '',
    null,
    undefined,
    42,
  ];
  for (const p of nope) {
    assert.equal(isPlausibleMediaPath(p, room), false, `${JSON.stringify(p)} must be refused`);
  }
});

/* ---------------------------------------------------------------- truncation */

test('a cut never lands inside an emoji', () => {
  /* A lone surrogate is invalid text; PostgREST rejects the whole insert, which
     is how a card once failed to save because a sentence ended in 😭. */
  const text = 'a'.repeat(9) + '😭';
  const cut = truncate(text, 10);
  assert.equal(countChars(cut), 10);
  assert.equal(cut.endsWith('😭'), true);
  /* Iterating by code point is the check that means anything: a valid pair
     yields one character above U+FFFF, a broken one yields a bare surrogate. */
  const lone = [...cut].some((ch) => {
    const cp = ch.codePointAt(0);
    return cp >= 0xd800 && cp <= 0xdfff;
  });
  assert.equal(lone, false, 'no unpaired surrogate anywhere in the result');
});

test('tidyAndTruncate trims, normalises newlines and refuses non-strings', () => {
  assert.equal(tidyAndTruncate('  hello \r\n world  ', 100), 'hello \n world');
  assert.equal(tidyAndTruncate(null, 100), '');
  assert.equal(tidyAndTruncate(undefined, 100), '');
  assert.equal(tidyAndTruncate(12345, 100), '');
  assert.equal(truncate('anything', 0), '');
  assert.equal(truncate('anything', NaN), '');
});

/* ----------------------------------------------------------------- throttles */

test('a fixed window lets exactly `limit` through, then stops', () => {
  __resetThrottles();
  const results = [];
  for (let i = 0; i < 7; i += 1) results.push(take('t', 'k', 5, 60_000).ok);
  assert.deepEqual(results, [true, true, true, true, true, false, false]);
});

test('separate keys have separate budgets', () => {
  __resetThrottles();
  for (let i = 0; i < 5; i += 1) take('t', 'a', 5, 60_000);
  assert.equal(take('t', 'a', 5, 60_000).ok, false, 'a is spent');
  assert.equal(take('t', 'b', 5, 60_000).ok, true, 'b is untouched');
});

test('backoff rises and then stops rising', () => {
  assert.equal(backoffMs(0), 0);
  assert.equal(backoffMs(1), 0, 'one fumbled password costs nothing');
  assert.equal(backoffMs(2) > 0, true);
  assert.equal(backoffMs(3) > backoffMs(2), true);
  assert.equal(backoffMs(50), backoffMs(20), 'and it is capped');
  assert.equal(backoffMs(50) <= 4000, true);
});

test('the limiter fails open rather than locking anybody out', () => {
  __resetThrottles();
  /* Nonsense arguments must never produce a refusal — a broken speed bump has
     to let traffic through, not become an outage. A limit of 0 is NOT nonsense:
     it means "allow nothing", and it is respected. */
  assert.equal(take(undefined, undefined, undefined, undefined).ok, true);
  assert.equal(take('t', 'k', null, null).ok, true);
  assert.equal(take('t', 'zero', 0, 60_000).ok, false, 'an explicit zero still means zero');
});

/* ------------------------------------------------------- the SUPABASE_URL trap */

test('SUPABASE_URL is trimmed back to the bare project origin', async () => {
  /* supabase-js appends /rest/v1 itself. Anything already on the end produces a
     path PostgREST does not route, and EVERY query dies with PGRST125 —
     "Invalid path specified in request URL", which reads like the database is
     down rather than like a settings typo. */
  const { normaliseSupabaseUrl } = await import('../lib/supabase.js');
  const want = 'https://abcdefgh.supabase.co';

  for (const given of [
    'https://abcdefgh.supabase.co',
    'https://abcdefgh.supabase.co/',
    'https://abcdefgh.supabase.co///',
    'https://abcdefgh.supabase.co/rest/v1',
    'https://abcdefgh.supabase.co/rest/v1/',
    '  https://abcdefgh.supabase.co/rest/v1  ',
    'https://abcdefgh.supabase.co/REST/V1',
  ]) {
    assert.equal(normaliseSupabaseUrl(given), want, `${JSON.stringify(given)} should normalise`);
  }
});

test('an empty or missing SUPABASE_URL stays empty rather than becoming junk', async () => {
  const { normaliseSupabaseUrl } = await import('../lib/supabase.js');
  for (const given of ['', '   ', null, undefined]) {
    assert.equal(normaliseSupabaseUrl(given), '', 'no database configured must stay that way');
  }
});

test('PGRST125 is named as a configuration fault, not a mystery', async () => {
  const { pgCategory } = await import('../lib/supabase.js');
  assert.equal(pgCategory({ code: 'PGRST125' }), 'config');
  assert.equal(pgCategory({ code: '42P01' }), 'schema');
  assert.equal(pgCategory({ code: '23505' }), 'duplicate');
  assert.equal(pgCategory({ message: 'fetch failed' }), 'network');
  assert.equal(pgCategory(null), null);
});
