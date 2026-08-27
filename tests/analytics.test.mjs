import test from 'node:test';
import assert from 'node:assert/strict';

const {
  bucketByMonth,
  countBy,
  humanDuration,
  median,
  monthKey,
  monthLabel,
  openDelays,
  rate,
  recentMonths,
} = await import('../lib/analytics.js');

/**
 * Numbers on a dashboard are believed. That is the whole risk: nobody
 * cross-checks a chart, so a bucketing bug is not noticed, it is acted on.
 * Most of these are about month boundaries, which is the only place any of
 * this is interesting and the one place it is easy to get wrong.
 */

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

/* -- keys and labels -------------------------------------------------------- */

test('a month key is sortable', () => {
  assert.equal(monthKey(new Date(2026, 6, 15)), '2026-07');
  /* Zero-padded, or "2026-9" sorts after "2026-10". */
  assert.equal(monthKey(new Date(2026, 8, 1)), '2026-09');
});

test('an unparseable date has no month', () => {
  for (const bad of ['whenever', '', null, undefined, {}]) {
    assert.equal(monthKey(bad), null);
  }
});

test('a label reads as a month', () => {
  assert.equal(monthLabel('2026-07'), 'Jul 2026');
  assert.equal(monthLabel('2026-01'), 'Jan 2026');
});

test('a nonsense key labels as nothing rather than "undefined 2026"', () => {
  for (const bad of ['2026-13', '2026-00', 'x', '', null, undefined]) {
    assert.equal(monthLabel(bad), '');
  }
});

/* -- the run of months ------------------------------------------------------ */

test('the months run oldest first and include this one', () => {
  const months = recentMonths(3, new Date(2026, 6, 15).getTime());
  assert.deepEqual(months, ['2026-05', '2026-06', '2026-07']);
});

test('the run crosses a year end', () => {
  const months = recentMonths(3, new Date(2026, 0, 10).getTime());
  assert.deepEqual(months, ['2025-11', '2025-12', '2026-01']);
});

test('asking on the 31st does not skip February', () => {
  /* Walking back a month from 31 March lands on 31 February, which JavaScript
     helpfully rolls forward into March — so February vanishes from the chart.
     Pinning to the 1st first is the fix, and this is the test that proves it. */
  const months = recentMonths(4, new Date(2026, 2, 31).getTime());
  assert.deepEqual(months, ['2025-12', '2026-01', '2026-02', '2026-03']);
});

/* -- bucketing -------------------------------------------------------------- */

const now = new Date(2026, 6, 15).getTime();

test('cards land in the month they were made', () => {
  const rows = [
    { created_at: at(2026, 7, 2) },
    { created_at: at(2026, 7, 20) },
    { created_at: at(2026, 6, 9) },
  ];
  const months = bucketByMonth(rows, { months: 3, now });
  assert.equal(months.find((m) => m.key === '2026-07').made, 2);
  assert.equal(months.find((m) => m.key === '2026-06').made, 1);
});

test('a card made in one month and opened in the next counts in both, separately', () => {
  /* The case that makes a naive implementation report an open rate over 100%
     for one month and under for the other. */
  const rows = [{ created_at: at(2026, 6, 28), opened_at: at(2026, 7, 3) }];
  const months = bucketByMonth(rows, { months: 3, now });

  const june = months.find((m) => m.key === '2026-06');
  const july = months.find((m) => m.key === '2026-07');

  assert.equal(june.made, 1);
  assert.equal(june.opened, 0);
  assert.equal(july.made, 0);
  assert.equal(july.opened, 1);
});

test('rows outside the window are ignored rather than piled onto the edge', () => {
  const rows = [{ created_at: at(2020, 1, 1) }, { created_at: at(2026, 7, 1) }];
  const months = bucketByMonth(rows, { months: 3, now });
  assert.equal(months.reduce((n, m) => n + m.made, 0), 1);
});

test('every month is present even with no data at all', () => {
  /* A chart with gaps in it is a chart that lies about the shape of a trend. */
  const months = bucketByMonth([], { months: 6, now });
  assert.equal(months.length, 6);
  assert.ok(months.every((m) => m.made === 0 && m.opened === 0 && m.label));
});

test('junk rows do not throw', () => {
  const months = bucketByMonth([null, undefined, {}, { created_at: 'soon' }], { months: 3, now });
  assert.equal(months.reduce((n, m) => n + m.made, 0), 0);
});

/* -- the small stuff -------------------------------------------------------- */

test('counting by a column', () => {
  const rows = [{ occasion: 'sorry' }, { occasion: 'sorry' }, { occasion: 'birthday' }, {}];
  assert.deepEqual(countBy(rows, 'occasion'), { sorry: 2, birthday: 1 });
});

test('a rate is a whole percentage and never NaN', () => {
  assert.equal(rate(1, 4), 25);
  /* Day one, nothing made yet. "NaN%" on an empty dashboard is worse than 0. */
  assert.equal(rate(0, 0), 0);
  assert.equal(rate(5, 0), 0);
  assert.equal(rate('x', 10), 0);
});

test('the median is the middle, not the mean', () => {
  /* One card opened eight months late must not move "how long it usually
     takes" at all. A mean would be dragged into uselessness by it. */
  assert.equal(median([1, 2, 3, 4, 1000000]), 3);
  assert.equal(median([2, 4]), 3);
  assert.equal(median([]), null);
  assert.equal(median([1, 'x', NaN, 3]), 2);
});

test('open delays skip unopened cards and time travel', () => {
  const rows = [
    { created_at: at(2026, 7, 1), opened_at: at(2026, 7, 2) },
    { created_at: at(2026, 7, 1) },
    { created_at: at(2026, 7, 5), opened_at: at(2026, 7, 1) },
  ];
  const delays = openDelays(rows);
  assert.equal(delays.length, 1);
  assert.equal(delays[0], 24 * 60 * 60 * 1000);
});

test('a duration reads as one unit', () => {
  assert.equal(humanDuration(30 * 1000), 'under a minute');
  assert.equal(humanDuration(60 * 1000), '1 minute');
  assert.equal(humanDuration(20 * 60 * 1000), '20 minutes');
  assert.equal(humanDuration(3 * 60 * 60 * 1000), '3 hours');
  assert.equal(humanDuration(3 * 24 * 60 * 60 * 1000), '3 days');
});

test('an unknown duration is a dash, not "NaN days"', () => {
  for (const bad of [null, undefined, NaN, Infinity, -5, 'soon']) {
    assert.equal(humanDuration(bad), '—');
  }
});
