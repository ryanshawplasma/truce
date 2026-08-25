import 'server-only';
import { cookies } from 'next/headers';
import {
  COUPLE_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
  shouldRenewSession,
} from './couple';
import { findRoomById } from './couple';

/**
 * Reading and writing the "Our corner" session.
 *
 * WHY THIS IS NOT IN app/couple/actions.js
 * ----------------------------------------
 * It used to be. Every export of a `'use server'` file becomes a real HTTP
 * endpoint with a public, guessable-by-nobody-but-still-public action id, and
 * Next will happily let a browser call it. getSessionState() was written as an
 * internal helper for two server components, and nothing about it wants to be
 * reachable from a fetch: it is a plumbing function, and plumbing that answers
 * the front door is a bigger surface than it needs to be.
 *
 * Nothing here was exploitable — the worst a caller learned was the room name
 * their own cookie already named. But "not exploitable today" is a weaker
 * promise than "not reachable", and the second one is free.
 *
 * `import 'server-only'` means a client component that imports this by mistake
 * fails the build rather than shipping the cookie logic to a browser.
 */

/** The raw, verified token contents — { roomId, side } — or null. */
export async function currentSession() {
  const jar = await cookies();
  const raw = jar.get(COUPLE_COOKIE);
  if (!raw || !raw.value) return null;
  return readSessionToken(raw.value);
}

/**
 * The room this browser is signed into.
 *
 * Returns { session } when signed in, { session: null } when not, and
 * { session: null, failed: true } when the LOOKUP broke rather than the room
 * being absent.
 *
 * That third case is the one that caused a production mystery: a failed read
 * used to be indistinguishable from "no such room", so /couple/room bounced
 * straight back to /couple and a corner that had just been created looked like
 * it had never been made. A read failure must never be mistaken for a fact.
 */
export async function getSessionState() {
  const session = await currentSession();
  if (!session) return { session: null };

  const found = await findRoomById(session.roomId);
  if (found.failed) return { session: null, failed: true, category: found.category };
  if (!found.room) return { session: null }; // deleted room, or an old signing secret

  return { session: { room: found.room, side: session.side } };
}

/** Convenience wrapper for callers that only care whether we are signed in. */
export async function getSession() {
  const { session } = await getSessionState();
  return session;
}

/**
 * Write the session cookie.
 *
 * Only ever called from a server action — a server component may read cookies
 * but not set them, and Next throws if you try.
 */
export async function startSession(roomId, side) {
  const jar = await cookies();
  jar.set(COUPLE_COOKIE, createSessionToken(roomId, side), sessionCookieOptions());
}

/** Forget the session on this device. */
export async function endSession() {
  const jar = await cookies();
  jar.set(COUPLE_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
}

/**
 * Keep an active corner signed in.
 *
 * Called from the room's own polling, so simply having the corner open is what
 * keeps it open. Returns true only when a fresh cookie was actually written.
 *
 * Every failure here is silent on purpose. This is a convenience running
 * underneath somebody's conversation; if the cookie cannot be rewritten they
 * keep the session they already had, and the worst case is the old expiry.
 */
export async function touchSession() {
  try {
    const jar = await cookies();
    const raw = jar.get(COUPLE_COOKIE);
    if (!raw || !raw.value) return false;

    const session = readSessionToken(raw.value);
    if (!session) return false;
    if (!shouldRenewSession(session.expires)) return false;

    jar.set(COUPLE_COOKIE, createSessionToken(session.roomId, session.side), sessionCookieOptions());
    return true;
  } catch {
    return false;
  }
}
