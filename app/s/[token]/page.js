import Link from 'next/link';
import BrandMark from '@/app/components/BrandMark';
import { CopyLink, DeleteCardButton } from './SenderTools';
import ReactionItem from './ReactionItem';
import { getCardByToken } from '@/lib/cards';
import { isSupabaseConfigured } from '@/lib/supabase';
import { siteOrigin } from '@/lib/site';
import { relativeTime, absoluteTime } from '@/lib/format';
import { isSealed } from '@/lib/constants';
import { getOccasion } from '@/lib/occasions';

/**
 * /s/[token] — the sender's private page.
 *
 * Reached only by knowing the long edit token, which is never shown to the
 * recipient. Shows the share link, whether the card has been opened, whether
 * they forgave you, what they sent back, and a way to delete it all.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your card — Truce',
  description: 'Your private page for a card you sent with Truce.',
  robots: { index: false, follow: false },
};

function Shell({ children }) {
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
      <main className="senderpage__main">{children}</main>
    </div>
  );
}

export default async function SenderPage({ params }) {
  const { token } = await params;
  const result = await getCardByToken(token);

  /* Unknown token, deleted card, or no database yet. */
  if (!result) {
    return (
      <Shell>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="oops__emoji" aria-hidden="true">
            🔎
          </div>
          <h2>We couldn&rsquo;t find that card</h2>
          <p className="panel__sub">
            {isSupabaseConfigured()
              ? 'This private link is either mistyped, or the card has already been deleted. Private links are long on purpose — copy the whole thing, including every character after /s/.'
              : 'There are no saved cards to look up yet — this site has not been connected to its database, so private pages are not switched on. Cards you make still work; they just carry themselves inside their link.'}
          </p>
          <div className="oops__actions">
            <Link className="btn btn--primary btn--lg" href="/">
              Make a card
            </Link>
            <Link className="btn btn--ghost btn--lg" href="/c/demo">
              See a sample card
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const { card, reactions } = result;
  const origin = await siteOrigin();
  const cardUrl = `${origin}/c/${card.id}`;

  const opened = Boolean(card.opened_at);
  /* One column, three meanings: forgiven on an apology, "they made their wish"
     on a birthday, "they said yes" on a proposal. The wording comes from the
     occasion config so the timeline never says the wrong thing. */
  const forgiven = Boolean(card.forgiven_at);
  const sealed = isSealed(card.unlock_at);
  const occasion = getOccasion(card.occasion);
  const tl = occasion.timeline;

  return (
    <Shell>
      <span className="private-flag">🔒 Private page — only you have this link</span>

      <div className="panel">
        <h2>
          Your {occasion.label.toLowerCase()} card for {card.to_name} <span aria-hidden="true">{occasion.badge}</span>
        </h2>
        <p className="panel__sub">
          Created {relativeTime(card.created_at)} · from {card.from_name} · {card.theme} theme
          {card.unlock_at ? <> · 🕰️ sealed until {absoluteTime(card.unlock_at)}</> : null}
        </p>
        <div className="linkgroup" style={{ marginTop: 6 }}>
          <h4>Their link — this is the one to send</h4>
          <CopyLink url={cardUrl} />
          <p>Keep the page you are on right now to yourself — it is how you check in later.</p>
        </div>
      </div>

      <div className="panel">
        <h2>Where things stand</h2>
        <p className="panel__sub">This updates itself. Refresh whenever you need to know.</p>

        <ul className="timeline">
          <li>
            <span className="tl__dot is-done" aria-hidden="true">
              ✓
            </span>
            <span className="tl__body">
              <b>Created</b>
              <span>{absoluteTime(card.created_at)}</span>
            </span>
          </li>
          {card.unlock_at ? (
            <li>
              <span className={`tl__dot${sealed ? '' : ' is-done'}`} aria-hidden="true">
                🕰️
              </span>
              <span className="tl__body">
                <b>{sealed ? `Sealed until ${absoluteTime(card.unlock_at)}` : 'Unsealed'}</b>
                <span>
                  {sealed
                    ? 'Until then they see a sealed envelope and a countdown — the words are not sent to their browser at all.'
                    : `The seal broke on ${absoluteTime(card.unlock_at)}. It reads like any other card now.`}
                </span>
              </span>
            </li>
          ) : null}
          <li>
            <span className={`tl__dot${opened ? ' is-done' : ''}`} aria-hidden="true">
              {opened ? '👀' : '…'}
            </span>
            <span className="tl__body">
              <b>{opened ? `Opened ${relativeTime(card.opened_at)}` : 'Not opened yet'}</b>
              <span>
                {opened
                  ? absoluteTime(card.opened_at)
                  : sealed
                    ? 'Nothing is recorded while the letter is sealed — the countdown does not count as opening it.'
                    : 'We will record the moment they first open the envelope.'}
              </span>
            </span>
          </li>
          <li>
            <span className={`tl__dot${forgiven ? ' is-done' : ''}`} aria-hidden="true">
              {forgiven ? tl.doneEmoji : '…'}
            </span>
            <span className="tl__body">
              <b>{forgiven ? tl.doneTitle : tl.pendingTitle}</b>
              <span>
                {forgiven
                  ? `${tl.doneHint} ${relativeTime(card.forgiven_at)} — ${absoluteTime(card.forgiven_at)}`
                  : tl.pendingHint}
              </span>
            </span>
          </li>
        </ul>
      </div>

      <div className="panel">
        <h2>Sent back to you</h2>
        <p className="panel__sub">Emoji and stickers they tapped after reading your card, newest first.</p>
        {reactions.length ? (
          <ul className="reaction-log">
            {reactions.map((r) => (
              <ReactionItem key={r.id} value={r.emoji} when={relativeTime(r.created_at)} />
            ))}
          </ul>
        ) : (
          <p className="empty-state">Nothing yet — reactions show up here the moment they tap one. 🤍</p>
        )}
      </div>

      <div className="panel danger">
        <h2>Delete this card</h2>
        <p className="panel__sub">
          The link stops working straight away and everything above is removed. There is no undo, so be sure.
        </p>
        <DeleteCardButton token={card.edit_token} toName={card.to_name} />
      </div>
    </Shell>
  );
}
