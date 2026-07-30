import Link from 'next/link';

export const metadata = {
  title: 'Card not found — Truce',
  description: 'This link is not working.',
  robots: { index: false, follow: false },
};

/** Friendly 404 — most people land here from a mistyped or deleted card link. */
export default function NotFound() {
  return (
    <div className="oops">
      <div className="oops__emoji" aria-hidden="true">
        💌
      </div>
      <h1>This card has gone quiet</h1>
      <p>
        The link may be mistyped, or the person who sent it deleted the card. If someone sent you this, ask them for the
        link again — it&rsquo;s the only copy.
      </p>
      <div className="oops__actions">
        <Link className="btn btn--primary btn--lg" href="/">
          Make your own card
        </Link>
        <Link className="btn btn--ghost btn--lg" href="/c/demo">
          See a sample card
        </Link>
      </div>
    </div>
  );
}
