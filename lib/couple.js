import 'server-only';
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { customAlphabet } from 'nanoid';
import { getSupabase } from './supabase';
import { COUPLE_MESSAGE_MAX } from './constants';

/**
 * "Our corner" — the private room for two.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY MODEL, honestly stated
 * ─────────────────────────────────────────────────────────────────────────────
 * A room is protected by a shared secret: its name plus a password the pair
 * agree on. That is it. There is no account, no email, no recovery.
 *
 *  - The password is never stored. We keep scrypt(password, random salt), and
 *    compare with a constant-time equal so a wrong guess reveals nothing about
 *    how wrong it was.
 *  - The session is a signed, httpOnly cookie: "roomId|side|expiry" plus an
 *    HMAC-SHA256 over exactly that string. The browser can read nothing from it
 *    and cannot forge one without the server secret.
 *  - It is NOT end-to-end encrypted. Whoever runs the database can read the
 *    messages. The /couple page says so out loud, and so does the README.
 *
 * Everything here is server-only: `import 'server-only'` means a client
 * component that imports it by mistake fails the build rather than shipping
 * the secret to a browser.
 */

const scryptAsync = promisify(scrypt);

/* Room ids never appear in a URL — the cookie carries them — but they are the
   foreign key every message hangs off, so they still need to be unguessable. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makeRoomId = customAlphabet(ALPHABET, 12);

export const COUPLE_COOKIE = 'truce_corner';
export const SESSION_DAYS = 30;
export const MAX_MESSAGE_LENGTH = COUPLE_MESSAGE_MAX;
export const HISTORY_LIMIT = 200;

/* ------------------------------------------------------------------ naming */

/** Rooms are found by name, so the rules are strict and the name is a secret. */
export function normaliseRoomName(value) {
  const name = String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (!/^[a-z0-9-]{3,32}$/.test(name)) {
    return { error: 'Use 3–32 letters, numbers or dashes — no spaces or symbols.' };
  }
  return { name };
}

export function normalisePassword(value) {
  const password = String(value == null ? '' : value);
  if (password.length < 6) return { error: 'Use at least 6 characters.' };
  if (password.length > 200) return { error: 'That is longer than we can handle.' };
  return { password };
}

/** Which of the two people is typing. There are only ever two. */
export function normaliseSide(value) {
  const side = Number(value);
  return side === 2 ? 2 : 1;
}

/** Optional "together since" date, stored as a plain YYYY-MM-DD. */
export function normaliseAnniversary(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return { anniversary: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { anniversary: null };
  const when = new Date(`${raw}T00:00:00Z`).getTime();
  if (Number.isNaN(when)) return { anniversary: null };
  /* No time travel, and nothing before photography. */
  if (when > Date.now() + 86400000) return { error: 'That date is in the future.' };
  if (when < Date.parse('1900-01-01')) return { anniversary: null };
  return { anniversary: raw };
}

/* --------------------------------------------------------------- passwords */

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return { hash: derived.toString('hex'), salt };
}

/** Constant-time verify: never leak how close a guess was. */
export async function verifyPassword(password, hash, salt) {
  try {
    const derived = await scryptAsync(password, String(salt), 64);
    const known = Buffer.from(String(hash), 'hex');
    if (known.length !== derived.length) return false;
    return timingSafeEqual(known, derived);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- sessions */

/**
 * The key the session cookie is signed with.
 *
 * ADMIN_SECRET is the right answer. If it is not set we derive a stable one
 * from the service-role key, which is already secret and already unique per
 * deployment — so sessions keep working out of the box. The README asks for
 * ADMIN_SECRET anyway, because rotating the database key should not silently
 * sign everybody out.
 */
function sessionSecret() {
  /* Always hashed with a purpose label rather than used raw, so the value that
     signs corner sessions is never byte-identical to the one typed into
     /dev?key=… — different job, different key. */
  const explicit = process.env.ADMIN_SECRET;
  if (explicit) return createHash('sha256').update(`truce-corner:${explicit}`).digest('hex');

  const derivedFrom = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL;
  if (derivedFrom) {
    return createHash('sha256').update(`truce-corner:${derivedFrom}`).digest('hex');
  }

  /* No database and no secret: there are no rooms to protect on this
     deployment, so a fixed development value is harmless. */
  return 'truce-corner-development-only';
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload) {
  return b64url(createHmac('sha256', sessionSecret()).update(payload).digest());
}

/** "<roomId>|<side>|<expiry ms>.<signature>" */
export function createSessionToken(roomId, side) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${roomId}|${side}|${expires}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

/** Returns { roomId, side } for a valid, unexpired, untampered token. */
export function readSessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  let payload;
  try {
    payload = Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [roomId, side, expires] = payload.split('|');
  if (!roomId || !expires) return null;
  if (Number(expires) < Date.now()) return null;

  return { roomId, side: Number(side) === 2 ? 2 : 1 };
}

/** The options every session cookie is written with. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/* ------------------------------------------------------------------ storage */

export async function findRoomByName(name) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('couple_rooms')
    .select('id, name, pass_hash, pass_salt, anniversary, created_at')
    .eq('name', name)
    .maybeSingle();
  if (error) {
    console.error('[truce] findRoomByName failed:', error.message);
    return null;
  }
  return data || null;
}

export async function findRoomById(id) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('couple_rooms')
    .select('id, name, anniversary, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[truce] findRoomById failed:', error.message);
    return null;
  }
  return data || null;
}

export async function insertRoom({ name, password, anniversary }) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'No database configured.' };

  const { hash, salt } = await hashPassword(password);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const id = makeRoomId();
    const { error } = await supabase
      .from('couple_rooms')
      .insert({ id, name, pass_hash: hash, pass_salt: salt, anniversary });

    if (!error) return { id };

    /* 23505 = unique violation. It is almost always the room NAME (ids are
       12 random characters), which means someone already took it. */
    if (error.code === '23505') {
      const taken = await findRoomByName(name);
      if (taken) return { error: 'That name is already taken. Try another one.' };
      continue; // astronomically unlikely id clash — try again
    }

    console.error('[truce] insertRoom failed:', error.message);
    return { error: 'Could not make that room just now.' };
  }

  return { error: 'Could not make that room just now.' };
}

/** The last HISTORY_LIMIT messages, oldest first; or everything after `sinceId`. */
export async function listMessages(roomId, sinceId = 0) {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('couple_messages')
    .select('id, author, body, created_at')
    .eq('room_id', roomId);

  if (sinceId > 0) {
    query = query.gt('id', sinceId).order('id', { ascending: true }).limit(HISTORY_LIMIT);
    const { data, error } = await query;
    if (error) {
      console.error('[truce] listMessages failed:', error.message);
      return [];
    }
    return data || [];
  }

  /* First load: take the newest 200, then flip them back into reading order. */
  const { data, error } = await query.order('id', { ascending: false }).limit(HISTORY_LIMIT);
  if (error) {
    console.error('[truce] listMessages failed:', error.message);
    return [];
  }
  return (data || []).slice().reverse();
}

export async function insertMessage(roomId, author, body) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'No database configured.' };

  const { data, error } = await supabase
    .from('couple_messages')
    .insert({ room_id: roomId, author, body })
    .select('id, author, body, created_at')
    .maybeSingle();

  if (error) {
    console.error('[truce] insertMessage failed:', error.message);
    return { error: 'Could not send that just now.' };
  }
  return { message: data };
}
