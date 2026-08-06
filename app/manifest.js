import { DEFAULT_APPEARANCE, appearanceMeta } from '@/lib/appearance';

/**
 * The web app manifest — what a browser reads before it will offer "install".
 *
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * 01-metadata/manifest.md. Returning an object from app/manifest.js is the
 * supported convention; Next serves it at /manifest.webmanifest and links it
 * from every page for us, so nothing has to be added to app/layout.js.
 *
 * background_color is what the phone paints during the cold-start splash, so it
 * matches the default appearance's page colour — anything else and the app
 * flashes a stranger's colour before the first frame. theme_color is the
 * browser chrome, kept in step with the <meta name="theme-color"> that
 * lib/appearance.js rewrites for whichever skin the visitor chose.
 *
 * Icons are PNGs from app/icons/[size]/route.js because Android's installer is
 * still fussy about SVG. The maskable copy is the same art: Android crops icons
 * to whatever shape the launcher uses, and the heart sits well inside the safe
 * circle already.
 */

export default function manifest() {
  const skin = appearanceMeta(DEFAULT_APPEARANCE);

  return {
    id: '/',
    name: 'Truce — the sweetest way to say sorry',
    short_name: 'Truce',
    description:
      'Apology cards worth opening, and a private corner for the two of you to keep talking in.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: skin.themeColor,
    theme_color: skin.themeColor,
    categories: ['social', 'lifestyle'],
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Our corner', short_name: 'Corner', url: '/couple' },
      { name: 'Send a card', short_name: 'New card', url: '/#make' },
    ],
  };
}
