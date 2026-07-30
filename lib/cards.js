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
    .select(
      'id, occasion, to_name, from_name, message, reason, promise, memory, style, theme, ' +
        'severity, stickers, unlock_at, created_at, opened_at, forgiven_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[truce] getCardById failed:', error.message);
    return null;
  }
  return data || null;
});

/** Reactions already sent for a card, oldest first.
 *  Used by the card page so a returning recipient still sees what they sent. */
export async function getReactionsByCardId(id) {
  if (!id || id === 'demo' || id === 'local') return [];
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('reactions')
    .select('id, emoji, created_at')
    .eq('card_id', id)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[truce] getReactionsByCardId failed:', error.message);
    return [];
  }
  return data || [];
}

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

/* ==========================================================================
   Admin stats — powers /dev
   --------------------------------------------------------------------------
   PRIVACY: this deliberately reads counts and ids only. Message text, names,
   promises and memories are never selected here, so the stats page cannot leak
   what anybody actually wrote.
   ========================================================================== */

/** One `count: exact, head: true` query, reduced to a number. */
async function countRows(build) {
  const { count, error } = await build();
  if (error) {
    console.error('[truce] stats count failed:', error.message);
    return null;
  }
  return count || 0;
}

/**
 * Totals plus the ten most recent cards.
 * Returns null when there is no database configured.
 */
export async function getAdminStats() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [cards, opened, forgiven, reactions, lastWeek] = await Promise.all([
    countRows(() => supabase.from('cards').select('id', { count: 'exact', head: true })),
    countRows(() =>
      supabase.from('cards').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null),
    ),
    countRows(() =>
      supabase.from('cards').select('id', { count: 'exact', head: true }).not('forgiven_at', 'is', null),
    ),
    countRows(() => supabase.from('reactions').select('id', { count: 'exact', head: true })),
    countRows(() =>
      supabase.from('cards').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ),
  ]);

  const { data: recent, error } = await supabase
    .from('cards')
    .select('id, occasion, created_at, opened_at, forgiven_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) console.error('[truce] recent cards failed:', error.message);

  return {
    cards,
    opened,
    forgiven,
    reactions,
    lastWeek,
    recent: recent || [],
    /* True when at least one query came back broken — the page says so rather
       than quietly showing zeroes. */
    partial: [cards, opened, forgiven, reactions, lastWeek].some((v) => v === null) || Boolean(error),
  };
}
