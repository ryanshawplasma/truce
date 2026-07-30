/**
 * The message libraries, joined up.
 *
 * Three libraries, one schema: { t: text, s: style, who: recipient tags }.
 *   sorry     — app/data/messages.js        (56, untouched)
 *   birthday  — app/data/occasion-messages.js (24)
 *   proposal  — app/data/occasion-messages.js (16)
 *
 * Filtering has three dimensions now — occasion, then style, then who the card
 * is for. Adding a fourth occasion means adding one line to LIBRARIES and one
 * entry to lib/occasions.js; nothing else has to know.
 */

import MESSAGES from './messages';
import { BIRTHDAY_MESSAGES, PROPOSAL_MESSAGES } from './occasion-messages';
import { DEFAULT_OCCASION, recipientTagFor } from '@/lib/occasions';

const LIBRARIES = {
  sorry: MESSAGES,
  birthday: BIRTHDAY_MESSAGES,
  proposal: PROPOSAL_MESSAGES,
};

/** Every message we ship, across every occasion. Used for the "N hand-written
 *  messages" line on the landing page. */
export const LIBRARY_TOTAL = Object.values(LIBRARIES).reduce((n, list) => n + list.length, 0);

/** How many messages a single occasion has. */
export function libraryCount(occasionId) {
  return messagesForOccasion(occasionId).length;
}

/** The whole library for one occasion (falls back to the apology library). */
export function messagesForOccasion(occasionId) {
  return LIBRARIES[occasionId] || LIBRARIES[DEFAULT_OCCASION];
}

/**
 * Messages for this occasion, in this style, written for this recipient.
 * A message qualifies when its `who` list contains the recipient's tag, or the
 * catch-all 'any'.
 */
export function filterMessages(occasionId, style, recipientId) {
  const tag = recipientTagFor(occasionId, recipientId);
  return messagesForOccasion(occasionId).filter((m) => {
    if (m.s !== style) return false;
    const who = m.who || ['any'];
    return who.includes(tag) || who.includes('any');
  });
}

export { LIBRARIES };
