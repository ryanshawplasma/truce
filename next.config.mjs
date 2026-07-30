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
  },
};

export default nextConfig;
