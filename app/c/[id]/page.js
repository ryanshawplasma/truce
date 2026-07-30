import { notFound } from 'next/navigation';
import CardExperience from '@/app/components/CardExperience';
import LocalCard from './LocalCard';
import { getCardById } from '@/lib/cards';
import { metadataBase } from '@/lib/site';
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

  const build = (title, description) => ({
    metadataBase: base,
    title,
    description,
    robots,
    openGraph: { title, description, type: 'website', siteName: 'Truce' },
    twitter: { card: 'summary_large_image', title, description },
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

  return build(
    to ? `For ${to} 💌` : 'Someone left you a letter 💌',
    from ? `Tap to open the envelope ${from} sealed for you 🤍` : 'Tap to open the envelope sealed for you 🤍',
  );
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
