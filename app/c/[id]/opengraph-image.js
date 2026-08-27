import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCardById } from '@/lib/cards';
import { getOccasion, fill, DEFAULT_OCCASION } from '@/lib/occasions';
import { cardLook, isNightLook, DEFAULT_LOOK } from '@/lib/palette';
import { sampleCard } from '@/lib/constants';

/**
 * The picture that unfurls when a card link is pasted into a chat.
 *
 * It is deliberately charming and deliberately empty of secrets: a blush
 * gradient, a sealed envelope with a wax heart, the Truce mascot peeking in
 * from the corner, and the recipient's first name if we can find it. Nothing
 * from the message itself ever appears here.
 *
 * Everything is drawn with shapes — the renderer has no emoji font, so an
 * emoji glyph would come out as an empty box.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A sealed envelope waiting to be opened — a card from Truce';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* Palette (kept in sync with the Truce design system in app/globals.css). */
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

/**
 * What is pressed into the wax.
 *
 * The copy already changed per occasion; the picture never did, so a birthday
 * and a proposal both unfurled as the same sealed heart. The seal is the one
 * thing somebody actually looks at in a chat preview, and it is the cheapest
 * place to say which kind of thing this is before it is opened.
 *
 * Drawn rather than typed: Satori has no emoji font, so a 🎂 would come out as
 * an empty box in the one image a stranger sees.
 */
function sealEmblem(occasion, color) {
  if (occasion === 'birthday') {
    /* a candle with a flame */
    return (
      <g>
        <rect x="194" y="204" width="12" height="26" rx="5" fill={color} />
        <path d="M200 186c6 6 8 10 8 13.5a8 8 0 0 1-16 0c0-3.5 2-7.5 8-13.5z" fill={color} />
      </g>
    );
  }
  if (occasion === 'proposal') {
    /* a ring with a stone */
    return (
      <g>
        <circle cx="200" cy="220" r="13" fill="none" stroke={color} strokeWidth="6" />
        <path d="M200 190l9 11h-18z" fill={color} />
      </g>
    );
  }
  /* sorry, and anything new, keeps the heart */
  return (
    <path
      d="M200 232.5S184 223 184 213.2a7.9 7.9 0 0 1 16-3.4 7.9 7.9 0 0 1 16 3.4c0 9.8-16 19.3-16 19.3z"
      fill={color}
    />
  );
}

/** A plain little heart, for the confetti scattered around the canvas. */
function TinyHeart({ size: s, color, opacity, rotate = 0, top, left }) {
  return (
    <div
      style={{ position: 'absolute', top, left, display: 'flex', transform: `rotate(${rotate}deg)` }}
    >
      <svg width={s} height={s} viewBox="0 0 24 24" style={{ opacity }}>
        <path
          d="M12 20.3S3 15 3 9.3A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 9 1.9c0 5.7-9 11-9 11z"
          fill={color}
        />
      </svg>
    </div>
  );
}

/* Fixed positions — an OG image must render identically every time. */
const CONFETTI = [
  { size: 30, color: ROSE, opacity: 0.26, rotate: -18, top: 70, left: 92 },
  { size: 20, color: '#F2B880', opacity: 0.55, rotate: 14, top: 150, left: 452 },
  { size: 16, color: ROSE, opacity: 0.3, rotate: 22, top: 486, left: 78 },
  { size: 26, color: '#FFFFFF', opacity: 0.75, rotate: -10, top: 92, left: 316 },
  { size: 18, color: ROSE, opacity: 0.2, rotate: 8, top: 58, left: 700 },
  { size: 24, color: '#F2B880', opacity: 0.38, rotate: -24, top: 548, left: 604 },
  { size: 14, color: ROSE, opacity: 0.28, rotate: 16, top: 120, left: 1122 },
  { size: 22, color: '#FFFFFF', opacity: 0.8, rotate: -14, top: 268, left: 1140 },
  { size: 17, color: '#F2B880', opacity: 0.42, rotate: 30, top: 470, left: 1092 },
];

