/**
 * Shared, framework-free constants.
 * Safe to import from both server and client components — it is pure data.
 */

/* Who the card is for. `tag` is what we filter the message library by. */
export const RECIPIENTS = [
  { id: 'girlfriend', label: 'Girlfriend', emoji: '💕', tag: 'romantic' },
  { id: 'boyfriend', label: 'Boyfriend', emoji: '💙', tag: 'romantic' },
  { id: 'wife', label: 'Wife', emoji: '💍', tag: 'romantic' },
  { id: 'husband', label: 'Husband', emoji: '🤵', tag: 'romantic' },
  { id: 'bestfriend', label: 'Best friend', emoji: '🤝', tag: 'friend' },
  { id: 'mom', label: 'Mom', emoji: '🌷', tag: 'family' },
  { id: 'dad', label: 'Dad', emoji: '🧢', tag: 'family' },
  { id: 'other', label: 'Someone else', emoji: '✨', tag: 'any' },
];

export const SEVERITIES = [
  { v: 1, emoji: '🙊', label: 'Tiny oops', desc: 'A small thing, but you noticed it' },
  { v: 2, emoji: '😬', label: 'Pretty bad', desc: 'There was a silence afterwards' },
  { v: 3, emoji: '💔', label: 'I really messed up', desc: 'This one needs the full apology' },
];

export const REASONS = [
  'I was late',
  'I forgot something important',
  'I said something hurtful',
  'I broke a promise',
  "It's complicated",
];

export const STYLES = [
  { id: 'sweet', emoji: '🥰', label: 'Sweet', desc: 'Warm, soft, straightforward' },
  { id: 'funny', emoji: '😅', label: 'Funny', desc: 'Disarm them with a laugh' },
  { id: 'poetic', emoji: '🌹', label: 'Poetic', desc: 'Pretty words, real feeling' },
  { id: 'heart', emoji: '💌', label: 'From the heart', desc: 'Plain, honest, no armour' },
];

export const STYLE_LABEL = {
  sweet: 'Sweet',
  funny: 'Funny',
  poetic: 'Poetic',
  heart: 'From the heart',
};

/* Each theme is a set of CSS custom properties defined in globals.css
   under `.themed[data-theme="…"]`. `dots` / `bg` are only for the swatches.
   The order here is the order of the picker: light and airy first, night last. */
