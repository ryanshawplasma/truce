import { ImageResponse } from 'next/og';

/**
 * The icon iOS uses when someone adds Truce to their home screen.
 *
 * iOS ignores the web manifest's icons entirely and looks for apple-icon, so
 * without this file a home-screen Truce would be a blurry screenshot of the
 * page. See node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/01-metadata/app-icons.md.
 *
 * Full-bleed on purpose: iOS rounds the corners itself and does not honour
 * transparency, so anything that is not painted comes out black.
 */

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const BLUSH = '#FFE4E9';
const ROSE = '#E85D75';
const CREAM = '#FFF7F2';

export default function AppleIcon() {
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
        <svg width={112} height={112} viewBox="0 0 24 24">
          <path
            d="M12 20.6S2.8 15.1 2.8 9.2A4.7 4.7 0 0 1 12 7.2a4.7 4.7 0 0 1 9.2 2c0 5.9-9.2 11.4-9.2 11.4z"
            fill={ROSE}
          />
          <rect x="6.4" y="10.2" width="11.2" height="4.1" rx="2.05" transform="rotate(-38 12 12.25)" fill={CREAM} />
        </svg>
      </div>
    ),
    size,
  );
}
