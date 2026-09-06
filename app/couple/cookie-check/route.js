import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionCookieOptions } from '@/lib/couple';

/**
 * /couple/cookie-check — does a cookie survive a redirect on this deployment?
 *
 * WHY THIS EXISTS
 * ---------------
 * A corner is created successfully and then will not open: the session cookie
 * is written and is not there a moment later. Everything else has been ruled
 * out from the outside — the database answers, the room row is written, the
 * redirect sits outside its try block, both pages are force-dynamic, there is
 * no middleware — and the one fact nobody has is the simplest one: whether a
 * Set-Cookie from this deployment reaches the browser and comes back.
 *
 * That fact is untestable through the corner itself, because getting there
 * requires a name and a password. This is the same journey with nothing
 * private in it: set a cookie, redirect, read it back.
 *
 * WHAT IT DELIBERATELY IS NOT
 * ---------------------------
 * It writes ONE throwaway cookie called `truce_cookie_check`, holding the word
 * "ok" and nothing else. It never touches the real session cookie, cannot sign
 * anybody in or out, reveals nothing about any room, and clears up after
 * itself. It uses the SAME options the session cookie uses, because options are
 * exactly what might be at fault — httpOnly, sameSite and secure all decide
 * whether a cookie survives, and testing with different ones would prove
 * nothing about the real thing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAME = 'truce_cookie_check';

export async function GET(request) {
  const url = new URL(request.url);
  const step = url.searchParams.get('step');
  const jar = await cookies();

  /* Step two: did it come back? */
  if (step === '2') {
    const got = jar.get(NAME);
    const ok = Boolean(got && got.value === 'ok');

    /* Tidy up regardless of the answer — this leaves nothing behind. */
    const body = ok
      ? 'COOKIES WORK — the cookie was set, survived a redirect, and came back.\n' +
        'So Set-Cookie is fine on this deployment, and the corner failing to open\n' +
        'is NOT the browser refusing cookies. It is the signature check: the key\n' +
        'that signs sessions changed. Check /dev -> Corner sign-in.\n'
      : 'COOKIE LOST — the cookie was set and did not come back after a redirect.\n' +
        'That is the browser or the platform dropping it, not a signing problem.\n' +
        'Private window, a blocker, or a proxy stripping Set-Cookie.\n';

    const res = new NextResponse(body, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
    res.cookies.set(NAME, '', { ...sessionCookieOptions(), maxAge: 0 });
    return res;
  }

  /* Step one: set it, then bounce to step two — the same shape as signing in. */
  const res = NextResponse.redirect(new URL('/couple/cookie-check?step=2', url), { status: 303 });
  res.cookies.set(NAME, 'ok', sessionCookieOptions());
  return res;
}
