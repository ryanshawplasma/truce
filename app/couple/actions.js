'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
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

  const nameCheck = normaliseRoomName(input && input.name);
  /* Deliberately vague: a malformed name and a wrong name get the same answer,
     so this cannot be used to discover which rooms exist. */
  const wrong = { ok: false, error: 'That name and password did not match a corner.' };
  if (nameCheck.error) return wrong;

  const password = String((input && input.password) || '');
  if (!password) return wrong;

  const room = await findRoomByName(nameCheck.name);
  if (!room) return wrong;

  const good = await verifyPassword(password, room.pass_hash, room.pass_salt);
  if (!good) return wrong;

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

export async function sendMessage(body) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, error: 'You are signed out — open your corner again.', signedOut: true };

  const text = String(body == null ? '' : body).replace(/\r\n/g, '\n').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return { ok: false, error: 'Type something first.' };

  const key = `${session.roomId}:${session.side}`;
  const now = Date.now();
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
