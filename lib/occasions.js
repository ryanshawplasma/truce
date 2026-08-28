/**
 * Occasion config.
 *
 * Truce started as one occasion ('sorry') with every occasion-specific string
 * kept out of the components. It now runs three — sorry, birthday and proposal —
 * through exactly the same components, and this file is the only place that
 * knows the difference between them.
 *
 * A new occasion is: one entry below, one message library in app/data/library.js,
 * and one id added to the allowlist in app/actions.js. No new UI code.
 *
 * Everything here is plain, serialisable data (strings, numbers, arrays) so it
 * can cross the server/client boundary freely. Anything that needs to *compute*
 * is a helper function at the bottom of the file, not a value in the config.
 *
 * Templates use {name} / {from} placeholders — see fill().
 */

import { RECIPIENTS, SEVERITIES, suggestedStickers, STICKER_IDS } from './constants';

/* The eight everyday recipients. Sorry and birthday both offer all of them;
   proposals are a rather more specific question. */
const EVERYDAY_RECIPIENTS = [
  'girlfriend',
  'boyfriend',
  'wife',
  'husband',
  'bestfriend',
  'mom',
  'dad',
  'other',
];

/* The full run of questions. An occasion lists the ones it wants, in order, and
   the wizard renders exactly that — which is how birthday skips "what happened"
   and a proposal skips both that and the severity question. */
const ALL_STEPS = [
  'recipient',
  'names',
  'severity',
  'reason',
  'style',
  'message',
  'promise',
  'theme',
  'stickers',
  'preview',
];

