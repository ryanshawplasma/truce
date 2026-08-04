import 'server-only';
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { customAlphabet } from 'nanoid';
import { getSupabase, logPgError, logStorageError } from './supabase';
import { COUPLE_MESSAGE_MAX } from './constants';
import {
  MEDIA_BUCKET,
  MEDIA_GALLERY_LIMIT,
  MEDIA_SIGNED_TTL_SECONDS,
  mediaPathFor,
} from './media';

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

/**
 * Look a room up by name.
 *
 * Returns { room } when found, { room: null } when genuinely absent, and
 * { failed, category } when the QUERY itself broke. The difference matters:
 * "there is no such room" and "the database would not answer" used to look
 * identical here, and the second one silently became the first.
 */
export async function findRoomByName(name) {
  const supabase = getSupabase();
  if (!supabase) return { room: null, failed: true, category: 'nodb' };
  const { data, error } = await supabase
    .from('couple_rooms')
    .select('id, name, pass_hash, pass_salt, anniversary, created_at')
    .eq('name', name)
    .maybeSingle();
  if (error) {
    const category = logPgError('findRoomByName', error);
    return { room: null, failed: true, category };
  }
  return { room: data || null };
}

/** Same contract as findRoomByName, by primary key. */
export async function findRoomById(id) {
  const supabase = getSupabase();
  if (!supabase) return { room: null, failed: true, category: 'nodb' };
  const { data, error } = await supabase
    .from('couple_rooms')
    .select('id, name, anniversary, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    const category = logPgError('findRoomById', error);
    return { room: null, failed: true, category };
  }
  return { room: data || null };
}

/**
 * Insert a room.
 *
 * Returns { id } or { error, category, field }. The category is what lets the
 * action say something true to the person waiting — "that name is taken" is a
 * very different message from "this site's database has not been set up yet",
 * and before this both came out as "Could not make that room just now."
 *
 * `anniversary` MUST be a YYYY-MM-DD string or null. An empty string is not a
 * date to Postgres and the insert dies with 22007 — that is the exact write
 * that used to pass local QA and fail in production, so it is asserted here as
 * well as normalised at both ends.
 */
export async function insertRoom({ name, password, anniversary }) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'No database configured.', category: 'nodb' };

  /* Last line of defence before the wire: never send '' to a date column. */
  const anniversaryValue =
    typeof anniversary === 'string' && anniversary.trim() ? anniversary.trim() : null;

  const { hash, salt } = await hashPassword(password);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const id = makeRoomId();
    const { error } = await supabase
      .from('couple_rooms')
      .insert({ id, name, pass_hash: hash, pass_salt: salt, anniversary: anniversaryValue });

    if (!error) return { id };

    const category = logPgError('insertRoom', error, { attempt });

    /* 23505 = unique violation. It is almost always the room NAME (ids are
       12 random characters), which means someone already took it. */
    if (category === 'duplicate') {
      const taken = await findRoomByName(name);
      if (taken.room) {
        return { error: 'That name is already taken. Try another one.', category, field: 'name' };
      }
      continue; // astronomically unlikely id clash — try again
    }

    if (category === 'schema') {
      return {
        error:
          'This site is not finished being set up — its database is missing the bit that stores corners. ' +
          'Whoever runs it needs to re-run the setup SQL.',
        category,
      };
    }

    if (category === 'badvalue') {
      return { error: 'That “together since” date did not look right.', category, field: 'anniversary' };
    }

    return { error: 'Could not make that corner just now. Please try again.', category };
  }

  return { error: 'Could not make that corner just now. Please try again.', category: 'unknown' };
}

/* ------------------------------------------------------------------ photos */

/**
 * Whether this deployment's `couple_messages` table has the `media_path`
 * column yet.
 *
 * 'unknown' until the first query tells us. The moment a select or an insert
 * comes back with 42703/PGRST204 we flip to 'missing', log the exact ALTER to
 * run, and quietly stop asking for the column — so a half-migrated database
 * loses photos, not the whole chat. Nothing here throws: a corner that worked
 * yesterday must keep working today.
 */
let mediaColumn = 'unknown'; // 'unknown' | 'present' | 'missing'

const BASE_MESSAGE_COLUMNS = 'id, author, body, created_at';
const MEDIA_MESSAGE_COLUMNS = `${BASE_MESSAGE_COLUMNS}, media_path`;

