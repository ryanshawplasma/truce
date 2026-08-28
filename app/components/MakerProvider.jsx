'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Wizard from './Wizard';

/**
 * Holds the "is the card maker open?" state for the whole landing page, so any
 * button anywhere on the page (nav, hero, features, footer) can open it.
 *
 * Server-rendered sections are passed straight through as `children`, which
 * keeps the marketing copy on the server and only ships the interactive bits.
 */

const MakerContext = createContext({ open: () => {}, close: () => {}, isOpen: false });

export function useMaker() {
  return useContext(MakerContext);
}

/**
 * `dbEnabled` is passed down from the server page. The wizard cannot read
 * server env vars itself, and the key must never be exposed with a
 * NEXT_PUBLIC_ prefix — so the server simply tells it yes or no.
 */
export default function MakerProvider({ children, dbEnabled = false }) {
  const [isOpen, setIsOpen] = useState(false);

  /* Set when the maker is opened from an occasion shortcut ("Birthday 🎂"
     under the hero). The token changes on every click so the wizard can tell a
     fresh request apart from a re-render and start a clean card. */
  const [start, setStart] = useState(null);

  /* Once the maker has been opened it stays MOUNTED, just hidden. Unmounting it
     would throw away every answer, which is what made pressing Back so painful:
     nine questions gone, no warning, no way back. Mounted-but-hidden means
     closing and reopening lands them exactly where they left off. */
  const [hasOpened, setHasOpened] = useState(false);

  /* Whether we pushed a history entry for the current opening. */
  const pushedRef = useRef(false);

  /**
   * `open()` — carry on where they left off.
   * `open('birthday')` — start a birthday card, past the occasion question.
   * `open('sorry', { theme: 'rakhi' })` — and with a look already chosen, which
   * is how the festival prompt hands somebody a Rakhi card rather than making
   * them find the theme themselves six questions later.
   */
  const open = useCallback((occasion, options) => {
    if (typeof occasion === 'string' && occasion) {
      setStart({ occasion, theme: (options && options.theme) || null, token: Date.now() });
    }
    setHasOpened(true);
    setIsOpen(true);
    /**
     * One history entry per opening, so the phone's Back gesture — which people
     * reach for meaning "go back a step" — closes the overlay instead of
     * leaving the site entirely. The wizard's own back arrow is untouched and
     * still walks through the questions.
     */
    if (!pushedRef.current) {
      try {
        window.history.pushState({ truceMaker: true }, '');
        pushedRef.current = true;
      } catch {
        /* Some embedded browsers refuse pushState — the maker still works. */
      }
    }
  }, []);

  const close = useCallback(() => {
    /* If we pushed an entry, unwind it and let popstate do the actual closing,
       so the history stack never drifts out of step with what is on screen. */
    if (pushedRef.current) {
      try {
        window.history.back();
        return;
      } catch {
        pushedRef.current = false;
      }
    }
    setIsOpen(false);
  }, []);

  /* Back button / Back gesture closes the overlay rather than the site. */
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      setIsOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* Keep the page behind the overlay from scrolling. */
  useEffect(() => {
    document.body.classList.toggle('is-locked', isOpen);
    return () => document.body.classList.remove('is-locked');
  }, [isOpen]);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <MakerContext.Provider value={value}>
      <div id="app-landing" className={isOpen ? 'hidden' : undefined}>
        {children}
      </div>
      {hasOpened ? <Wizard onClose={close} dbEnabled={dbEnabled} open={isOpen} start={start} /> : null}
    </MakerContext.Provider>
  );
}
