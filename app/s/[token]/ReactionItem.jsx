'use client';

import { Sticker } from '@/app/components/stickers';
import { STICKER_REACTION_PREFIX } from '@/lib/constants';

/**
 * One thing the recipient sent back — an emoji or a sticker.
 * Stickers are stored as "sticker:<id>"; anything else is an emoji.
 */
export default function ReactionItem({ value, when }) {
  const isSticker = typeof value === 'string' && value.startsWith(STICKER_REACTION_PREFIX);
  const id = isSticker ? value.slice(STICKER_REACTION_PREFIX.length) : null;

  return (
    <li>
      {isSticker ? (
        <Sticker id={id} size={72} className="sticker" label="" />
      ) : (
        <span className="emoji">{value}</span>
      )}
      <span className="when">{when}</span>
    </li>
  );
}