function messageColumns() {
  return mediaColumn === 'missing' ? BASE_MESSAGE_COLUMNS : MEDIA_MESSAGE_COLUMNS;
}

export function isMediaColumnMissing() {
  return mediaColumn === 'missing';
}

/** Say it once, loudly, with the fix in the line. */
function noteMediaColumnMissing(scope) {
  if (mediaColumn === 'missing') return;
  mediaColumn = 'missing';
  console.error(
    `[truce] ${scope}: couple_messages.media_path is missing, so photos are switched off. ` +
      'Run this once in the Supabase SQL editor: ' +
      'alter table public.couple_messages add column if not exists media_path text;',
  );
}

/** A nanoid stem for an object name; the room id supplies the folder. */
const makeMediaId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 16);

/**
 * Ask Storage for a one-shot signed upload URL.
 *
 * The browser never sees the service-role key: it gets a URL that is good for
 * exactly one object, at a path WE chose inside the caller's own room folder.
 * A client that lies about the path afterwards is caught by
 * isPlausibleMediaPath in the action.
 */
export async function createMediaUploadTicket(roomId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'nodb' };

  const path = mediaPathFor(roomId, makeMediaId());
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path, { contentType: 'image/jpeg' });

  if (error) return { error: logStorageError('createSignedUploadUrl', error, { path }) };
  if (!data || !data.signedUrl) return { error: 'unknown' };

  return { path, signedUrl: data.signedUrl, token: data.token || null };
}

/**
 * Attach a short-lived signed download URL to every row that has a media_path.
 *
 * Called on EVERY fetch — first load, every poll, and the gallery — so a URL
 * that has been sitting in a phone's memory for an hour is replaced rather than
 * quietly rotting. Rows without a photo are returned untouched.
 */
export async function attachMediaUrls(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const paths = [...new Set(list.filter((r) => r && r.media_path).map((r) => r.media_path))];
  if (!paths.length) return list;

  const supabase = getSupabase();
  if (!supabase) return list;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, MEDIA_SIGNED_TTL_SECONDS);

  if (error) {
    logStorageError('createSignedUrls', error, { count: paths.length });
    /* A photo we cannot sign becomes a fallback tile, not a broken page. */
    return list.map((r) => (r && r.media_path ? { ...r, media_url: null } : r));
  }

  const signed = new Map();
  for (const item of data || []) {
    if (item && item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
  }
  return list.map((r) => (r && r.media_path ? { ...r, media_url: signed.get(r.media_path) || null } : r));
}

/* ---------------------------------------------------------------- closing */

/**
 * Closing a corner takes two people.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT IS BUILT THIS WAY
 * ─────────────────────────────────────────────────────────────────────────────
 * A corner belongs to two people and holds things neither of them can get back:
 * the 2am messages, the photos, the day counter. A single tap must not be able
 * to end that — not in an argument, and not from a phone somebody left
 * unlocked on a table.
 *
 * So each side asks separately, and each ask costs the room password. The room
 * is destroyed only when both asks are live at the same moment, inside
 * DELETE_WINDOW_MS. Outside it, the older ask is simply stale and the newer one
 * starts the clock again. Either person can withdraw at any time, and doing
 * nothing at all is a veto — the window closes on its own.
 *
 * The password is re-checked on every ask rather than trusted from the session,
 * because the session is thirty days old by design. Somebody holding the phone
 * is not somebody who knows the password.
 *
 * THE COLUMNS MIGHT NOT BE THERE
 * ──────────────────────────────
 * Same story as media_path: a deployment that has not re-run schema.sql has no
 * delete_asked_* columns, and a select that names them dies with 42703. That
 * must switch the feature off with a sentence the owner can act on — never take
 * the chat down with it. See the long note above mediaColumn; this is the same
 * pattern, deliberately.
 */

/** Both asks must be live within this window for a corner to be destroyed. */
export const DELETE_WINDOW_MS = 10 * 60 * 1000;

let deleteColumns = 'unknown'; // 'unknown' | 'present' | 'missing'

export function isDeleteColumnMissing() {
  return deleteColumns === 'missing';
}

function noteDeleteColumnsMissing(scope) {
  if (deleteColumns === 'missing') return;
  deleteColumns = 'missing';
  console.error(
    `[truce] ${scope}: couple_rooms.delete_asked_1/2 are missing, so closing a corner is ` +
      'switched off. Run this once in the Supabase SQL editor: ' +
      'alter table public.couple_rooms add column if not exists delete_asked_1 timestamptz; ' +
      'alter table public.couple_rooms add column if not exists delete_asked_2 timestamptz;',
  );
}

