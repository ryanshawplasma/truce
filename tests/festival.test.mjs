import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FESTIVALS,
  festivalDate,
  isFestivalOpen,
  isThemeOfferable,
  lastPlannedYear,
  openFestivalThemes,
} = await import('../lib/festival.js');
const { THEME_IDS } = await import('../lib/constants.js');

/**
 * The cruellest possible bug in this product would be a seasonal theme that
 * expires on a card somebody already sent. Most of these exist to hold the line
 * between "offered" and "rendered".
 */

const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

/* -- the window ------------------------------------------------------------ */

test('the theme is offered on the day itself', () => {
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 28)), true);
});

test('it opens well before, because people write ahead', () => {
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 20)), true);
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 17)), true);
});

test('it stays open the day after, and closes soon after that', () => {
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 29)), true);
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 30)), true);
  assert.equal(isFestivalOpen('rakhi', day(2026, 9, 5)), false);
});

test('it is shut the rest of the year', () => {
  assert.equal(isFestivalOpen('rakhi', day(2026, 1, 15)), false);
  assert.equal(isFestivalOpen('rakhi', day(2026, 6, 1)), false);
  assert.equal(isFestivalOpen('rakhi', day(2026, 12, 25)), false);
});

test('each year uses its own date, not last year’s', () => {
  /* A lunar festival moves. 9 August is the 2025 date and is nowhere near the
     2026 one, so a hardcoded month-and-day would be wrong by nineteen days. */
  assert.equal(isFestivalOpen('rakhi', day(2025, 8, 9)), true);
  assert.equal(isFestivalOpen('rakhi', day(2026, 8, 9)), false);
});

test('a year nobody has written down offers nothing rather than guessing', () => {
  assert.equal(festivalDate('rakhi', 2099), null);
  assert.equal(isFestivalOpen('rakhi', day(2099, 8, 28)), false);
});

test('an unknown festival is simply closed', () => {
  assert.equal(isFestivalOpen('diwali', day(2026, 11, 8)), false);
  assert.equal(festivalDate('nope', 2026), null);
});

/* -- offered vs rendered --------------------------------------------------- */

test('an ordinary theme is always offerable', () => {
  for (const id of ['blush', 'sky', 'midnight']) {
    assert.equal(isThemeOfferable(id, day(2026, 1, 1)), true);
  }
});

test('the seasonal theme is only offerable inside its window', () => {
  assert.equal(isThemeOfferable('rakhi', day(2026, 8, 28)), true);
  assert.equal(isThemeOfferable('rakhi', day(2026, 3, 3)), false);
});

test('the seasonal theme still EXISTS all year', () => {
  /* The whole point. A card made on the day has to keep its look forever — in
     the room, in the keepsake, in the share preview. Only the picker is
     seasonal; the theme itself never expires. */
  assert.ok(THEME_IDS.includes('rakhi'));
});

/* -- the table ------------------------------------------------------------- */

test('every festival points at a theme that exists', () => {
  for (const f of Object.values(FESTIVALS)) {
    assert.ok(THEME_IDS.includes(f.theme), `festival "${f.id}" points at a missing theme`);
  }
});

test('the dates are plausible calendar dates', () => {
  for (const f of Object.values(FESTIVALS)) {
    for (const [year, [y, m, d]] of Object.entries(f.dates)) {
      assert.equal(y, Number(year), `${f.id} ${year} disagrees with its own key`);
      assert.ok(m >= 1 && m <= 12, `${f.id} ${year} has month ${m}`);
      assert.ok(d >= 1 && d <= 31, `${f.id} ${year} has day ${d}`);
    }
  }
});

test('the calendar has not run out', () => {
  /* Fails loudly the year nobody adds the next date, instead of the theme
     quietly never appearing again and nobody noticing until someone asks. */
  const planned = lastPlannedYear('rakhi');
  const thisYear = new Date().getFullYear();
  assert.ok(
    planned >= thisYear,
    `rakhi dates stop at ${planned}; add ${thisYear} and the next few to lib/festival.js`,
  );
});

test('openFestivalThemes lists what is on right now', () => {
  assert.deepEqual(openFestivalThemes(day(2026, 8, 28)), ['rakhi']);
  assert.deepEqual(openFestivalThemes(day(2026, 3, 3)), []);
});
