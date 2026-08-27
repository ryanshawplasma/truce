import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCardById } from '@/lib/cards';
import { isSealed, sampleCard } from '@/lib/constants';
import { getOccasion } from '@/lib/occasions';
import { cardLook } from '@/lib/palette';
import {
  KEEPSAKE_HEIGHT,
  KEEPSAKE_MESSAGE_MAX,
  KEEPSAKE_WIDTH,
  bodySize,
  clampText,
  keepsakeDate,
} from '@/lib/keepsake';

/**
 * /c/[id]/keepsake — the card as a picture you can keep.
 *
 * WHY THIS EXISTS
 * ---------------
 * Everything else about a card is a link. Links rot: the phone gets replaced,
 * the chat gets cleared, the tab gets closed by somebody tidying up. For a
 * thing whose whole purpose is to be kept, "it lives at a URL" is a promise
 * nobody should have to rely on. This renders the words themselves into a PNG
 * that goes into a camera roll and stops being our problem.
 *
 * HOW IT DIFFERS FROM opengraph-image.js
 * --------------------------------------
 * That one is the share preview, and is deliberately empty of secrets: it gets
 * scraped by WhatsApp, iMessage, Slack and anyone else who sees the link, so
 * not one word of the message appears in it.
 *
 * This one is the opposite — it is nothing BUT the message. So it must never
 * be advertised as og:image, and it is exactly as protected as the card it
 * belongs to: same unguessable id, same noindex, same seal.
 *
 * WHAT IT REFUSES
 * ---------------
 *   sealed     a time-capsule that has not opened yet renders the closed
 *              envelope, not the letter. The seal is the entire product.
 *   local      a "local" card lives in the URL fragment, which by definition
 *              never reaches a server, so there is nothing here to draw. The
 *              button that leads here is hidden for those.
 *   missing    404 rather than a blank card, so a wrong link fails honestly.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/** The bandaged heart. `viewBox` is 24×24, same shape the OG image draws. */
function Mascot({ width, heart, tape }) {
  return (
    <svg width={width} height={width} viewBox="0 0 24 24">
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

export async function GET(request, { params }) {
  const { id } = await params;

  /* A local card is only ever in the fragment, which never leaves the browser.
     Nothing to render, and pretending otherwise would produce a blank card. */
  if (id === 'local') {
    return new Response('This card only exists in your own link.', { status: 404 });
  }

  const card = id === 'demo' ? sampleCard() : await getCardById(id);
  if (!card) return new Response('No such card.', { status: 404 });

  /* A time capsule that has not opened yet keeps its secret here too. Without
     this, the seal would be a front-door lock on a house with an open window. */
  if (isSealed(card.unlock_at)) {
    return new Response('This one is still sealed.', { status: 403 });
  }

  const look = cardLook(card.theme);
  const occasion = getOccasion(card.occasion);

  const [display, body] = await Promise.all([
    readFile(join(process.cwd(), 'assets', 'Fraunces-Display.ttf')),
    readFile(join(process.cwd(), 'assets', 'Nunito-SemiBold.ttf')),
  ]);

  const message = clampText(card.message, KEEPSAKE_MESSAGE_MAX);
  const to = clampText(card.to_name, 40);
  const from = clampText(card.from_name, 40);
  const when = keepsakeDate(card.created_at);

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
          padding: 64,
          background: look.bg,
          fontFamily: 'Nunito',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 44,
            background: look.panel,
            padding: '64px 62px',
            boxShadow: '0 26px 70px rgba(0,0,0,0.14)',
          }}
        >
          {/* --- who it is for --- */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Mascot width={54} heart={look.accent} tape={look.panel} />
            <span
              style={{
                fontFamily: 'Fraunces',
                fontSize: 40,
                color: look.ink,
                lineHeight: 1.1,
              }}
            >
              {to ? `For ${to}` : occasion.meta.ogHeadlineFallback}
            </span>
          </div>

          <div style={{ display: 'flex', width: 72, height: 4, borderRadius: 4, background: look.accent, marginTop: 26 }} />

          {/* --- the letter itself --- */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              /* Top-aligned, following the rule under the heading. Centring
                 was tried and looked worse: the words float with a gap above
                 AND below and stop reading as a letter. Space left at the
                 bottom of a short note reads as paper, which is correct. */
              alignItems: 'flex-start',
              marginTop: 34,
              fontSize: bodySize(message),
              lineHeight: 1.5,
              color: look.ink,
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </div>

          {/* --- who it is from --- */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 30,
            }}
          >
            <span style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 38, color: look.accent }}>
              {from ? `— ${from}` : ''}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 22, color: look.soft }}>
              <span style={{ display: 'flex' }}>{when}</span>
              <span style={{ display: 'flex', marginTop: 6, letterSpacing: 1 }}>made with Truce</span>
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: KEEPSAKE_WIDTH,
      height: KEEPSAKE_HEIGHT,
      fonts: [
        { name: 'Fraunces', data: display, weight: 600, style: 'normal' },
        { name: 'Nunito', data: body, weight: 600, style: 'normal' },
      ],
      headers: {
        /* Private, like the card. A shared cache holding somebody's apology is
           precisely the thing an unguessable id is supposed to prevent. */
        'cache-control': 'private, no-store',
        'content-disposition': `inline; filename="truce-card-${id}.png"`,
      },
    },
  );
}