/** Which column belongs to which side. There are only ever two. */
function askColumn(side) {
  return Number(side) === 2 ? 'delete_asked_2' : 'delete_asked_1';
}

/**
 * Turn two raw timestamps into the state both the server and the room need.
 *
 * Exported bare because it is pure: the test suite exercises the window logic
 * without a database anywhere near it.
 */
export function readDeleteState(row, now = Date.now()) {
  const at = (value) => {
    if (!value) return null;
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) return null;
    /* A stale ask is not an ask. */
    return now - ms > DELETE_WINDOW_MS ? null : ms;
  };

  const mine = { 1: at(row && row.delete_asked_1), 2: at(row && row.delete_asked_2) };
  const both = mine[1] !== null && mine[2] !== null;

  /* The window belongs to the EARLIER ask — it is the one that expires first,
     and showing a countdown that could grow would be a lie. */
  const earliest = both ? Math.min(mine[1], mine[2]) : (mine[1] ?? mine[2] ?? null);
  const expiresAt = earliest === null ? null : earliest + DELETE_WINDOW_MS;

  return {
    asked: { 1: mine[1] !== null, 2: mine[2] !== null },
    both,
    expiresAt,
    msLeft: expiresAt === null ? 0 : Math.max(0, expiresAt - now),
  };
}

/** The room row that closing needs: the password, and both asks. */
export async function findRoomForClosing(id) {
  const supabase = getSupabase();
  if (!supabase) return { room: null, failed: true, category: 'nodb' };
  if (deleteColumns === 'missing') return { room: null, failed: true, category: 'schema' };

  const { data, error } = await supabase
    .from('couple_rooms')
    .select('id, name, pass_hash, pass_salt, delete_asked_1, delete_asked_2')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const category = logPgError('findRoomForClosing', error);
    if (category === 'schema') noteDeleteColumnsMissing('findRoomForClosing');
    return { room: null, failed: true, category };
  }

  if (deleteColumns === 'unknown') deleteColumns = 'present';
  return { room: data || null };
}

/**
 * Record — or withdraw — one side's ask.
 *
 * `at` is a Date for an ask and null to withdraw. Returns the room's state
 * afterwards so the caller never has to read its own write back.
 */
export async function setDeleteAsk(roomId, side, at) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'nodb' };
  if (deleteColumns === 'missing') return { error: 'schema' };

  const { data, error } = await supabase
    .from('couple_rooms')
    .update({ [askColumn(side)]: at ? new Date(at).toISOString() : null })
    .eq('id', roomId)
    .select('delete_asked_1, delete_asked_2')
    .maybeSingle();

  if (error) {
    const category = logPgError('setDeleteAsk', error, { side });
    if (category === 'schema') noteDeleteColumnsMissing('setDeleteAsk');
    return { error: category };
  }

  return { row: data || {} };
}

/**
 * Destroy a corner: the photos first, then the row.
 *
 * Order matters. couple_messages cascades from couple_rooms, so deleting the
 * row first would take the media_path values with it and orphan every object in
 * the bucket — invisible, unreferenced, and still counting against the storage
 * quota. List the paths, remove the objects, THEN drop the room.
 *
 * A storage failure is logged but does not stop the delete. Somebody who asked
 * twice, with a password, inside ten minutes, has been unambiguous; leaving
 * their messages in place because a bucket call timed out would be the wrong
 * way to fail. Orphaned objects are a cleanup job, not a reason to keep a
 * conversation somebody asked twice to be rid of.
 */
export async function destroyRoom(roomId) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'nodb' };

  if (deleteColumns !== 'missing') {
    const { data, error } = await supabase
      .from('couple_messages')
      .select('media_path')
      .eq('room_id', roomId)
      .not('media_path', 'is', null);

    if (error) {
      /* A database one migration behind has no media_path to list. Nothing to
         clean up in that case, so carry on rather than refusing to delete. */
      logPgError('destroyRoom(list photos)', error);
    } else {
      const paths = [...new Set((data || []).map((r) => r.media_path).filter(Boolean))];
      if (paths.length) {
        const removal = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
        if (removal.error) logStorageError('destroyRoom(remove)', removal.error, { count: paths.length });
      }
    }
  }

  const { error } = await supabase.from('couple_rooms').delete().eq('id', roomId);
  if (error) {
    logPgError('destroyRoom', error);
    return { error: 'delete' };
  }
  return { ok: true };
}

