'use client';

/**
 * Small browser-only helpers shared by the wizard and the card experience:
 * heart bursts, confetti, toasts, and the reduced-motion check.
 *
 * Every function here touches the DOM, so they are only ever called from event
 * handlers or effects — never during render.
 */

export const HEART_GLYPHS = ['🤍', '💗', '💕', '💌', '✨', '🩷'];

/* The Sky appearance mixes blues into the drift so the hearts belong to the
   page they float over. Rose stays in the mix — it is still Truce. */
const SKY_HEART_GLYPHS = ['💙', '🩵', '🤍', '💗', '💌', '✨'];

/** Whichever set suits the appearance the site is currently wearing. */
export function heartGlyphs() {
  try {
    if (typeof document === 'undefined') return HEART_GLYPHS;
    return document.documentElement.getAttribute('data-appearance') === 'blush' ? HEART_GLYPHS : SKY_HEART_GLYPHS;
  } catch {
    return HEART_GLYPHS;
  }
}

/** Respect the user's OS-level "reduce motion" setting. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/* The fixed layer that burst hearts fly around in. Created once, lazily. */
let burstLayer = null;
function getBurstLayer() {
  if (typeof document === 'undefined') return null;
  if (burstLayer && document.body.contains(burstLayer)) return burstLayer;
  burstLayer = document.createElement('div');
  burstLayer.className = 'heart-layer heart-layer--fixed';
  burstLayer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(burstLayer);
  return burstLayer;
}

/**
 * A burst of characters from a point in the viewport.
 *
 * `rise: true` biases every trajectory upwards so a tapped emoji floats up the
 * screen in multiples instead of scattering in a ring.
 */
export function burstGlyphs(x, y, { count = 16, glyphs = HEART_GLYPHS, rise = false, min = 16, max = 36 } = {}) {
  if (prefersReducedMotion()) return;
  const layer = getBurstLayer();
  if (!layer) return;

  const list = Array.isArray(glyphs) ? glyphs : [glyphs];
  const originX = typeof x === 'number' ? x : window.innerWidth / 2;
  const originY = typeof y === 'number' ? y : window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'bheart';
    el.textContent = list[Math.floor(Math.random() * list.length)];
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.fontSize = `${min + Math.random() * (max - min)}px`;

    /* rise: fan out across the top half only (-165°…-15°) and travel further. */
    const angle = rise
      ? -Math.PI + (Math.PI * (i + 0.5 + Math.random() * 0.6)) / count
      : (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = rise ? 150 + Math.random() * 190 : 90 + Math.random() * 170;

    el.style.setProperty('--bx', `${(Math.cos(angle) * distance * (rise ? 0.55 : 1)).toFixed(1)}px`);
    el.style.setProperty('--by', `${(Math.sin(angle) * distance - (rise ? 110 : 60)).toFixed(1)}px`);
    el.style.setProperty('--bs', (0.8 + Math.random() * 0.9).toFixed(2));
    el.style.setProperty('--br', `${(Math.random() * 120 - 60).toFixed(0)}deg`);
    el.style.setProperty('--dur', `${((rise ? 1.15 : 0.9) + Math.random() * 0.7).toFixed(2)}s`);
    el.addEventListener('animationend', () => el.remove());
    layer.appendChild(el);
  }
}

/** A burst of hearts from a point in the viewport. */
export function burstHearts(x, y, count = 16) {
  burstGlyphs(x, y, { count });
}

/** Same, but centred on an element. */
export function burstFrom(el, count = 16) {
  if (!el || !el.getBoundingClientRect) {
    burstHearts(undefined, undefined, count);
    return;
  }
  const r = el.getBoundingClientRect();
  burstHearts(r.left + r.width / 2, r.top + r.height / 2, count);
}

/**
 * A sticker floating up out of the button that was tapped.
 *
 * Rather than re-rendering the drawing, we clone the <svg> that is already on
 * screen — no serialisation, no extra dependency, and the clones keep their
 * little looped animations while they fly.
 */
export function stickerBurstFrom(el, count = 10) {
  if (prefersReducedMotion()) return;
  const layer = getBurstLayer();
  const source = el && el.querySelector ? el.querySelector('svg') : null;
  if (!layer || !source) return;

  const r = el.getBoundingClientRect();
  const originX = r.left + r.width / 2;
  const originY = r.top + r.height / 2;

  for (let i = 0; i < count; i++) {
    const wrap = document.createElement('span');
    wrap.className = 'bheart bheart--svg';
    wrap.appendChild(source.cloneNode(true));

    const scale = 0.55 + Math.random() * 0.75;
    wrap.style.left = `${originX}px`;
    wrap.style.top = `${originY}px`;
    wrap.style.width = `${Math.round(58 * scale)}px`;
    wrap.style.height = `${Math.round(58 * scale)}px`;

    const angle = -Math.PI + (Math.PI * (i + 0.5 + Math.random() * 0.6)) / count;
    const distance = 150 + Math.random() * 190;
    wrap.style.setProperty('--bx', `${(Math.cos(angle) * distance * 0.55).toFixed(1)}px`);
    wrap.style.setProperty('--by', `${(Math.sin(angle) * distance - 120).toFixed(1)}px`);
    wrap.style.setProperty('--bs', (0.85 + Math.random() * 0.5).toFixed(2));
    wrap.style.setProperty('--br', `${(Math.random() * 90 - 45).toFixed(0)}deg`);
    wrap.style.setProperty('--dur', `${(1.25 + Math.random() * 0.7).toFixed(2)}s`);
    wrap.addEventListener('animationend', () => wrap.remove());
    layer.appendChild(wrap);
  }
}

