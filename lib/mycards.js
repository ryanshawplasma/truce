/**
 * Device memory — the small list of cards made in *this* browser.
 *
 * Why it exists: a sender gets two links. The public /c/<id> one they send,
 * and the private /s/<token> one that shows opens, forgiveness and reactions.
 * People close the tab and lose the private one. This keeps a copy on the
 * device so /mine can hand it back.
 *
 * Rules this module lives by:
 *  - Browser only. Every function is a no-op during server rendering.
 *  - Storage may be missing, full, or blocked (private mode, "block cookies",
 *    iframes with a locked-down sandbox). Every single access is wrapped, and
 *    every failure is silent — the app must behave perfectly without it.
 *  - Two kinds of entry. A database card stores its id + private edit token.
 *    A hash-mode card (/c/local#c=…) has neither — the card rides inside the
 *    link — so the finished URL itself is what gets stored. Without that, a
 *    refresh of the success screen destroyed the only copy in existence.
 *
 * Privacy note: this never leaves the device. The edit tokens stored here are
 * the visitor's own tokens, held in their own browser, and are never sent
 * anywhere except back to Truce when they open their private page.
 */

export const MY_CARDS_KEY = 'truce.mycards';

/** Keep the list small and tidy — a phone browser does not need more. */
const MAX_ENTRIES = 50;

/**
 * Can we actually use localStorage right now?
 * Feature-detected by writing, because Safari private mode used to expose the
 * API and then throw on the first setItem.
 */
export function storageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__truce_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/* A stored link must be a real http(s) URL before it ever reaches an href. */
function safeUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim().slice(0, 8000);
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

/** Coerce whatever is in storage into an entry we trust, or null. */
function normalise(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const toName = typeof raw.toName === 'string' ? raw.toName.slice(0, 40) : '';
  const createdAt =
    typeof raw.createdAt === 'string' && !Number.isNaN(new Date(raw.createdAt).getTime())
      ? raw.createdAt
      : new Date().toISOString();

  /**
   * Hash-mode cards ("no-setup mode", or a database wobble).
   *
   * These have no row and no id — the whole card rides inside the link. They
   * used to be skipped entirely, which meant refreshing the success screen lost
   * the only copy of the link that had ever existed. So we keep the finished
   * URL itself. There is no private page for these: nothing is being tracked.
   */
  if (raw.kind === 'hash') {
    const url = safeUrl(raw.url);
    if (!url) return null;
    /* Identity for de-duplication. The fragment already uniquely describes the
       card, so no digest is needed. */
    const fragment = url.split('#c=')[1] || url;
    return { kind: 'hash', id: `hash:${fragment.slice(0, 48)}`, url, toName, createdAt, unlockAt: null };
  }

  const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 64) : '';
  const editToken = typeof raw.editToken === 'string' ? raw.editToken.trim().slice(0, 128) : '';
  if (!id || !editToken) return null;

  /* Optional: set only for time-capsule cards, so /mine can show the 🕰️ badge
     without asking the server anything. */
  const unlockAt =
    typeof raw.unlockAt === 'string' && !Number.isNaN(new Date(raw.unlockAt).getTime())
      ? raw.unlockAt
      : null;

  return { kind: 'db', id, editToken, toName, createdAt, unlockAt };
}

/**
 * Every card this device remembers, newest first.
 * Returns [] on any problem — a corrupt value is treated as "nothing saved".
 */
export function readMyCards() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(MY_CARDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const list = [];
    for (const item of parsed) {
      const entry = normalise(item);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      list.push(entry);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Remember a freshly created card. Newest wins on a repeated id.
 * Returns true when it was written, false when storage refused — callers
 * should not change what they show either way.
 */
export function rememberCard(entry) {
  try {
    const clean = normalise(entry);
    if (!clean) return false;
    if (typeof window === 'undefined' || !window.localStorage) return false;

    const next = [clean, ...readMyCards().filter((c) => c.id !== clean.id)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(MY_CARDS_KEY, JSON.stringify(next));
    return true;
  } catch {
    /* Quota exceeded, storage disabled, serialisation trouble — never fatal. */
    return false;
  }
}

/** The stored entry for this card id, or null. */
export function findMyCard(id) {
  if (!id) return null;
  try {
    return readMyCards().find((c) => c.id === id) || null;
  } catch {
    return null;
  }
}