export default async function OpengraphImage({ params }) {
  const { id } = await params;

  let toName = '';
  let occasionId = DEFAULT_OCCASION;
  let themeId = DEFAULT_LOOK;
  try {
    if (id !== 'local') {
      /* The demo card is resolved the same way the page resolves it, so the
         preview and the card it previews agree about theme and occasion. */
      const card = id === 'demo' ? sampleCard() : await getCardById(id);
      if (card && card.to_name) toName = String(card.to_name).trim().slice(0, 22);
      if (card && card.occasion) occasionId = card.occasion;
      if (card && card.theme) themeId = card.theme;
    }
  } catch {
    /* An OG image must never fail loudly — fall back to the generic version. */
  }

  /* Satori needs real font data (TTF/OTF/WOFF — never WOFF2). These two are
     built by tools/build-og-fonts.py; next.config.mjs makes sure they travel
     with the serverless function on Vercel. */
  const [display, body] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'Fraunces-Display.ttf')),
    readFile(join(process.cwd(), 'assets', 'Nunito-SemiBold.ttf')),
  ]);

  /* One line, occasion-appropriate, and never a word of the letter itself. */
  /* The unfurl now wears the card's own theme. A sky card that previewed as a
     pink envelope was a small lie about what was inside it. */
  const look = cardLook(themeId);
  const night = isNightLook(themeId);

  const meta = getOccasion(occasionId).meta;
  const headline = toName ? fill(meta.ogHeadline, { name: toName }) : meta.ogHeadlineFallback;
  /* Two comfortable lines is the goal; step down as the name gets longer. */
  const headlineSize = headline.length > 50 ? 46 : headline.length > 30 ? 54 : 60;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: look.bg,
          fontFamily: 'Nunito',
          overflow: 'hidden',
        }}
      >
        {/* --- soft light --- */}
        <div
          style={{
            position: 'absolute',
            top: -230,
            right: -140,
            width: 660,
            height: 660,
            borderRadius: 660,
            /* Half-opaque white is a soft glow on a pale sky and a pair of
               grey blobs on a dark one. */
            background: night ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.5)',
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
            background: night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.34)',
            display: 'flex',
          }}
        />

        {CONFETTI.map((h, i) => (
          <TinyHeart key={i} {...h} />
        ))}

        {/* --- the mascot, peeking in from the corner --- */}
        <div
          style={{
            position: 'absolute',
            right: -70,
            bottom: -92,
            display: 'flex',
            transform: 'rotate(16deg)',
          }}
        >
          <Mascot width={320} heart="#F79FB0" tape="#FFF7F2" opacity={0.5} />
        </div>

        {/* --- the envelope --- */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 58,
            top: 132,
            transform: 'rotate(-4deg)',
          }}
        >
          <svg width="440" height="367" viewBox="0 0 400 334">
            {/* it floats a little */}
            <ellipse cx="200" cy="318" rx="146" ry="15" fill="#3D2137" opacity="0.1" />

            {/* the letter, peeking out of the top */}
            <g transform="rotate(-4 200 76)">
              <rect x="72" y="4" width="256" height="164" rx="14" fill={look.paper} />
              <rect
                x="72"
                y="4"
                width="256"
                height="164"
                rx="14"
                fill="none"
                stroke={look.fold}
                strokeWidth="2"
              />
              <rect x="100" y="42" width="200" height="10" rx="5" fill={look.fold} opacity="0.55" />
              <rect x="100" y="68" width="168" height="10" rx="5" fill={look.fold} opacity="0.55" />
              <rect x="100" y="94" width="188" height="10" rx="5" fill={look.fold} opacity="0.55" />
              <path
                d="M118 141S104 133 104 124.2a4.4 4.4 0 0 1 14-2.6 4.4 4.4 0 0 1 14 2.6c0 8.8-14 16.8-14 16.8z"
                fill={ROSE}
                opacity="0.85"
              />
              <rect x="146" y="126" width="112" height="9" rx="4.5" fill={look.fold} opacity="0.55" />
            </g>

            {/* envelope body */}
            <rect x="8" y="86" width="384" height="212" rx="24" fill={look.envelope} />
            {/* front pocket, with the classic V */}
            <path
              d="M8 106 L200 226 L392 106 L392 274 A24 24 0 0 1 368 298 L32 298 A24 24 0 0 1 8 274 Z"
              fill={look.fold}
            />
            {/* a soft highlight along the left fold */}
            <path d="M8 106 L200 226 L186 236 L8 124 Z" fill="#FFFFFF" opacity="0.22" />

            {/* wax seal */}
            <circle cx="200" cy="216" r="40" fill={look.accentDeep} />
            <circle cx="200" cy="212" r="40" fill={look.accent} />
            <circle cx="187" cy="199" r="12" fill="#FFFFFF" opacity="0.26" />
            <g opacity="0.92">{sealEmblem(occasionId, night ? look.panel : '#FFFFFF')}</g>
          </svg>
        </div>

        {/* --- the words --- */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            position: 'absolute',
            left: 534,
            top: 150,
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
            <div
              style={{
                display: 'flex',
                fontSize: 25,
                letterSpacing: 9,
                color: ROSE_DEEP,
                fontWeight: 700,
              }}
            >
              TRUCE
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontFamily: 'Fraunces',
              fontSize: headlineSize,
              lineHeight: 1.16,
              /* The card's own ink. Hardcoded plum on a moonlight card was
                 dark text on a dark sky — the headline was very nearly
                 unreadable, and it is the only sentence in the preview. */
              color: look.ink,
              fontWeight: 700,
            }}
          >
            {headline}
          </div>

          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontSize: 28,
              color: look.soft,
              fontWeight: 700,
            }}
          >
            Tap to open the envelope
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