export const OCCASIONS = {
  /* ======================================================================== */
  sorry: {
    id: 'sorry',
    label: 'Apology',
    badge: '💌',

    /* The "what's the occasion?" card at the top of the maker. */
    picker: {
      emoji: '💌',
      label: 'Say sorry',
      desc: 'The one that started it all',
    },

    /* Landing hero (only the default occasion writes the hero). */
    heroTitle: 'Messed up?',
    heroTitleAccent: 'Make it right.',
    heroLede:
      "Create a personalized apology experience they'll actually want to open. " +
      '56 hand-written messages, beautiful themes, delivered as a link. Free while in beta.',

    steps: ALL_STEPS,
    recipientIds: EVERYDAY_RECIPIENTS,
    severities: SEVERITIES,
    /* Used when an occasion skips the severity question entirely. */
    defaultSeverity: 2,

    /* The envelope scene */
    envelopeTitle: 'For {name}',
    envelopeSubtitles: {
      1: 'a little something to make it right 🌸',
      2: 'a proper apology, sealed with care 💌',
      3: 'everything I should have said, sealed inside 💔',
    },
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
      themeSub: 'This is the world their card opens into — it travels with the card, whoever opens it.',
      previewSub: "A preview of what lands on their screen. Happy with it? Let's make the link.",
    },

    /* The promise field, and how it reads back on the card. Birthday reuses the
       same database column for a wish, so everything about it is config. */
    promise: {
      label: 'I promise to…',
      placeholder: 'call you back before you have to text twice',
      hint: 'Small and true beats big and vague.',
      boxTitle: 'My promise to you',
      /* Prefixed onto whatever they typed, and stripped off the front of their
         input first so "I promise to I promise to…" can never happen. */
      lead: 'I promise to ',
      stripPattern: '^i\\s+promise\\s+to\\s+',
    },

    signOff: 'truly sorry',

    /* The recipient's moment: 'forgive' | 'candles' | 'question' */
    moment: 'forgive',
    momentQuestion: 'Do you forgive me?',
    momentYes: 'Yes ❤️',
    noLabels: ['No 😤', 'Are you sure?', 'Really?', 'Please? 🥺', 'Okay fine… yes 🤍'],
    momentDone: 'Forgiveness received.',
    momentDoneSub: '{from} can breathe again.',
    momentDoneEmoji: '🎉',
    hugLabel: 'Send a hug back 🤗',

    meter: {
      title: 'Forgiveness',
      full: 'Fully forgiven 💖',
      near: 'almost there…',
      warm: 'warming up…',
      idle: 'sealed',
      teasing: 'hmm…',
      loading: 'loading…',
      loadingCaption: 'Forgiving…',
      /* Tap-to-pump: after the moment is said yes to, the meter is filled
         by hand rather than on its own. See CardExperience.jsx. */
      pump: 'Now fill it up — tap! 💗',
      pumpLabels: ['keep going…','more…','nearly!','so close!!'],
      payoff: 'FULLY FORGIVEN 💖✨',
      ariaLabel: 'Forgiveness meter',
    },

    /* The "let them know" strip under the celebration. */
    reply: {
      title: 'Let {from} know 💌',
      sub: 'Send this same link back — it is the fastest way to say “I saw it”.',
      shareText: 'I opened your letter 🤍 come see —',
    },

    /* The sender's private timeline (/s/[token]). */
    timeline: {
      doneEmoji: '🎉',
      doneTitle: 'Forgiven 🎉',
      doneHint: 'They tapped yes',
      pendingTitle: 'No answer yet',
      pendingHint: 'The moment they tap “yes”, it shows up here.',
    },

    /* Share preview copy for /c/[id]. */
    meta: {
      title: 'For {name} 💌',
      titleFallback: 'Someone left you a letter 💌',
      description: 'Tap to open the envelope {from} sealed for you 🤍',
      descriptionFallback: 'Tap to open the envelope sealed for you 🤍',
      ogHeadline: '{name}, someone has something to say to you',
      ogHeadlineFallback: 'Someone has something to say to you',
    },

    /* Sorry picks its three suggested stickers from the writing style — see
       suggestedStickers() in lib/constants.js. */
    stickerSource: 'style',
  },

  /* ======================================================================== */
  birthday: {
    id: 'birthday',
    label: 'Birthday',
    badge: '🎂',

    picker: {
      emoji: '🎂',
      label: 'Birthday',
      desc: 'Candles, wishes, the whole thing',
    },

    heroTitle: 'Another year of them.',
    heroTitleAccent: 'Make it count.',
    heroLede:
      'A birthday card they actually keep — a sealed envelope, a wish, and a cake with candles to blow out. ' +
      'Delivered as a link. Free while in beta.',

    /* No "what happened" — nothing happened, it is their birthday. */
    steps: ['recipient', 'names', 'severity', 'style', 'message', 'promise', 'theme', 'stickers', 'preview'],
    recipientIds: EVERYDAY_RECIPIENTS,
    severities: [
      { v: 1, emoji: '🕯️', label: 'A little moment', desc: 'Quiet, warm, just for them' },
      { v: 2, emoji: '🎉', label: 'A proper celebration', desc: 'The good kind of fuss' },
      { v: 3, emoji: '🎆', label: 'The full fireworks', desc: 'Everything, loudly, all at once' },
    ],
    defaultSeverity: 2,

    envelopeTitle: 'A birthday letter for {name} 🎂',
    envelopeSubtitles: {
      1: 'a little birthday moment 🕯️',
      2: 'sealed with candles and care 🎂',
      3: 'the full birthday fireworks 🎆',
    },
    openHint: 'Tap to open 🎁',

    wizard: {
      recipientQ: 'Whose birthday is it?',
      recipientSub: 'This helps us pick messages that actually sound like you two.',
      severityQ: 'How big should this feel?',
      severitySub: 'It only sets the tone — and how many candles they get to blow out.',
      styleQ: 'Pick your birthday style',
      styleSub: 'The library is written four different ways. Choose the one that sounds like your voice.',
      messageQ: 'Choose your message',
      promiseQ: 'A wish for them 🎈',
      promiseSub: 'Optional, and the bit they will reread. What do you hope this year brings them?',
      themeQ: 'Pick your theme',
      themeSub: 'This is the world their card opens into — it travels with the card, whoever opens it.',
      previewSub: "A preview of what lands on their screen. Happy with it? Let's make the link.",
    },

    /* Stored in the same `promise` column, labelled as a wish everywhere. */
    promise: {
      label: 'My wish for you is…',
      placeholder: 'a year with far more of the good days than the hard ones',
      hint: 'Say the thing you would say out loud if the room were quiet.',
      boxTitle: 'My wish for you',
      lead: '',
      stripPattern: '^(i\\s+wish\\s+(you\\s+)?|my\\s+wish\\s+(for\\s+you\\s+)?is\\s+)',
    },

    signOff: 'with love',

    moment: 'candles',
    momentQuestion: 'Make a wish, then blow them out 🎂',
    momentSub: 'Tap each candle. Take your time — it is your wish.',
    momentDone: 'Happy birthday, {name} 💛',
    momentDoneSub: 'Wish made. {from} hopes it lands.',
    momentDoneEmoji: '🎂',
    hugLabel: 'Send a hug back 🤗',

    meter: {
      title: 'Birthday spirit',
      full: 'Maximum birthday 🎂',
      near: 'nearly party time…',
      warm: 'warming up…',
      idle: 'sealed',
      teasing: 'ooh…',
      loading: 'making a wish…',
      loadingCaption: 'Wishing…',
      /* Tap-to-pump: after the moment is said yes to, the meter is filled
         by hand rather than on its own. See CardExperience.jsx. */
      pump: 'Now fill it up — tap! 🎂',
      pumpLabels: ['keep going…','more cake!','nearly!','so close!!'],
      payoff: 'BIRTHDAY SPIRIT MAXED 🎂🎉',
      ariaLabel: 'Birthday spirit meter',
    },

    reply: {
      title: 'Say thank you 💌',
      sub: 'Send this same link back — it is the fastest way to say “I loved this”.',
      shareText: 'I opened your birthday card 🎂 thank you —',
    },

    timeline: {
      doneEmoji: '🎂',
      doneTitle: 'They made their wish 🎂',
      doneHint: 'They blew out the candles',
      pendingTitle: 'No wish yet',
      pendingHint: 'The moment they blow out the last candle, it shows up here.',
    },

    meta: {
      title: 'Happy birthday, {name} 🎂',
      titleFallback: 'Someone left you a birthday card 🎂',
      description: '{from} has a birthday letter for you 🎈',
      descriptionFallback: 'Tap to open the envelope sealed for you 🎈',
      ogHeadline: '{name}, someone has a birthday card for you',
      ogHeadlineFallback: 'Someone has a birthday card for you',
    },

    /* Fixed picks: warm, celebratory, and all drawings the sender has already
       seen on the landing page. The third slot follows the size of the fuss. */
    stickerSource: 'fixed',
    stickerPicks: ['cheer-up', 'bear-hug'],
    stickerBySeverity: { 1: 'melting-heart', 2: 'love-letter', 3: 'cheer-up' },
  },

  /* ======================================================================== */
  /* --------------------------------------------------------------------------
   * Raksha Bandhan.
   *
   * Seasonal, and the reason it is a whole occasion rather than just a theme:
   * the Rakhi prompt used to open the APOLOGY flow with the gold theme applied,
   * so somebody who pressed "Make a Rakhi card" was asked who they wanted to
   * say sorry to and offered Girlfriend, Boyfriend, Wife, Husband. For a
   * festival about brothers and sisters. A look is not an occasion.
   *
   * The festival's own meaning does the structural work: raksha bandhan is the
   * bond of protection, so the `promise` field — which every occasion already
   * has — becomes the vow, and needs no new machinery at all.
   * ------------------------------------------------------------------------ */
  rakhi: {
    id: 'rakhi',
    label: 'Rakhi',
    badge: '🪢',
    /* Only offered around the festival. See lib/festival.js — same window the
       theme uses, so the two appear and disappear together. */
    seasonal: 'rakhi',

    picker: {
      emoji: '🪢',
      label: 'Rakhi',
      desc: 'For your brother or sister',
    },

    heroTitle: 'One thread, one promise.',
    heroTitleAccent: 'Send it anyway.',
    heroLede:
      'A Raksha Bandhan card for the sibling you cannot tie a rakhi on in person — a sealed envelope, ' +
      'a real message, and the promise that goes with the thread. Delivered as a link.',

    /* No "what happened": nobody did anything wrong. Same shape as birthday. */
    steps: ['recipient', 'names', 'severity', 'style', 'message', 'promise', 'theme', 'stickers', 'preview'],
    recipientIds: ['sister', 'brother', 'bestfriend', 'other'],
    severities: [
      { v: 1, emoji: '🧵', label: 'Just the thread', desc: 'Quiet, warm, no fuss' },
      { v: 2, emoji: '🪢', label: 'The proper rakhi', desc: 'Sweets, teasing, the whole thing' },
      { v: 3, emoji: '🎆', label: 'Full festival', desc: 'Everything, loudly, all at once' },
    ],
    defaultSeverity: 2,

    envelopeTitle: 'A rakhi for {name} 🪢',
    envelopeSubtitles: {
      1: 'one thread, sent with love 🧵',
      2: 'sealed with sweets and a promise 🪢',
      3: 'the whole festival, in one envelope 🎆',
    },
    openHint: 'Tap to open 🪢',

    wizard: {
      recipientQ: 'Who are you tying it for?',
      recipientSub: 'Distance is the only reason this is a link and not a thread.',
      severityQ: 'How big should this feel?',
      severitySub: 'It only sets the tone — nobody is counting.',
      styleQ: 'Pick your rakhi style',
      styleSub: 'The library is written four different ways. Choose the one that sounds like you two.',
      messageQ: 'Choose your message',
      promiseQ: 'Your promise to them 🪢',
      promiseSub:
        'Raksha bandhan means the bond of protection. This is the half of it that is yours to keep.',
      themeQ: 'Pick your theme',
      themeSub: 'Rakhi Gold is here for the festival — it travels with the card, whoever opens it.',
      previewSub: "A preview of what lands on their screen. Happy with it? Let's make the link.",
    },

    promise: {
      label: 'I promise…',
      placeholder: 'to pick up the phone first, and to always be the one who shows up',
      hint: 'The thread is the easy half. This is the part they will reread.',
      boxTitle: 'My promise to you',
      lead: 'I promise ',
      stripPattern: '^(i\\s+promise\\s+(to\\s+)?)',
    },

    signOff: 'always',

    moment: 'question',
    momentQuestion: 'Will you always be on my side?',
    momentSub: 'You already know the answer. Say it anyway.',
    momentDone: 'Happy Raksha Bandhan, {name} 🪢',
    momentDoneSub: '{from} is not going anywhere.',
    momentDoneEmoji: '🪢',
    hugLabel: 'Send a hug back 🤗',

    meter: {
      title: 'Sibling energy',
      full: 'Unbreakable 🪢',
      near: 'nearly there…',
      warm: 'warming up…',
      idle: 'sealed',
      teasing: 'ooh…',
      loading: 'tying the thread…',
      loadingCaption: 'Tying…',
      pump: 'Now pull it tight — tap! 🪢',
      pumpLabels: ['keep going…', 'tighter!', 'nearly!', 'so close!!'],
      payoff: 'BOND: UNBREAKABLE 🪢🎆',
      ariaLabel: 'Sibling energy meter',
    },

    reply: {
      title: 'Say it back 💌',
      sub: 'Send this same link back — it is the fastest way to say “I got it, and I mean it too”.',
      shareText: 'I opened your rakhi 🪢 happy Raksha Bandhan —',
    },

    timeline: {
      doneEmoji: '🪢',
      doneTitle: 'They said yes 🪢',
      doneHint: 'The thread is tied',
      pendingTitle: 'Not answered yet',
      pendingHint: 'The moment they answer, it shows up here.',
    },

    meta: {
      title: 'Happy Raksha Bandhan, {name} 🪢',
      titleFallback: 'Someone sent you a rakhi 🪢',
      description: '{from} tied one for you 🧵',
      descriptionFallback: 'Tap to open the envelope sealed for you 🧵',
      ogHeadline: '{name}, someone tied a rakhi for you',
      ogHeadlineFallback: 'Someone tied a rakhi for you',
    },

    stickerSource: 'fixed',
    stickerPicks: ['bear-hug', 'pinky-promise'],
    stickerBySeverity: { 1: 'melting-heart', 2: 'love-letter', 3: 'cheer-up' },
  },

  proposal: {
    id: 'proposal',
    label: 'Proposal',
    badge: '💍',

    picker: {
      emoji: '💍',
      label: 'Proposal',
      desc: 'Ask the question properly',
    },

    heroTitle: 'Some questions',
    heroTitleAccent: 'deserve a moment.',
    heroLede:
      'Ask it the way you would want to be asked — a sealed envelope, your own words, and one enormous question. ' +
      'Delivered as a link. Free while in beta.',

    /* No severity, no "what happened" — there is only one size of this question. */
    steps: ['recipient', 'names', 'style', 'message', 'promise', 'theme', 'stickers', 'preview'],
    recipientIds: ['girlfriend', 'boyfriend', 'partner', 'other'],
    /* A proposal is romantic by definition, so "Someone else ✨" here means
       "we have not put a word on it yet" — not "no relationship". Without this
       the catch-all recipient would match nothing, because every message in the
       proposal library is tagged romantic. */
    recipientTags: { other: 'romantic' },
    severities: SEVERITIES,
    defaultSeverity: 2,

    envelopeTitle: 'Someone has a question for you 💍',
    envelopeSubtitles: {
      1: 'open when your heart is ready 💍',
      2: 'open when your heart is ready 💍',
      3: 'open when your heart is ready 💍',
    },
    openHint: 'Tap to open 💍',

    wizard: {
      recipientQ: 'Who are you asking?',
      recipientSub: 'There is only one right answer to this one, so take your time.',
      styleQ: 'Pick how you want to ask',
      styleSub: 'The library is written four different ways. Choose the one that sounds like your voice.',
      messageQ: 'Choose your words',
      promiseQ: 'My promise 💍',
      promiseSub: 'Optional, and the part they will hold on to. What are you actually promising?',
      themeQ: 'Pick your theme',
      themeSub: 'This is the world their card opens into — it travels with the card, whoever opens it.',
      previewSub: "A preview of what lands on their screen. Happy with it? Let's make the link.",
    },

    promise: {
      label: 'I promise to…',
      placeholder: 'choose you on the ordinary days, not just this one',
      hint: 'The small, true, everyday one beats the grand one.',
      boxTitle: 'My promise to you',
      lead: 'I promise to ',
      stripPattern: '^i\\s+promise\\s+to\\s+',
    },

    signOff: 'yours',

    moment: 'question',
    momentQuestion: 'Will you be mine? 💍',
    momentYes: 'Yes ❤️',
    /* The same dodging machinery, in a much softer mood. */
    noLabels: ['No 😳', 'Are you sure?', 'Really?', 'Please? 🥺', 'Okay… ask me again 🥺'],
    momentDone: 'They said yes!! 💍🎉',
    momentDoneSub: '{from} is going to remember this one for a very long time.',
    momentDoneEmoji: '💍',
    hugLabel: 'Send a hug back 🤗',

    meter: {
      title: 'Butterflies',
      full: 'All the butterflies 🦋',
      near: 'heart racing…',
      warm: 'fluttering…',
      idle: 'sealed',
      teasing: 'eek…',
      loading: 'holding breath…',
      loadingCaption: 'Asking…',
      /* Tap-to-pump: after the moment is said yes to, the meter is filled
         by hand rather than on its own. See CardExperience.jsx. */
      pump: 'Now fill it up — tap! 💍',
      pumpLabels: ['keep going…','more!','nearly!','so close!!'],
      payoff: 'THEY SAID YES 💍🎉',
      ariaLabel: 'Butterflies meter',
    },

    reply: {
      title: 'Tell them your answer 💌',
      sub: 'Send this same link back — it is the fastest way to say it out loud.',
      shareText: 'I opened it 💍 come here —',
    },

    timeline: {
      doneEmoji: '💍',
      doneTitle: 'They said YES 💍',
      doneHint: 'They tapped yes',
      pendingTitle: 'No answer yet',
      pendingHint: 'The moment they tap “yes”, it shows up here.',
    },

    meta: {
      title: 'A question for {name} 💍',
      titleFallback: 'Someone has a question for you 💍',
      description: '{from} has something to ask you 💍',
      descriptionFallback: 'Tap to open the envelope sealed for you 💍',
      ogHeadline: '{name}, someone has a question for you',
      ogHeadlineFallback: 'Someone has a question for you',
    },

    stickerSource: 'fixed',
    stickerPicks: ['pinky-promise', 'love-letter'],
    stickerBySeverity: { 1: 'rosie-plum/made-up', 2: 'rosie-plum/made-up', 3: 'rosie-plum/made-up' },
  },

  /* -------------------------------------------------------------------------
   * Adding "anniversary" would be an entry exactly like the two above: a picker
   * card, a `steps` list, its own envelope copy, and a `moment`. If it wants a
   * brand new recipient moment (rather than reusing 'forgive' / 'candles' /
   * 'question'), that is the only place a new component is needed — see the
   * switch in app/components/CardExperience.jsx.
   * ---------------------------------------------------------------------- */
};

