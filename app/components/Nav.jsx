'use client';

import { useEffect, useState } from 'react';
import BrandMark from './BrandMark';
import CtaButton from './CtaButton';

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#messages', label: 'Messages' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
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
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

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
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
            {l.label}
          </a>
        ))}
        <CtaButton className="btn btn--primary btn--wide">Make your card</CtaButton>
      </div>
    </header>
  );
}
