'use client';

import { useCallback, useState } from 'react';
import { canKeepsake, keepsakeFilename, keepsakePath } from '@/lib/keepsake';

/**
 * "Keep this card" — the card, as a picture, in your camera roll.
 *
 * WHY A SHARE SHEET AND NOT A DOWNLOAD
 * ------------------------------------
 * On a phone — which is where a card is opened — `<a download>` is close to
 * useless. iOS Safari ignores the attribute for cross-document navigations and
 * has no visible downloads folder to land in, so the best case is a new tab
 * showing an image and the person guessing at long-press. The share sheet is
 * the thing that actually has "Save Image" in it, and it is one tap.
 *
 * So the order is: share sheet where it exists, download where it works, and a
 * plain new tab as the last resort — which is exactly the fallback a browser
 * with neither API is still perfectly able to handle by hand.
 *
 * Nothing here decides whether the card CAN be kept — canKeepsake does, and the
 * route enforces the same three refusals server-side. A button that is hidden
 * is a courtesy; the route is the rule.
 */
export default function KeepCard({ card, sealed = false, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const keep = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNote('');

    const url = keepsakePath(card.id);
    const filename = keepsakeFilename(card);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        /* 403 is the seal, and it is the one worth naming: everything else is
           the same shrug from the person's point of view. */
        setNote(res.status === 403 ? 'This one is still sealed 🤍' : 'That picture would not come out. Try again?');
        return;
      }

      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'image/png' });

      /* The good path. canShare with files is the only reliable test — Safari
         has navigator.share without file support, and calling it with files it
         cannot take throws rather than degrading. */
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          /* Dismissing the sheet is an AbortError, and it is not a failure —
             they changed their mind, and saying "that did not work" would be
             both wrong and slightly rude. */
          if (err && err.name === 'AbortError') return;
          /* Anything else: fall through and try to save it the old way. */
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const canDownload = 'download' in a;

      if (canDownload) {
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNote('Saved 🤍');
      } else {
        window.open(objectUrl, '_blank', 'noopener');
        setNote('Long-press the picture to save it 🤍');
      }

      /* Not immediately: revoking before the browser has started the save
         cancels it, and a one-minute leak of one object URL on a page that is
         about to be closed is the cheaper mistake. */
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setNote('Could not reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }, [busy, card]);

  if (!canKeepsake(card, sealed)) return null;

  return (
    <div className={`keep ${className}`.trim()}>
      <button type="button" className="btn btn--ghost keep__btn" onClick={keep} disabled={busy}>
        {busy ? <span className="spinner spinner--ink" aria-hidden="true" /> : <span aria-hidden="true">🖼️</span>}
        <span>{busy ? 'Making the picture…' : 'Keep this card'}</span>
      </button>
      <p className="keep__note" role="status">
        {note || 'Saves it as a picture, so it is yours even if the link goes.'}
      </p>
    </div>
  );
}
