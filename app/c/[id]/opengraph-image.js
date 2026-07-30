import { ImageResponse } from 'next/og';
import { getCardById } from '@/lib/cards';

/**
 * The picture that shows up when a card link is pasted into a chat.
 *
 * It deliberately gives almost nothing away: a soft blush gradient, the Truce
 * mark, and "Someone has something to say to you". If the card exists we add
 * the recipient's first name — never anything from the message itself.
 *
 * No emoji glyphs are drawn here: the image renderer has no emoji font, so the
 * envelope is drawn as a shape instead.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Someone has something to say to you — a card from Truce';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }) {
  const { id } = await params;

  let toName = '';
  try {
    if (id !== 'local') {
      const card = await getCardById(id);
      if (card && card.to_name) toName = String(card.to_name).slice(0, 24);
    }
  } catch {
    /* An OG image must never fail loudly — fall back to the generic version. */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFF7F2 0%, #FFE4E9 48%, #FFD9C9 100%)',
          fontFamily: 'sans-serif',
          padding: '70px',
          position: 'relative',
        }}
      >
        {/* soft glow */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -120,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: 'rgba(255,255,255,0.55)',
            display: 'flex',
          }}
        />

        {/* the Truce mark: a heart with a bandage, drawn with plain boxes */}
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 132,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 18px 42px rgba(61,33,55,0.14)',
            marginBottom: 40,
            position: 'relative',
          }}
        >
          <svg width="74" height="74" viewBox="0 0 24 24">
            <path
              d="M12 20.3S3 15 3 9.3A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 9 1.9c0 5.7-9 11-9 11z"
              fill="#E85D75"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              width: 62,
              height: 22,
              borderRadius: 22,
              background: '#FFF7F2',
              transform: 'rotate(-38deg)',
              display: 'flex',
            }}
          />
        </div>

        <div
          style={{
            fontSize: 30,
            letterSpacing: 10,
            textTransform: 'uppercase',
            color: '#C94360',
            fontWeight: 700,
            display: 'flex',
            marginBottom: 26,
          }}
        >
          Truce
        </div>

        <div
          style={{
            fontSize: toName ? 66 : 60,
            lineHeight: 1.15,
            color: '#3D2137',
            fontWeight: 700,
            textAlign: 'center',
            display: 'flex',
            maxWidth: 940,
          }}
        >
          {toName ? `${toName}, someone has something to say to you` : 'Someone has something to say to you'}
        </div>

        <div
          style={{
            marginTop: 34,
            fontSize: 30,
            color: '#6B4E63',
            display: 'flex',
            textAlign: 'center',
          }}
        >
          Tap to open your card
        </div>
      </div>
    ),
    { ...size },
  );
}
