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

  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
