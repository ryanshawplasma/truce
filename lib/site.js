import 'server-only';
import { headers } from 'next/headers';

/**
 * The public origin of this deployment, e.g. "https://truce.vercel.app".
 * Uses NEXT_PUBLIC_SITE_URL when set (recommended on Vercel — it is stable
 * across preview deploys), otherwise falls back to the incoming request host.
 */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  /* Vercel sets this on every deployment, including previews. */
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * The same origin as a URL object, for `metadata.metadataBase`.
 * Social scrapers only follow absolute URLs, so og:image has to resolve
 * against a real host — never against localhost on a live deployment.
 */
export async function metadataBase() {
  try {
    return new URL(await siteOrigin());
  } catch {
    return new URL('http://localhost:3000');
  }
}
