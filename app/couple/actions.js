'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { backoffMs, clientKey, sleep, strike, take } from '@/lib/throttle';
import { tidyAndTruncate } from '@/lib/truncate';
import {
  COUPLE_COOKIE,
  MAX_MESSAGE_LENGTH,
  createSessionToken,
  findRoomById,
  findRoomByName,
  insertMessage,
  insertRoom,
  listMessages,
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
const CREATE_PER_IP = 5;      // new rooms / minute from one address
const WINDOW_MS = 60 * 1000;

/* Every failed join costs at least this long, whatever went wrong. */
const MIN_FAIL_MS = 250;

const TOO_MANY = 'Too many tries just now — give it a minute 🤍';

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

/** The room this browser is signed into, or null. Used by the room page. */
export async function getSession() {
  const session = await currentSession();
  if (!session) return null;

  const room = await findRoomById(session.roomId);
  if (!room) return null; // deleted room, or a token signed with an old secret

  return { room, side: session.side };
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
  redirect('/couple/room');
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
  if (existing) {
    return { ok: false, error: 'That name is already taken. Try another one.', field: 'name' };
  }

  const created = await insertRoom({
    name: nameCheck.name,
    password: passCheck.password,
    anniversary: annCheck.anniversary,
  });
  if (created.error) return { ok: false, error: created.error, field: 'name' };

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

  const room = await findRoomByName(nameCheck.name);
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

export async function sendMessage(body) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, error: 'You are signed out — open your corner again.', signedOut: true };

  /* Code-point safe: a message ending in an emoji must not be cut in half.
     See lib/truncate.js for why a plain .slice() breaks the insert. */
  const text = tidyAndTruncate(String(body == null ? '' : body), MAX_MESSAGE_LENGTH);
  if (!text) return { ok: false, error: 'Type something first.' };

  const key = `${session.roomId}:${session.side}`;
  const now = Date.now();
  pruneLastSent(now);
  const previous = lastSentAt.get(key) || 0;
  if (now - previous < THROTTLE_MS) {
    return { ok: false, error: 'One at a time 🤍' };
  }
  lastSentAt.set(key, now);

  const result = await insertMessage(session.roomId, session.side, text);
  if (result.error) {
    lastSentAt.delete(key); // a failed send should not cost them their turn
    return { ok: false, error: result.error };
  }
  return { ok: true, message: result.message };
}

/* -------------------------------------------------------------- getMessages */

/** Everything newer than `sinceId` — this is what the room polls. */
export async function getMessages(sinceId = 0) {
  if (!isSupabaseConfigured()) return { ok: false, messages: [] };

  const session = await currentSession();
  if (!session) return { ok: false, messages: [], signedOut: true };

  const since = Number.isFinite(Number(sinceId)) ? Math.max(0, Number(sinceId)) : 0;
  const messages = await listMessages(session.roomId, since);
  return { ok: true, messages };
}
