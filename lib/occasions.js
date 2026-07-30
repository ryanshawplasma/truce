/**
 * Occasion config.
 *
 * Truce ships with one occasion ('sorry'), but every occasion-specific string
 * lives here instead of being hard-coded in components. When we add birthday or
 * anniversary cards, we add an entry below and pass `occasion` through the same
 * components — no new UI code, just new copy.
 *
 * Keep this deliberately small: only copy that genuinely changes per occasion.
 */

export const OCCASIONS = {
  sorry: {
    id: 'sorry',
    label: 'Apology',

    /* Landing hero */
    heroTitle: 'Messed up?',
    heroTitleAccent: 'Make it right.',
    heroLede:
      "Create a personalized apology experience they'll actually want to open. " +
      '56 hand-written messages, beautiful themes, delivered as a link. Free while in beta.',

    /* The envelope scene, keyed by severity (1–3). */
    envelopeSubtitles: {
      1: 'a little something to make it right 🌸',
      2: 'a proper apology, sealed with care 💌',
      3: 'everything I should have said, sealed inside 💔',
    },

    /* The nudge under the envelope. */
    openHint: 'Tap to open 💌',

    /* Wizard question labels */
    wizard: {
      recipientQ: 'Who do you want to say sorry to?',
      recipientSub: 'This helps us pick messages that actually sound like you two.',
      severityQ: 'How big was the oops?',
      severitySub: 'Be honest. It only changes the tone, not the outcome.',
      reasonQ: 'What happened?',
      reasonSub: 'Optional — a gentle "…about that 🙈" line under your message makes an apology feel specific.',
      styleQ: 'Pick your apology style',
      styleSub: 'The library is written four different ways. Choose the one that sounds like your voice.',
      messageQ: 'Choose your message',
      promiseQ: 'Seal it with a promise',
      promiseSub: 'Optional, and the part people remember. Sorry lands harder with a next step attached.',
      themeQ: 'Pick your theme',
      themeSub: 'This is the world their card opens into.',
    },

    /* The card experience */
    signOff: 'truly sorry',
    forgiveQuestion: 'Do you forgive me?',
    forgiveDone: 'Forgiveness received.',
  },

  /* ---------------------------------------------------------------------------
   * How a future occasion slots in — uncomment, add messages tagged s:'birthday'
   * to app/data/messages.js, and pass occasion="birthday" into the wizard.
   *
   * birthday: {
   *   id: 'birthday',
   *   label: 'Birthday',
   *   heroTitle: 'Another year of them.',
   *   heroTitleAccent: 'Make it count.',
   *   heroLede: 'A birthday card they actually keep. Delivered as a link.',
   *   envelopeSubtitles: { 1: 'a little happy birthday 🎈', 2: 'happy birthday, properly 🎂', 3: 'the big one 🎉' },
   *   openHint: 'Tap to open 🎁',
   *   wizard: { recipientQ: "Whose birthday is it?", ... },
   *   signOff: 'with love',
   *   forgiveQuestion: 'Did it make you smile?',
   *   forgiveDone: 'Smile received.',
   * },
   * ------------------------------------------------------------------------ */
};

export const DEFAULT_OCCASION = 'sorry';

export function getOccasion(id) {
  return OCCASIONS[id] || OCCASIONS[DEFAULT_OCCASION];
}

/** Envelope subtitle for a given occasion + severity, with safe fallbacks. */
export function envelopeSubtitle(occasionId, severity) {
  const o = getOccasion(occasionId);
  return o.envelopeSubtitles[severity] || o.envelopeSubtitles[2];
}
