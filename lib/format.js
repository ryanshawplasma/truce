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