export const THEMES = [
  { id: 'blush', label: 'Blush Rose', dots: ['#FFE4E9', '#E85D75', '#FFFFFF'], bg: 'linear-gradient(160deg,#FFF1F4,#FFD9CC)' },
  { id: 'sky', label: 'Sky Blue', dots: ['#D6ECFF', '#4A90D9', '#FFFFFF'], bg: 'linear-gradient(160deg,#EAF6FF,#D6ECFF)' },
  { id: 'peach', label: 'Peach Sunset', dots: ['#FFE0CC', '#EF8256', '#FFFBF7'], bg: 'linear-gradient(160deg,#FFF3E7,#FFC9AE)' },
  { id: 'lavender', label: 'Lavender Haze', dots: ['#E7DCFB', '#8B6BD6', '#FFFFFF'], bg: 'linear-gradient(160deg,#F5F0FF,#DCD3F7)' },
  { id: 'moonlight', label: 'Moonlight', dots: ['#2A3560', '#A9B8EA', '#F6F8FF'], bg: 'linear-gradient(160deg,#0F1630,#2A2F58)' },
  { id: 'midnight', label: 'Midnight Plum', dots: ['#3A2A52', '#F2B880', '#F7EEF6'], bg: 'linear-gradient(160deg,#2A1B3D,#3A1F3E)' },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const STYLE_IDS = STYLES.map((s) => s.id);

/* The only emoji a recipient can send back. Anything else is rejected
   server-side in app/actions.js — this array is the single source of truth. */
export const REACTION_EMOJI = ['❤️', '🥹', '😂', '🤗', '💐', '🫶', '😭', '😘', '🥺', '✨'];

/* Little emoji the sender can drop into their message while writing it. */
export const FEELING_EMOJI = ['😔', '🥺', '❤️', '🙏', '✨', '🫂', '😢', '🌹'];

/* ---------------------------------------------------------------------------
 * Stickers — six packs, sixty-two drawings.
 *
 * This is the server-safe half: pack ids, sticker ids and labels only, so
 * app/actions.js can validate what a recipient sent without pulling any client
 * component into the server bundle. The drawings live in
 * app/components/stickers/ and are joined to this list by its registry.
 *
 * Ids are stable and globally unique. The twelve classics keep their original
 * UNPREFIXED ids so cards and reactions made before the couple packs still
 * resolve; every pack added since is namespaced "<pack>/<pose>".
 * ------------------------------------------------------------------------ */
export const STICKER_PACKS = [
  {
    id: 'classics',
    name: 'Classics',
    emoji: '🩹',
    icon: 'bandaged-heart',
    stickers: [
      { id: 'bandaged-heart', label: 'Patched-up heart' },
      { id: 'puppy-eyes', label: 'Puppy eyes' },
      { id: 'white-flag', label: 'White flag' },
      { id: 'bear-hug', label: 'Bear hug' },
      { id: 'melting-heart', label: 'Melting heart' },
      { id: 'bouquet', label: 'Bouquet' },
      { id: 'sorry-burst', label: 'Sorry!' },
      { id: 'crying-blob', label: 'Little cry' },
      { id: 'dove-branch', label: 'Peace dove' },
      { id: 'love-letter', label: 'Love letter' },
      { id: 'pinky-promise', label: 'Pinky promise' },
      { id: 'cheer-up', label: 'Cheer up' },
    ],
  },
  {
    id: 'momo-pip',
    name: 'Momo & Pip',
    emoji: '🐻',
    icon: 'momo-pip/big-hug',
    stickers: [
      { id: 'momo-pip/begging', label: 'Begging' },
      { id: 'momo-pip/waterfall-cry', label: 'Waterfall cry' },
      { id: 'momo-pip/big-hug', label: 'Big hug' },
      { id: 'momo-pip/flowers-shy', label: 'Flowers, shy' },
      { id: 'momo-pip/pouty', label: 'Pouty' },
      { id: 'momo-pip/cheek-kiss', label: 'Cheek kiss' },
      { id: 'momo-pip/head-pat', label: 'Head pat' },
      { id: 'momo-pip/forgive-sign', label: 'Forgive me?' },
      { id: 'momo-pip/sulk-rain', label: 'Sulk & rain' },
      { id: 'momo-pip/made-up', label: 'Made up' },
    ],
  },
  {
    id: 'rosie-plum',
    name: 'Rosie & Plum',
    emoji: '💕',
    icon: 'rosie-plum/made-up',
    stickers: [
      { id: 'rosie-plum/begging', label: 'Begging' },
      { id: 'rosie-plum/waterfall-cry', label: 'Waterfall cry' },
      { id: 'rosie-plum/big-hug', label: 'Big hug' },
      { id: 'rosie-plum/flowers-shy', label: 'Flowers, shy' },
      { id: 'rosie-plum/pouty', label: 'Pouty' },
      { id: 'rosie-plum/cheek-kiss', label: 'Cheek kiss' },
      { id: 'rosie-plum/head-pat', label: 'Head pat' },
      { id: 'rosie-plum/forgive-sign', label: 'Forgive me?' },
      { id: 'rosie-plum/sulk-rain', label: 'Sulk & rain' },
      { id: 'rosie-plum/made-up', label: 'Made up' },
    ],
  },
  {
    id: 'clover-biscuit',
    name: 'Clover & Biscuit',
    emoji: '🐰',
    icon: 'clover-biscuit/cheek-kiss',
    stickers: [
      { id: 'clover-biscuit/begging', label: 'Begging' },
      { id: 'clover-biscuit/waterfall-cry', label: 'Waterfall cry' },
      { id: 'clover-biscuit/big-hug', label: 'Big hug' },
      { id: 'clover-biscuit/flowers-shy', label: 'Flowers, shy' },
      { id: 'clover-biscuit/pouty', label: 'Pouty' },
      { id: 'clover-biscuit/cheek-kiss', label: 'Cheek kiss' },
      { id: 'clover-biscuit/head-pat', label: 'Head pat' },
      { id: 'clover-biscuit/forgive-sign', label: 'Forgive me?' },
      { id: 'clover-biscuit/sulk-rain', label: 'Sulk & rain' },
      { id: 'clover-biscuit/made-up', label: 'Made up' },
    ],
  },
  {
    id: 'mochi-bao',
    name: 'Mochi & Bao',
    emoji: '🐼',
    icon: 'mochi-bao/big-hug',
    stickers: [
      { id: 'mochi-bao/begging', label: 'Begging' },
      { id: 'mochi-bao/waterfall-cry', label: 'Waterfall cry' },
      { id: 'mochi-bao/big-hug', label: 'Big hug' },
      { id: 'mochi-bao/flowers-shy', label: 'Flowers, shy' },
      { id: 'mochi-bao/pouty', label: 'Pouty' },
      { id: 'mochi-bao/cheek-kiss', label: 'Cheek kiss' },
      { id: 'mochi-bao/head-pat', label: 'Head pat' },
      { id: 'mochi-bao/forgive-sign', label: 'Forgive me?' },
      { id: 'mochi-bao/sulk-rain', label: 'Sulk & rain' },
      { id: 'mochi-bao/made-up', label: 'Made up' },
    ],
  },
  {
    id: 'poppy-truffle',
    name: 'Poppy & Truffle',
    emoji: '🐷',
    icon: 'poppy-truffle/made-up',
    stickers: [
      { id: 'poppy-truffle/begging', label: 'Begging' },
      { id: 'poppy-truffle/waterfall-cry', label: 'Waterfall cry' },
      { id: 'poppy-truffle/big-hug', label: 'Big hug' },
      { id: 'poppy-truffle/flowers-shy', label: 'Flowers, shy' },
      { id: 'poppy-truffle/pouty', label: 'Pouty' },
      { id: 'poppy-truffle/cheek-kiss', label: 'Cheek kiss' },
      { id: 'poppy-truffle/head-pat', label: 'Head pat' },
      { id: 'poppy-truffle/forgive-sign', label: 'Forgive me?' },
      { id: 'poppy-truffle/sulk-rain', label: 'Sulk & rain' },
      { id: 'poppy-truffle/made-up', label: 'Made up' },
    ],
  },
];

/** Every sticker, flattened, in pack order — 62 of them. */
export const STICKER_META = STICKER_PACKS.flatMap((p) => p.stickers);

export const STICKER_IDS = STICKER_META.map((s) => s.id);
export const STICKER_PACK_IDS = STICKER_PACKS.map((p) => p.id);

/** Label lookup for a single id, used by the sender page. */
export function stickerLabel(id) {
  const found = STICKER_META.find((s) => s.id === id);
  return found ? found.label : null;
}

/** How many stickers a sender may stick on one card. */
export const MAX_STICKERS = 4;

/* ---------------------------------------------------------------------------
 * Suggested stickers
 *
 * Sixty-two drawings is a lovely problem to have and a slightly paralysing one
 * to scroll. So the sticker step opens with three one-tap suggestions picked
 * from the tone the sender already chose: two that match the writing style, and
 * one that matches how big the oops was.
 *
 * All ids come from the "classics" pack so a suggestion is never a surprise
 * character the sender has not seen yet.
 * ------------------------------------------------------------------------ */
const STYLE_SUGGESTIONS = {
  sweet: ['bear-hug', 'cheer-up'],
  funny: ['sorry-burst', 'crying-blob'],
  poetic: ['dove-branch', 'bouquet'],
  heart: ['bandaged-heart', 'pinky-promise'],
};

/* The third slot: a big apology gets the white flag, everything else gets a
   softer closing note. */
const SEVERITY_SUGGESTION = {
  1: 'melting-heart',
  2: 'puppy-eyes',
  3: 'white-flag',
};

/**
 * Three sticker ids to offer up front, for a given style + severity.
 * Always returns three known ids, even for an unknown style.
 */
export function suggestedStickers(style, severity) {
  const base = STYLE_SUGGESTIONS[style] || STYLE_SUGGESTIONS.sweet;
  const third = SEVERITY_SUGGESTION[severity] || SEVERITY_SUGGESTION[2];
  const picks = [];
  for (const id of [...base, third, 'love-letter', 'bear-hug']) {
    if (picks.length >= 3) break;
    if (!picks.includes(id) && STICKER_IDS.includes(id)) picks.push(id);
  }
  return picks;
}

/** A reaction is either an allow-listed emoji or "sticker:<known id>". */
export const STICKER_REACTION_PREFIX = 'sticker:';

export function isValidReaction(value) {
  if (typeof value !== 'string') return false;
  if (REACTION_EMOJI.includes(value)) return true;
  if (!value.startsWith(STICKER_REACTION_PREFIX)) return false;
  return STICKER_IDS.includes(value.slice(STICKER_REACTION_PREFIX.length));
}

/* Server-side validation limits. The client mirrors these as maxLength hints,
   but the server is the only thing that actually enforces them. */
export const LIMITS = {
  name: 40,
  message: 1200,
  promise: 300,
  memory: 300,
  reason: 120,
  reactionsPerCard: 50,
};

/* ---------------------------------------------------------------------------
 * Time-capsule letters
 *
 * A card can be sealed until a chosen moment. Until then the server refuses to
 * send the words at all — see app/c/[id]/page.js — so the lock is real, not a
 * CSS trick.
 * ------------------------------------------------------------------------ */
export const UNLOCK_MIN_MS = 60 * 60 * 1000;              // at least an hour away
export const UNLOCK_MAX_MS = 5 * 365.25 * 24 * 60 * 60 * 1000; // at most five years

/**
 * Turn whatever the form sent into a trustworthy ISO timestamp.
 * Shared by the wizard (for instant feedback) and the server action (for real).
 * Returns { iso } , { iso: null } for "no lock", or { error }.
 */
export function normaliseUnlockAt(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') return { iso: null };
  const when = new Date(value).getTime();
  if (Number.isNaN(when)) return { error: 'That date did not look right.' };
  /* A minute of slack: the clock ticks between picking and pressing. */
  if (when < now + UNLOCK_MIN_MS - 60 * 1000) {
    return { error: 'Pick a moment at least an hour from now.' };
  }
  if (when > now + UNLOCK_MAX_MS) return { error: 'Five years is the longest we can hold a letter.' };
  return { iso: new Date(when).toISOString() };
}

/** True when a card is sealed and must not hand over its words yet. */
export function isSealed(unlockAt, now = Date.now()) {
  if (!unlockAt) return false;
  const when = new Date(unlockAt).getTime();
  return !Number.isNaN(when) && when > now;
}

/* "Our corner" — the private room for two. The server half (hashing, sessions,
   queries) lives in lib/couple.js, which is server-only; this is the one number
   the chat box also needs. */
export const COUPLE_MESSAGE_MAX = 600;

/* Demo card behind /c/demo (the "See a sample card" button). No database needed. */
export const SAMPLE_CARD = {
  id: 'demo',
  occasion: 'sorry',
  to_name: 'Sam',
  from_name: 'Alex',
  severity: 2,
  theme: 'blush',
  style: 'sweet',
  reason: 'I was late (again), to the one dinner that mattered',
  message:
    "I've been rehearsing this in the shower for two days, so here it goes: I was wrong, you were right, and I miss you already.\n\n" +
    "You saved me a seat and I turned it into a lesson about my calendar. That was your evening, and I spent it. I'm sorry — properly, out loud, in writing, and in whatever font makes it land best.",
  promise: 'leave twenty minutes early, every single time, starting with Thursday',
  memory: 'the night we got lost looking for that taco place and found the good one instead',
  stickers: ['mochi-bao/big-hug', 'poppy-truffle/made-up', 'white-flag'],
  opened_at: null,
  forgiven_at: null,
};

/**
 * The gentle "…about {reason} 🙈" line under a message.
 *
 * "It's complicated" reads better lowercase; "I was late" does not, because a
 * lowercase "i" just looks like a typo. So only the non-"I" openings get
 * softened.
 */
export function softenReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return '';
  if (/^I(\s|')/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}
