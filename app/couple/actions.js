'use server';

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { currentSession, endSession, startSession, touchSession } from '@/lib/couple-session';
import { backoffMs, clientKey, sleep, strikeLimit, takeLimit } from '@/lib/throttle';
import { tidyAndTruncate } from '@/lib/truncate';
import { isAllowedReaction } from '@/lib/chat';
import {
  MEDIA_AUDIO_MAX_MS,
  MEDIA_CAPTION_MAX,
  MEDIA_SETUP_MESSAGE,
  MEDIA_THROTTLE_MESSAGE,
  MEDIA_UPLOADS_PER_HOUR,
  isPlausibleMediaPath,
} from '@/lib/media';
import {
  DELETE_WINDOW_MS,
  MAX_MESSAGE_LENGTH,
  attachMediaUrls,
  createMediaUploadTicket,
  destroyRoom,
  findRoomByName,
  findRoomForClosing,
  insertMessage,
  insertRoom,
  listMessageStates,
  listMessages,
  listRoomMedia,
  normaliseAnniversary,
  normalisePassword,
  normaliseRoomName,
  normaliseSide,
  readDeleteState,
  setDeleteAsk,
  softDeleteMessage,
  toggleReaction,
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

/**
 * What to say when the database refuses, by cause.
 *
 * These are read by somebody trying to open a private room at 2am, so none of
 * them are error codes — but they do have to be DIFFERENT from each other.
 * 'config' spent an evening looking exactly like 'network' here, which sent the
 * site's owner hunting a database that was perfectly healthy. Whoever is
 * reading cannot fix any of these, but the person they message can, and a
 * sentence that names the right thing gets there faster.
 */
const DB_TROUBLE = {
  schema:
    'This site is not finished being set up — its database is missing the bit that stores corners.',
  config:
    'This site is pointed at its database incorrectly, so nothing can be saved yet. Whoever runs it needs to check the setup.',
  auth: 'This site cannot sign in to its own database. Whoever runs it needs to check its keys.',
  default: 'We could not reach the database just now. Please try again in a moment.',
};

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

/* currentSession / getSessionState / startSession now live in
   lib/couple-session.js. They are plumbing for server components, and every
   export of this file is a public endpoint — see the note at the top of that
   module. Only the two that genuinely need to be callable from a browser stay
   here: leaveRoom (a button) and enterRoom (via createRoom / joinRoom). */

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
  await endSession();
  return { ok: true };
}

/* --------------------------------------------------------------- createRoom */

