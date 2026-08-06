'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Add to Home Screen".
 *
 * Two browsers, two completely different stories:
 *
 *   Android / desktop Chromium — fires `beforeinstallprompt` when it decides a
 *     site is installable. Swallow it, keep it, and fire it back when the person
 *     actually asks. The event is single-use: once prompt() has been called the
 *     browser will not hand us another one, so it is dropped afterwards.
 *
 *   iOS Safari — has no such event and no API at all. Adding to the home screen
 *     is a manual trip through the Share sheet, so the honest thing is to show
 *     the three taps rather than a button that cannot work.
 *
 * Everything is decided after mount. The server cannot know what browser this
 * is or whether the app is already installed, so rendering anything during SSR
 * would either flash the wrong thing or trip hydration.
 *
 * Storage follows the same rule as lib/appearance.js and lib/mycards.js:
 * localStorage may be missing, full or blocked, so every access is wrapped and
 * every failure is silent — the worst case is that a dismissed hint comes back.
 */

const DISMISS_KEY = 'truce.install.dismissed';

/* Long enough that a "not now" sticks for a while, short enough that somebody
   who genuinely wants it is not locked out for good. */
const DISMISS_DAYS = 30;

function dismissedRecently() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const when = Number(raw);
    if (!Number.isFinite(when)) return false;
    return Date.now() - when < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* Blocked storage — the hint simply comes back next visit. */
  }
}

/** Already running from the home screen? Then there is nothing to offer. */
function isStandalone() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    /* Safari's own, older flag — still the only one iOS sets. */
    return window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/** iPhone, iPod, and iPads that pretend to be desktop Macs since iPadOS 13. */
function isIOS() {
  try {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent || '';
    if (/iphone|ipod|ipad/i.test(ua)) return true;
    return /macintosh/i.test(ua) && Number(window.navigator.maxTouchPoints) > 1;
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {string} [props.className]  extra classes for the trigger
 * @param {'chip'|'wide'} [props.tone] how loud the trigger looks
 * @param {string} [props.label]      override the trigger's words
 */
export default function InstallPrompt({ className = '', tone = 'chip', label = 'Add to Home Screen' }) {
  /* 'none' until we know better — nothing renders on the server or the first
     client frame, which is exactly what we want. */
  const [mode, setMode] = useState('none'); // 'none' | 'prompt' | 'ios'
  const [guideOpen, setGuideOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const deferredRef = useRef(null);

  /**
   * Register the service worker.
   *
   * Not for offline support — public/sw.js caches nothing on purpose. Chrome
   * simply will not fire `beforeinstallprompt` for a site without a fetch
   * handler, so without this the Android button below would never appear.
   *
   * Failures are swallowed: an unregistered worker costs us the install
   * button and nothing else, and it is not worth a message about.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  useEffect(() => {
    if (isStandalone()) return undefined;
    if (dismissedRecently()) return undefined;

    /* iOS decides immediately — there is no event coming. */
    if (isIOS()) {
      setMode('ios');
      return undefined;
    }

    const onBeforeInstall = (event) => {
      /* Stop Chrome's own mini-infobar so ours is the only offer on screen. */
      event.preventDefault();
      deferredRef.current = event;
      setMode('prompt');
    };

    const onInstalled = () => {
      deferredRef.current = null;
      setInstalled(true);
      setMode('none');
      rememberDismissal();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = deferredRef.current;
    if (!event) return;
    /* Single-use: whatever happens, this event is spent. */
    deferredRef.current = null;
    try {
      event.prompt();
      const choice = await event.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setInstalled(true);
        setMode('none');
      } else {
        /* "Not now" is an answer — stop asking for a while. */
        setMode('none');
        rememberDismissal();
      }
    } catch {
      setMode('none');
    }
  }, []);

  if (installed || mode === 'none') return null;

  const triggerClass = ['install-btn', tone === 'wide' ? 'install-btn--wide' : 'install-btn--chip', className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => (mode === 'ios' ? setGuideOpen(true) : install())}
      >
        <span aria-hidden="true">⬇️</span>
        {label}
      </button>

      {guideOpen ? <IOSGuide onDismiss={() => setGuideOpen(false)} onNever={() => {
        rememberDismissal();
        setGuideOpen(false);
        setMode('none');
      }} /> : null}
    </>
  );
}

/**
 * The three taps, in the order iOS actually presents them.
 *
 * Written as instructions rather than a screenshot on purpose: Apple moves the
 * Share button between the bottom bar and the address bar depending on version
 * and orientation, and a stale screenshot is worse than a sentence.
 */
function IOSGuide({ onDismiss, onNever }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="closer" role="dialog" aria-modal="true" aria-label="Add Truce to your home screen">
      <button type="button" className="closer__backdrop" onClick={onDismiss} aria-label="Close" />

      <div className="closer__panel install-guide">
        <h2 className="closer__title">Keep Truce one tap away</h2>
        <p className="closer__body">
          Three taps and it lives on your home screen like any other app — full screen, no address
          bar.
        </p>

        <ol className="install-steps">
          <li className="install-step">
            <span className="install-step__n" aria-hidden="true">
              1
            </span>
            <span className="install-step__text">
              Tap the <b>Share</b> button
              <span className="install-step__glyph" aria-hidden="true">
                {/* iOS share glyph: a box with an arrow leaving the top. */}
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
                  <path
                    d="M12 3v12M12 3l-3.6 3.6M12 3l3.6 3.6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <small>at the bottom of Safari — or in the address bar on an iPad</small>
            </span>
          </li>

          <li className="install-step">
            <span className="install-step__n" aria-hidden="true">
              2
            </span>
            <span className="install-step__text">
              Scroll down and choose <b>Add to Home Screen</b>
              <small>it sits below the row of share icons</small>
            </span>
          </li>

          <li className="install-step">
            <span className="install-step__n" aria-hidden="true">
              3
            </span>
            <span className="install-step__text">
              Tap <b>Add</b>, top right
              <small>that&rsquo;s it — Truce is on your home screen 🤍</small>
            </span>
          </li>
        </ol>

        <p className="install-guide__note">
          Safari only. If you&rsquo;re in Chrome or Firefox on iPhone, open this page in Safari
          first.
        </p>

        <div className="closer__actions">
          <button type="button" className="btn btn--primary btn--wide" onClick={onDismiss}>
            Got it
          </button>
          <button type="button" className="btn btn--ghost btn--wide" onClick={onNever}>
            Don&rsquo;t show this again
          </button>
        </div>
      </div>
    </div>
  );
}