export const DEFAULT_OCCASION = 'sorry';

/** Every occasion we ship, in picker order. */
export const OCCASION_IDS = ['sorry', 'birthday', 'rakhi', 'proposal'];

/** The list the maker's first question renders. */
export const OCCASION_CHOICES = OCCASION_IDS.map((id) => ({
  id,
  ...OCCASIONS[id].picker,
}));

export function isOccasion(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(OCCASIONS, id);
}

export function getOccasion(id) {
  return OCCASIONS[id] || OCCASIONS[DEFAULT_OCCASION];
}

/** An occasion id we are willing to store, always one of the allowlist. */
export function safeOccasion(id) {
  return isOccasion(id) ? id : DEFAULT_OCCASION;
}

/* ---------------------------------------------------------------- templates */

/**
 * Fill {name} / {from} style placeholders.
 * Values are plain strings rendered as React children, so they are escaped by
 * React itself — this is only ever assembling text, never markup.
 */
export function fill(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : match,
  );
}

/* ------------------------------------------------------------- the envelope */

/** "For Sam" / "A birthday letter for Sam 🎂" / "Someone has a question for you 💍" */
export function envelopeTitle(occasionId, name) {
  return fill(getOccasion(occasionId).envelopeTitle, { name: name || 'you' });
}

/** Envelope subtitle for a given occasion + severity, with safe fallbacks. */
export function envelopeSubtitle(occasionId, severity) {
  const o = getOccasion(occasionId);
  return o.envelopeSubtitles[severity] || o.envelopeSubtitles[2];
}

