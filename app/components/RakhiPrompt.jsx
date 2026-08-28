'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMaker } from './MakerProvider';
import { isFestivalOpen } from '@/lib/festival';

/**
 * The Raksha Bandhan prompt.
 *
 * A festival theme nobody can find is not a feature. Rakhi Gold lives six
 * questions deep in the maker, behind a theme picker somebody reaches after
 * they have already decided what to write — which is far too late to be the
 * reason they made a card at all. This puts it in front of them once.
 *
 * WHAT KEEPS IT FROM BEING A NUISANCE
 * -----------------------------------
 * A modal on a landing page is a tax on everybody who did not want it, so this
 * one is deliberately cheap to refuse:
 *
 *   - once per device, ever. Dismissed is remembered; so is "yes", because
 *     somebody who already made their card does not need asking again.
 *   - only inside the festival window, which is a fortnight a year.
 *   - never on the first paint. It waits until the page has settled, so it
 *     does not shove the landing page aside before anybody has read it.
 *   - Escape closes it, the backdrop closes it, and the decline is a real
 *     button of its own rather than a grey afterthought.
 *
 * It also opens the maker with the theme already chosen, so pressing the
 * button actually delivers the thing it advertised instead of dropping
 * somebody at question one to go and find it.
 *
 * ACCESSIBILITY
 * -------------
 * A real dialog: role, aria-modal, a labelled title, focus moved into it on
 * open and returned to wherever it was on close. The decorative rakhi is
 * hidden from screen readers — it is a picture of a thread, and the sentence
 * beside it already says what the thread is.
 */

const SEEN_KEY = 'truce.rakhi.prompt';

export default function RakhiPrompt() {
  const { open } = useMaker();
  const [showing, setShowing] = useState(false);
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  const remember = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* Storage blocked. It may ask once more on the next visit, which is a
         far smaller problem than a prompt that cannot be dismissed. */
    }
  }, []);

  const close = useCallback(() => {
    remember();
    setShowing(false);
    /* Back where they were. Dropping focus to the top of the document after a
       modal closes is one of the quiet ways a page becomes unusable by
       keyboard. */
    const back = returnFocusRef.current;
    if (back && typeof back.focus === 'function') back.focus();
  }, [remember]);

  const make = useCallback(() => {
    remember();
    setShowing(false);
    /* Its own occasion, not the apology flow wearing gold.
       This button used to open 'sorry', which then asked who you wanted to say
       sorry to and offered Girlfriend and Boyfriend — for a festival about
       brothers and sisters. A look is not an occasion. */
    open('rakhi', { theme: 'rakhi' });
  }, [open, remember]);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* Unreadable storage counts as unseen. */
    }
    if (seen || !isFestivalOpen('rakhi')) return undefined;

    /* Long enough for the page to have arrived and been looked at. A modal
       that lands on the first frame reads as an ad. */
    const timer = window.setTimeout(() => {
      returnFocusRef.current = document.activeElement;
      setShowing(true);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showing) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);

    /* Focus the panel rather than the confirm button: landing on "yes" invites
       somebody to press space and agree to something they have not read. */
    if (panelRef.current) panelRef.current.focus();

    return () => window.removeEventListener('keydown', onKey);
  }, [showing, close]);

  if (!showing) return null;

  return (
    <div className="rakhip" role="presentation" onClick={close}>
      <div
        className="rakhip__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rakhipTitle"
        tabIndex={-1}
        ref={panelRef}
        /* The backdrop closes; the panel must not, or every mis-click inside
           the dialog dismisses it. */
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="rakhip__art" viewBox="0 0 220 78" aria-hidden="true">
          <defs>
            <linearGradient id="rpGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FBDC9A" />
              <stop offset="1" stopColor="#E0A038" />
            </linearGradient>
          </defs>
          <path
            d="M4 20 C 50 44, 78 48, 110 48 C 142 48, 170 44, 216 20"
            fill="none"
            stroke="#D4451F"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="62" cy="39" r="3.6" fill="url(#rpGold)" />
          <circle cx="158" cy="39" r="3.6" fill="url(#rpGold)" />
          <g className="rakhip__bloom">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <ellipse
                key={deg}
                cx="110"
                cy="34"
                rx="5.6"
                ry="11"
                fill="url(#rpGold)"
                transform={`rotate(${deg} 110 48)`}
              />
            ))}
            <circle cx="110" cy="48" r="9.5" fill="#D4451F" />
            <circle cx="110" cy="48" r="5.6" fill="#FBDC9A" />
            <circle cx="110" cy="48" r="2.2" fill="#D4451F" />
          </g>
          <path d="M101 57 C 96 66, 95 71, 96 77" fill="none" stroke="#D4451F" strokeWidth="3" strokeLinecap="round" />
          <path d="M119 57 C 124 66, 125 71, 124 77" fill="none" stroke="#D4451F" strokeWidth="3" strokeLinecap="round" />
        </svg>

        <p className="rakhip__kicker">Today only-ish</p>
        <h2 className="rakhip__title" id="rakhipTitle">
          Happy Raksha&nbsp;Bandhan
        </h2>
        <p className="rakhip__sub">
          There is a Rakhi Gold card this week — marigold, gold thread and all. It goes
          away again on the 30th.
        </p>

        <div className="rakhip__row">
          <button type="button" className="btn btn--primary rakhip__go" onClick={make}>
            Make a Rakhi card
          </button>
          <button type="button" className="rakhip__no" onClick={close}>
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
