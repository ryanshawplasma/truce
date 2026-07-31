/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The Open Graph image renderer reads two font files from assets/ at request
     time (satori needs real TTF data — it cannot read the WOFF2 files that
     next/font serves to browsers). Nothing `import`s them, so tell the bundler
     to pack them with the card route's serverless function — otherwise the
     share preview 500s on Vercel while working perfectly in local dev. */
  outputFileTracingIncludes: {
    '/c/[id]': ['./assets/**'],
    '/c/[id]/opengraph-image': ['./assets/**'],
    '/r/[id]': ['./assets/**'],
    '/r/[id]/opengraph-image': ['./assets/**'],
  },

  /**
   * Baseline security headers on every response.
   *
   *  - X-Frame-Options DENY: Truce is full of one-tap buttons that change
   *    something real — "Yes, I forgive you", "Delete this card", the reaction
   *    strip. Framing the site invisibly over a game of "click the balloon" is
   *    the classic clickjack, and nothing here ever needs to be embedded.
   *  - X-Content-Type-Options nosniff: stop a browser second-guessing a
   *    Content-Type and executing something it should have downloaded.
   *  - Referrer-Policy: card links are private. Sending a full /c/<id> or, far
   *    worse, /s/<edit_token> URL to a third-party origin in a Referer header
   *    would hand out the secret part. Same-origin keeps the path, cross-origin
   *    gets the bare origin only.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          /* The modern replacement for X-Frame-Options. Both are sent: the old
             header for anything that only understands that, this for the rest.
             Only frame-ancestors is set — a full CSP would need auditing against
             every inline style in globals.css and is a separate job. */
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
