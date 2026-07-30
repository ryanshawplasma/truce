import { notFound } from 'next/navigation';
import CardExperience from '@/app/components/CardExperience';
import LocalCard from './LocalCard';
import { getCardById } from '@/lib/cards';
import { SAMPLE_CARD } from '@/lib/constants';

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

export async function generateMetadata({ params }) {
  const { id } = await params;

  /* Private links should never show up in search results. */
  const robots = { index: false, follow: false };

  if (id === 'local') {
    return {
      title: 'A card is waiting for you 💌 — Truce',
      description: 'Someone has something to say to you.',
      robots,
    };
  }

  const card = id === 'demo' ? SAMPLE_CARD : await getCardById(id);
  if (!card) {
    return { title: 'Card not found — Truce', description: 'This card link is not working.', robots };
  }

  return {
    title: `For ${card.to_name} 💌 — Truce`,
    description: `${card.from_name} has something to say to you.`,
    robots,
    openGraph: {
      title: `For ${card.to_name} 💌 — Truce`,
      description: `${card.from_name} has something to say to you.`,
      type: 'website',
    },
  };
}

export default async function CardPage({ params }) {
  const { id } = await params;

  /* Hash mode: the whole card travels in the URL fragment, which the server
     never sees — so hand off to a small client component. */
  if (id === 'local') return <LocalCard />;

  const card = id === 'demo' ? SAMPLE_CARD : await getCardById(id);
  if (!card) notFound();

  /* Only real cards get open-tracking, forgiveness and saved reactions. */
  const live = id !== 'demo';

  return <CardExperience card={card} live={live} />;
}
