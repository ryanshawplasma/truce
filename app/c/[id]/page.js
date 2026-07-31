import { notFound } from 'next/navigation';
import CardExperience from '@/app/components/CardExperience';
import LockedCard from '@/app/components/LockedCard';
import LocalCard from './LocalCard';
import { getCardById, getReactionsByCardId } from '@/lib/cards';
import { metadataBase, siteOrigin } from '@/lib/site';
import { SAMPLE_CARD, isSealed } from '@/lib/constants';
import { getOccasion, fill } from '@/lib/occasions';

/**
 * /c/[id] — the card experience.
 *
 * Three kinds of id:
 *   demo   → the built-in sample, no database needed
 *   local  → the card is encoded in the #c= fragment, decoded in the browser
 *   others → a real short id, fetched from Supabase
 *
 * Rendered per request so a freshly created card is never served from a cache.
 */
export const dynamic = 'force-dynamic';

/**
 * Share previews.
 *
 * Kept deliberately tiny: a chat bubble has room for one line, so anything
 * longer just gets truncated into mush. The picture does the talking — see
 * ./opengraph-image.js, which Next attaches to og:image automatically.
 *
 * `twitter` has to be spelled out here: metadata is merged shallowly, so
 * without it this route would inherit the landing page's much longer copy.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;

  /* Private links should never show up in search results. */
  const robots = { index: false, follow: false };
  const base = await metadataBase();
  const origin = await siteOrigin();

  /* Spelled out rather than left to the file convention: several scrapers
     (WhatsApp and iMessage among them) will not render an og:image without an
     absolute URL and explicit dimensions, which is why the reply link used to
     unfurl better than the card link it was born from. Both are first-class
     now — keep this in step with app/r/[id]/page.js. */
  const image = {
    url: `${origin}/c/${id}/opengraph-image`,
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: 'A sealed envelope waiting to be opened — a card from Truce',
  };

  const build = (title, description) => ({
    metadataBase: base,
    title,
    description,
    robots,
    alternates: { canonical: `${origin}/c/${id}` },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Truce',
      url: `${origin}/c/${id}`,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  });

  if (id === 'local') {
    return build('Someone left you a letter 💌', 'Tap to open the envelope sealed for you 🤍');
  }

  const card = id === 'demo' ? SAMPLE_CARD : await getCardById(id);
  if (!card) {
    return build('Someone left you a letter 💌', 'Tap to open the envelope sealed for you 🤍');
  }

  const to = String(card.to_name || '').trim();
  const from = String(card.from_name || '').trim();

  /* A sealed letter says so, but still never leaks a single word of itself. */
  if (isSealed(card.unlock_at)) {
    return build(
      to ? `A sealed letter for ${to} 🕰️` : 'A sealed letter 🕰️',
      from ? `${from} sealed this one to open later.` : 'This one is sealed to open later.',
    );
  }

  /* "For Sam 💌" / "Happy birthday, Sam 🎂" / "A question for Sam 💍" — the
     wording per occasion lives in lib/occasions.js. */
  const meta = getOccasion(card.occasion).meta;
  return build(
    to ? fill(meta.title, { name: to }) : meta.titleFallback,
    from ? fill(meta.description, { name: to, from }) : meta.descriptionFallback,
  );
}

export default async function CardPage({ params }) {
  const { id } = await params;

  /* Hash mode: the whole card travels in the URL fragment, which the server
     never sees — so hand off to a small client component. */
  if (id === 'local') return <LocalCard />;

  const card = id === 'demo' ? SAMPLE_CARD : await getCardById(id);
  if (!card) notFound();

  /* ---- Time capsule -----------------------------------------------------
     Still sealed? Then the words do not leave the server. We build a brand new
     object holding only what the locked screen needs — the message, promise,
     memory and stickers are never serialised into the HTML, so "view source"
     shows nothing either. */
  if (isSealed(card.unlock_at)) {
    return (
      <LockedCard
        card={{
          to_name: card.to_name,
          from_name: card.from_name,
          theme: card.theme,
          unlock_at: card.unlock_at,
        }}
        /* The server's clock, sent along so the countdown can correct for a
           visitor whose device clock is wrong — see LockedCard. */
        serverNow={Date.now()}
      />
    );
  }

  /* Only real cards get open-tracking, forgiveness and saved reactions. */
  const live = id !== 'demo';

  /* Anything they have already sent back, so the "Sent back so far" strip is
     populated when they come back to the card a second time. */
  const reactions = live ? await getReactionsByCardId(id) : [];

  return <CardExperience card={card} live={live} initialReactions={reactions} />;
}
