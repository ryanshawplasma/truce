/**
 * Seasonal themes — a look that is only offered for a little while.
 *
 * THE RULE THAT MATTERS
 * ---------------------
 * A seasonal theme is *offered* for a window. It is *rendered* forever.
 *
 * Those are different questions and conflating them would be the cruellest
 * possible bug in this product: a rakhi card made on the day would quietly
 * turn into a generic pink one a fortnight later, on somebody's keepsake, in
 * their share preview, in the card they saved to remember the day by. So the
 * theme lives in THEMES permanently and only the picker asks this file.
 *
 * WHY THE DATES ARE A TABLE
 * -------------------------
 * Raksha Bandhan is Shravana Purnima — a full moon in a lunar calendar, which
 * lands on a different Gregorian date every year and cannot be computed from a
 * simple rule. So it is written down, one line a year, and a year that is not
 * in the table simply does not offer the theme rather than guessing a date and
 * being confidently wrong by a week.
 *
 * ADD THE NEXT YEAR HERE. There is a test that fails once the table runs out,
 * so this stops being offered loudly rather than silently.
 */

/** Local dates, as Y-M-D. Month is 1-based, the way a human writes it. */
export const FESTIVALS = {
  rakhi: {
    id: 'rakhi',
    theme: 'rakhi',
    label: 'Rakhi',
    /* Shravana Purnima. Verify each new entry against a panchang before adding
       it — being a day out on the actual day is worse than not shipping it. */
    dates: {
      2025: [2025, 8, 9],
      2026: [2026, 8, 28],
      2027: [2027, 8, 17],
    },
    /* Generous on purpose. People buy and write ahead, the festival runs into
       the evening, and this has to behave the same for somebody in Auckland
       and somebody in California without either of them seeing it vanish on
       the day itself. */
    opensDaysBefore: 12,
    closesDaysAfter: 2,
  },
};

const DAY = 24 * 60 * 60 * 1000;

/** Local midnight for a [y, m, d] triple. */
function midnight([y, m, d]) {
  return new Date(y, m - 1, d).getTime();
}

/**
 * When this festival falls in a given year, or null if nobody has written it
 * down yet.
 */
export function festivalDate(id, year) {
  const festival = FESTIVALS[id];
  if (!festival) return null;
  const entry = festival.dates[year];
  return entry ? midnight(entry) : null;
}

/**
 * Is the theme currently on offer?
 *
 * Checks this year and last, because the window can reach backwards across a
 * new year — and checking only `getFullYear()` would close it early for a
 * festival whose tail crosses midnight on the 31st. Rakhi is an August
 * festival so that cannot happen today, but the next one added might not be.
 */
export function isFestivalOpen(id, now = Date.now()) {
  const festival = FESTIVALS[id];
  if (!festival) return false;

  const year = new Date(now).getFullYear();
  for (const candidate of [year, year - 1]) {
    const day = festivalDate(id, candidate);
    if (day === null) continue;
    const opens = day - festival.opensDaysBefore * DAY;
    const closes = day + (festival.closesDaysAfter + 1) * DAY; // inclusive of the last day
    if (now >= opens && now < closes) return true;
  }
  return false;
}

/** Every seasonal theme id that is open right now. */
export function openFestivalThemes(now = Date.now()) {
  return Object.values(FESTIVALS)
    .filter((f) => isFestivalOpen(f.id, now))
    .map((f) => f.theme);
}

/**
 * Should this theme appear in the picker?
 *
 * Everything that is not seasonal always does. A seasonal one does only inside
 * its window — but see the note at the top: this decides what is OFFERED, and
 * never what is rendered.
 */
export function isThemeOfferable(themeId, now = Date.now()) {
  const seasonal = Object.values(FESTIVALS).find((f) => f.theme === themeId);
  if (!seasonal) return true;
  return isFestivalOpen(seasonal.id, now);
}

/** The last year anybody has written a date down for. */
export function lastPlannedYear(id) {
  const festival = FESTIVALS[id];
  if (!festival) return null;
  const years = Object.keys(festival.dates).map(Number);
  return years.length ? Math.max(...years) : null;
}
