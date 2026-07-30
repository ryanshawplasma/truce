/**
 * "No-setup mode" codec.
 *
 * When Supabase is not configured, a card has nowhere to live — so we put the
 * whole card in the URL fragment instead: /c/local#c=<base64>. The fragment is
 * never sent to the server, so this works with zero backend.
 *
 * Compact keys keep the link short. This is the same encoding the standalone
 * single-file version of Truce used, so old links keep working.
 */

/* --- isomorphic base64 (Buffer on the server, btoa/atob in the browser) --- */
function b64encode(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(str)));
}

function b64decode(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(str)));
}

/** Full card row -> compact payload object. */
export function toPayload(card) {
  const d = {
    v: 1,
    to: card.to_name || '',
    fr: card.from_name || '',
    sv: card.severity || 2,
    ms: card.message || '',
    th: card.theme || 'blush',
    st: card.style || 'sweet',
  };
  if (card.reason) d.rs = card.reason;
  if (card.promise) d.pr = card.promise;
  if (card.memory) d.mm = card.memory;
  if (Array.isArray(card.stickers) && card.stickers.length) d.sk = card.stickers;
  return d;
}

/** Compact payload object -> the card shape the UI expects. */
export function fromPayload(d) {
  if (!d || typeof d !== 'object' || !d.to) return null;
  return {
    id: 'local',
    occasion: 'sorry',
    to_name: String(d.to),
    from_name: String(d.fr || ''),
    severity: d.sv === 1 || d.sv === 2 || d.sv === 3 ? d.sv : 2,
    message: String(d.ms || ''),
    theme: String(d.th || 'blush'),
    style: String(d.st || 'sweet'),
    reason: d.rs ? String(d.rs) : '',
    promise: d.pr ? String(d.pr) : '',
    memory: d.mm ? String(d.mm) : '',
    /* Links made before stickers existed simply have no `sk` field. */
    stickers: Array.isArray(d.sk) ? d.sk.filter((x) => typeof x === 'string') : [],
    opened_at: null,
    forgiven_at: null,
  };
}

/** Card row -> base64 string for the #c= fragment. */
export function encodeCard(card) {
  return b64encode(JSON.stringify(toPayload(card)));
}

/** Base64 fragment -> card shape, or null if the link is damaged. */
export function decodeCard(raw) {
  if (!raw) return null;
  try {
    let s = String(raw);
    /* Some chat apps percent-encode the fragment. Base64 never contains "%",
       so undoing it is always safe. */
    if (s.indexOf('%') !== -1) {
      try {
        s = decodeURIComponent(s);
      } catch {
        /* keep the raw string */
      }
    }
    s = s.replace(/\s/g, '');
    return fromPayload(JSON.parse(b64decode(s)));
  } catch {
    return null;
  }
}
