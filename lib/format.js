/**
 * Tiny formatting helpers. Pure functions — safe on the server or the client.
 */

/** "just now", "12 minutes ago", "3 days ago". */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return 'just now';

  const units = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ];

  let label = 'minute';
  let value = 1;
  for (const [unit, secondsPer] of units) {
    const amount = Math.floor(seconds / secondsPer);
    if (amount < 1) break;
    label = unit;
    value = amount;
  }
  return `${value} ${label}${value === 1 ? '' : 's'} ago`;
}

/** "29 Jul 2026, 14:05" — stable, unambiguous, no locale surprises. */
export function absoluteTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC';
}

/**
 * "Friday 25 December 2026 at 09:00" — in the reader's OWN timezone.
 *
 * Only ever call this on the client (inside an effect or after mount): the
 * server has a different clock setting, and rendering it during SSR would
 * produce a hydration mismatch. `absoluteTime` above is the stable, shared
 * version and is safe anywhere.
 */
export function friendlyDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return absoluteTime(iso);
  }
}

/** Whole days between two dates, for the "Day 412 together" counter. */
export function daysBetween(fromIso, now = Date.now()) {
  if (!fromIso) return null;
  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) return null;
  return Math.floor((now - start) / 86400000);
}
