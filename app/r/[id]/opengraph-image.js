import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCardById } from '@/lib/cards';
import { isSealed } from '@/lib/constants';

/**
 * The picture for a reply link.
 *
 * Same family as the card's share image (app/c/[id]/opengraph-image.js) so the
 * two read as one product, but flipped in meaning: the envelope is open and a
 * heart is coming OUT of it, on its way back to the sender.
 *
 * Everything is drawn with shapes — the renderer has no emoji font, so an emoji
 * glyph would come out as an empty box. And nothing from the letter, or from
 * the reply, ever appears here.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A reply on its way back — a card from Truce';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ROSE = '#E85D75';
const ROSE_DEEP = '#C94360';
const PLUM = '#3D2137';
const PLUM_SOFT = '#8A6A80';
const CREAM = '#FFF7F2';

/** The bandaged heart, at any size. `viewBox` is 24×24. */
function Mascot({ width, heart = ROSE, tape = CREAM, opacity = 1 }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24" style={{ opacity }}>
      <path
        d="M12 20.6S2.8 15.1 2.8 9.2A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 9.2 2c0 5.9-9.2 11.4-9.2 11.4z"
        fill={heart}
      />
      <g transform="rotate(-38 12 11.3)">
        <rect x="4.3" y="8.7" width="15.4" height="5.2" rx="2.6" fill={tape} />
        <circle cx="8.1" cy="10.2" r="0.55" fill={heart} opacity="0.5" />
        <circle cx="8.1" cy="12.4" r="0.55" fill={heart} opacity="0.5" />
        <circle cx="15.9" cy="10.2" r="0.55" fill={heart} opacity="0.5" />
        <circle cx="15.9" cy="12.4" r="0.55" fill={heart} opacity="0.5" />
      </g>
    </svg>
  );
}

function TinyHeart({ size: s, color, opacity, rotate = 0, top, left }) {
  return (
    <div style={{ position: 'absolute', top, left, display: 'flex', transform: `rotate(${rotate}deg)` }}>
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ opacity }}>
        <path d="M12 20.3S3 15 3 9.3A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 9 1.9c0 5.7-9 11-9 11z" fill={color} />
      </svg>
    </div>
  );
}

/* Fixed positions — an OG image must render identically every time. The hearts
   here trail upward and to the right: the reply leaving the envelope. */
const CONFETTI = [
  { size: 26, color: ROSE, opacity: 0.3, rotate: -14, top: 96, left: 300 },
  { size: 18, color: '#F2B880', opacity: 0.5, rotate: 12, top: 62, left: 392 },
  { size: 14, color: ROSE, opacity: 0.26, rotate: 20, top: 150, left: 236 },
  { size: 22, color: '#FFFFFF', opacity: 0.72, rotate: -8, top: 40, left: 176 },
  { size: 16, color: ROSE, opacity: 0.22, rotate: 10, top: 520, left: 132 },
  { size: 24, color: '#F2B880', opacity: 0.35, rotate: -22, top: 556, left: 640 },
  { size: 15, color: ROSE, opacity: 0.26, rotate: 16, top: 116, left: 1128 },
  { size: 21, color: '#FFFFFF', opacity: 0.78, rotate: -12, top: 288, left: 1146 },
];

export default async function ReplyOpengraphImage({ params }) {
  const { id } = await params;

  let toName = '';
  let sealed = false;
  try {
    if (id !== 'local' && id !== 'demo') {
      const card = await getCardById(id);
      if (card) {
        sealed = isSealed(card.unlock_at);
        if (!sealed && card.to_name) toName = String(card.to_name).trim().slice(0, 22);
      }
    }
  } catch {
    /* An OG image must never fail loudly — fall back to the generic version. */
  }

  const [display, body] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'Fraunces-Display.ttf')),
    readFile(join(process.cwd(), 'assets', 'Nunito-SemiBold.ttf')),
  ]);

  const headline = sealed
    ? 'Still sealed — not opened yet'
    : toName
      ? `${toName} replied`
      : 'They replied';
  const sub = sealed ? 'A time capsule, waiting for its day' : 'See what they sent back';
  const headlineSize = headline.length > 26 ? 54 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #FFF4F6 0%, #FFE3E9 44%, #FFD9C4 100%)',
          fontFamily: 'Nunito',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -230,
            right: -140,
            width: 660,
            height: 660,
            borderRadius: 660,
            background: 'rgba(255,255,255,0.5)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -300,
            left: -170,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: 'rgba(255,255,255,0.34)',
            display: 'flex',
          }}
        />

        {CONFETTI.map((h, i) => (
          <TinyHeart key={i} {...h} />
        ))}

        <div
          style={{ position: 'absolute', right: -70, bottom: -92, display: 'flex', transform: 'rotate(16deg)' }}
        >
          <Mascot width={320} heart="#F79FB0" tape="#FFF7F2" opacity={0.5} />
        </div>

        {/* --- the open envelope, with a heart lifting out of it --- */}
        <div style={{ display: 'flex', position: 'absolute', left: 62, top: 148, transform: 'rotate(-3deg)' }}>
          <svg width="430" height="358" viewBox="0 0 400 334">
            <ellipse cx="200" cy="320" rx="142" ry="14" fill="#3D2137" opacity="0.1" />

            {/* the flap, thrown open behind everything */}
            <path d="M8 118 L200 8 L392 118 L392 150 L200 44 L8 150 Z" fill="#FBD9DF" />

            {/* the heart on its way out */}
            <g transform="translate(0,-6)">
              <path
                d="M200 150S150 116 150 82.6A26 26 0 0 1 200 71a26 26 0 0 1 50 11.6c0 33.4-50 67.4-50 67.4z"
                fill={ROSE}
              />
              <path
                d="M182 96a17 17 0 0 1 12-14"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* envelope body + front pocket */}
            <rect x="8" y="118" width="384" height="180" rx="24" fill="#F7C6D1" />
            <path
              d="M8 138 L200 244 L392 138 L392 274 A24 24 0 0 1 368 298 L32 298 A24 24 0 0 1 8 274 Z"
              fill="#EFAEBF"
            />
            <path d="M8 138 L200 244 L186 254 L8 156 Z" fill="#FFFFFF" opacity="0.22" />
          </svg>
        </div>

        {/* --- the words --- */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            left: 534,
            top: 160,
            width: 596,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 62,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                boxShadow: '0 8px 20px rgba(61,33,55,0.12)',
              }}
            >
              <Mascot width={38} />
            </div>
            <div style={{ display: 'flex', fontSize: 25, letterSpacing: 9, color: ROSE_DEEP, fontWeight: 700 }}>
              TRUCE
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontFamily: 'Fraunces',
              fontSize: headlineSize,
              lineHeight: 1.16,
              color: PLUM,
              fontWeight: 700,
            }}
          >
            {headline}
          </div>

          <div style={{ display: 'flex', marginTop: 26, fontSize: 28, color: PLUM_SOFT, fontWeight: 700 }}>
            {sub}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: display, style: 'normal', weight: 700 },
        { name: 'Nunito', data: body, style: 'normal', weight: 700 },
      ],
    },
  );
}
