import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, sameGroup, splitLinks } from '../lib/chat.js';

/**
 * The message list's data layer.
 *
 * Grouping is what makes the room read like a chat rather than a stack of
 * boxes, and it has two edges that are easy to get wrong and almost impossible
 * to notice by looking: a run that tries to span midnight, and a run broken by
 * the other person answering. Both are pinned here.
 *
 * Timestamps are built with `new Date(y, m, d, h, min)` — local time, the same
 * clock the reader's browser uses — because that is what the grouping compares.
 */

const local = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).toISOString();

const msg = (author, created_at, body = 'hi') => ({ author, created_at, body });

const messagesOf = (rows) => rows.filter((r) => r.kind === 'message');

/* ------------------------------------------------------------------ grouping */

test('one person talking in a burst is a single run', () => {
  const rows = messagesOf(
    buildRows([
      msg(1, local(2026, 3, 4, 10, 0)),
      msg(1, local(2026, 3, 4, 10, 1)),
      msg(1, local(2026, 3, 4, 10, 2)),
    ]),
  );

  assert.deepEqual(
    rows.map((r) => [r.firstOfGroup, r.lastOfGroup]),
    [
      [true, false],
      [false, false],
      [false, true],
    ],
  );
});

test('the other person answering breaks the run', () => {
  const rows = messagesOf(
    buildRows([
      msg(1, local(2026, 3, 4, 10, 0)),
      msg(2, local(2026, 3, 4, 10, 1)),
      msg(1, local(2026, 3, 4, 10, 2)),
    ]),
  );

  /* Every one of them is alone, so every one gets both ends. */
  for (const row of rows) {
    assert.equal(row.firstOfGroup, true);
    assert.equal(row.lastOfGroup, true);
  }
});

test('a long silence breaks the run even for the same person', () => {
  const rows = messagesOf(
    buildRows([
      msg(1, local(2026, 3, 4, 10, 0)),
      msg(1, local(2026, 3, 4, 10, 4)), // inside the five-minute window
      msg(1, local(2026, 3, 4, 10, 30)), // well outside it
    ]),
  );

  assert.deepEqual(
    rows.map((r) => r.firstOfGroup),
    [true, false, true],
  );
});

test('a run never spans midnight, however close the clocks are', () => {
  const rows = buildRows([
    msg(1, local(2026, 3, 4, 23, 59)),
    msg(1, local(2026, 3, 5, 0, 1)), // two minutes later, but a different day
  ]);

  /* A date separator has to sit between them... */
  const kinds = rows.map((r) => r.kind);
  assert.deepEqual(kinds, ['date', 'message', 'date', 'message']);

  /* ...and neither message may be joined to the other across it. */
  const [a, b] = messagesOf(rows);
  assert.equal(a.lastOfGroup, true, 'the 23:59 message must end its run');
  assert.equal(b.firstOfGroup, true, 'the 00:01 message must start a new one');
});

test('an unreadable timestamp never groups with anything', () => {
  assert.equal(sameGroup(msg(1, 'not a date'), msg(1, local(2026, 3, 4, 10, 0))), false);
  assert.equal(sameGroup(msg(1, local(2026, 3, 4, 10, 0)), msg(1, 'not a date')), false);
});

test('an empty room produces no rows at all', () => {
  assert.deepEqual(buildRows([]), []);
});

/* --------------------------------------------------------------- link splitting */

test('a message with no link comes back as one text part', () => {
  assert.deepEqual(splitLinks('just words'), [{ type: 'text', value: 'just words' }]);
});

test('a link is separated from the words around it', () => {
  assert.deepEqual(splitLinks('look at https://example.com now'), [
    { type: 'text', value: 'look at ' },
    { type: 'link', value: 'https://example.com' },
    { type: 'text', value: ' now' },
  ]);
});

test('a full stop ending the sentence stays out of the link', () => {
  const parts = splitLinks('see https://example.com/page.');
  assert.equal(parts[1].value, 'https://example.com/page');
  assert.deepEqual(parts[2], { type: 'text', value: '.' });
});

test('two links in one message both survive', () => {
  const parts = splitLinks('https://a.example and https://b.example');
  assert.deepEqual(
    parts.filter((p) => p.type === 'link').map((p) => p.value),
    ['https://a.example', 'https://b.example'],
  );
});

test('only http(s) is ever turned into a link', () => {
  /* The bubble renders these into an href, so anything that could execute must
     stay inert text. */
  for (const nasty of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ]) {
    const parts = splitLinks(`try ${nasty} ok`);
    assert.equal(
      parts.some((p) => p.type === 'link'),
      false,
      `${nasty} must not become a link`,
    );
  }
});

test('markup in a message is never treated as a link', () => {
  const parts = splitLinks('<a href="https://evil.example">x</a>');
  /* The URL inside the attribute is bounded by a quote, which the pattern
     refuses to cross — and either way the caller renders text, not HTML. */
  const links = parts.filter((p) => p.type === 'link').map((p) => p.value);
  for (const link of links) assert.equal(link.includes('"'), false);
});

