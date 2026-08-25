/**
 * How long the letter sat there before it was opened.
 *
 * WHY A CARD SAYS THIS AT ALL
 * ---------------------------
 * A link has no author in it. You open a URL and words appear, and nothing
 * about that says a person wrote them at a particular moment and then went
 * away and waited. Putting the wait back is the cheapest way to make the
 * sender present in the room: "four days ago" is a fact about them, not about
 * the page.
 *
 * WHAT IT MUST NOT DO
 * -------------------
 * Blame the reader. "You took four days to open this" is the same number
 * pointed the other way, and it turns a reunion into an accusation — the exact
 * opposite of what the card is for. Everything here is phrased as a fact about
 * the letter and the person who wrote it. The reader is never the subject.
 *
 * WHAT IT DELIBERATELY DOES NOT KNOW
 * ----------------------------------
 * The time of day it was written. "At 2am" is the single most evocative thing
 * a timestamp carries — an apology written at 2am is a different object from
 * one written at lunchtime — and we cannot honestly render it: the sender's
 * timezone is not stored, so their 2am would be drawn as the reader's 9pm.
 * A duration survives the trip between timezones. A clock face does not.
 */

/**
 * Under this, the wait is not worth remarking on.
 *
 * Somebody who opens a card twenty minutes after it lands did not keep anybody
 * waiting, and saying so anyway makes the line into filler — which is how a
 * detail that should feel observed starts feeling generated.
 */
export const WAIT_WORTH_SAYING_MS = 6 * 60 * 60 * 1000;

/**
 * Milliseconds between writing it and opening it, or null if unknowable.
 *
 * `openedAt` is preferred over the clock so the number is stable: the sentence
 * should say the same thing on the fifth reading as it did on the first, and a
 * wait that grew every time you looked at it would be nonsense.
 */
export function waitedMs(createdAt, openedAt, now = Date.now()) {
  if (!createdAt) return null;

  const wrote = new Date(createdAt).getTime();
  if (!Number.isFinite(wrote)) return null;

  const opened = openedAt ? new Date(openedAt).getTime() : now;
  if (!Number.isFinite(opened)) return null;

  /* Clock skew between the database and the reader's device can make a card
     look as though it was opened before it was written. Zero, not negative. */
  return Math.max(0, opened - wrote);
}

/** Was the wait long enough to be worth a sentence? */
export function shouldMentionWait(createdAt, openedAt, now = Date.now()) {
  const ms = waitedMs(createdAt, openedAt, now);
  return ms !== null && ms >= WAIT_WORTH_SAYING_MS;
}
