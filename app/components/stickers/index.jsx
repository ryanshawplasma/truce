'use client';

/**
 * The Truce sticker registry — six packs, sixty-two drawings.
 *
 *   classics        12  original object stickers (hand-drawn)
 *   momo-pip        10  bear + bunny couple
 *   rosie-plum      10  hearts couple
 *   clover-biscuit  10  bunny + cat couple
 *   mochi-bao       10  panda couple
 *   poppy-truffle   10  pig couple
 *
 * Ids are globally unique and stable. The classics keep their original
 * unprefixed ids ("bouquet") so cards and reactions created before the couple
 * packs still resolve; everything added since is namespaced "<pack>/<pose>".
 *
 * The *metadata* (pack ids, sticker ids, labels) lives in lib/constants.js so
 * server actions can validate a reaction without importing any of this client
 * component code. This file is the only place that knows about the drawings.
 */

import { STICKER_PACKS } from '@/lib/constants';
import CLASSICS from './classics';
import MOMO_PIP from './momo-pip';
import ROSIE_PLUM from './rosie-plum';
import CLOVER_BISCUIT from './clover-biscuit';
import MOCHI_BAO from './mochi-bao';
import POPPY_TRUFFLE from './poppy-truffle';

/* pack id -> { sticker id: component } */
const PACK_COMPONENTS = {
  classics: CLASSICS,
  'momo-pip': MOMO_PIP,
  'rosie-plum': ROSIE_PLUM,
  'clover-biscuit': CLOVER_BISCUIT,
  'mochi-bao': MOCHI_BAO,
  'poppy-truffle': POPPY_TRUFFLE,
};

/**
 * [{ id, name, emoji, stickers: [{ id, label, Comp }] }]
 * Built by joining the shared metadata to the drawings, so a typo in either
 * list shows up immediately as a missing component rather than silently.
 */
export const PACKS = STICKER_PACKS.map((pack) => ({
  ...pack,
  stickers: pack.stickers.map((meta) => ({
    ...meta,
    Comp: (PACK_COMPONENTS[pack.id] || {})[meta.id],
  })),
}));

/** Every sticker, flattened, in pack order. */
export const STICKERS = PACKS.flatMap((pack) => pack.stickers);

const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

export function getSticker(id) {
  return BY_ID.get(id) || null;
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || null;
}

/**
 * Draw one sticker.
 * Decorative by default; pass `label` to announce it to screen readers.
 */
export function Sticker({ id, size = 72, className, label, style }) {
  const found = getSticker(id);
  if (!found || !found.Comp) return null;
  const { Comp, label: fallback } = found;
  const described = label === undefined ? null : label || fallback;

  return (
    <Comp
      width={size}
      height={size}
      className={className}
      style={style}
      role={described ? 'img' : undefined}
      aria-label={described || undefined}
      aria-hidden={described ? undefined : 'true'}
      focusable="false"
    />
  );
}

export default STICKERS;
