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
export function buildRows(messages, now = new Date()) {
  const rows = [];
  let lastKey = '';

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    const key = dayKey(message.created_at);
    const startsDay = key !== lastKey;

    if (startsDay) {
      rows.push({ kind: 'date', key, label: dayLabel(message.created_at, now) });
      lastKey = key;
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
