import { ImageResponse } from 'next/og';

/**
 * The PNG app icons the web manifest points at.
 *
 * app/icon.svg already covers the browser tab, but Android's install flow still
 * wants real PNGs at known sizes, so these are generated from the same artwork:
 * the bandaged heart, on blush.
 *
 * The size is a route parameter rather than two near-identical files, but it is
 * NOT free-form — only the sizes the manifest actually asks for are allowed.
 * Rendering an arbitrary number would let a stranger ask for a 20000px PNG and
 * bill us the memory for it, which is the kind of thing lib/throttle.js exists
 * to stop elsewhere. Anything else gets a 404.
 *
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * route.md — `params` is a promise in this version of Next and has to be
 * awaited.
 */

export const runtime = 'nodejs';

/* The two the manifest references. Prerendered at build time by
   generateStaticParams below, so a cold install never waits on a render. */
const ALLOWED = new Set(['192', '512']);

/* Palette — kept in sync with app/globals.css and app/icon.svg. */
const BLUSH = '#FFE4E9';
const ROSE = '#E85D75';
const CREAM = '#FFF7F2';

export function generateStaticParams() {
  return [...ALLOWED].map((size) => ({ size }));
}

export async function GET(request, { params }) {
  const { size } = await params;

  if (!ALLOWED.has(String(size))) {
    return new Response('Not found', { status: 404 });
  }

  const px = Number(size);

  /* The heart occupies the middle ~58% so that a launcher cropping this to a
     circle (purpose: maskable) never clips it. */
  const art = Math.round(px * 0.58);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BLUSH,
        }}
      >
        <svg width={art} height={art} viewBox="0 0 24 24">
          <path
            d="M12 20.6S2.8 15.1 2.8 9.2A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 9.2 2c0 5.9-9.2 11.4-9.2 11.4z"
            fill={ROSE}
          />
          <rect x="6.4" y="10.2" width="11.2" height="4.1" rx="2.05" transform="rotate(-38 12 12.25)" fill={CREAM} />
        </svg>
      </div>
    ),
    {
      width: px,
      height: px,
      headers: {
        /* Immutable art at a fixed URL — let the phone keep it. */
        'cache-control': 'public, max-age=31536000, immutable',
      },
    },
  );
}
