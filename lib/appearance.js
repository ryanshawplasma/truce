/**
 * Appearance — the site-wide skin.
 *
 * Not to be confused with a card's *theme*. The two settings live side by side
 * and mean different things, so the words are used strictly:
 *
 *   Appearance  the whole site's palette (nav, landing, maker, /mine, /couple,
 *               /s, /dev, 404). A per-visitor preference kept in their own
 *               browser. Ships as "blush" (default) and "sky" (the cool one).
 *
 *   Theme       the palette of one card, chosen by its sender in the maker and
 *               carried inside the card. See lib/constants.js. A card always
 *               wears the theme its sender picked, whoever is reading it.
 *
 * How it is applied: as data-appearance on <html>, written by the tiny inline
 * script below *before the first paint* (see app/layout.js). Doing it any later
 * — in an effect, say — would show a flash of the wrong palette on every load.
 *
 * Storage rules, same as lib/mycards.js: localStorage may be missing, full or
 * blocked (private mode, "block cookies", a locked-down iframe). Every access
 * is wrapped and every failure is silent — the site simply stays on the default.
 */

export const APPEARANCE_KEY = 'truce.appearance';

export const DEFAULT_APPEARANCE = 'blush';

/** The two skins, in toggle order. Adding a third means adding a CSS block. */
export const APPEARANCES = [
  {
    id: 'sky',
    label: 'Sky',
    emoji: '💙',
    /* Drives <meta name="theme-color">, so the phone browser chrome matches. */
    themeColor: '#EAF4FE',
  },
  {
    id: 'blush',
    label: 'Blush',
    emoji: '🌸',
    themeColor: '#FFF7F2',
  },
];

export const APPEARANCE_IDS = APPEARANCES.map((a) => a.id);

/** Never trust a stored string — coerce anything unexpected to the default. */
export function safeAppearance(value) {
  return APPEARANCE_IDS.includes(value) ? value : DEFAULT_APPEARANCE;
}

export function appearanceMeta(id) {
  return APPEARANCES.find((a) => a.id === safeAppearance(id)) || APPEARANCES[0];
}

/** The one after this one, wrapping around. */
export function nextAppearance(id) {
  const i = APPEARANCE_IDS.indexOf(safeAppearance(id));
  return APPEARANCE_IDS[(i + 1) % APPEARANCE_IDS.length];
}

/** What the document is wearing right now. Browser only. */
export function currentAppearance() {
  if (typeof document === 'undefined') return DEFAULT_APPEARANCE;
  return safeAppearance(document.documentElement.getAttribute('data-appearance'));
}

export function readAppearance() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_APPEARANCE;
    return safeAppearance(window.localStorage.getItem(APPEARANCE_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeAppearance(id) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(APPEARANCE_KEY, safeAppearance(id));
  } catch {
    /* Storage blocked or full — the choice just won't survive a reload. */
  }
}

/**
 * Paint an appearance onto the document: the attribute every token hangs off,
 * plus the browser-chrome colour. Fires a `truce:appearance` event so anything
 * decorative that isn't CSS (the floating hearts) can follow along.
 */
export function applyAppearance(id) {
  if (typeof document === 'undefined') return;
  const meta = appearanceMeta(id);
  document.documentElement.setAttribute('data-appearance', meta.id);

  try {
    const tag = document.querySelector('meta[name="theme-color"]');
    if (tag) tag.setAttribute('content', meta.themeColor);
  } catch {
    /* no meta tag, no problem */
  }

  try {
    window.dispatchEvent(new CustomEvent('truce:appearance', { detail: meta.id }));
  } catch {
    /* CustomEvent is ancient; if it fails nothing depends on it */
  }
}

/**
 * The pre-paint boot script, inlined into <head> by app/layout.js.
 *
 * Deliberately hand-written ES5 in one line: it runs while the HTML is still
 * being parsed, before any bundle exists, so it cannot import anything. Keep it
 * boring and keep it small.
 */
export const APPEARANCE_BOOT_SCRIPT = [
  '(function(){try{',
  `var k=${JSON.stringify(APPEARANCE_KEY)},d=${JSON.stringify(DEFAULT_APPEARANCE)};`,
  'var v=null;try{v=window.localStorage.getItem(k)}catch(e){}',
  `if(${JSON.stringify(APPEARANCE_IDS)}.indexOf(v)<0)v=d;`,
  'document.documentElement.setAttribute("data-appearance",v);',
  `var c=v==="blush"?${JSON.stringify(APPEARANCES[1].themeColor)}:${JSON.stringify(APPEARANCES[0].themeColor)};`,
  'var m=document.querySelector(\'meta[name="theme-color"]\');',
  'if(m)m.setAttribute("content",c);',
  '}catch(e){}})()',
].join('');
