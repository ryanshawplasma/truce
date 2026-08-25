import test from 'node:test';
import assert from 'node:assert/strict';

const { WAIT_WORTH_SAYING_MS, shouldMentionWait, waitedMs } = await import('../lib/waiting.js');

/**
 * The sentence under the signature says how long the letter waited. It is one
 * line on a page somebody is reading at an emotional moment, so the ways it can
 * be wrong are all ways of being tactless rather than ways of throwing.
 */

const HOUR = 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

test('the wait is measured from writing to opening', () => {
  const wrote = 1_000_000_000_000;
  assert.equal(waitedMs(iso(wrote), iso(wrote + 3 * HOUR)), 3 * HOUR);
});

test('an unopened card is still waiting, so it counts up to now', () => {
  const wrote = 1_000_000_000_000;
  assert.equal(waitedMs(iso(wrote), null, wrote + 5 * HOUR), 5 * HOUR);
});

test('once opened, the number stops moving', () => {
  /* The line has to say the same thing on the fifth reading as on the first.
     A wait that grew every time you looked at it would be nonsense. */
  const wrote = 1_000_000_000_000;
  const opened = wrote + 2 * HOUR;
  const first = waitedMs(iso(wrote), iso(opened), opened);
  const later = waitedMs(iso(wrote), iso(opened), opened + 400 * HOUR);
  assert.equal(first, later);
});

test('a card opened before it was written waited no time, not negative time', () => {
  /* Clock skew between the database and the reader's phone is ordinary. */
  const wrote = 1_000_000_000_000;
  assert.equal(waitedMs(iso(wrote), iso(wrote - HOUR)), 0);
});

test('an unknowable wait is null rather than a guess', () => {
  for (const bad of [null, undefined, '', 'whenever', {}]) {
    assert.equal(waitedMs(bad, null, Date.now()), null);
  }
  assert.equal(waitedMs(iso(Date.now()), 'nonsense'), null);
});

/* -- whether to say anything at all ---------------------------------------- */

test('a card opened straight away is not remarked on', () => {
  /* Somebody who opened it in twenty minutes kept nobody waiting, and saying
     so anyway is how an observed detail starts feeling generated. */
  const wrote = 1_000_000_000_000;
  assert.equal(shouldMentionWait(iso(wrote), null, wrote + 20 * 60 * 1000), false);
});

test('a wait over the threshold is worth a sentence', () => {
  const wrote = 1_000_000_000_000;
  assert.equal(shouldMentionWait(iso(wrote), null, wrote + WAIT_WORTH_SAYING_MS + 1), true);
});

test('exactly the threshold counts', () => {
  const wrote = 1_000_000_000_000;
  assert.equal(shouldMentionWait(iso(wrote), null, wrote + WAIT_WORTH_SAYING_MS), true);
});

test('an unknowable wait is never mentioned', () => {
  assert.equal(shouldMentionWait(null, null), false);
  assert.equal(shouldMentionWait('nonsense', null), false);
});

test('the threshold is hours, not minutes or weeks', () => {
  /* Minutes would make it filler on every card; weeks would mean it almost
     never appears and the code would rot unnoticed. */
  assert.ok(WAIT_WORTH_SAYING_MS >= HOUR);
  assert.ok(WAIT_WORTH_SAYING_MS <= 24 * HOUR);
});
