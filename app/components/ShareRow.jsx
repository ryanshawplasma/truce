'use client';

import { useEffect, useState } from 'react';
import { copyText, toast } from './ui';

/**
 * One row of "send this to someone" buttons.
 *
 * Used twice: by the sender on the success screen (send the card), and by the
 * recipient after they forgive (tell the sender to come and look). Same
 * component, different channels and copy.
 *
 * Every glyph below is drawn here as a plain SVG path — no brand assets are
 * downloaded or bundled. They are deliberately simple silhouettes: recognisable
 * at 22px, and consistent with the rest of the Truce line work.
 */

/* ------------------------------------------------------------------ glyphs */

function GlyphShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="18" cy="5.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.4 10.8 15.6 6.9M8.4 13.2l7.2 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* speech bubble with the tail bottom-left */}
      <path
        d="M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.3 20.7l4.4-1.1A8.8 8.8 0 1 0 12 3.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* handset */}
      <path
        d="M9.5 8.6c.35-.06.62.05.78.42l.55 1.3c.13.3.07.55-.16.79l-.42.44c-.14.15-.17.3-.07.48a6 6 0 0 0 2.4 2.35c.2.1.37.07.52-.09l.45-.45c.23-.23.48-.28.78-.15l1.3.56c.36.16.47.44.4.79-.16.86-.9 1.44-1.85 1.35a7.7 7.7 0 0 1-6.4-6.44c-.1-.94.5-1.7 1.32-1.85Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphTelegram() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* paper plane */}
      <path
        d="M21 4.3 2.9 11.2c-.6.23-.58 1.1.03 1.3l4.5 1.42 1.7 5.06c.18.55.88.68 1.25.24l2.35-2.8 4.5 3.3c.45.33 1.1.09 1.22-.46L22.2 5.2c.12-.6-.46-1.1-1.2-.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="m7.4 13.9 11.3-7.6-8.2 8.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function GlyphMessages() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3.6c-4.9 0-8.8 3.3-8.8 7.4 0 2.3 1.2 4.3 3.2 5.6v3.6l3.3-1.9c.7.14 1.5.2 2.3.2 4.9 0 8.8-3.3 8.8-7.5S16.9 3.6 12 3.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8.4" cy="11" r="1.15" fill="currentColor" />
      <circle cx="12" cy="11" r="1.15" fill="currentColor" />
      <circle cx="15.6" cy="11" r="1.15" fill="currentColor" />
    </svg>
  );
}

function GlyphInstagram() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="7" r="1.25" fill="currentColor" />
    </svg>
  );
}

function GlyphCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.4 5.6H6.6a3 3 0 0 0-3 3v8.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ helpers */

const enc = encodeURIComponent;

/** Open a normal web link without handing the new tab a window.opener. */
function openTab(href) {
  try {
    const w = window.open(href, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = href; // pop-up blocked: go there instead
  } catch {
    window.location.href = href;
  }
}

/**
 * Instagram has no prefill URL for direct messages, so the honest version is:
 * put the text on their clipboard, say so, and take them to the inbox.
 */
function shareToInstagram(fullText) {
  copyText(fullText).then((ok) => {
    toast(ok ? 'Copied — paste it in their DM 💬' : 'Copy the link first, then paste it in their DM 💬');
  });

  /* Try the app, then fall back to the web inbox — unless the app took over,
     in which case the tab is hidden and we leave well alone. */
  try {
    window.location.href = 'instagram://direct-inbox';
  } catch {
    /* desktop browsers simply ignore an unknown scheme */
  }
  window.setTimeout(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    openTab('https://www.instagram.com/direct/inbox/');
  }, 900);
}

/* ------------------------------------------------------------------- row */

/**
 * @param {string} text  the message, without the link
 * @param {string} url   the link (appended to `text` for every channel)
 * @param {string[]} channels  any of native | whatsapp | telegram | sms | instagram | copy
 */
export default function ShareRow({
  label,
  hint,
  text,
  url,
  channels = ['native', 'whatsapp', 'telegram', 'sms', 'copy'],
  className = '',
}) {
  /* navigator.share only exists in the browser, and only on some of them, so
     the button appears after hydration rather than during the server render. */
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const t = window.setTimeout(() => setCopied(false), 2600);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!url) return null;

  const fullText = `${text} ${url}`.trim();

  const onNative = () => {
    try {
      const p = navigator.share({ text, url });
      if (p && p.catch) p.catch(() => { /* they closed the sheet — nothing to do */ });
    } catch {
      /* some in-app browsers advertise share() and then refuse it */
    }
  };

  const onCopy = () => {
    copyText(fullText).then((ok) => {
      setCopied(ok);
      toast(ok ? 'Copied 🤍 paste it anywhere' : 'Your browser would not let us copy — select the link above.');
    });
  };

  const items = [];

  if (channels.includes('native') && canShare) {
    items.push({ key: 'native', name: 'Share', aria: 'Share with your phone’s share sheet', glyph: <GlyphShare />, onClick: onNative });
  }
  if (channels.includes('whatsapp')) {
    items.push({
      key: 'whatsapp', name: 'WhatsApp', aria: 'Share on WhatsApp', glyph: <GlyphWhatsApp />,
      href: `https://wa.me/?text=${enc(fullText)}`, external: true,
    });
  }
  if (channels.includes('telegram')) {
    items.push({
      key: 'telegram', name: 'Telegram', aria: 'Share on Telegram', glyph: <GlyphTelegram />,
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, external: true,
    });
  }
  if (channels.includes('sms')) {
    items.push({
      key: 'sms', name: 'Messages', aria: 'Send as a text message', glyph: <GlyphMessages />,
      href: `sms:?&body=${enc(fullText)}`, external: false,
    });
  }
  if (channels.includes('instagram')) {
    items.push({
      key: 'instagram', name: 'Instagram', aria: 'Copy the message and open Instagram', glyph: <GlyphInstagram />,
      onClick: () => shareToInstagram(fullText),
    });
  }
  if (channels.includes('copy')) {
    items.push({
      key: 'copy', name: copied ? 'Copied 🤍' : 'Copy', aria: 'Copy the message and link', glyph: <GlyphCopy />,
      onClick: onCopy,
    });
  }

  return (
    <div className={`sharerow ${className}`.trim()}>
      {label ? <h4 className="sharerow__label">{label}</h4> : null}

      <div className="sharerow__row">
        {items.map((item) =>
          item.href ? (
            <a
              key={item.key}
              className={`share-btn share-btn--${item.key}`}
              href={item.href}
              aria-label={item.aria}
              {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <span className="share-btn__glyph">{item.glyph}</span>
              <span className="share-btn__name">{item.name}</span>
            </a>
          ) : (
            <button
              key={item.key}
              type="button"
              className={`share-btn share-btn--${item.key}`}
              aria-label={item.aria}
              onClick={item.onClick}
            >
              <span className="share-btn__glyph">{item.glyph}</span>
              <span className="share-btn__name">{item.name}</span>
            </button>
          ),
        )}
      </div>

      {hint ? <p className="sharerow__hint">{hint}</p> : null}
    </div>
  );
}
