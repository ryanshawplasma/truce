/**
 * The parts of the room's message list that are just data.
 *
 * Kept out of the component on purpose: grouping runs across midnight and
 * across an optimistic message being swapped for a real one, and link-splitting
 * runs over whatever anybody types. Both are exactly the sort of thing that
 * breaks quietly and is never noticed until somebody's message looks wrong, so
 * both are testable without rendering anything. See tests/chat.test.mjs.
 *
 * Everything here is timezone-aware only through the reader's own Date, which
 * is why it runs in the browser after mount rather than on the server.
 */

/* Two messages from the same person, close enough together, read as one breath
   rather than two. Five minutes is roughly where WhatsApp draws it. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** A stable per-day key in the READER's timezone. */
export function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'x';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yesterday = new Date(now.getTime() - 86400000);
  if (dayKey(iso) === dayKey(now)) return 'Today';
  if (dayKey(iso) === dayKey(yesterday)) return 'Yesterday';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return d.toDateString();
  }
}

export function clockTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Same person, close enough in time. Unparseable timestamps never group. */
export function sameGroup(a, b) {
  if (!a || !b || a.author !== b.author) return false;
  const ta = new Date(a.created_at).getTime();
  const tb = new Date(b.created_at).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(tb - ta) <= GROUP_WINDOW_MS;
}

/**
 * Insert "Today" / "Yesterday" / a date between days, and work out where each
 * run of messages from one person starts and ends.
 *
 * Only the last bubble of a run gets a tail, which is the small thing that
 * makes a chat feel like a chat instead of a list of boxes. A run never spans
 * a date separator, however close the timestamps are either side of midnight —
 * otherwise a message at 23:59 and one at 00:01 would be joined across the
 * "Today" heading sitting between them.
 */
export function buildRows(messages, now = new Date(), { unreadFrom = null } = {}) {
  const rows = [];
  let lastKey = '';
  let markedUnread = false;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const key = dayKey(message.created_at);
    const startsDay = key !== lastKey;

    if (startsDay) {
      rows.push({ kind: 'date', key, label: dayLabel(message.created_at, now) });
      lastKey = key;
    }

    /* The "unread" line goes AFTER the date heading, never between a heading
       and the day it introduces — and only once, even though the id it looks
       for could in principle appear twice in a list being merged. */
    if (!markedUnread && unreadFrom !== null && message.id === unreadFrom) {
      rows.push({ kind: 'unread', key: `unread-${unreadFrom}` });
      markedUnread = true;
    }

    const prev = startsDay ? null : messages[i - 1];
    const next = messages[i + 1];
    const nextSameDay = next ? dayKey(next.created_at) === key : false;

    rows.push({
      kind: 'message',
      message,
      firstOfGroup: !sameGroup(prev, message),
      lastOfGroup: !nextSameDay || !sameGroup(message, next),
    });
  }

  return rows;
}

/* Bare http(s) links only — never a javascript: or data: URL. The trailing
   character class keeps a full stop or a closing bracket at the end of a
   sentence out of the href. */
const LINK_RE = /https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/gi;

/**
 * Split a message into text and link runs.
 *
 * Returns plain objects rather than markup so the caller decides how to render
 * — which keeps the escaping guarantee intact: the room turns these into React
 * children, never into HTML, so a message containing markup stays text.
 *
 * A message with no links comes back as a single text part, so the common case
 * stays cheap and the caller needs no special case.
 */
export function splitLinks(text) {
  const s = String(text);
  const parts = [];
  let last = 0;

  for (const match of s.matchAll(LINK_RE)) {
    const start = match.index;
    const url = match[0];
    if (start > last) parts.push({ type: 'text', value: s.slice(last, start) });
    parts.push({ type: 'link', value: url });
    last = start + url.length;
  }

  if (last < s.length) parts.push({ type: 'text', value: s.slice(last) });
  return parts;
}

/* ==========================================================================
   REACTIONS
   --------------------------------------------------------------------------
   Stored on the message row as jsonb: { "❤️": [1], "😂": [1, 2] } — the emoji
   to the sides that pressed it. There are only ever two sides, so a reaction
   is at most two entries long and needs no counting beyond that.

   Everything here is pure and total. The value arriving from the database is
   whatever was written there, possibly by an older build or a hand-edited row,
   so nothing may assume shape: normaliseReactions is the only door in, and it
   throws away anything it does not recognise rather than trusting it.
   ======================================================================== */