export async function createRoom(input) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  /* Checked before anything expensive: creating a room hashes a password. */
  const ip = await clientKey();
  const gate = await takeLimit('couple:create', ip, CREATE_PER_IP, WINDOW_MS);
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
      error: DB_TROUBLE[existing.category] || DB_TROUBLE.default,
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
  const perIp = await takeLimit('couple:join:ip', ip, JOIN_PER_IP, WINDOW_MS);
  const perRoom = await takeLimit('couple:join:room', roomKey, JOIN_PER_ROOM, WINDOW_MS);
  if (!perIp.ok || !perRoom.ok) {
    await sleep(backoffMs(Math.max(perIp.strikes, perRoom.strikes)));
    return { ok: false, error: TOO_MANY };
  }

  /* One helper for every failure path, so they are indistinguishable. */
  const fail = async () => {
    const strikes = await strikeLimit('couple:join:room', roomKey);
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
    return { ok: false, error: DB_TROUBLE[found.category] || DB_TROUBLE.default };
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

export async function sendMessage(body, mediaPath = null, replyTo = null, mediaMs = null) {
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

  /* A reply names an id and nothing more. It is not checked against this room:
     the quote is resolved from what the reader already holds, so an id from
     somewhere else renders as "message unavailable" and reveals nothing. What
     it must not be is a way to write junk into a bigint column. */
  const answering = Number(replyTo);
  const parent = Number.isInteger(answering) && answering > 0 ? answering : null;

  /* Length is measured by the recorder, so it is a claim from the browser.
     Clamped rather than trusted — the worst a lie can do is mislabel a bar. */
  const claimed = Number(mediaMs);
  const heldMs =
    Number.isFinite(claimed) && claimed > 0 ? Math.min(Math.round(claimed), MEDIA_AUDIO_MAX_MS) : null;

  const result = await insertMessage(session.roomId, session.side, text, media, parent, heldMs);
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
export async function getUploadUrl(kind = 'photo', audioExt = 'webm') {
  if (!isSupabaseConfigured()) return { ok: false, setup: true, error: MEDIA_SETUP_MESSAGE };

  const session = await currentSession();
  if (!session) return { ok: false, signedOut: true, error: 'You are signed out — open your corner again.' };

  const gate = await takeLimit('corner:upload', `${session.roomId}:${session.side}`, MEDIA_UPLOADS_PER_HOUR, 60 * 60 * 1000);
  if (!gate.ok) return { ok: false, throttled: true, error: MEDIA_THROTTLE_MESSAGE };

  /* 'voice' or anything else, which means a photo. The browser picks the kind
     but never the extension or the content type — those are decided here, so
     the object's name always matches the bytes that go into it. */
  const voice = kind === 'voice';
  const ticket = await createMediaUploadTicket(
    session.roomId,
    voice
      ? { ext: audioExt === 'm4a' ? 'm4a' : 'webm', contentType: audioExt === 'm4a' ? 'audio/mp4' : 'audio/webm' }
      : { ext: 'jpg', contentType: 'image/jpeg' },
  );
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

  /* Having the corner open is what keeps it open: the poll that fetches new
     messages is also what rolls the 30 days forward. */
  await touchSession();

  const since = Number.isFinite(Number(sinceId)) ? Math.max(0, Number(sinceId)) : 0;
  const messages = await listMessages(session.roomId, since);
  /* Reactions and unsends happen to messages the poll has already seen, so
     they can never arrive on the `messages` list — that only ever carries
     what is newer than sinceId. This is how the other side's heart shows up. */
  const states = await listMessageStates(session.roomId);

  /* Signed download URLs are re-minted on every fetch, so they are never older
     than the poll that carried them. */
  return { ok: true, messages: await attachMediaUrls(messages), states };
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

/* ------------------------------------------------------------------ closing */

/**
 * Closing a corner takes two people, a password each, and ten minutes.
 *
 * The rules, in one place:
 *
 *   - each side asks separately, and each ask costs the room password;
 *   - the room dies only when both asks are live at once, inside the window;
 *   - either side can withdraw, and doing nothing is a veto — the window
 *     closes by itself;
 *   - the password is re-checked every time rather than trusted from the
 *     session, because the session is thirty days old by design. Somebody
 *     holding an unlocked phone is not somebody who knows the password.
 *
 * See the long note above DELETE_WINDOW_MS in lib/couple.js.
 */

const CLOSE_PER_ROOM = 6; // password attempts / minute, per side of a room
const CLOSE_WINDOW_MS = 60 * 1000;
const CLOSE_SETUP =
  'Closing a corner is not switched on for this site yet — it needs one quick setup step by ' +
  'whoever runs it 🤍';

/** The shape the room renders from. Never includes anything secret. */
function closingPayload(row, side, now = Date.now()) {
  const state = readDeleteState(row, now);
  const me = Number(side) === 2 ? 2 : 1;
  const them = me === 1 ? 2 : 1;
  return {
    ok: true,
    mine: state.asked[me],
    theirs: state.asked[them],
    msLeft: state.msLeft,
    windowMs: DELETE_WINDOW_MS,
  };
}

/** Where the room stands on closing right now. Cheap, and reveals nothing. */
export async function getClosingState() {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, signedOut: true, error: 'You are signed out — open your corner again.' };

  const found = await findRoomForClosing(session.roomId);
  if (found.failed) {
    if (found.category === 'schema') return { ok: false, setup: true, error: CLOSE_SETUP };
    return { ok: false, error: 'We could not reach the database just now.' };
  }
  if (!found.room) return { ok: false, gone: true, error: 'This corner is no longer here.' };

  return closingPayload(found.room, session.side);
}

/**
 * Ask to close the corner, or withdraw an ask.
 *
 * `withdraw` needs no password: taking your own hand off the button is always
 * allowed, and making somebody type a password to STOP a deletion would be a
 * strange place to put friction.
 */
export async function askToClose(password, withdraw = false) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, signedOut: true, error: 'You are signed out — open your corner again.' };

  /* Verifying a password runs scrypt, so the gate comes first — same reasoning
     as joinRoom. Withdrawing is free and does not spend a token. */
  if (!withdraw) {
    const gate = await takeLimit('couple:close', `${session.roomId}:${session.side}`, CLOSE_PER_ROOM, CLOSE_WINDOW_MS);
    if (!gate.ok) {
      await sleep(backoffMs(gate.strikes));
      return { ok: false, error: TOO_MANY };
    }
  }

  const found = await findRoomForClosing(session.roomId);
  if (found.failed) {
    if (found.category === 'schema') return { ok: false, setup: true, error: CLOSE_SETUP };
    return { ok: false, error: 'We could not reach the database just now. Please try again.' };
  }
  if (!found.room) return { ok: false, gone: true, error: 'This corner is no longer here.' };

  if (withdraw) {
    const cleared = await setDeleteAsk(session.roomId, session.side, null);
    if (cleared.error) return { ok: false, error: 'Could not change that just now.' };
    return { ...closingPayload(cleared.row, session.side), withdrawn: true };
  }

  const startedAt = Date.now();
  const good = await verifyPassword(String(password || ''), found.room.pass_hash, found.room.pass_salt);
  if (!good) {
    /* Same uniform delay as a failed join: a wrong password here should not be
       distinguishable from any other refusal by a stopwatch. */
    await uniformFail(startedAt, await strikeLimit('couple:close', `${session.roomId}:${session.side}`));
    return { ok: false, error: 'That password did not match.' };
  }

  const saved = await setDeleteAsk(session.roomId, session.side, new Date());
  if (saved.error) {
    if (saved.error === 'schema') return { ok: false, setup: true, error: CLOSE_SETUP };
    return { ok: false, error: 'Could not record that just now. Please try again.' };
  }

  const state = readDeleteState(saved.row);

  /* Both hands on the button, inside the window. */
  if (state.both) {
    const destroyed = await destroyRoom(session.roomId);
    if (destroyed.error) {
      return { ok: false, error: 'Could not close the corner just now. Please try again.' };
    }
    await endSession();
    return { ok: true, closed: true };
  }

  return { ...closingPayload(saved.row, session.side), waiting: true };
}