test('splitting is stable when called repeatedly', () => {
  /* A module-level global regex is easy to get wrong: if lastIndex leaked
     between calls, the second run would start from the middle. */
  const text = 'a https://example.com b';
  assert.deepEqual(splitLinks(text), splitLinks(text));
});

/* -- reactions -------------------------------------------------------------
   The column is jsonb, which means the value is whatever was written there —
   by this build, an older one, or somebody in the SQL editor. Every test here
   is about not trusting it. */

const { REACTIONS, isAllowedReaction, normaliseReactions, toggleReactionSet } =
  await import('../lib/chat.js');

test('pressing an emoji adds you, pressing it again takes you back', () => {
  const once = toggleReactionSet({}, '❤️', 1);
  assert.deepEqual(once, { '❤️': [1] });

  const twice = toggleReactionSet(once, '❤️', 1);
  /* Not an empty array left lying around — the key goes. */
  assert.deepEqual(twice, {});
});

test('both sides can hold the same emoji, and the order is stable', () => {
  const one = toggleReactionSet({}, '😂', 2);
  const both = toggleReactionSet(one, '😂', 1);
  assert.deepEqual(both, { '😂': [1, 2] });
});

test('one side letting go leaves the other holding it', () => {
  const both = toggleReactionSet({ '👍': [1, 2] }, '👍', 1);
  assert.deepEqual(both, { '👍': [2] });
});

test('an emoji outside the palette changes nothing', () => {
  assert.equal(isAllowedReaction('🦆'), false);
  assert.deepEqual(toggleReactionSet({ '❤️': [1] }, '🦆', 2), { '❤️': [1] });
});

test('junk in the column is thrown away, not trusted', () => {
  /* Every one of these has been a real shape at some point: null columns,
     a hand-edited row, an array where an object belongs. */
  assert.deepEqual(normaliseReactions(null), {});
  assert.deepEqual(normaliseReactions([]), {});
  assert.deepEqual(normaliseReactions('❤️'), {});
  assert.deepEqual(normaliseReactions({ '❤️': 'yes' }), {});
  assert.deepEqual(normaliseReactions({ '🦆': [1] }), {});
});

test('sides are forced to 1 or 2, and never duplicated', () => {
  assert.deepEqual(normaliseReactions({ '❤️': [1, 1, 1] }), { '❤️': [1] });
  assert.deepEqual(normaliseReactions({ '❤️': [3, 0, -1, 99] }), {});
  /* A string side is what a JSON round-trip through some clients produces. */
  assert.deepEqual(normaliseReactions({ '❤️': ['2'] }), { '❤️': [2] });
});

test('the palette is small enough to be a question, not a wall', () => {
  assert.ok(REACTIONS.length > 0 && REACTIONS.length <= 8);
  assert.equal(new Set(REACTIONS).size, REACTIONS.length);
});

/* -- search ---------------------------------------------------------------
   Over the window the room already holds. Every case here is about matching
   the way a person types, not the way the text was stored. */

const { foldForSearch, searchMessages, highlight } = await import('../lib/chat.js');

const said = (id, body, extra = {}) => ({ id, author: 1, body, created_at: 'now', ...extra });

test('search ignores case and accents, because typing does', () => {
  const rows = [said(1, 'meet me at the Café'), said(2, 'nowhere near')];
  const hits = searchMessages(rows, 'cafe');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 1);
});

test('results come back newest first', () => {
  const rows = [said(1, 'sorry'), said(2, 'sorry again'), said(3, 'and again, sorry')];
  assert.deepEqual(
    searchMessages(rows, 'sorry').map((m) => m.id),
    [3, 2, 1],
  );
});

test('an unsent message never turns up in a search', () => {
  /* Its body is empty in the database anyway — but a search that could surface
     something somebody took back would be a way of reading what they withdrew. */
  const rows = [said(1, 'the thing I regret', { deleted_at: 'now' }), said(2, 'fine')];
  assert.deepEqual(searchMessages(rows, 'regret'), []);
});

test('an empty query finds nothing rather than everything', () => {
  const rows = [said(1, 'anything')];
  for (const q of ['', '   ', null, undefined]) {
    assert.deepEqual(searchMessages(rows, q), []);
  }
});

test('search survives a list with holes in it', () => {
  assert.deepEqual(searchMessages([null, undefined, said(1, 'here')], 'here').length, 1);
  assert.deepEqual(searchMessages(null, 'here'), []);
});

test('highlight splits around every occurrence, keeping the original text', () => {
  const parts = highlight('sorry, truly sorry', 'sorry');
  assert.equal(parts.map((p) => p.text).join(''), 'sorry, truly sorry');
  assert.deepEqual(
    parts.filter((p) => p.hit).map((p) => p.text),
    ['sorry', 'sorry'],
  );
});

test('highlight preserves the original casing of what it matched', () => {
  const parts = highlight('Sorry', 'sorry');
  assert.deepEqual(parts, [{ text: 'Sorry', hit: true }]);
});

