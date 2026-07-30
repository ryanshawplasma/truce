'use client';

import { useMemo, useState } from 'react';
import MESSAGES from '../data/messages';
import { STYLES, STYLE_LABEL } from '@/lib/constants';
import CtaButton from './CtaButton';

/** The "peek at the library" block: style tabs + a few real messages. */
export default function MessageTeaser() {
  const [active, setActive] = useState('sweet');

  const picks = useMemo(() => MESSAGES.filter((m) => m.s === active).slice(0, 4), [active]);

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Apology styles">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={s.id === active}
            onClick={() => setActive(s.id)}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      <div className="quotes">
        {picks.length ? (
          picks.map((m, i) => (
            <figure className="quote" key={`${active}-${i}`} style={{ animationDelay: `${i * 60}ms` }}>
              “{m.t}”
              <span>
                {STYLE_LABEL[m.s] || m.s} · for {(m.who || ['any']).join(', ')}
              </span>
            </figure>
          ))
        ) : (
          <p className="msg-empty">More messages in this style are on the way.</p>
        )}
      </div>

      <p className="library-note">
        …and {Math.max(MESSAGES.length - 4, 0)} more, sorted by who you&rsquo;re writing to.{' '}
        <CtaButton className="btn btn--plain">Browse them in the maker →</CtaButton>
      </p>
    </>
  );
}
