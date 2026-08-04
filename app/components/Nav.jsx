'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import CtaButton from './CtaButton';
import BetaChip from './BetaChip';
import AppearanceToggle from './AppearanceToggle';

/* In-page anchors, plus one real route: `route: true` entries use next/link so
   they navigate instead of scrolling. */
const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#messages', label: 'Messages' },
  { href: '#pricing', label: 'Pricing' },
  /* `corner` gives it the soft tinted chip in the bar. It is the only link
     here that goes somewhere private rather than further down the page, and it
     was disappearing among five anchors that all look the same. */
  { href: '/couple', label: 'Our corner 💙', route: true, beta: true, corner: true },
  { href: '#faq', label: 'FAQ' },
  { href: '/mine', label: 'My cards', route: true },
];

export default function Nav() {
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav${stuck ? ' is-stuck' : ''}`}>
      <div className="wrap nav__inner">
        <a
          className="brand"
          href="#top"
          aria-label="Truce home"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <BrandMark />
          <span>Truce</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((l) =>
            l.route ? (
              <Link key={l.href} href={l.href} className={l.corner ? 'nav__corner' : undefined}>
                {l.label}
                {l.beta ? <BetaChip /> : null}
              </Link>
            ) : (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ),
          )}
        </nav>

        <AppearanceToggle variant="pill" />

        <CtaButton className="btn btn--primary btn--sm nav__cta">Make your card</CtaButton>

        <button
          type="button"
          className="nav__toggle"
          aria-expanded={menuOpen}
          aria-controls="navDrawer"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
        </button>
      </div>

      <div className={`nav__drawer${menuOpen ? '' : ' hidden'}`} id="navDrawer">
        {LINKS.map((l) =>
          l.route ? (
            <Link
              key={l.href}
              href={l.href}
              className={l.corner ? 'nav__corner' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
              {l.beta ? <BetaChip /> : null}
            </Link>
          ) : (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ),
        )}
        <CtaButton className="btn btn--primary btn--wide">Make your card</CtaButton>
        <AppearanceToggle variant="row" />
      </div>
    </header>
  );
}