/* ------------------------------------------------------------- the wizard */

/** The ordered step keys for an occasion (never includes the occasion picker). */
export function occasionSteps(occasionId) {
  return getOccasion(occasionId).steps;
}

/** The recipient cards this occasion offers, in RECIPIENTS order. */
export function occasionRecipients(occasionId) {
  const allowed = getOccasion(occasionId).recipientIds;
  if (!allowed) return RECIPIENTS;
  return RECIPIENTS.filter((r) => allowed.includes(r.id));
}

/**
 * The message tag to filter by for this recipient, on this occasion.
 * Usually just the recipient's own tag — see `recipientTags` above for the one
 * case where an occasion reads a recipient differently.
 */
export function recipientTagFor(occasionId, recipientId) {
  const overrides = getOccasion(occasionId).recipientTags;
  if (overrides && overrides[recipientId]) return overrides[recipientId];
  const found = RECIPIENTS.find((r) => r.id === recipientId);
  return found ? found.tag : 'any';
}

/** True when this recipient id is offered for this occasion. */
export function allowsRecipient(occasionId, recipientId) {
  return occasionRecipients(occasionId).some((r) => r.id === recipientId);
}

/** The three severity cards this occasion offers. */
export function occasionSeverities(occasionId) {
  return getOccasion(occasionId).severities || SEVERITIES;
}

