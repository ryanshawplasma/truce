'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

export default function MakerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

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
      {isOpen ? <Wizard onClose={close} /> : null}
    </MakerContext.Provider>
  );
}
