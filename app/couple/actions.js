'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { backoffMs, clientKey, sleep, strike, take } from '@/lib/throttle';
import { tidyAndTruncate } from '@/lib/truncate';
import {
  MEDIA_CAPTION_MAX,
  MEDIA_SETUP_MESSAGE,
  MEDIA_THROTTLE_MESSAGE,
  MEDIA_UPLOADS_PER_HOUR,
  isPlausibleMediaPath,
} from '@/lib/media';
import {
  COUPLE_COOKIE,
  MAX_MESSAGE_LENGTH,
  attachMediaUrls,
  createMediaUploadTicket,
  createSessionToken,
  findRoomById,
  findRoomByName,
  insertMessage,
  insertRoom,
  listMessages,
  listRoomMedia,
  normaliseAnniversary,
  normalisePassword,
  normaliseRoomName,
  normaliseSide,
  readSessionToken,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/couple';

/**
 * Server actions for "Our corner".
 *
 * Every one of these re-validates its input from scratch and re-reads the
 * session from the httpOnly cookie. Nothing the browser claims about which room
 * it is in, or which side of it, is ever believed.
 */

const NO_DB = 'Our corner is not switched on for this site yet — it needs somewhere to keep your messages.';

/* ------------------------------------------------------------------ limits */

/**
 * Why these actions are throttled at all.
 *
 * createRoom and joinRoom are the only unauthenticated things in Truce that do
 * real work: verifying a password runs scrypt, which deliberately costs about
 * 46ms of CPU and 16MB of memory *per attempt*. Without a limit, one laptop can
 * both guess passwords quickly and hold a serverless instance down by asking it
 * to hash. So:
 *
 *  - every attempt is counted per IP, and again per IP+room name
 *  - the count is checked BEFORE any hashing happens, so a rejected attempt is
 *    nearly free for us and not for them
 *  - every failed join takes at least MIN_FAIL_MS, so "no such room" and "wrong
 *    password" cannot be told apart by a stopwatch
 *  - repeat failures earn a rising delay (see backoffMs)
 *
 * The counters are per serverless instance and are forgotten on a cold start —
 * see the long note in lib/throttle.js. This is a speed bump, honestly labelled.
 */
const JOIN_PER_ROOM = 5;      // attempts / minute against one room name
const JOIN_PER_IP = 20;       // attempts / minute from one address, any room
const CREATE_PER_IP = 12;     // new rooms / minute from one address
const WINDOW_MS = 60 * 1000;

/* Every failed join costs at least this long, whatever went wrong. */
const MIN_FAIL_MS = 250;

const TOO_MANY = 'That was a lot of tries at once — wait about a minute and try again 🤍';

/** Hold the answer until it has taken a uniform amount of time, plus backoff. */
async function uniformFail(startedAt, strikes) {
  const spent = Date.now() - startedAt;
  await sleep(Math.max(0, MIN_FAIL_MS - spent) + backoffMs(strikes));
}

/* ------------------------------------------------------------------ session */

async function currentSession() {
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

async function startSession(roomId, side) {
  const jar = await cookies();
  jar.set(COUPLE_COOKIE, createSessionToken(roomId, side), sessionCookieOptions());
}

/**
 * Sign in and go straight to the room.
 *
 * The redirect is done HERE rather than with router.push() on the client for a
 * reason: the Set-Cookie and the navigation then travel in one response, so the
 * room page can never be asked for before the browser has the session. Doing it
 * client-side raced often enough to matter.
 *
 * `redirect()` works by throwing, so nothing after it runs and it must not sit
 * inside a try/catch.
 */
async function enterRoom(roomId, side) {
  await startSession(roomId, side);
  /* `?new=1` is a breadcrumb, not state. If the room page finds no session it
     can tell the difference between "someone typed the URL" (send them to the
     door quietly) and "we JUST signed them in and the cookie did not survive"
     — which deserves an explanation instead of a blank form. */
  redirect('/couple/room?new=1');
}

export async function leaveRoom() {
  const jar = await cookies();
  jar.set(COUPLE_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return { ok: true };
}

/* --------------------------------------------------------------- createRoom */

export async function createRoom(input) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  /* Checked before anything expensive: creating a room hashes a password. */
  const ip = await clientKey();
  const gate = take('couple:create', ip, CREATE_PER_IP, WINDOW_MS);
  if (!gate.ok) {
    await sleep(backoffMs(gate.strikes));
    return { ok: false, error: TOO_MANY, field: 'name' };
  }

  const nameCheck = normaliseRoomName(input && input.name);
  if (nameCheck.error) return { ok: false, error: nameCheck.error, field: 'name' };

  const passCheck = normalisePassword(input && input.password);
  if (passCheck.error) return { ok: false, error: passCheck.error, field: 'password' };

  const annCheck = normaliseAnniversary(input && input.anniversary);
  if (annCheck.error) return { ok: false, error: annCheck.error, field: 'anniversary' };

  const side = normaliseSide(input && input.side);

  /* Check first for a friendly message; the unique index is what actually
     guarantees it (two people could press create at the same instant). */
  const existing = await findRoomByName(nameCheck.name);
  if (existing.failed) {
    /* The lookup itself broke. Saying "that name is free" here would be a
       guess, and saying nothing at all is what made this bug invisible. */
    return {
      ok: false,
      field: 'name',
      error:
        existing.category === 'schema'
          ? 'This site is not finished being set up — its database is missing the bit that stores corners.'
          : 'We could not reach the database just now. Please try again in a moment.',
    };
  }
  if (existing.room) {
    return { ok: false, error: 'That name is already taken. Try another one.', field: 'name' };
  }

  const created = await insertRoom({
    name: nameCheck.name,
    password: passCheck.password,
    /* Normalised to a YYYY-MM-DD string or null — never ''. See the note in
       insertRoom: '' is not a date and Postgres refuses the whole insert. */
    anniversary: annCheck.anniversary ?? null,
  });
  if (created.error) {
    return { ok: false, error: created.error, field: created.field || 'name' };
  }

  await enterRoom(created.id, side); // throws to redirect — nothing after this runs
}

/* ----------------------------------------------------------------- joinRoom */

export async function joinRoom(input) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const startedAt = Date.now();

  /* Deliberately vague: a malformed name, an unknown name and a wrong password
     all get the same answer in the same amount of time, so this cannot be used
     to discover which rooms exist. */
  const wrong = { ok: false, error: 'That name and password did not match a corner.' };

  const nameCheck = normaliseRoomName(input && input.name);
  const ip = await clientKey();
  /* A malformed name still gets a bucket, so junk cannot be used to dodge the
     per-room limit — it just shares one. */
  const roomKey = `${ip}|${nameCheck.name || '?'}`;

  /* Both gates are consulted BEFORE the password is hashed. */
  const perIp = take('couple:join:ip', ip, JOIN_PER_IP, WINDOW_MS);
  const perRoom = take('couple:join:room', roomKey, JOIN_PER_ROOM, WINDOW_MS);
  if (!perIp.ok || !perRoom.ok) {
    await sleep(backoffMs(Math.max(perIp.strikes, perRoom.strikes)));
    return { ok: false, error: TOO_MANY };
  }

  /* One helper for every failure path, so they are indistinguishable. */
  const fail = async () => {
    const strikes = strike('couple:join:room', roomKey);
    await uniformFail(startedAt, strikes);
    return wrong;
  };

  if (nameCheck.error) return fail();

  const password = String((input && input.password) || '');
  if (!password) return fail();

  const found = await findRoomByName(nameCheck.name);
  /* A broken lookup is not a wrong password. Telling someone their password is
     wrong when the database simply did not answer sends them off to "fix"
     something that was never broken. This answer reveals nothing about whether
     the room exists, so the timing game is still safe. */
  if (found.failed) {
    await uniformFail(startedAt, 0);
    return {
      ok: false,
      error:
        found.category === 'schema'
          ? 'This site is not finished being set up — corners have nowhere to live yet.'
          : 'We could not reach the database just now. Please try again in a moment.',
    };
  }
  const room = found.room;
  if (!room) return fail();

  const good = await verifyPassword(password, room.pass_hash, room.pass_salt);
  if (!good) return fail();

  await enterRoom(room.id, normaliseSide(input && input.side)); // throws to redirect
}

/* -------------------------------------------------------------- sendMessage */

/**
 * A soft throttle: one message per second per side of a room.
 *
 * In memory on purpose — it is a politeness limit, not a security control, and
 * a serverless instance restarting simply forgets it. Anything stricter belongs
 * in the database.
 */
const lastSentAt = new Map();
const THROTTLE_MS = 1000;

/* The map is keyed by room+side, so it grows with the number of rooms that have
   ever sent a message on this instance. Sweep anything older than a minute — by
   then the 1s throttle it existed to enforce is long spent. */
const SEND_SWEEP_MS = 60 * 1000;
let lastSendSweep = 0;

function pruneLastSent(now) {
  if (now - lastSendSweep < SEND_SWEEP_MS) return;
  lastSendSweep = now;
  for (const [key, at] of lastSentAt) {
    if (now - at > SEND_SWEEP_MS) lastSentAt.delete(key);
  }
}

export async function sendMessage(body, mediaPath = null) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, error: 'You are signed out — open your corner again.', signedOut: true };

  /* A photo is only attachable if the path is one WE could have issued, inside
     this caller's own room folder. The browser is told the path by the server a
     moment earlier, but it is still just a browser saying words. */
  let media = null;
  if (mediaPath !== null && mediaPath !== undefined && mediaPath !== '') {
    if (!isPlausibleMediaPath(String(mediaPath), session.roomId)) {
      console.error(
        '[truce] sendMessage: rejected a media_path outside the caller\'s room',
        JSON.stringify({ room: session.roomId, gaveLength: String(mediaPath).length }),
      );
      return { ok: false, error: 'That photo could not be attached.' };
    }
    media = String(mediaPath);
  }

  /* Code-point safe: a message ending in an emoji must not be cut in half.
     See lib/truncate.js for why a plain .slice() breaks the insert.
     A photo's caption is much shorter than a message on its own. */
  const text = tidyAndTruncate(String(body == null ? '' : body), media ? MEDIA_CAPTION_MAX : MAX_MESSAGE_LENGTH);
  if (!text && !media) return { ok: false, error: 'Type something first.' };

  const key = `${session.roomId}:${session.side}`;
  const now = Date.now();
  pruneLastSent(now);
  const previous = lastSentAt.get(key) || 0;
  if (now - previous < THROTTLE_MS) {
    return { ok: false, error: 'One at a time 🤍' };
  }
  lastSentAt.set(key, now);

  const result = await insertMessage(session.roomId, session.side, text, media);
  if (result.error) {
    lastSentAt.delete(key); // a failed send should not cost them their turn
    if (result.setup) return { ok: false, setup: true, error: MEDIA_SETUP_MESSAGE };
    return { ok: false, error: result.error };
  }

  /* Hand the sender a signed URL straight away so their own photo appears
     without waiting for the next poll. */
  const [message] = await attachMediaUrls([result.message]);
  return { ok: true, message };
}

