'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CardExperience from '@/app/components/CardExperience';
import { decodeCard } from '@/lib/codec';

/**
 * /c/local — "no-setup mode".
 *
 * The whole card is packed into the URL fragment (#c=…), which browsers never
 * send to the server, so the decoding has to happen here. This is what makes
 * Truce work with zero backend configuration.
 */
export default function LocalCard() {
  const [card, setCard] = useState(undefined); // undefined = still reading the hash

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash || '';
      const raw = hash.startsWith('#c=') ? hash.slice(3) : '';
      setCard(decodeCard(raw));
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  if (card === undefined) {
    return (
      <div className="oops">
        <p className="lede">Opening your card…</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="oops">
        <div className="oops__emoji" aria-hidden="true">
          💔
        </div>
        <h1>That link looks damaged</h1>
        <p>
          The card was tucked inside the link itself, and some of it went missing along the way — usually when a chat app
          shortens or wraps the address. Ask them to send the whole link again.
        </p>
        <div className="oops__actions">
          <Link className="btn btn--primary btn--lg" href="/">
            Make your own card
          </Link>
          <Link className="btn btn--ghost btn--lg" href="/c/demo">
            See a sample card
          </Link>
        </div>
      </div>
    );
  }

  return <CardExperience card={card} live={false} />;
}
