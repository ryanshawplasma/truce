/**
 * The card as a picture you can keep.
 *
 * Everything else about a card is a link, and links rot: the phone gets
 * replaced, the chat gets cleared, somebody tidies up a tab. For a thing whose
 * whole purpose is to be kept, "it lives at a URL" is a promise nobody should
 * have to rely on.
 *
 * The drawing itself is in app/c/[id]/keepsake/route.js. What lives here is the
 * handful of decisions that are just arithmetic — how big the words should be,
 * where to stop, whether there is anything to draw at all — because those are
 * the parts that break quietly and would otherwise only be visible by looking
 * at a picture.
 *
 * No server imports: the room's Save button needs the same idea of "can this
 * card be kept" as the route that would refuse it.
 */

/** 4:5 — the shape a phone gallery is happiest with. */
export const KEEPSAKE_WIDTH = 1080;
export const KEEPSAKE_HEIGHT = 1350;

/** Longer than the maker will accept, so this only ever catches the absurd. */
export const KEEPSAKE_MESSAGE_MAX = 1100;

/**
 * How big the letter can be before it stops fitting.
 *
 * There is no measuring: the renderer lays out once and never reports back, so
 * the size steps down by length instead. The thresholds are picked so that the
 * longest message the maker accepts still lands inside the panel rather than
 * running off the bottom edge of a picture somebody is keeping.
 */
export function bodySize(text) {
  const n = String(text || '').length;
  if (n <= 180) return 46;
  if (n <= 320) return 40;
  if (n <= 520) return 34;
  if (n <= 800) return 29;
  return 25;
}

/** A keepsake is not the place to be clever about overflow. */
export function clampText(text, max) {
  const s = String(text == null ? '' : text).trim();
  if (!Number.isFinite(max) || max <= 1) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The date under the signature.
 *
 * A card with no date renders no date — never "Invalid Date", which is the
 * default thing a Date does when handed nothing and would sit in the corner of
 * a keepsake forever.
 */
export function keepsakeDate(iso, locale = 'en-GB') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toDateString();
  }
}

/**
 * Can this card be turned into a picture at all?
 *
 * Three cannots, and each is a real card somebody is looking at right now:
 *
 *   local   the card lives in the URL fragment, which by definition never
 *           reaches a server, so there is nothing on the far end to draw.
 *   sealed  a time capsule that has not opened yet keeps its secret here too.
 *           Otherwise the seal is a front-door lock on a house with an open
 *           window.
 *   empty   no words, nothing to keep.
 */
export function canKeepsake(card, sealed = false) {
  if (!card) return false;
  if (sealed) return false;
  if (!card.id || card.id === 'local') return false;
  return Boolean(String(card.message || '').trim());
}

/** Where the picture lives. Same id, and therefore the same protection. */
export function keepsakePath(id) {
  return `/c/${encodeURIComponent(String(id))}/keepsake`;
}

/** What it should be called once it is in somebody's camera roll. */
export function keepsakeFilename(card) {
  const who = String((card && card.from_name) || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return who ? `truce-from-${who}.png` : 'truce-card.png';
}