/* --------------------------------------------------------------- uploads */

/**
 * Start a photo upload.
 *
 * Returns a one-shot signed URL and the path it belongs to. The path is chosen
 * here, not by the browser, and always sits under the caller's own room folder.
 *
 * The hourly cap is per room-SIDE and lives in memory, like the other limits in
 * this file: a serverless instance restarting forgets it. It exists to stop an
 * accidental loop filling a free-tier bucket, not to defeat a determined
 * person — see the long note in lib/throttle.js.
 */
export async function getUploadUrl() {
  if (!isSupabaseConfigured()) return { ok: false, setup: true, error: MEDIA_SETUP_MESSAGE };

  const session = await currentSession();
  if (!session) return { ok: false, signedOut: true, error: 'You are signed out — open your corner again.' };

  const gate = take('corner:upload', `${session.roomId}:${session.side}`, MEDIA_UPLOADS_PER_HOUR, 60 * 60 * 1000);
  if (!gate.ok) return { ok: false, throttled: true, error: MEDIA_THROTTLE_MESSAGE };

  const ticket = await createMediaUploadTicket(session.roomId);
  if (ticket.error) {
    /* 'nobucket' is the one the site owner can fix in thirty seconds, and the
       only one worth putting in front of the people in the room. */
    if (ticket.error === 'nobucket' || ticket.error === 'nodb') {
      return { ok: false, setup: true, error: MEDIA_SETUP_MESSAGE };
    }
    return { ok: false, error: 'Could not start that upload just now. Try again in a moment.' };
  }

  return { ok: true, path: ticket.path, signedUrl: ticket.signedUrl, token: ticket.token };
}

