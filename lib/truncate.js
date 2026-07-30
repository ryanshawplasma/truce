/**
 * Code-point-safe truncation.
 *
 * `"…😭".slice(0, n)` counts UTF-16 code units, so a cut can land *between* the
 * two halves of a surrogate pair and leave a lone surrogate behind. A lone
 * surrogate is not valid text: JSON.stringify happily emits it, and PostgREST
 * then rejects the whole insert as invalid UTF-8 — so a card silently fails to
 * save because somebody ended a sentence with an emoji.
 *
 * Array.from() iterates by code point, so a slice of it can never split a pair.
 * (It does not group ZWJ sequences like 👩‍👩‍👧 into one unit — that is fine.
 * The guarantee we need is "never produces invalid text", not "never splits a
 * family emoji".)
 *
 * Used on BOTH sides: the client trims for a live character count, the server
 * trims again because the client is never trusted.
 */

/** Trim `value` to at most `max` code points. Never returns a lone surrogate. */
export function truncate(value, max) {
  const str = String(value == null ? '' : value);
  if (!Number.isFinite(max) || max <= 0) return '';
  /* Fast path: no astral characters means length in code units == code points. */
  if (str.length <= max) return str;
  const points = Array.from(str);
  if (points.length <= max) return str;
  return points.slice(0, max).join('');
}

/** How long a string is in code points — what the limits above actually count. */
export function countChars(value) {
  return Array.from(String(value == null ? '' : value)).length;
}

/** Trim whitespace, normalise newlines, then truncate safely. */
export function tidyAndTruncate(value, max) {
  if (typeof value !== 'string') return '';
  return truncate(value.replace(/\r\n/g, '\n').trim(), max);
}
