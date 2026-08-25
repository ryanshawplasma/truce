import test from 'node:test';
import assert from 'node:assert/strict';

const {
  KEEPSAKE_MESSAGE_MAX,
  bodySize,
  canKeepsake,
  clampText,
  keepsakeDate,
  keepsakeFilename,
  keepsakePath,
} = await import('../lib/keepsake.js');

/**
 * The picture is drawn once and never measured, so everything that decides
 * whether it fits — or whether it should exist at all — is arithmetic that has
 * to be right the first time. A bug here is only visible by looking at a
 * finished image, which is exactly the sort of thing nobody looks at twice.
 */

/* -- how big the words are ------------------------------------------------- */

test('a short note is set large and a long one small', () => {
  assert.ok(bodySize('miss you') > bodySize('x'.repeat(900)));
});

test('the size never grows as the message grows', () => {
  /* Monotonic, or a message one character longer could suddenly get bigger and
     overflow the panel it just fitted inside. */
  let previous = Infinity;
  for (const n of [0, 100, 180, 181, 320, 321, 520, 521, 800, 801, 1100]) {
    const size = bodySize('x'.repeat(n));
    assert.ok(size <= previous, `size grew at length ${n}`);
    previous = size;
  }
});

test('a missing message still gets a usable size', () => {
  for (const bad of [null, undefined, 0, {}]) {
    assert.ok(bodySize(bad) > 0);
  }
});

/* -- where it stops -------------------------------------------------------- */

test('a message inside the limit is left exactly alone', () => {
  assert.equal(clampText('  hello  ', 50), 'hello');
});

test('a message over the limit ends in an ellipsis and fits', () => {
  const out = clampText('x'.repeat(200), 50);
  assert.equal(out.length, 50);
  assert.ok(out.endsWith('…'));
});

test('clamping never leaves a space stranded before the ellipsis', () => {
  const out = clampText(`${'x'.repeat(48)}   tail`, 50);
  assert.ok(!/\s…$/.test(out), out);
});

test('junk clamps to nothing rather than throwing', () => {
  for (const bad of [null, undefined, {}, 42]) {
    assert.equal(typeof clampText(bad, 50), 'string');
  }
  assert.equal(clampText('hello', 0), '');
  assert.equal(clampText('hello', NaN), '');
});

/* -- the date -------------------------------------------------------------- */

test('a real date reads as a date', () => {
  assert.match(keepsakeDate('2026-03-04T10:00:00.000Z'), /2026/);
});

test('no date and a broken date both render nothing at all', () => {
  /* "Invalid Date" is what a Date does when handed nothing, and it would sit
     in the corner of somebody's keepsake forever. */
  for (const bad of [null, undefined, '', 'whenever', {}, NaN]) {
    assert.equal(keepsakeDate(bad), '');
  }
});

/* -- whether there is anything to keep ------------------------------------- */

const card = { id: 'abc123', message: 'I am sorry', from_name: 'Alex' };

test('an ordinary opened card can be kept', () => {
  assert.equal(canKeepsake(card), true);
});

test('a sealed card cannot — the seal has to hold here too', () => {
  /* Otherwise the time capsule is a front-door lock on a house with an open
     window: the letter is readable as a picture before it has opened. */
  assert.equal(canKeepsake(card, true), false);
});

test('a local card cannot, because the server has never seen it', () => {
  assert.equal(canKeepsake({ ...card, id: 'local' }, false), false);
});

test('a card with no words cannot', () => {
  assert.equal(canKeepsake({ ...card, message: '   ' }), false);
  assert.equal(canKeepsake({ ...card, message: null }), false);
});

test('no card at all is not a crash', () => {
  assert.equal(canKeepsake(null), false);
  assert.equal(canKeepsake(undefined), false);
});

/* -- the address and the filename ------------------------------------------ */

test('the picture lives under the card it belongs to', () => {
  assert.equal(keepsakePath('abc123'), '/c/abc123/keepsake');
});

test('an id is escaped rather than pasted into a path', () => {
  assert.equal(keepsakePath('a/../b'), '/c/a%2F..%2Fb/keepsake');
});

test('the filename says who it is from, safely', () => {
  assert.equal(keepsakeFilename({ from_name: 'Alex' }), 'truce-from-alex.png');
  assert.equal(keepsakeFilename({ from_name: 'Anna Maria' }), 'truce-from-anna-maria.png');
});

test('a name that survives none of that still produces a filename', () => {
  /* A name in a script with no ASCII at all, or no name, must not end up as
     "truce-from-.png" or as a path separator. */
  for (const from of ['', null, undefined, '///', '🙂', 'こんにちは']) {
    const name = keepsakeFilename({ from_name: from });
    assert.equal(name, 'truce-card.png');
    assert.ok(!name.includes('/'));
  }
});

test('the clamp limit is generous enough not to cut real messages', () => {
  assert.ok(KEEPSAKE_MESSAGE_MAX >= 1000);
});