/* --------------------------------------------------------------- messages */

/** The last HISTORY_LIMIT messages, oldest first; or everything after `sinceId`. */
export async function listMessages(roomId, sinceId = 0) {
  const supabase = getSupabase();
  if (!supabase) return [];

  /* One attempt, with whichever column list this deployment can serve. */
  const run = async (columns) => {
    let query = supabase.from('couple_messages').select(columns).eq('room_id', roomId);
    if (sinceId > 0) {
      query = query.gt('id', sinceId).order('id', { ascending: true }).limit(HISTORY_LIMIT);
      return query;
    }
    /* First load: take the newest 200, then flip them back into reading order. */
    return query.order('id', { ascending: false }).limit(HISTORY_LIMIT);
  };

  let { data, error } = await run(messageColumns());

  /* The database is one migration behind. Drop the column and carry on — the
     words matter more than the pictures. */
  if (error && logPgError('listMessages', error) === 'schema' && mediaColumn !== 'missing') {
    noteMediaColumnMissing('listMessages');
    ({ data, error } = await run(BASE_MESSAGE_COLUMNS));
    if (error) {
      logPgError('listMessages(retry)', error);
      return [];
    }
  } else if (error) {
    return [];
  } else if (mediaColumn === 'unknown') {
    mediaColumn = 'present';
  }

  const rows = data || [];
  return sinceId > 0 ? rows : rows.slice().reverse();
}

export async function insertMessage(roomId, author, body, mediaPath = null) {
  const supabase = getSupabase();
  if (!supabase) return { error: 'No database configured.' };

  const row = { room_id: roomId, author, body };
  if (mediaPath) row.media_path = mediaPath;

  /* One attempt, with whichever RETURNING list this deployment can serve — the
     same shape as listMessages, and for exactly the same reason. */
  const run = (columns) =>
    supabase.from('couple_messages').insert(row).select(columns).maybeSingle();

  let { data, error } = await run(mediaPath ? MEDIA_MESSAGE_COLUMNS : messageColumns());

  if (error) {
    const category = logPgError('insertMessage', error);
    if (category === 'schema') {
      noteMediaColumnMissing('insertMessage');

      /* A photo genuinely has nowhere to go without the column. */
      if (mediaPath) return { error: 'setup', setup: true };

      /* Words do. On a database that predates media_path the row itself is
         perfectly valid — the only thing 42703 refused was asking for that
         column BACK. Drop it from the RETURNING list and send the message.
         Without this retry every text message sent on a server instance that
         had not yet done a read failed with "this site is still being set up",
         which is how a half-migrated database took the whole chat down instead
         of just the photos. */
      ({ data, error } = await run(BASE_MESSAGE_COLUMNS));
      if (error) {
        logPgError('insertMessage(retry)', error);
        return { error: 'This site is still being set up — messages have nowhere to go yet.' };
      }
      return { message: data };
    }
    return { error: 'Could not send that just now.' };
  }

  if (mediaColumn === 'unknown') mediaColumn = 'present';
  return { message: data };
}

/**
 * Every photo in a room, newest first — what the gallery shows.
 *
 * Returns { photos } or { photos: [], setup: true } when this deployment has no
 * media_path column to filter on.
 */
export async function listRoomMedia(roomId, limit = MEDIA_GALLERY_LIMIT) {
  if (mediaColumn === 'missing') return { photos: [], setup: true };

  const supabase = getSupabase();
  if (!supabase) return { photos: [] };

  const { data, error } = await supabase
    .from('couple_messages')
    .select(MEDIA_MESSAGE_COLUMNS)
    .eq('room_id', roomId)
    .not('media_path', 'is', null)
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(1, Number(limit) || MEDIA_GALLERY_LIMIT), MEDIA_GALLERY_LIMIT));

  if (error) {
    if (logPgError('listRoomMedia', error) === 'schema') {
      noteMediaColumnMissing('listRoomMedia');
      return { photos: [], setup: true };
    }
    return { photos: [] };
  }

  if (mediaColumn === 'unknown') mediaColumn = 'present';
  return { photos: data || [] };
}
