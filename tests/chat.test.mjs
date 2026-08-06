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