/**
 * Three sticker ids to offer up front.
 * Sorry follows the writing style; the other occasions have a fixed, fitting
 * trio with the third slot set by how big the moment is meant to feel.
 */
export function occasionSuggestedStickers(occasionId, style, severity) {
  const o = getOccasion(occasionId);
  if (o.stickerSource !== 'fixed') return suggestedStickers(style, severity);

  const third = (o.stickerBySeverity || {})[severity] || (o.stickerBySeverity || {})[2];
  const picks = [];
  for (const id of [...(o.stickerPicks || []), third, 'love-letter', 'bear-hug']) {
    if (picks.length >= 3) break;
    if (!picks.includes(id) && STICKER_IDS.includes(id)) picks.push(id);
  }
  return picks;
}

/* --------------------------------------------------------- promise / wish */

/** Strip the lead-in the sender may have typed themselves ("I promise to …"). */
export function stripPromiseLead(occasionId, value) {
  const pattern = getOccasion(occasionId).promise.stripPattern;
  if (!pattern) return value;
  try {
    return String(value || '').replace(new RegExp(pattern, 'i'), '');
  } catch {
    return value;
  }
}

/** How the promise/wish reads on the finished card. */
export function promiseText(occasionId, value) {
  return `${getOccasion(occasionId).promise.lead}${value || ''}`;
}
