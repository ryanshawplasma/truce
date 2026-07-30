import Link from 'next/link';
import { redirect } from 'next/navigation';
import BrandMark from '@/app/components/BrandMark';
import BetaChip from '@/app/components/BetaChip';
import CoupleForms from './CoupleForms';
import { getSession } from './actions';
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

export default async function CouplePage() {
  const configured = isSupabaseConfigured();

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
            Our corner is a tiny private room for two. No accounts, no phone numbers, no app — just
            a page you can both open whenever you need to say something.
          </p>

          {/* How it works, in the order it actually happens. Three steps is the
              whole of it, and saying so up front is what stops people bouncing
              off a name-and-password box they do not recognise. */}
          <ol className="corner-how">
            <li>
              <span className="corner-how__num">1</span>
              <span>
                <b>Pick a room name and a password together.</b> Anything you will both remember —
                an inside joke works better than a good password here.
              </span>
            </li>
            <li>
              <span className="corner-how__num">2</span>
              <span>
                <b>You both enter the same pair.</b> That is the whole key. Whoever has both is in;
                nobody else is, and there is no list of rooms to browse.
              </span>
            </li>
            <li>
              <span className="corner-how__num">3</span>
              <span>
                <b>It stays open for 30 days.</b> Signed in on each device, so it is there at 2am
                without a login dance.
              </span>
            </li>
          </ol>

          <p className="corner-for">
            <b>What it is for:</b> the moments one of you is blocked everywhere else and still has
            something to say. 💙
          </p>

          <ul className="corner-points">
            <li>
              <b>Nothing to install.</b> It is a web page. It works on the phone you already have.
            </li>
            <li>
              <b>Not indexed, not listed.</b> Rooms are found by knowing the name and the password,
              never by searching.
            </li>
            <li>
              <b>Free while in beta.</b> Like the rest of Truce. 🤍
            </li>
          </ul>

          <p className="corner-honest">
            <b>Being straight with you:</b> this is a shared-secret room, and it is{' '}
            <b>not end-to-end encrypted</b>. Your messages are stored on our server so the other one
            of you can read them later, which means we could technically read them too. Treat it
            like a note passed in class — lovely, private from the world, but please don&rsquo;t
            reuse an important password here, and don&rsquo;t put anything in it you would be
            devastated to lose.
          </p>
        </div>

        {configured ? (
          <CoupleForms />
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
