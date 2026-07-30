'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sticker } from '@/app/components/stickers';
import { copyText } from '@/app/components/ui';
import { readMyCards, storageAvailable } from '@/lib/mycards';
import { relativeTime } from '@/lib/format';

/**
 * The list of cards this device remembers.
 *
 * Read in an effect, never during render: storage is a browser-only thing, and
 * reading it while rendering would either break the server build or produce a
 * hydration mismatch. Until the effect runs we show a quiet placeholder.
 */
export default function MyCards() {
  const [cards, setCards] = useState(null); // null = still looking
  const [canStore, setCanStore] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setCanStore(storageAvailable());
    setCards(readMyCards());
    try {
      setOrigin(window.location.origin);
    } catch {
      setOrigin('');
    }
  }, []);

  if (cards === null) {
    return (
      <div className="panel" style={{ textAlign: 'center' }}>
        <p className="panel__sub" style={{ margin: 0 }}>
          Looking on this device…
        </p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="panel mycards__empty">
        <Sticker id="bandaged-heart" size={96} className="mycards__mascot" />
        <h2>No cards yet</h2>
        <p className="panel__sub">Cards you make on this device will appear here.</p>
        <p className="mycards__fineprint">
          {canStore
            ? 'This list is kept in your browser only — clearing your browsing data (or opening Truce on another phone) clears it. Your private link is still the safest thing to keep.'
            : 'Your browser is blocking site storage right now — private browsing usually does this — so Truce cannot remember cards on this device. Everything else works normally; just keep your private link somewhere safe when you make a card.'}
        </p>
        <div className="oops__actions">
          <Link className="btn btn--primary btn--lg" href="/">
            Make a card
          </Link>
          <Link className="btn btn--ghost btn--lg" href="/c/demo">
            See a sample card
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>My cards</h2>
        <p className="panel__sub">
          {cards.length === 1 ? 'One card' : `${cards.length} cards`}{' '}
          made on this device, newest first. Tap &ldquo;My private page&rdquo; to see if it has been opened.
        </p>

        <ul className="mycards">
          {cards.map((card) => (
            <MyCardRow key={card.id} card={card} origin={origin} />
          ))}
        </ul>
      </div>

      <p className="mycards__fineprint mycards__fineprint--foot">
        This list lives in your browser, not on our servers. Clearing your browsing data clears it, and it will not
        follow you to another device — so keep your private links somewhere safe too.
      </p>
    </>
  );
}

function MyCardRow({ card, origin }) {
  const [state, setState] = useState('');
  const cardUrl = `${origin}/c/${card.id}`;

  const onCopy = async () => {
    const ok = await copyText(cardUrl);
    setState(ok ? 'Copied 🤍' : 'Could not copy — open the link and copy it from the address bar.');
    setTimeout(() => setState(''), 2600);
  };

  return (
    <li className="mycard">
      <div className="mycard__main">
        <p className="mycard__to">To {card.toName || 'someone'}</p>
        <p className="mycard__when">{relativeTime(card.createdAt) || 'just now'}</p>
      </div>

      <div className="mycard__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCopy}>
          Their link
        </button>
        <Link className="btn btn--primary btn--sm" href={`/s/${card.editToken}`}>
          My private page
        </Link>
      </div>

      <p className="copy-state mycard__state" role="status">
        {state}
      </p>
    </li>
  );
}
