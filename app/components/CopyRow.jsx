'use client';

import { useEffect, useRef, useState } from 'react';
import { copyText } from './ui';

/**
 * One link, one Copy button, and a fallback that always works.
 *
 * The whole point of this component is that it can never get stuck:
 *   - the click handler is not `async` and never awaits, so the button stays
 *     responsive whatever the clipboard does;
 *   - `copyText` resolves within 1.5s no matter what (see ui.js);
 *   - if it could not copy, the field is selected for the visitor and the row
 *     explains how to copy it by hand.
 *
 * Used by the wizard's success screen, the sender page and /mine so all three
 * behave identically.
 */
export default function CopyRow({ url, ariaLabel = 'Link', tone = 'public', autoFocusOnFail = true }) {
  const [state, setState] = useState('idle'); // idle | copied | manual
  const inputRef = useRef(null);
  const resetRef = useRef(null);

  useEffect(() => () => window.clearTimeout(resetRef.current), []);

  const onCopy = () => {
    window.clearTimeout(resetRef.current);
    copyText(url).then((ok) => {
      setState(ok ? 'copied' : 'manual');
      if (!ok && autoFocusOnFail && inputRef.current) {
        try {
          inputRef.current.focus();
          inputRef.current.select();
        } catch {
          /* a browser that will not let us select is exactly why the hint below exists */
        }
      }
      if (ok) resetRef.current = window.setTimeout(() => setState('idle'), 2600);
    });
  };

  return (
    <>
      <div className={`linkbox${tone === 'private' ? ' linkbox--private' : ''}${state === 'manual' ? ' is-manual' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          aria-label={ariaLabel}
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.target.select()}
        />
        <button type="button" className="btn btn--primary btn--sm" onClick={onCopy}>
          {state === 'copied' ? 'Copied 🤍' : 'Copy'}
        </button>
      </div>

      <p className="copy-state" role="status">
        {state === 'copied' ? 'Copied 🤍' : ''}
        {state === 'manual'
          ? 'Your browser would not let us copy it. The link is selected above — hold it down and choose Copy.'
          : ''}
      </p>
    </>
  );
}
