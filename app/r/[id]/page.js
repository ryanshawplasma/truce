import Link from 'next/link';
import { notFound } from 'next/navigation';
import BrandMark from '@/app/components/BrandMark';
import ReactionItem from '@/app/s/[token]/ReactionItem';
import ReplyCreatorBanner from './ReplyCreatorBanner';
import { getCardById, getReactionsByCardId } from '@/lib/cards';
import { metadataBase, siteOrigin } from '@/lib/site';
import { isSealed, SAMPLE_CARD } from '@/lib/constants';
import { getOccasion, fill } from '@/lib/occasions';
import { relativeTime } from '@/lib/format';

/**
 * /r/[id] — "{to_name} replied 💌"
 *
 * The recipient's half of the conversation, on its own page.
 *
 * Why this exists: the reply row on a card used to share the CARD link back to
 * the sender, which meant the sender opened their own letter again and had to
 * work out what had changed. This page answers the only question they have —
 * "did they see it, and what did they say?" — in one screen, and it is a much
 * better thing to unfurl in a chat.
 *
 * It shows no part of the letter. A sealed card shows nothing at all beyond the
 * fact that it is sealed: the reply page must never become a way around the
 * time capsule.
 */
export const dynamic = 'force-dynamic';

/** Cards that exist without a database. `demo` is the sample everyone can see. */
async function loadCard(id) {
  if (id === 'demo') return SAMPLE_CARD;
  return getCardById(id);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const base = await metadataBase();
  const origin = await siteOrigin();

  const build = (title, description) => ({
    metadataBase: base,
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `${origin}/r/${id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Truce',
      url: `${origin}/r/${id}`,
      /* Explicit, absolute, and sized. Some scrapers will not take a relative
         og:image and several will not render one without width/height. */
      images: [
        {
          url: `${origin}/r/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'A reply on its way back — a card from Truce',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${origin}/r/${id}/opengraph-image`],
    },
  });

  const card = await loadCard(id);
  if (!card) return build('A reply 💌 — Truce', 'Someone answered their card.');

  const to = String(card.to_name || '').trim();

  if (isSealed(card.unlock_at)) {
    return build('Still sealed 🕰️ — Truce', 'This letter has not been opened yet.');
  }

  return build(
    to ? `${to} replied 💌` : 'They replied 💌',
    to ? `See what ${to} sent back.` : 'See what they sent back.',
  );
}

export default async function ReplyPage({ params }) {
  const { id } = await params;

  const card = await loadCard(id);
  if (!card) notFound();

  const theme = card.theme || 'blush';
  const occasion = getOccasion(card.occasion);
  const to = String(card.to_name || '').trim() || 'They';
  const from = String(card.from_name || '').trim();

  /* ---- Sealed: say that, and nothing else -------------------------------
     No names beyond the recipient's, no status, no reactions. A card that has
     not been opened cannot have a reply, and a sealed one must not leak that
     it was peeked at either. */
  if (isSealed(card.unlock_at)) {
    return (
      <div className="cardapp themed replypage" data-theme={theme}>
        <div className="replypage__inner">
          <span className="replypage__badge" aria-hidden="true">
            🕰️
          </span>
          <h1 className="replypage__title">Still sealed</h1>
          <p className="replypage__sub">
            This letter is a time capsule — it opens on the day it was set for. There is nothing to
            see here until then.
          </p>
          <Link className="btn btn--ghost btn--lg" href={`/c/${id}`}>
            Go to the card
          </Link>
          <MakeYourOwn />
        </div>
      </div>
    );
  }

  const reactions = id === 'demo' ? [] : await getReactionsByCardId(id);
  const opened = Boolean(card.opened_at);
  const done = Boolean(card.forgiven_at);
  const timeline = occasion.timeline;

  return (
    <div className="cardapp themed replypage" data-theme={theme}>
      {/* If the sender is the one who opened this link, point them home. */}
      <ReplyCreatorBanner cardId={id} />

      <div className="replypage__inner">
        <span className="replypage__badge" aria-hidden="true">
          {done ? timeline.doneEmoji : '💌'}
        </span>

        <h1 className="replypage__title">{to} replied</h1>
        <p className="replypage__sub">
          {from ? fill('Here is what came back for {from}.', { from }) : 'Here is what came back.'}
        </p>

        {/* ---- what happened, in order ---- */}
        <ol className="replysteps">
          <li className={opened ? 'is-done' : ''}>
            <span className="replysteps__tick" aria-hidden="true">
              {opened ? '✓' : '·'}
            </span>
            <span>
              <b>{opened ? 'Opened' : 'Not opened yet'}</b>
              {opened ? <small>{relativeTime(card.opened_at)}</small> : null}
            </span>
          </li>
          <li className={done ? 'is-done' : ''}>
            <span className="replysteps__tick" aria-hidden="true">
              {done ? '✓' : '·'}
            </span>
            <span>
              <b>{done ? timeline.doneTitle : timeline.pendingTitle}</b>
              {done ? <small>{relativeTime(card.forgiven_at)}</small> : null}
            </span>
          </li>
        </ol>

        {/* ---- and what they sent ---- */}
        {reactions.length ? (
          <section className="replygifts">
            <h2 className="replygifts__title">Sent back</h2>
            <ul className="reactions reactions--big">
              {reactions.map((r) => (
                <ReactionItem key={r.id} value={r.emoji} when={relativeTime(r.created_at)} />
              ))}
            </ul>
          </section>
        ) : (
          <p className="replypage__empty">
            Nothing sent back yet — {done ? 'but the answer was yes 🤍' : 'give it a moment.'}
          </p>
        )}

        <Link className="replypage__cardlink" href={`/c/${id}`}>
          See the original card →
        </Link>

        <MakeYourOwn />
      </div>
    </div>
  );
}

function MakeYourOwn() {
  return (
    <div className="replypage__cta">
      <span className="replypage__mark" aria-hidden="true">
        <BrandMark />
      </span>
      <Link className="btn btn--primary btn--lg" href="/">
        Make your own with Truce 🤍
      </Link>
    </div>
  );
}
