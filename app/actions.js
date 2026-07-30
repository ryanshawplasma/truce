'use server';

import { customAlphabet } from 'nanoid';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { encodeCard } from '@/lib/codec';
import { siteOrigin } from '@/lib/site';
import { LIMITS, THEME_IDS, STYLE_IDS, STICKER_IDS, MAX_STICKERS, isValidReaction } from '@/lib/constants';

/**
 * Server actions. Everything the browser sends is untrusted: every field is
 * re-trimmed, re-length-checked and re-validated against an allowlist here,
 * regardless of what the client-side wizard already did.
 */

/* URL-safe, unambiguous alphabet (no "-" or "_" so links are easy to read out loud). */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makeId = customAlphabet(ALPHABET, 8);
const makeToken = customAlphabet(ALPHABET, 24);

/* ------------------------------------------------------------------ helpers */

function str(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim().slice(0, max);
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

  const to_name = str(input.to_name, LIMITS.name);
  const from_name = str(input.from_name, LIMITS.name);
  const message = str(input.message, LIMITS.message);

  if (!to_name) return { error: 'Please tell us who this card is for.' };
  if (!from_name) return { error: 'Please tell us who it is from.' };
  if (!message) return { error: 'Your card needs a message.' };

  const severityNumber = Number(input.severity);
  const severity = severityNumber === 1 || severityNumber === 2 || severityNumber === 3 ? severityNumber : 2;

  return {
    card: {
      occasion: 'sorry', // only occasion for now — see lib/occasions.js
      to_name,
      from_name,
      message,
      reason: str(input.reason, LIMITS.reason),
      promise: str(input.promise, LIMITS.promise),
      memory: str(input.memory, LIMITS.memory),
      style: oneOf(input.style, STYLE_IDS, 'sweet'),
      theme: oneOf(input.theme, THEME_IDS, 'blush'),
      stickers: cleanStickers(input.stickers),
      severity,
    },
  };
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

  const origin = await siteOrigin();

  /* No database configured — hand the card back in the URL. */
  if (!isSupabaseConfigured()) {
    return { ok: true, mode: 'hash', payload: encodeCard(card), origin };
  }

  const supabase = getSupabase();

  /* Short ids can collide (rarely). Retry a few times before giving up. */
  for (let attempt = 0; attempt < 4; attempt++) {
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
        cardUrl: `${origin}/c/${id}`,
        senderUrl: `${origin}/s/${edit_token}`,
      };
    }

    /* 23505 = unique violation: try another id. Anything else is a real error. */
    if (insertError.code !== '23505') {
      console.error('[truce] createCard insert failed:', insertError.message);
      /* Never lose someone's words: fall back to a self-contained link. */
      return { ok: true, mode: 'hash', payload: encodeCard(card), origin, degraded: true };
    }
  }

  return { ok: true, mode: 'hash', payload: encodeCard(card), origin, degraded: true };
}

/* -------------------------------------------------------------- markOpened */

/** Records the first time a recipient actually opened the card. */
export async function markOpened(id) {
  if (typeof id !== 'string' || !id || id === 'demo' || id === 'local') return { ok: true };
  const supabase = getSupabase();
  if (!supabase) return { ok: true };

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

  const { count, error: countError } = await supabase
    .from('reactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', id);

  if (countError) {
    console.error('[truce] reaction count failed:', countError.message);
    return { ok: false, error: 'Could not send that just now.' };
  }
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
  redirect('/?deleted=1');
}
