/**
 * The cuteness meter — pure fun, nothing is stored or sent anywhere.
 *
 * Shared by the wizard (where the sender watches it climb as they add things)
 * and the card itself (where the recipient gets to poke it). Both sides read
 * the same shape: promise, memory, stickers, message, style, theme — which is
 * true of the wizard's `data` object and of a saved card row alike.
 */

/* Yes, it goes to 120%. Cuteness does not respect the laws of percentages. */
export const CUTENESS_MAX = 120;

/** How many emoji are sprinkled through the message. */
export function countEmoji(text) {
  const matches = String(text || '').match(/\p{Extended_Pictographic}/gu);
  return matches ? matches.length : 0;
}

const tidy = (value) => String(value ?? '').replace(/[ \t]+/g, ' ').trim();

/**
 * It rewards the things that actually make a card feel personal: a promise, a
 * memory, stickers, a bit of emoji in the message. Full marks is reachable but
 * takes effort, which is the point.
 */
export function cutenessScore(data) {
  if (!data) return 0;
  let score = 30; // you showed up and wrote something
  if (tidy(data.promise)) score += 18;
  if (tidy(data.memory)) score += 18;
  score += Math.min(4, (data.stickers || []).length) * 7; // up to 28
  score += Math.min(4, countEmoji(data.message)) * 4; //     up to 16
  if (data.style) score += 5;
  if (data.theme) score += 5;
  return Math.max(0, Math.min(CUTENESS_MAX, score));
}

export function cutenessLabel(score) {
  if (score >= 120) return 'meter broken 🚨🧸💘';
  if (score >= 105) return 'off the charts 💘💘';
  if (score >= 90) return 'dangerously cute 🧸💘';
  if (score >= 80) return 'critically cute 💞';
  if (score >= 68) return 'extremely cute 🎀';
  if (score >= 54) return 'very cute 🧁';
  if (score >= 42) return 'pretty cute 🌸';
  return 'sweet start 🌱';
}

/** A nudge towards the one thing that would help most (wizard only). */
export function cutenessHint(data) {
  if (!tidy(data.promise)) return 'Add a promise for a big cuteness bump.';
  if (!tidy(data.memory)) return 'A shared memory would push this higher.';
  if ((data.stickers || []).length < 2) return 'Stickers are worth a lot. Just saying.';
  if (countEmoji(data.message) < 2) return 'A little emoji in the message goes a long way.';
  if (cutenessScore(data) >= 120) return 'You broke the meter. 120%. There is no higher honor.';
  return 'Honestly? This is about as cute as it gets.';
}

/**
 * The recipient's tappable version starts from the card's own score, but never
 * so high that there is nothing left to do — there should always be five or six
 * satisfying taps between "hello" and a broken meter.
 */
export function cardCutenessStart(card) {
  return Math.min(cutenessScore(card), 100);
}

/** How much one tap is worth, so that ~6 taps always reach the top. */
export function cutenessTapStep(start) {
  return Math.max(3, Math.ceil((CUTENESS_MAX - start) / 6));
}
