'use server';

import { customAlphabet } from 'nanoid';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { encodeCard } from '@/lib/codec';
import { siteOrigin } from '@/lib/site';
import { backoffMs, clientKey, sleep, take } from '@/lib/throttle';
import { tidyAndTruncate } from '@/lib/truncate';
import {
  LIMITS, THEME_IDS, STYLE_IDS, STICKER_IDS, MAX_STICKERS, isValidReaction, normaliseUnlockAt, isSealed,
} from '@/lib/constants';
import {
  OCCASION_IDS, DEFAULT_OCCASION, allowsRecipient, getOccasion, occasionSteps,
} from '@/lib/occasions';

/**
 * Server actions. Everything the browser sends is untrusted: every field is
 * re-trimmed, re-length-checked and re-validated against an allowlist here,
 * regardless of what the client-side wizard already did.
 */

/* URL-safe, unambiguous alphabet (no "-" or "_" so links are easy to read out loud). */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* Six characters = 62^6 ≈ 56 billion ids: short enough to text comfortably,
   long enough that guessing one is hopeless. Collisions are handled by
   retrying the insert (see createCard), and the eight-character ids handed out
   before this change keep working — nothing looks at the length. */
const ID_LENGTH = 6;
const makeId = customAlphabet(ALPHABET, ID_LENGTH);
const makeToken = customAlphabet(ALPHABET, 24);

/* ------------------------------------------------------------------ helpers */

/**
 * Trim + cap a field. Code-point safe: cutting a string mid-emoji leaves a lone
 * surrogate, which PostgREST rejects as invalid UTF-8 and which would take the
 * whole insert down with it. See lib/truncate.js.
 */
function str(value, max) {
  if (typeof value !== 'string') return '';
  return tidyAndTruncate(value, max);
}

/* --------------------------------------------------------------- throttles */

/**
 * Best-effort per-IP limits (in memory, per serverless instance — the honest
 * caveats are documented in lib/throttle.js). Card writing is cheap, so these
 * are generous: they exist to stop a script filling the table, not to police
 * anybody using the product normally.
 */
const RATE = {
  create: { limit: 10, windowMs: 60 * 1000 },   // new cards / minute
  react: { limit: 30, windowMs: 60 * 1000 },    // reactions / minute
  touch: { limit: 120, windowMs: 60 * 1000 },   // markOpened + setForgiven, loose
};

const BUSY = 'One sec 🤍 — that was a lot at once. Try again in a moment.';

/* --------------------------------------------------------------- seal check */

/**
 * Is this card still sealed?
 *
 * A time-capsule card has not really been opened, forgiven or reacted to until
 * its date arrives — the locked page never offers those buttons, but the server
 * is the only thing that can actually enforce it.
 *
 * Returns { sealed, failed }. A read failure is NOT treated as "not sealed":
 * callers do nothing rather than guess.
 */
