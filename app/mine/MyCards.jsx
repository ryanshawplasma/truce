'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sticker } from '@/app/components/stickers';
import { copyText } from '@/app/components/ui';
import { readMyCards, storageAvailable } from '@/lib/mycards';
import { relativeTime } from '@/lib/format';
import { isSealed } from '@/lib/constants';

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
  const [justDeleted, setJustDeleted] = useState(false);

  useEffect(() => {
    setCanStore(storageAvailable());
    setCards(readMyCards());
    try {
      setOrigin(window.location.origin);
    } catch {
      setOrigin('');
    }

    /**
     * Deleting a card sends the sender here with ?deleted=1, because the page
     * they were on (their private page) no longer exists. Read from
     * window.location rather than useSearchParams() so this page stays static
     * and needs no Suspense boundary.
     *
     * The parameter is then wiped from the URL: a refresh should not re-announce
     * a deletion that happened ten minutes ago.
     */
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deleted') === '1') {
        setJustDeleted(true);
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch {
      /* no URL access — the banner simply does not show */
    }
  }, []);

  const deletedBanner = justDeleted ? (
    <div className="panel deleted-note" role="status">
      <p>
        <b>Card deleted 🤍</b> It is gone from Truce, and its link no longer opens. Anyone you already sent it to will
        see a friendly &ldquo;this card is no longer here&rdquo; page.
      </p>
    </div>
  ) : null;

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
      <>
      {deletedBanner}
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
      </>
    );
  }

  return (
    <>
      {deletedBanner}
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
  /* Hash-mode cards carry their whole self in the link, so the stored URL IS
     the card — there is no /c/<id> to rebuild and no private page to visit. */
  const isHash = card.kind === 'hash';
  const cardUrl = isHash ? card.url : `${origin}/c/${card.id}`;
  const sealed = isSealed(card.unlockAt);

  /* Fire-and-forget: the handler never awaits, and copyText always settles. */
  const onCopy = () => {
    copyText(cardUrl).then((ok) => {
      setState(ok ? 'Copied 🤍' : 'Could not copy — open the link and copy it from the address bar.');
      window.setTimeout(() => setState(''), 3200);
    });
  };

  return (
    <li className="mycard">
      <div className="mycard__main">
        <p className="mycard__to">
          To {card.toName || 'someone'}
          {sealed ? (
            <span className="mycard__badge" title="Sealed until its date">
              🕰️ Sealed
            </span>
          ) : null}
          {isHash ? (
            <span
              className="mycard__badge mycard__badge--hash"
              title="The whole card travels inside this link"
            >
              🔗 Self-contained
            </span>
          ) : null}
        </p>
        <p className="mycard__when">{relativeTime(card.createdAt) || 'just now'}</p>
        {isHash ? (
          <p className="mycard__note">
            This card lives entirely in its link — nothing about it is stored on our side, so there is no private page
            and no way to tell whether it has been opened.
          </p>
        ) : null}
      </div>

      <div className="mycard__actions">
        <button type="button" className={`btn btn--sm ${isHash ? 'btn--primary' : 'btn--ghost'}`} onClick={onCopy}>
          {isHash ? 'Copy link' : 'Their link'}
        </button>
        {isHash ? null : (
          <Link className="btn btn--primary btn--sm" href={`/s/${card.editToken}`}>
            My private page
          </Link>
        )}
      </div>

      <p className="copy-state mycard__state" role="status">
        {state}
      </p>
    </li>
  );
}
