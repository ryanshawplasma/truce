import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEDIA_AUDIO_EXTS,
  clockDuration,
  isPlausibleMediaPath,
  mediaKind,
  mediaPathFor,
  pickAudioFormat,
} = await import('../lib/media.js');

/**
 * Voice notes share the photo bucket and are told apart by extension alone.
 * That makes the path the only thing deciding what a message IS, so every way
 * of getting a path wrong is worth a line here.
 */

/* -- what kind of thing is this? ------------------------------------------- */

test('the extension is what says photo or voice', () => {
  assert.equal(mediaKind('room00000001/abcdef123456.jpg'), 'photo');
  assert.equal(mediaKind('room00000001/abcdef123456.webm'), 'voice');
  assert.equal(mediaKind('room00000001/abcdef123456.m4a'), 'voice');
});

test('anything else is neither, rather than assumed to be a photo', () => {
  assert.equal(mediaKind('room00000001/abcdef123456.mp3'), null);
  assert.equal(mediaKind('no-extension-at-all'), null);
  assert.equal(mediaKind(''), null);
  assert.equal(mediaKind(null), null);
  assert.equal(mediaKind(undefined), null);
  assert.equal(mediaKind(42), null);
});

test('a dot in the folder does not count as an extension', () => {
  /* lastIndexOf finds the real one; a room id cannot contain a dot anyway,
     but the kind must not depend on that staying true. */
  assert.equal(mediaKind('room.name/abcdef123456.webm'), 'voice');
});

/* -- building a path ------------------------------------------------------- */

test('a path is built from the room, the id and the kind', () => {
  assert.equal(mediaPathFor('room00000001', 'abcdef123456'), 'room00000001/abcdef123456.jpg');
  assert.equal(mediaPathFor('room00000001', 'abcdef123456', 'webm'), 'room00000001/abcdef123456.webm');
  assert.equal(mediaPathFor('room00000001', 'abcdef123456', 'm4a'), 'room00000001/abcdef123456.m4a');
});

test('an extension we do not serve falls back to jpg rather than being honoured', () => {
  /* Otherwise this is a way to name an object anything at all. */
  for (const bad of ['exe', 'html', 'svg', '', null, undefined, '../x']) {
    assert.equal(mediaPathFor('room00000001', 'abcdef123456', bad), 'room00000001/abcdef123456.jpg');
  }
});

/* -- claiming a path ------------------------------------------------------- */

test('a voice note in your own room is allowed', () => {
  for (const ext of MEDIA_AUDIO_EXTS) {
    assert.equal(isPlausibleMediaPath(`room00000001/abcdef123456.${ext}`, 'room00000001'), true);
  }
});

test('audio does not widen the door for anything else', () => {
  /* The whole point of the allowlist is that adding two extensions does not
     turn the bucket into somewhere to park a file. */
  const room = 'room00000001';
  for (const bad of [
    'room00000001/abcdef123456.mp3',
    'room00000001/abcdef123456.html',
    'room00000001/abcdef123456.webm.html',
    'room00000001/abcdef123456.webm?x=1',
    'room00000001/../abcdef123456.webm',
    '/room00000001/abcdef123456.webm',
    'other0000001/abcdef123456.webm',
    'room00000001/ab.webm',
  ]) {
    assert.equal(isPlausibleMediaPath(bad, room), false, bad);
  }
});

/* -- how long was it? ------------------------------------------------------ */

test('a length reads as a clock, never as a number of milliseconds', () => {
  assert.equal(clockDuration(0), '0:00');
  assert.equal(clockDuration(7000), '0:07');
  assert.equal(clockDuration(61000), '1:01');
  assert.equal(clockDuration(600000), '10:00');
});

test('a missing or nonsense length still reads as a clock', () => {
  /* media_ms is null on every voice note recorded before the column existed,
     and Infinity is what a WebM file answers when asked its own duration. */
  for (const bad of [null, undefined, NaN, Infinity, -1, 'soon', {}]) {
    assert.match(clockDuration(bad), /^\d+:\d{2}$/);
  }
});

/* -- choosing a container -------------------------------------------------- */

test('opus is preferred where it is offered', () => {
  const chrome = { isTypeSupported: (t) => t.startsWith('audio/webm') };
  assert.deepEqual(pickAudioFormat(chrome), { mimeType: 'audio/webm;codecs=opus', ext: 'webm' });
});

test('safari gets mp4, because it will not give us webm', () => {
  const safari = { isTypeSupported: (t) => t.startsWith('audio/mp4') };
  assert.deepEqual(pickAudioFormat(safari), { mimeType: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' });
});

test('no recorder at all is null, not a guess', () => {
  /* getUserMedia is HTTPS-only, so this is also what an insecure page sees. */
  assert.equal(pickAudioFormat(null), null);
});

test('a recorder that supports nothing we can send is refused', () => {
  const useless = { isTypeSupported: () => false };
  assert.equal(pickAudioFormat(useless), null);
});
