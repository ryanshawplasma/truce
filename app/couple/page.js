import Link from 'next/link';
import { redirect } from 'next/navigation';
import BrandMark from '@/app/components/BrandMark';
import BetaChip from '@/app/components/BetaChip';
import CoupleForms from './CoupleForms';
import { getSession } from '@/lib/couple-session';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * /couple — the door to "Our corner".
 *
 * A private room for two people, opened with a name and a shared password.
 * It exists for the moment one of them is blocked everywhere else and still
 * has something to say.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Our corner — Truce',
  description: 'A tiny private space for two, opened with a name and a password you both know.',
  robots: { index: false, follow: false },
};

/* Things that can go wrong between "make our corner" and the room actually
   opening. Each one gets a sentence a person can act on. */
const DOOR_ERRORS = {
  cookie:
    'Your corner was made, but this browser did not keep the sign-in. Enter it below with the same name and password — and check that cookies are allowed for this site.',
  lookup:
    'Your corner was made, but we could not read it back just now. Give it a moment and enter it below.',
};

export default async function CouplePage({ searchParams }) {
  const configured = isSupabaseConfigured();
  const params = (await searchParams) || {};
  const doorError = DOOR_ERRORS[params.err] || '';
  /* Both of you agreed to close it, and it is gone. Not an error — but landing
     on a blank sign-in form with no explanation would feel like one. */
  const justClosed = params.closed === '1';

  /* Already signed in? Go straight in. */
  if (configured) {
    const session = await getSession();
    if (session) redirect('/couple/room');
  }

  return (
    <div className="senderpage">
      <header className="nav is-stuck">
        <div className="wrap nav__inner">
          <Link className="brand" href="/" aria-label="Truce home">
            <BrandMark />
            <span>Truce</span>
          </Link>
          <Link className="btn btn--ghost btn--sm nav__cta" href="/">
            Make a card
          </Link>
        </div>
      </header>

      <main className="senderpage__main">
        <div className="panel corner-intro">
          <span className="corner-flag">
            💙 Our corner
            <BetaChip />
          </span>
          <h1>A room with one door and two keys.</h1>
          <p className="panel__sub">
            A tiny private room for two. Pick a name and a password together, you both type the
            same pair, and you are in — no accounts, no numbers, no app.
          </p>
          <p className="panel__sub">
            It stays open for 30 days on each device, so it is there at 2am without a login dance.
          </p>
          <p className="panel__sub">
            For the moments one of you is blocked everywhere else and still has something to say. 💙
          </p>
        </div>

        {justClosed ? (
          <p className="corner-door-note" role="status">
            That corner is closed. Every message and photo in it has been deleted, for both of you.
            You can always start a new one 🤍
          </p>
        ) : null}

        {doorError ? (
          <p className="corner-door-error" role="alert">
            {doorError}
          </p>
        ) : null}

        {configured ? (
          <>
            <CoupleForms initialError={doorError} />
            <p className="corner-note">
              Private room, shared password — not end-to-end encrypted.
            </p>
          </>
        ) : (
          <div className="panel">
            <h2>Not switched on yet</h2>
            <p className="panel__sub">
              Our corner is the one part of Truce that needs somewhere to keep your messages, and
              this site has not been connected to it yet. It will open as soon as it is.
            </p>
            <p className="panel__sub">
              Everything else still works without it: you can make and send cards right now.
            </p>
            <div className="oops__actions">
              <Link className="btn btn--primary btn--lg" href="/">
                Make a card instead
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/c/demo">
                See a sample card
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