/** One emoji, floating up out of the button that was tapped. */
export function emojiBurstFrom(el, glyph, count = 14) {
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : undefined;
  const y = r ? r.top + r.height / 2 : undefined;
  burstGlyphs(x, y, { count, glyphs: [glyph], rise: true, min: 24, max: 52 });
}

/**
 * Confetti, loaded on demand so it never runs during server rendering and never
 * costs anything on pages that don't celebrate. Falls back to hearts if the
 * package fails to load for any reason.
 */
export async function celebrate(originEl) {
  if (prefersReducedMotion()) return;
  const colors = ['#E85D75', '#F2B880', '#FFE4E9', '#8B6BD6', '#FFFFFF'];
  try {
    const mod = await import('canvas-confetti');
    const confetti = mod.default;
    const common = { colors, disableForReducedMotion: true, zIndex: 300 };
    confetti({ ...common, particleCount: 90, spread: 72, startVelocity: 42, origin: { y: 0.62 } });
    setTimeout(() => {
      confetti({ ...common, particleCount: 55, angle: 60, spread: 62, origin: { x: 0, y: 0.7 } });
      confetti({ ...common, particleCount: 55, angle: 120, spread: 62, origin: { x: 1, y: 0.7 } });
    }, 220);
  } catch {
    burstFrom(originEl, 22);
  }
}

/**
 * Give any promise a deadline.
 *
 * Server actions travel over the network, and a network can simply stop
 * answering — a phone that lost signal mid-tap leaves the promise pending
 * forever. Anything that disables a button while it waits uses this, so the
 * interface always comes back.
 *
 * Resolves with `fallback` if the deadline passes first. The original promise
 * is not cancelled (it cannot be); it is just no longer waited on.
 */
export function withTimeout(promise, ms = 10000, fallback = { ok: false, error: 'timeout' }) {
  let timer = null;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
}

/* ------------------------------------------------------------------ toast */
let toastEl = null;
let toastTimer = null;

export function toast(message) {
  if (typeof document === 'undefined') return;
  if (!toastEl || !document.body.contains(toastEl)) {
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'status');
    toastEl.style.cssText =
      'position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);' +
      /* Reads the appearance tokens so the toast belongs to the current skin,
         including over a card, whose own theme never touches these. */
      'background:var(--toast-bg,#3D2137);color:var(--toast-ink,#FFF7F2);' +
      'padding:13px 22px;border-radius:999px;font-weight:700;font-size:.92rem;' +
      'box-shadow:0 14px 34px rgba(61,33,55,.28);z-index:400;opacity:0;transition:opacity .25s ease,transform .25s ease;' +
      'pointer-events:none;max-width:90vw;text-align:center;font-family:inherit;';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  requestAnimationFrame(() => {
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(-50%) translateY(12px)';
  }, 2400);
}

/* How long we are willing to wait for the clipboard before offering the
   old-fashioned way. In-app browsers (Instagram, some Android WebViews) can
   leave navigator.clipboard.writeText pending forever when the permission
   prompt is suppressed — which is exactly the "it gets stuck" everyone means. */
const CLIPBOARD_TIMEOUT_MS = 1500;

/** The execCommand path: an off-screen textarea we select and copy. */
function copyViaExecCommand(text) {
  try {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', 'readonly');
    /* Not display:none and not width 0 — Safari refuses to copy from a field it
       considers invisible. Off-screen but real works everywhere. */
    helper.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;pointer-events:none';
    document.body.appendChild(helper);
    helper.select();
    helper.setSelectionRange(0, 99999);
    const ok = document.execCommand && document.execCommand('copy');
    helper.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}

/**
 * Copy text to the clipboard. Resolves `true` if it worked, `false` if the
 * caller should show a select-this-yourself fallback.
 *
 * Guarantees it settles: the async clipboard API is raced against a timeout, so
 * a copy button can never leave the interface waiting on a promise that a
 * browser has quietly abandoned.
 */
export function copyText(text) {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  const modern = (() => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return Promise.resolve(navigator.clipboard.writeText(text)).then(
          () => true,
          () => false,
        );
      }
    } catch {
      /* fall through */
    }
    return Promise.resolve(false);
  })();

  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), CLIPBOARD_TIMEOUT_MS);
  });

  return Promise.race([modern, timeout])
    .then((ok) => (ok ? true : copyViaExecCommand(text)))
    .catch(() => copyViaExecCommand(text))
    .finally(() => clearTimeout(timer));
}
