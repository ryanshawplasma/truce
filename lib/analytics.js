/**
 * Turning rows of timestamps into something you can look at.
 *
 * Everything here is pure and takes `now` as an argument, because the answer to
 * "which month is this" depends on when you ask and a function that reads the
 * clock itself cannot be tested at a month boundary — which is the only place
 * any of this is interesting.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH
 * -----------------------------------
 * Anything anybody wrote. The queries that feed this select timestamps, an
 * occasion and a theme, and nothing else — no names, no messages, no ids that
 * lead anywhere. A stats page is not a reason to hold a copy of everybody's
 * apologies in memory.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07" — sortable, and stable across timezones because it is built from
 *  the same Date the label is. */
export function monthKey(date) {
  /* Checked before Date sees it, because new Date(null) is not an invalid date
     — it is the epoch. A row with a null timestamp was being filed under
     January 1970, which is outside every window this draws and so would have
     silently vanished from the chart rather than showing up as a problem. */
  if (date === null || date === undefined || date === '') return null;

  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "Jul 2026" */
export function monthLabel(key) {
  if (typeof key !== 'string') return '';
  const [year, month] = key.split('-');
  const index = Number(month) - 1;
  if (!MONTHS[index]) return '';
  return `${MONTHS[index]} ${year}`;
}

/**
 * The last `count` months, oldest first, including the one we are in.
 *
 * Built by walking a Date backwards rather than subtracting 30 days at a time,
 * so February does not quietly go missing and a 31st does not skip a month.
 */
export function recentMonths(count = 12, now = Date.now()) {
  const out = [];
  const cursor = new Date(now);
  cursor.setDate(1); // or the 31st of a month rolls into the next one
  for (let i = 0; i < count; i += 1) {
    out.unshift(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return out;
}

/**
 * Count rows into months.
 *
 * `made` counts by created_at, `opened` by opened_at — deliberately separate,
 * because a card made in June and opened in July belongs to June's "made" and
 * July's "opened". Adding them to the same bucket would make the open rate of
 * a month look wrong in whichever direction the boundary fell.
 */
export function bucketByMonth(rows, { months = 12, now = Date.now() } = {}) {
  const keys = recentMonths(months, now);
  const index = new Map(keys.map((key) => [key, { key, label: monthLabel(key), made: 0, opened: 0 }]));

  for (const row of rows || []) {
    if (!row) continue;

    const madeKey = monthKey(row.created_at);
    if (madeKey && index.has(madeKey)) index.get(madeKey).made += 1;

    if (row.opened_at) {
      const openedKey = monthKey(row.opened_at);
      if (openedKey && index.has(openedKey)) index.get(openedKey).opened += 1;
    }
  }

  return keys.map((key) => index.get(key));
}

/** How many of each value, for a column with only a handful of them. */
export function countBy(rows, field) {
  const out = {};
  for (const row of rows || []) {
    if (!row) continue;
    const value = row[field];
    if (!value) continue;
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

/**
 * Percentage, as a whole number, and 0 rather than NaN when nothing happened.
 *
 * A stats page that says "NaN%" on its first day is worse than one that says
 * nothing, and the first day is the day somebody is most likely to look.
 */
export function rate(part, whole) {
  const p = Number(part);
  const w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return 0;
  return Math.round((p / w) * 100);
}

/**
 * The middle value, not the average.
 *
 * One card opened eight months late drags a mean into uselessness, and "how
 * long does it usually take" is the actual question.
 */
export function median(values) {
  const sorted = (values || []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** How long each opened card sat unopened, in ms. Unopened cards are absent. */
export function openDelays(rows) {
  const out = [];
  for (const row of rows || []) {
    if (!row || !row.created_at || !row.opened_at) continue;
    const made = new Date(row.created_at).getTime();
    const opened = new Date(row.opened_at).getTime();
    if (!Number.isFinite(made) || !Number.isFinite(opened)) continue;
    /* Clock skew can put "opened" before "made". Not evidence of time travel,
       and not something to average in as a negative. */
    if (opened < made) continue;
    out.push(opened - made);
  }
  return out;
}

/** "3 days", "4 hours", "12 minutes" — a duration, at one unit of precision. */
export function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';

  /* Tested against the raw milliseconds, not against the rounded minutes:
     Math.round turns thirty seconds into 1 before the "under a minute" check
     ever runs, so the shortest possible answer was unreachable. */
  if (ms < 60000) return 'under a minute';

  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
