'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { findMyCard } from '@/lib/mycards';

/**
 * The sender's way home.
 *
 * The reply link is meant to be sent TO the sender, so most people who open
 * /r/<id> made the card. If this device remembers making it, offer the private
 * page — that is where the full timeline and the delete button live, and losing
 * the /s/ link is the single most common way people get stuck.
 *
 * Read in an effect on purpose: `findMyCard` reads localStorage, which does not
 * exist during the server render. Doing it any earlier would make the first
 * client render disagree with the server's and hydration would complain.
 */
export default function ReplyCreatorBanner({ cardId }) {
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    if (!cardId || cardId === 'demo') return;
    setEntry(findMyCard(cardId));
  }, [cardId]);

  if (!entry) return null;

  return (
    <Link className="creator-banner" href={`/s/${entry.editToken}`}>
      <span aria-hidden="true">🔒</span> This is your card — view your private page →
    </Link>
  );
}
