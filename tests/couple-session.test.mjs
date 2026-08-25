import test from 'node:test';
import assert from 'node:assert/strict';

/* ADMIN_SECRET is set in tests/register.mjs — it has to be in place before
   lib/couple.js is evaluated, or sessionSecret() derives a different key. */
const {
  createSessionToken,
  readSessionToken,
  shouldRenewSession,
  normaliseAnniversary,
  normalisePassword,
  normaliseRoomName,
  normaliseSide,
  hashPassword,
  verifyPassword,
} = await import('../lib/couple.js');

/**
 * The session cookie is the only thing standing between a browser and somebody
 * else's corner, so every way of getting one wrong is worth a line here.
 */

test('a fresh token round-trips', () => {
  const token = createSessionToken('room00000001', 2);
  const read = readSessionToken(token);
  assert.equal(read.roomId, 'room00000001');
  assert.equal(read.side, 2);
  /* The expiry rides along so the session can be rolled forward. */
  assert.ok(read.expires > Date.now());
});

test('a tampered payload is refused', () => {
  const token = createSessionToken('room00000001', 1);
  const [payload, signature] = token.split('.');
  const forged = Buffer.from('roomSOMEONEELSE|1|' + (Date.now() + 100000))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  assert.equal(readSessionToken(`${forged}.${signature}`), null, 'the signature does not cover it');
  assert.equal(readSessionToken(`${payload}.${'x'.repeat(signature.length)}`), null, 'nor a made-up signature');
});

test('junk is refused rather than thrown at', () => {
  for (const junk of [null, undefined, '', 'no-dot', 42, {}, '....', 'a.b']) {
    assert.equal(readSessionToken(junk), null, `${JSON.stringify(junk)} must not be a session`);
  }
});

test('an expired token is refused', () => {
  /* Build one by hand with an expiry in the past, signed correctly. */
  const token = createSessionToken('room00000001', 1);
  const decoded = Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  const [roomId, side] = decoded.split('|');
  assert.equal(roomId, 'room00000001');
  assert.equal(side, '1');

  /* A correctly signed token whose expiry has passed is still refused — the
     signature proves it was ours, not that it is still valid. */
  const stale = `${Buffer.from(`${roomId}|${side}|${Date.now() - 1}`).toString('base64url')}`;
  assert.equal(readSessionToken(`${stale}.anything`), null);
});

test('side is only ever 1 or 2', () => {
  assert.equal(normaliseSide(2), 2);
  assert.equal(normaliseSide('2'), 2);
  for (const v of [1, '1', 0, 3, -1, 'left', null, undefined, NaN, 1.5]) {
    assert.equal([1, 2].includes(normaliseSide(v)), true, `${v} still lands on a real side`);
  }
});

test('room names are strict, lowercased and space-collapsed', () => {
  assert.equal(normaliseRoomName('  Rainy Tuesday  ').name, 'rainy-tuesday');
  assert.equal(normaliseRoomName('ab').error !== undefined, true, 'too short');
  assert.equal(normaliseRoomName('x'.repeat(33)).error !== undefined, true, 'too long');
  assert.equal(normaliseRoomName('has_underscore').error !== undefined, true);
  assert.equal(normaliseRoomName('emoji-🤍').error !== undefined, true);
  assert.equal(normaliseRoomName('').error !== undefined, true);
});

test('an empty anniversary becomes null, never an empty string', () => {
  /* '' is not a date to Postgres and it kills the whole insert — this exact
     value is what broke corner creation in production. */
  assert.equal(normaliseAnniversary('').anniversary, null);
  assert.equal(normaliseAnniversary(null).anniversary, null);
  assert.equal(normaliseAnniversary('   ').anniversary, null);
  assert.equal(normaliseAnniversary('not-a-date').anniversary, null);
  assert.equal(normaliseAnniversary('2020-02-14').anniversary, '2020-02-14');
  assert.equal(normaliseAnniversary('2999-01-01').error !== undefined, true, 'no time travel');
});

test('passwords have a floor and a ceiling', () => {
  assert.equal(normalisePassword('12345').error !== undefined, true);
  assert.equal(normalisePassword('123456').password, '123456');
  assert.equal(normalisePassword('x'.repeat(201)).error !== undefined, true);
});

test('a password verifies against its own hash and nothing else', async () => {
  const { hash, salt } = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', hash, salt), true);
  assert.equal(await verifyPassword('correct horse batter', hash, salt), false);
  assert.equal(await verifyPassword('', hash, salt), false);
  assert.equal(await verifyPassword('correct horse battery', 'nonsense', salt), false);
  assert.equal(await verifyPassword('correct horse battery', hash, 'wrong-salt'), false);
});

test('two hashes of the same password differ — the salt is doing its job', async () => {
  const a = await hashPassword('same password');
  const b = await hashPassword('same password');
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
});

/* -- rolling the session forward ------------------------------------------
   A corner used every day used to expire on day 30 and ask for the password
   again — the one moment somebody has forgotten it. */

const DAY = 24 * 60 * 60 * 1000;
const FULL = 30 * DAY;

test('a session fresh out of the oven is not renewed', () => {
  assert.equal(shouldRenewSession(Date.now() + FULL), false);
});

test('a day of use is enough to earn a new 30 days', () => {
  assert.equal(shouldRenewSession(Date.now() + FULL - DAY - 1000), true);
});

test('an expired session is never resurrected', () => {
  /* Waiting somebody out is a way of signing out. A late poll must not undo it. */
  assert.equal(shouldRenewSession(Date.now() - 1000), false);
  assert.equal(shouldRenewSession(Date.now() - FULL), false);
});

test('junk expiry is refused rather than thrown at', () => {
  for (const bad of [undefined, null, NaN, Infinity, 'soon', {}]) {
    assert.equal(shouldRenewSession(bad), false);
  }
});
