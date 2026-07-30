import Link from 'next/link';
import BrandMark from '@/app/components/BrandMark';
import MyCards from './MyCards';

/**
 * /mine — "My cards".
 *
 * A rescue hatch for senders who kept the card link but lost the private one.
 * The list lives entirely in the visitor's own browser (see lib/mycards.js),
 * so this page is a thin server shell around a client component: there is
 * nothing on the server to look up, and nothing to render until the browser
 * has read its own storage.
 */
export const metadata = {
  title: 'My cards — Truce',
  description: 'Cards you have made on this device.',
  robots: { index: false, follow: false },
};

export default function MinePage() {
  return (
    <div className="senderpage">
      <header className="nav is-stuck">
        <div className="wrap nav__inner">
          <Link className="brand" href="/" aria-label="Truce home">
            <BrandMark />
            <span>Truce</span>
          </Link>
          <Link className="btn btn--ghost btn--sm nav__cta" href="/">
            Make another card
          </Link>
        </div>
      </header>

      <main className="senderpage__main">
        <MyCards />
      </main>
    </div>
  );
}