/** The palette. Deliberately small — a wall of emoji is a worse question. */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

export function isAllowedReaction(emoji) {
  return REACTIONS.includes(emoji);
}

/**
 * Coerce whatever the column holds into { emoji: [side, ...] }.
 *
 * Unknown emoji are dropped, so retiring one from the palette retires it from
 * every old message too. Sides are forced to 1 or 2 and de-duplicated, and an
 * emoji nobody is left holding disappears rather than sitting there as [].
 */
export function normaliseReactions(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;

  for (const [emoji, raw] of Object.entries(value)) {
    if (!isAllowedReaction(emoji)) continue;
    if (!Array.isArray(raw)) continue;

    const sides = [];
    for (const side of raw) {
      const n = Number(side);
      if (n !== 1 && n !== 2) continue;
      if (!sides.includes(n)) sides.push(n);
    }
    if (sides.length) out[emoji] = sides.sort();
  }
  return out;
}

/**
 * Press or un-press one emoji, returning a new object.
 *
 * Pressing what you already pressed takes it back — the same button both ways,
 * which is what every chat app has trained fingers to expect. An unknown emoji
 * changes nothing at all rather than inventing a key.
 */
export function toggleReactionSet(reactions, emoji, side) {
  const next = normaliseReactions(reactions);
  if (!isAllowedReaction(emoji)) return next;

  const n = Number(side) === 2 ? 2 : 1;
  const held = next[emoji] || [];

  if (held.includes(n)) {
    const rest = held.filter((s) => s !== n);
    if (rest.length) next[emoji] = rest;
    else delete next[emoji];
  } else {
    next[emoji] = [...held, n].sort();
  }
  return next;
}

/* ==========================================================================
   SEARCH
   --------------------------------------------------------------------------
   Over what the browser already holds, not the database. The room keeps the
   recent window in memory anyway, and searching that is instant and costs
   nobody a query. Older than the window is genuinely not searchable yet, and
   the UI says so rather than pretending the room is shorter than it is.
   ======================================================================== */

/**
 * Fold a string down to something two people's typing can match across.
 *
 * Case and accents both go: somebody searching "cafe" means the message that
 * says "café", and on a phone keyboard the accented one is the harder to
 * reproduce deliberately.
 */
