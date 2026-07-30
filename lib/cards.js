import 'server-only';
import { cache } from 'react';
import { getSupabase } from './supabase';
import { SAMPLE_CARD } from './constants';

/**
 * Read helpers for server components. (Writes live in app/actions.js.)
 * Every function tolerates a missing database and simply returns null.
 */

/** Fetch one card by its public short id.
 *  Wrapped in React's cache() so generateMetadata and the page itself share a
 *  single database round-trip per request. */
export const getCardById = cache(async function getCardById(id) {
  if (id === 'demo') return SAMPLE_CARD;
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('cards')
    .select('id, occasion, to_name, from_name, message, reason, promise, memory, style, theme, severity, stickers, created_at, opened_at, forgiven_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[truce] getCardById failed:', error.message);
    return null;
  }
  return data || null;
});

/** Fetch a card plus its reactions using the sender's private edit token. */
export async function getCardByToken(token) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('edit_token', token)
    .maybeSingle();

  if (error) {
    console.error('[truce] getCardByToken failed:', error.message);
    return null;
  }
  if (!data) return null;

  const { data: reactions, error: rErr } = await supabase
    .from('reactions')
    .select('id, emoji, created_at')
    .eq('card_id', data.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (rErr) console.error('[truce] reactions fetch failed:', rErr.message);
  return { card: data, reactions: reactions || [] };
}