/* ------------------------------------------------------- react and unsend */

const REACT_SETUP =
  'Reactions need one more line of setup on this site. The message itself is fine.';

/**
 * Press or un-press an emoji on a message.
 *
 * Both people may react to anything in their own room, including their own
 * messages — that is how every chat app behaves and there is no reason to be
 * stricter about a heart than WhatsApp is.
 *
 * The emoji is checked against the palette on the way in. Without that, this
 * action is an arbitrary-string writer into a jsonb column that then renders
 * in the other person's browser.
 */
export async function react(messageId, emoji) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, error: 'You are signed out — open your corner again.', signedOut: true };

  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'That message is not here any more.' };

  if (!isAllowedReaction(emoji)) return { ok: false, error: 'That is not one of the reactions.' };

  const result = await toggleReaction(session.roomId, id, session.side, emoji);
  if (result.setup) return { ok: false, setup: true, error: REACT_SETUP };
  if (result.error) return { ok: false, error: result.error };

  return { ok: true, id, reactions: result.reactions };
}

/**
 * Unsend one of your own messages.
 *
 * Authorship is decided from the session cookie, never from the caller — the
 * only thing the browser gets to choose is which id it names, and a message
 * belonging to the other side is refused by the database layer.
 */
export async function unsend(messageId) {
  if (!isSupabaseConfigured()) return { ok: false, error: NO_DB };

  const session = await currentSession();
  if (!session) return { ok: false, error: 'You are signed out — open your corner again.', signedOut: true };

  const id = Number(messageId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'That message is not here any more.' };

  const result = await softDeleteMessage(session.roomId, id, session.side);
  if (result.setup) return { ok: false, setup: true, error: REACT_SETUP };
  if (result.error) return { ok: false, error: result.error };

  return { ok: true, id };
}
