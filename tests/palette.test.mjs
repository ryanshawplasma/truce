import test from 'node:test';
import assert from 'node:assert/strict';

const { CARD_LOOKS, DEFAULT_LOOK, cardLook, isNightLook } = await import('../lib/palette.js');
const { THEME_IDS } = await import('../lib/constants.js');

/**
 * These colours are drawn by next/og, which has no browser and no cascade, so
 * nothing here fails at build time — a missing theme renders as a black
 * rectangle with invisible text in the one image a stranger sees in a chat.
 * The tests are the only thing standing between a new theme and that.
 */

const TOKENS = ['bg', 'panel', 'ink', 'soft', 'accent', 'accentDeep', 'envelope', 'fold', 'paper'];

test('every theme that exists has a palette', () => {
  /* THEME_IDS is the list of themes a sender can actually pick. Add a seventh
     and this fails here rather than in somebody's group chat. */
  for (const id of THEME_IDS) {
    assert.ok(CARD_LOOKS[id], `no palette for theme "${id}"`);
  }
});

test('no palette exists for a theme nobody can choose', () => {
  /* The other direction: a leftover entry means the file has drifted. */
  for (const id of Object.keys(CARD_LOOKS)) {
    assert.ok(THEME_IDS.includes(id), `palette for "${id}", which is not a theme`);
  }
});

test('every palette is complete', () => {
  for (const [id, look] of Object.entries(CARD_LOOKS)) {
    for (const token of TOKENS) {
      assert.ok(look[token], `theme "${id}" is missing ${token}`);
      assert.equal(typeof look[token], 'string');
    }
  }
});

test('every colour is a colour, not a CSS variable', () => {
  /* var(--t-ink) resolves to nothing in Satori and draws as black. The whole
     reason this file exists is that those renderers cannot read the cascade. */
  for (const [id, look] of Object.entries(CARD_LOOKS)) {
    for (const token of TOKENS) {
      assert.ok(!look[token].includes('var('), `theme "${id}" ${token} uses var()`);
    }
  }
});

test('an unknown theme falls back rather than returning undefined', () => {
  /* Undefined colours are the black-rectangle case. */
  for (const bad of ['neon', '', null, undefined, 42, {}]) {
    const look = cardLook(bad);
    assert.deepEqual(look, CARD_LOOKS[DEFAULT_LOOK]);
    for (const token of TOKENS) assert.ok(look[token]);
  }
});

test('a real theme comes back as itself', () => {
  assert.equal(cardLook('sky'), CARD_LOOKS.sky);
  assert.notEqual(cardLook('sky').accent, cardLook('blush').accent);
});

test('the default is a real theme', () => {
  assert.ok(THEME_IDS.includes(DEFAULT_LOOK));
});

test('the night themes are the dark ones', () => {
  assert.equal(isNightLook('moonlight'), true);
  assert.equal(isNightLook('midnight'), true);
  assert.equal(isNightLook('blush'), false);
  assert.equal(isNightLook(undefined), false);
});

test('ink and panel are not the same colour in any theme', () => {
  /* Text the colour of the paper it sits on is the failure this whole file is
     trying to make impossible, and it is invisible until somebody looks. */
  for (const [id, look] of Object.entries(CARD_LOOKS)) {
    assert.notEqual(look.ink.toLowerCase(), look.panel.toLowerCase(), `theme "${id}" is unreadable`);
  }
});