async function sealState(supabase, id) {
  const { data, error } = await supabase.from('cards').select('unlock_at').eq('id', id).maybeSingle();
  if (error) {
    console.error('[truce] seal check failed:', error.message);
    return { sealed: false, failed: true };
  }
  if (!data) return { sealed: false, failed: true, missing: true };
  return { sealed: isSealed(data.unlock_at), failed: false };
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/** Keep only known sticker ids, drop duplicates, cap the count. */
function cleanStickers(value) {
  if (!Array.isArray(value)) return [];
  const seen = [];
  for (const id of value) {
    if (typeof id !== 'string') continue;
    if (!STICKER_IDS.includes(id)) continue;
    if (seen.includes(id)) continue;
    seen.push(id);
    if (seen.length >= MAX_STICKERS) break;
  }
  return seen;
}

/** Normalise + validate the wizard payload. Returns { card } or { error }. */
function validateCardInput(input) {
  if (!input || typeof input !== 'object') return { error: 'Nothing to save.' };

  /* Allowlist first: everything below is interpreted through the occasion, so
     an unknown one must never get as far as being stored. */
  const occasion = OCCASION_IDS.includes(input.occasion) ? input.occasion : DEFAULT_OCCASION;

  /* The recipient is not stored — it only ever picked which messages to show —
     but a proposal addressed to "Dad" means the browser sent us something the
     maker cannot produce, so we decline rather than quietly go along with it. */
  if (input.recipient && !allowsRecipient(occasion, input.recipient)) {
    return { error: 'That is not someone this kind of card can be sent to.' };
  }

  const to_name = str(input.to_name, LIMITS.name);
  const from_name = str(input.from_name, LIMITS.name);
  const message = str(input.message, LIMITS.message);

  if (!to_name) return { error: 'Please tell us who this card is for.' };
  if (!from_name) return { error: 'Please tell us who it is from.' };
  if (!message) return { error: 'Your card needs a message.' };

  /* Occasions that skip the severity question store the config default rather
     than whatever the client happened to send. */
  const asks = occasionSteps(occasion).includes('severity');
  const fallback = getOccasion(occasion).defaultSeverity || 2;
  const severityNumber = Number(input.severity);
  const severity = asks && [1, 2, 3].includes(severityNumber) ? severityNumber : fallback;

  /* Same rule for the question an occasion never asks: a birthday card has no
     "what happened", so it cannot arrive with one. */
  const reason = occasionSteps(occasion).includes('reason') ? str(input.reason, LIMITS.reason) : '';

  /* Time-capsule: never trust the browser's clock or its arithmetic. */
  const unlock = normaliseUnlockAt(input.unlock_at);
  if (unlock.error) return { error: unlock.error };

  return {
    card: {
      occasion, // one of OCCASION_IDS — see lib/occasions.js
      to_name,
      from_name,
      message,
      reason,
      promise: str(input.promise, LIMITS.promise),
      memory: str(input.memory, LIMITS.memory),
      style: oneOf(input.style, STYLE_IDS, 'sweet'),
      theme: oneOf(input.theme, THEME_IDS, 'blush'),
      stickers: cleanStickers(input.stickers),
      severity,
      unlock_at: unlock.iso,
    },
  };
}

/* ------------------------------------------------------- getCapabilities */

/**
 * What this deployment can actually do, asked at request time.
 *
 * The landing page is statically prerendered (it is marketing copy — it should
 * be instant), which means anything it reads from `process.env` is frozen at
 * build time. That is right almost always, because Vercel builds with the same
 * environment it runs with. This tiny action is the safety net for when it is
 * not: the wizard starts with the value baked into the page and quietly
 * corrects itself a moment later.
 *
 * It exposes one boolean and never the keys themselves.
 */
export async function getCapabilities() {
  return { db: isSupabaseConfigured() };
}

/* --------------------------------------------------------------- createCard */

/**
 * Creates a card.
 *  - with Supabase configured: inserts a row and returns real short links
 *  - without Supabase ("no-setup mode"): returns a base64 payload so the client
 *    can build a /c/local#c=… link that needs no backend at all
 */
export async function createCard(input) {
  const { card, error } = validateCardInput(input);
  if (error) return { ok: false, error };

  /* Generous, and only about stopping a script — see RATE above. */
  const gate = take('card:create', await clientKey(), RATE.create.limit, RATE.create.windowMs);
  if (!gate.ok) {
    await sleep(backoffMs(gate.strikes));
    return { ok: false, error: BUSY };
  }

  const origin = await siteOrigin();

  /* No database configured — hand the card back in the URL.
     A hash link carries the whole card inside it, so there is nothing to seal:
     drop the unlock date rather than pretending it does something. */
  if (!isSupabaseConfigured()) {
    return { ok: true, mode: 'hash', payload: encodeCard(card), origin, unlockDropped: Boolean(card.unlock_at) };
  }

  const supabase = getSupabase();

  /**
   * Two kinds of failure, handled differently:
   *
   *  - 23505, a unique violation, means the random id already exists. Rare, and
   *    the fix is simply another id — so we just go round again.
   *  - anything else is the database itself having a moment (a cold start, a
   *    dropped connection, a pooler hiccup). Those are usually over in a
   *    fraction of a second, so we wait 300ms and try once more before giving
   *    up on a short link.
   *
   * Whatever happens, the sender never loses their words: the fallback packs
   * the card into the link itself.
   */
  let realFailures = 0;

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeId();
    const edit_token = makeToken();

    const { error: insertError } = await supabase
      .from('cards')
      .insert({ id, edit_token, ...card });

    if (!insertError) {
      return {
        ok: true,
        mode: 'db',
        id,
        editToken: edit_token,
        unlockAt: card.unlock_at,
        cardUrl: `${origin}/c/${id}`,
        senderUrl: `${origin}/s/${edit_token}`,
      };
    }

    if (insertError.code === '23505') continue; // id clash — pick another

    realFailures += 1;
    /* Log the actual cause, so Vercel Logs answers "why did it degrade?". */
    console.error(
      `[truce] createCard insert failed (attempt ${realFailures}):`,
      JSON.stringify({
        code: insertError.code || null,
        message: insertError.message || null,
        details: insertError.details || null,
        hint: insertError.hint || null,
      }),
    );

    if (realFailures >= 2) break; // one retry was enough of a chance
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return degraded(card, origin);
}

/**
 * The safety net: the card travels inside its own link.
 * `degraded: true` tells the wizard to apologise for a wobble rather than to
 * talk about setting the site up — those are very different messages.
 */
function degraded(card, origin) {
  return {
    ok: true,
    mode: 'hash',
    payload: encodeCard(card),
    origin,
    degraded: true,
    unlockDropped: Boolean(card.unlock_at),
  };
}

/* -------------------------------------------------------------- markOpened */

/** Records the first time a recipient actually opened the card. */
export async function markOpened(id) {
  if (typeof id !== 'string' || !id || id === 'demo' || id === 'local') return { ok: true };
  const supabase = getSupabase();
  if (!supabase) return { ok: true };

  if (!take('card:touch', await clientKey(), RATE.touch.limit, RATE.touch.windowMs).ok) {
    return { ok: true, throttled: true }; // silent: this is telemetry, not an action
  }

  /* A sealed time-capsule has not been opened, however many times the link is
     tapped — the sender should not see "opened" before their own date. The
     locked page never calls this, but the check belongs on the server.

     If the read itself fails we do NOTHING. Recording "opened" on the strength
     of a failed lookup would be worse than missing the event entirely. */
  const seal = await sealState(supabase, id);
  if (seal.failed) return { ok: false, unknown: true };
  if (seal.sealed) return { ok: true, sealed: true };

  const { error } = await supabase
    .from('cards')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', id)
    .is('opened_at', null);

  if (error) console.error('[truce] markOpened failed:', error.message);
  return { ok: !error };
}

/* -------------------------------------------------------------- setForgiven */

/** Records the moment they tapped "Yes". Only ever set once. */
export async function setForgiven(id) {
  if (typeof id !== 'string' || !id || id === 'demo' || id === 'local') return { ok: true };
  const supabase = getSupabase();
  if (!supabase) return { ok: true };

  if (!take('card:touch', await clientKey(), RATE.touch.limit, RATE.touch.windowMs).ok) {
    return { ok: true, throttled: true };
  }

  /* Same rule as markOpened: nothing can be forgiven before it can be read. */
  const seal = await sealState(supabase, id);
  if (seal.failed) return { ok: false, unknown: true };
  if (seal.sealed) return { ok: true, sealed: true };

  const { error } = await supabase
    .from('cards')
    .update({ forgiven_at: new Date().toISOString() })
    .eq('id', id)
    .is('forgiven_at', null);

  if (error) console.error('[truce] setForgiven failed:', error.message);
  return { ok: !error };
}

/* -------------------------------------------------------------- addReaction */

/**
 * Saves one reaction from the recipient — either an allow-listed emoji or
 * "sticker:<known id>". Allowlist plus a per-card cap.
 */
export async function addReaction(id, emoji) {
  if (!isValidReaction(emoji)) return { ok: false, error: 'That reaction is not on the list.' };
  if (typeof id !== 'string' || !id || id === 'demo' || id === 'local') return { ok: true, mode: 'demo' };

  const supabase = getSupabase();
  if (!supabase) return { ok: true, mode: 'demo' };

  const gate = take('card:react', await clientKey(), RATE.react.limit, RATE.react.windowMs);
  if (!gate.ok) {
    await sleep(backoffMs(gate.strikes));
    return { ok: false, error: BUSY };
  }

  /* A sealed card cannot be reacted to — its words have not been handed over
     yet, so there is nothing to react to. */
  const seal = await sealState(supabase, id);
  if (seal.failed) return { ok: false, error: 'Could not send that just now.' };
  if (seal.sealed) return { ok: false, error: 'This letter has not opened yet 🕰️' };

  const { count, error: countError } = await supabase
    .from('reactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', id);

  if (countError) {
    console.error('[truce] reaction count failed:', countError.message);
    return { ok: false, error: 'Could not send that just now.' };
  }
  /* Count-then-insert is a check-then-act race: two reactions arriving together
     can both see 49 and both insert. The overshoot is at most a handful of rows
     and entirely harmless — enforcing it exactly would need a database-side
     constraint or a transaction, which is not worth it for a politeness cap. */
  if ((count || 0) >= LIMITS.reactionsPerCard) {
    return { ok: false, error: 'This card has received plenty of love already 🤍' };
  }

  const { error } = await supabase.from('reactions').insert({ card_id: id, emoji });
  if (error) {
    console.error('[truce] addReaction failed:', error.message);
    return { ok: false, error: 'Could not send that just now.' };
  }
  return { ok: true };
}

/* --------------------------------------------------------------- deleteCard */

/** Deletes a card (and its reactions, via ON DELETE CASCADE) by sender token. */
export async function deleteCard(editToken) {
  if (typeof editToken !== 'string' || !editToken) return { ok: false, error: 'Missing token.' };

  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'No database configured.' };

  const { error } = await supabase.from('cards').delete().eq('edit_token', editToken);
  if (error) {
    console.error('[truce] deleteCard failed:', error.message);
    return { ok: false, error: 'Could not delete that card.' };
  }

  revalidatePath(`/s/${editToken}`);
  /* Land somewhere that actually acknowledges the deletion. The private page
     they were on no longer exists, and the landing page has no idea what
     ?deleted=1 means — /mine reads it and says so. */
  redirect('/mine?deleted=1');
}