export function foldForSearch(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The messages matching `query`, newest first.
 *
 * Unsent messages never match. Their body is empty in the database anyway, but
 * being explicit matters: a search that surfaced something somebody took back
 * would be a way of reading what they withdrew.
 */
export function searchMessages(messages, query) {
  const needle = foldForSearch(query);
  if (!needle) return [];

  const found = [];
  for (const message of messages || []) {
    if (!message || message.deleted_at) continue;
    if (foldForSearch(message.body).includes(needle)) found.push(message);
  }
  return found.reverse();
}

/**
 * Split a body around every occurrence of the query, for highlighting.
 *
 * Returns [{ text, hit }]. The slicing is done on the ORIGINAL string using
 * offsets found in the folded one, which only lines up because foldForSearch
 * never changes the length of what it folds — NFD-then-strip-marks and
 * lowercasing are both length-preserving for the text this handles, and
 * whitespace collapsing is the one that is not, so it is applied to the needle
 * and to `includes` but never used to index back into the original.
 */
export function highlight(body, query) {
  const text = String(body == null ? '' : body);
  const needle = foldForSearch(query);
  if (!needle) return [{ text, hit: false }];

  const hay = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  /* If folding changed the length, offsets cannot be trusted — show it plain
     rather than highlighting the wrong characters. */
  if (hay.length !== text.length) return [{ text, hit: false }];

  const parts = [];
  let at = 0;
  for (;;) {
    const found = hay.indexOf(needle, at);
    if (found < 0) break;
    if (found > at) parts.push({ text: text.slice(at, found), hit: false });
    parts.push({ text: text.slice(found, found + needle.length), hit: true });
    at = found + needle.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}

/**
 * The first message the reader has not seen, or null.
 *
 * "Not seen" means: newer than the last id this device marked read, and
 * written by the OTHER person. Your own messages are never unread — you were
 * there — and a divider that appeared above something you just sent from your
 * laptop would be nonsense on your phone.
 */
export function firstUnreadId(messages, lastReadId, side) {
  /* null and undefined are rejected before Number() sees them, because
     Number(null) is 0 — which would quietly mean "read nothing" and draw the
     line above the entire history the first time a corner is opened on a new
     phone. A device that has never marked anything read is treated as having
     seen it all; the caller passes an explicit 0 when it really means none. */
  if (lastReadId === null || lastReadId === undefined) return null;

  const floor = Number(lastReadId);
  if (!Number.isFinite(floor)) return null;

  for (const message of messages || []) {
    if (!message) continue;
    if (typeof message.id !== 'number' || message.id <= floor) continue;
    if (message.author === side) continue;
    return message.id;
  }
  return null;
}

/* ==========================================================================
   TICKS AND PRESENCE
   --------------------------------------------------------------------------
   This room used to draw ONE tick, with a comment saying a "seen" mark we
   could not honour would be a lie. That was correct at the time: nothing
   tracked whether anybody had read anything, so a second tick would have been
   decoration pretending to be information.

   So the way to earn the second tick was not to draw it — it was to start
   recording the two facts it stands for. The room polls every four seconds;
   each poll now says "I am here" and "I have read up to this id", and both
   sides can be told the truth:

     sending    in flight, not yet on the server
     sent       the server has it, the other side has not been back since
     delivered  their browser has fetched since this was written
     read       their read mark has passed this message

   "Delivered" is deliberately derived from presence rather than from a
   per-message receipt: one high-water mark per side is a single small write
   every four seconds, where per-message rows would be a write per message per
   reader. The claim it makes — "their browser has been here since you sent
   this" — is exactly what the data supports and no more.
   ========================================================================== */

/** Within this, the other person is treated as here rather than away. */
export const ONLINE_WINDOW_MS = 25 * 1000;

/**
 * Which tick to draw on one of YOUR messages.
 *
 * Never called for theirs — the state of your own reading is not information
 * you need drawn back at you.
 */
export function tickState(message, presence = {}) {
  if (!message) return 'sent';
  if (message.pending) return 'sending';

  const id = Number(message.id);
  const readUpto = Number(presence.readUpto);
  if (Number.isFinite(id) && Number.isFinite(readUpto) && readUpto >= id) return 'read';

  /* Their last visit, against when this was written. Both are needed: a
     browser that was here an hour before you typed proves nothing about this
     message. */
  const seen = presence.seenAt ? new Date(presence.seenAt).getTime() : NaN;
  const made = message.created_at ? new Date(message.created_at).getTime() : NaN;
  if (Number.isFinite(seen) && Number.isFinite(made) && seen >= made) return 'delivered';

  return 'sent';
}

/**
 * "online" / "last seen 6 minutes ago" / "" when we simply do not know.
 *
 * An empty string rather than "last seen never": the header shows nothing at
 * all until there is something true to say, which is better than telling
 * somebody their person has never once opened the room.
 */
export function lastSeenLabel(iso, now = Date.now()) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';

  const ago = now - then;
  if (ago < 0) return 'online';                 // clock skew, not the future
  if (ago <= ONLINE_WINDOW_MS) return 'online';

  const mins = Math.floor(ago / 60000);
  if (mins < 1) return 'last seen just now';
  if (mins === 1) return 'last seen a minute ago';
  if (mins < 60) return `last seen ${mins} minutes ago`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return 'last seen an hour ago';
  if (hours < 24) return `last seen ${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'last seen yesterday';
  return `last seen ${days} days ago`;
}

/**
 * Is the other person typing right now?
 *
 * `typing_at` is a moment, not a flag, and that is the whole design: a flag has
 * to be turned OFF, and the browser that would turn it off is exactly the one
 * that just got closed, lost signal, or went into a pocket. A stale flag leaves
 * somebody typing forever.
 *
 * A timestamp expires by itself. Nobody has to send "I stopped".
 */
export const TYPING_WINDOW_MS = 7 * 1000;

export function isTyping(typingAt, now = Date.now()) {
  if (!typingAt) return false;
  const at = new Date(typingAt).getTime();
  if (!Number.isFinite(at)) return false;
  /* A clock running ahead should not type into next week. */
  if (at > now + TYPING_WINDOW_MS) return false;
  return now - at <= TYPING_WINDOW_MS;
}