test('a precomposed accent highlights normally, keeping its accent', () => {
  /* "café" as one é character folds to the same LENGTH, so offsets line up and
     the match can be marked. This is what a phone keyboard produces, so it is
     the case that actually happens. */
  const parts = highlight('at the café now', 'cafe');
  assert.deepEqual(
    parts.filter((p) => p.hit).map((p) => p.text),
    ['café'],
    'the original accent survives being highlighted',
  );
  assert.equal(parts.map((p) => p.text).join(''), 'at the café now');
});

test('highlight refuses rather than mis-slicing when folding changes length', () => {
  /* The same word typed as e + a combining acute is one character LONGER than
     its folded form, so offsets taken from the folded string would cut the
     original in the wrong place and mangle the message to draw a mark on it.
     Better to show it plain: searchMessages still finds it, the highlight just
     declines to guess. */
  const decomposed = 'at the café now'; // e + combining acute, not é
  const parts = highlight(decomposed, 'cafe');

  assert.equal(parts.length, 1, 'one unsplit piece — the guard fired');
  assert.equal(parts[0].hit, false);
  assert.equal(parts[0].text, decomposed, 'and not a character was moved');

  /* The search itself is unaffected: it compares folded to folded and never
     indexes back into the original. */
  assert.equal(searchMessages([said(1, decomposed)], 'cafe').length, 1);
});

test('a query that matches nothing leaves the text in one piece', () => {
  assert.deepEqual(highlight('hello', 'zzz'), [{ text: 'hello', hit: false }]);
  assert.deepEqual(highlight('hello', ''), [{ text: 'hello', hit: false }]);
});

test('folding collapses runs of whitespace', () => {
  assert.equal(foldForSearch('  two   words  '), 'two words');
});

/* -- the unread line -------------------------------------------------------
   WhatsApp's "unread messages" divider: drawn once, where you left off, and
   only for things the other person said. */

const { firstUnreadId } = await import('../lib/chat.js');

const from = (id, author, body = 'x') => ({ id, author, body, created_at: local(2026, 3, 4, 10, id) });

test('the line sits above the first thing they said that you have not seen', () => {
  const rows = [from(1, 1), from(2, 2), from(3, 2)];
  assert.equal(firstUnreadId(rows, 1, 1), 2);
});

test('your own messages are never unread', () => {
  /* You were there. And sending from a laptop must not draw a line on a phone. */
  const rows = [from(1, 2), from(2, 1), from(3, 1)];
  assert.equal(firstUnreadId(rows, 1, 1), null);
});

test('nothing newer than what you read means no line at all', () => {
  const rows = [from(1, 2), from(2, 2)];
  assert.equal(firstUnreadId(rows, 2, 1), null);
});

test('a device that has never read anything starts from the beginning', () => {
  const rows = [from(1, 2), from(2, 2)];
  assert.equal(firstUnreadId(rows, 0, 1), 1);
});

test('an unusable last-read draws no line rather than guessing', () => {
  const rows = [from(1, 2)];
  for (const bad of [null, undefined, NaN, 'later', {}]) {
    assert.equal(firstUnreadId(rows, bad, 1), null);
  }
});

test('pending messages have no server id, so they cannot be the line', () => {
  /* An optimistic row's id is a negative timestamp. */
  const rows = [{ id: -17209, author: 2, body: 'in flight', created_at: local(2026, 3, 4, 10, 1) }, from(9, 2)];
  assert.equal(firstUnreadId(rows, 0, 1), 9);
});

test('buildRows draws the line once, below the date heading', () => {
  const rows = buildRows([from(1, 1), from(2, 2), from(3, 2)], new Date(2026, 2, 4, 12, 0), { unreadFrom: 2 });
  const kinds = rows.map((r) => r.kind);

  assert.deepEqual(kinds, ['date', 'message', 'unread', 'message', 'message']);
  /* Never between a heading and the day it introduces. */
  assert.notEqual(kinds.indexOf('unread'), kinds.indexOf('date') + 1);
});

test('buildRows without an unread id is exactly as it was', () => {
  const messages = [from(1, 1), from(2, 2)];
  const plain = buildRows(messages, new Date(2026, 2, 4, 12, 0));
  const explicit = buildRows(messages, new Date(2026, 2, 4, 12, 0), { unreadFrom: null });
  assert.deepEqual(plain, explicit);
  assert.equal(plain.some((r) => r.kind === 'unread'), false);
});

test('an unread id that is not in the list draws no line', () => {
  const rows = buildRows([from(1, 1)], new Date(2026, 2, 4, 12, 0), { unreadFrom: 999 });
  assert.equal(rows.some((r) => r.kind === 'unread'), false);
});

test('the line is drawn once even if the id appears twice', () => {
  /* buildRows takes whatever array it is handed. A list mid-merge — an
     optimistic row and its confirmed twin, say — must not grow two dividers
     saying the same thing. */
  const dupe = [from(1, 1), from(2, 2), { ...from(2, 2), body: 'again' }];
  const rows = buildRows(dupe, new Date(2026, 2, 4, 12, 0), { unreadFrom: 2 });

  assert.equal(rows.filter((r) => r.kind === 'unread').length, 1);
});
