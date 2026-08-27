/**
 * Card themes, as plain colours.
 *
 * WHY THIS EXISTS SEPARATELY FROM globals.css
 * -------------------------------------------
 * The real theme lives in app/globals.css as custom properties under
 * `.themed[data-theme="…"]`, and a browser resolves them. Two things that draw
 * cards have no browser and no DOM: the share image that unfurls in a chat, and
 * the keepsake PNG somebody saves. Both run inside next/og, which lays out with
 * Satori — no cascade, no var(), no computed styles. They need the numbers.
 *
 * This file was written because the keepsake route had already copied the
 * palette by hand and the share image had its own separate hardcoded pink, so
 * there were three descriptions of the same six themes and only one of them
 * moved when a theme changed. Now there is one, and both renderers read it.
 *
 * KEEPING IT HONEST
 * -----------------
 * It still has to be edited alongside globals.css by hand — nothing here can
 * read CSS. What it can do is fail loudly rather than quietly: THEME_IDS in
 * lib/constants.js is the list of themes that exist, and a test asserts every
 * one of them has an entry here. Add a seventh theme and that test fails before
 * anybody discovers the share image drew it in the wrong colour.
 */

/**
 * One entry per theme in THEMES (lib/constants.js).
 *
 *   bg          the page behind the card
 *   panel       the card / letter surface
 *   ink         body text on `panel`
 *   soft        secondary text on `panel`
 *   accent      the one saturated colour: seals, rules, the signature
 *   accentDeep  a step darker, for the underside of a seal
 *   envelope    the drawn envelope body
 *   fold        its flap, one step from `envelope`
 *   paper       the letter peeking out of it
 */
export const CARD_LOOKS = {
  blush: {
    bg: 'linear-gradient(160deg,#FFF1F4 0%,#FFD9CC 100%)',
    panel: '#FFFFFF',
    ink: '#3D2137',
    soft: '#8A6A80',
    accent: '#E85D75',
    accentDeep: '#C94360',
    envelope: '#F5B7C6',
    fold: '#EFA3B6',
    paper: '#FFF7F2',
  },
  sky: {
    bg: 'linear-gradient(160deg,#EAF6FF 0%,#D6ECFF 100%)',
    panel: '#FFFFFF',
    ink: '#223A54',
    soft: '#4A6884',
    accent: '#4A90D9',
    accentDeep: '#356FAC',
    envelope: '#AED2F2',
    fold: '#96C2EA',
    paper: '#F4FAFF',
  },
  peach: {
    bg: 'linear-gradient(160deg,#FFF3E7 0%,#FFC9AE 100%)',
    panel: '#FFFBF7',
    ink: '#4A2A1E',
    soft: '#8A6552',
    accent: '#EF8256',
    accentDeep: '#C9633C',
    envelope: '#FBC3A2',
    fold: '#F7AE87',
    paper: '#FFF8F1',
  },
  lavender: {
    bg: 'linear-gradient(160deg,#F5F0FF 0%,#DCD3F7 100%)',
    panel: '#FFFFFF',
    ink: '#2E2247',
    soft: '#6B5B8E',
    accent: '#8B6BD6',
    accentDeep: '#6C4FB0',
    envelope: '#CDBDF0',
    fold: '#BAA6E8',
    paper: '#F8F5FF',
  },
  moonlight: {
    bg: 'linear-gradient(160deg,#0F1630 0%,#2A2F58 100%)',
    panel: '#1A2244',
    ink: '#F6F8FF',
    soft: '#A9B8EA',
    accent: '#A9B8EA',
    accentDeep: '#7C8DC4',
    envelope: '#39406E',
    fold: '#2C3159',
    paper: '#E8EDFB',
  },
  midnight: {
    bg: 'linear-gradient(160deg,#2A1B3D 0%,#3A1F3E 100%)',
    panel: '#3A2A52',
    ink: '#F7EEF6',
    soft: '#D9BBD0',
    accent: '#F2B880',
    accentDeep: '#CE955F',
    envelope: '#513A6B',
    fold: '#432F5A',
    paper: '#F7EEF6',
  },
};

/** The one a card falls back to. Blush is the brand. */
export const DEFAULT_LOOK = 'blush';

/**
 * The palette for a theme, never undefined.
 *
 * An unknown theme comes back as blush rather than as a crash or, worse, as an
 * object of undefined colours — which renders as a black rectangle with
 * invisible text, and does so in the one image a stranger sees in a chat.
 */
export function cardLook(theme) {
  return CARD_LOOKS[theme] || CARD_LOOKS[DEFAULT_LOOK];
}

/** Is this a theme meant to be read as night? Changes nothing but shadows. */
export function isNightLook(theme) {
  return theme === 'moonlight' || theme === 'midnight';
}