/* -------------------------------------------------------------- getMessages */

/** Everything newer than `sinceId` — this is what the room polls. */
export async function getMessages(sinceId = 0) {
  if (!isSupabaseConfigured()) return { ok: false, messages: [] };

  const session = await currentSession();
  if (!session) return { ok: false, messages: [], signedOut: true };

  const since = Number.isFinite(Number(sinceId)) ? Math.max(0, Number(sinceId)) : 0;
  const messages = await listMessages(session.roomId, since);
  /* Signed download URLs are re-minted on every fetch, so they are never older
     than the poll that carried them. */
  return { ok: true, messages: await attachMediaUrls(messages) };
}

/* ------------------------------------------------------------------ photos */

/** Every photo in the room, newest first — the Gallery. */
export async function getGallery() {
  if (!isSupabaseConfigured()) return { ok: false, photos: [] };

  const session = await currentSession();
  if (!session) return { ok: false, photos: [], signedOut: true };

  const { photos, setup } = await listRoomMedia(session.roomId);
  if (setup) return { ok: true, setup: true, photos: [] };

  return { ok: true, photos: await attachMediaUrls(photos) };
}

/**
 * Re-sign photos the browser already holds.
 *
 * A tab left open past the hour has URLs that have expired; rather than showing
 * a permanently broken tile, the image's own onError asks for a fresh one. Only
 * ids from the caller's own room can ever come back.
 */
export async function refreshMedia(ids) {
  if (!isSupabaseConfigured()) return { ok: false, messages: [] };

  const session = await currentSession();
  if (!session) return { ok: false, messages: [], signedOut: true };

  const wanted = new Set(
    (Array.isArray(ids) ? ids : [])
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .slice(0, 50),
  );
  if (!wanted.size) return { ok: true, messages: [] };

  const { photos, setup } = await listRoomMedia(session.roomId);
  if (setup) return { ok: true, setup: true, messages: [] };

  const matched = (photos || []).filter((row) => wanted.has(Number(row.id)));
  return { ok: true, messages: await attachMediaUrls(matched) };
}
