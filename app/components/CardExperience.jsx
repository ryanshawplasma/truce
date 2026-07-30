'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addReaction, markOpened, setForgiven } from '../actions';
import { REACTION_EMOJI, MAX_STICKERS, STICKER_REACTION_PREFIX } from '@/lib/constants';
import { PACKS, Sticker } from './stickers';
import PackTabs from './PackTabs';
import { getOccasion, envelopeSubtitle } from '@/lib/occasions';
import { burstFrom, celebrate, emojiBurstFrom, stickerBurstFrom, prefersReducedMotion } from './ui';

/**
 * What the recipient sees.
 *
 * Envelope → letter (typed out) → promise & memory → "Do you forgive me?" →
 * reactions. Text is rendered as React children, so it is always escaped and
 * a name like `<script>` is just a very odd name.
 *
 * `live` is false for the built-in sample and for hash-encoded cards; the
 * tracking actions no-op in that case.
 */

const NO_LABELS = ['No 😤', 'Are you sure?', 'Really?', 'Please? 🥺', 'Okay fine… yes 🤍'];

export default function CardExperience({ card, live = false }) {
  const occasion = getOccasion(card.occasion);
  const stickers = Array.isArray(card.stickers) ? card.stickers.slice(0, MAX_STICKERS) : [];

  const [opened, setOpened] = useState(false);
  /* `envDone` = the opening animation has finished. It flips the envelope out
     of its "mid-flight" stacking into a plain, unambiguous one (see .env.is-done
     in globals.css) so the letter can never end up behind the envelope front. */
  const [envDone, setEnvDone] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [typedDone, setTypedDone] = useState(false);
  const [showForgive, setShowForgive] = useState(false);
  const [forgiven, setForgivenState] = useState(false);

  const envRef = useRef(null);
  const typeRef = useRef(null);
  const [typedText, setTypedText] = useState('');

  /* ---------------------------------------------------- open tracking */
  useEffect(() => {
    document.body.classList.add('is-locked');
    return () => document.body.classList.remove('is-locked');
  }, []);

  useEffect(() => {
    if (!live) return;
    markOpened(card.id).catch(() => {
      /* tracking is a nice-to-have; never break the card over it */
    });
  }, [live, card.id]);

  /* ---------------------------------------------------- opening the envelope */
  const openEnvelope = useCallback(() => {
    if (opened) return;
    setOpened(true);
    burstFrom(envRef.current, 18);

    if (prefersReducedMotion()) {
      /* Nothing animates, so there is no "mid-flight" moment to preserve. */
      setEnvDone(true);
      window.setTimeout(() => setShowLetter(true), 60);
      return;
    }

    /* The flap takes .8s and the letter .85s; settle the stacking just before
       the scene hands over to the full letter at 950ms. */
    window.setTimeout(() => setEnvDone(true), 820);
    window.setTimeout(() => setShowLetter(true), 950);
  }, [opened]);

  /* ---------------------------------------------------- typewriter */
  const finishTyping = useCallback(() => {
    if (typeRef.current) {
      cancelAnimationFrame(typeRef.current);
      typeRef.current = null;
    }
    setTypedText(card.message);
    setTypedDone(true);
  }, [card.message]);

  useEffect(() => {
    if (!showLetter || typedDone) return undefined;

    if (prefersReducedMotion()) {
      setTypedText(card.message);
      setTypedDone(true);
      return undefined;
    }

    const message = card.message || '';
    const perChar = Math.max(12, Math.min(30, 9000 / Math.max(message.length, 1)));
    let start = null;

    const frame = (ts) => {
      if (start === null) start = ts;
      const n = Math.floor((ts - start) / perChar);
      if (n >= message.length) {
        setTypedText(message);
        setTypedDone(true);
        typeRef.current = null;
        return;
      }
      setTypedText(message.slice(0, n));
      typeRef.current = requestAnimationFrame(frame);
    };

    typeRef.current = requestAnimationFrame(frame);
    return () => {
      if (typeRef.current) cancelAnimationFrame(typeRef.current);
      typeRef.current = null;
    };
  }, [showLetter, typedDone, card.message]);

  /* Reveal the forgive question a beat after the letter finishes. */
  useEffect(() => {
    if (!typedDone) return undefined;
    const t = window.setTimeout(() => setShowForgive(true), prefersReducedMotion() ? 0 : 450);
    return () => window.clearTimeout(t);
  }, [typedDone]);

  /* ---------------------------------------------------- forgiveness */
  const handleForgive = useCallback(
    (originEl) => {
      if (forgiven) return;
      setForgivenState(true);
      celebrate(originEl);
      if (live) {
        setForgiven(card.id).catch(() => {});
      }
    },
    [forgiven, live, card.id],
  );

  return (
    <div className="cardapp themed" data-theme={card.theme || 'blush'}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ---------- Scene 1: the envelope ---------- */}
        {!showLetter ? (
          <section className="cardapp__scene env-scene">
            <h2>For {card.to_name}</h2>
            <p className="env-scene__sub">{envelopeSubtitle(card.occasion, card.severity)}</p>

            <button type="button" className="env-wrap" onClick={openEnvelope} aria-label="Open your envelope">
              <span
                className={`env${opened ? ' is-open' : ''}${envDone ? ' is-done' : ''}`}
                ref={envRef}
              >
                <span className="env__back" />
                <span className="env__letter">
                  <span>A letter from {card.from_name}</span>
                </span>
                <span className="env__front" />
                <span className="env__flap" />
                <span className="env__seal">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <use href="#ic-heart" />
                  </svg>
                </span>
              </span>

              {stickers.length ? (
                <span className="env-stickers">
                  {stickers.slice(0, 2).map((id, i) => (
                    <Sticker key={id} id={id} size={58} className={`env-sticker env-sticker--${i + 1}`} />
                  ))}
                </span>
              ) : null}
            </button>

            <span className="tap-hint" style={{ opacity: opened ? 0 : 1 }}>
              {occasion.openHint || 'Tap to open 💌'}
            </span>
          </section>
        ) : (
          /* ---------- Scene 2: the letter ---------- */
          <section className="cardapp__scene">
            {/* `letter--stickered` reserves the top/bottom sticker band (see globals.css)
                so a stuck-on sticker can never land on the message. */}
            <article
              className={stickers.length ? 'letter letter--stickered' : 'letter'}
              onClick={typedDone ? undefined : finishTyping}
            >
              {stickers.length ? (
                <span className="sticker-layer">
                  {stickers.map((id, i) => (
                    <Sticker key={id} id={id} size={72} className={`sticker-slot sticker-slot--${i + 1}`} />
                  ))}
                </span>
              ) : null}

              {card.reason ? <span className="letter__re">Re: {card.reason}</span> : null}

              <h2 className="letter__dear">Dear {card.to_name},</h2>

              <p className="letter__msg">
                <span className="sr-only">{card.message}</span>
                <span aria-hidden="true">{typedText}</span>
                {!typedDone ? <span className="caret" aria-hidden="true" /> : null}
              </p>

              {!typedDone ? (
                <button
                  type="button"
                  className="skip-typing"
                  onClick={(e) => {
                    e.stopPropagation();
                    finishTyping();
                  }}
                >
                  Tap to skip
                </button>
              ) : null}

              {typedDone && (card.promise || card.memory) ? (
                <div className="letter__extras">
                  {card.promise ? (
                    <div className="promise-box">
                      <h4>My promise to you</h4>
                      <p>I promise to {card.promise}</p>
                    </div>
                  ) : null}
                  {card.memory ? (
                    <p className="memory-line">Remember {card.memory}? I want more of that.</p>
                  ) : null}
                </div>
              ) : null}

              {typedDone ? (
                <p className="letter__sign">
                  — {card.from_name}, {occasion.signOff}
                </p>
              ) : null}
            </article>

            {showForgive ? (
              <ForgiveBlock
                occasion={occasion}
                fromName={card.from_name}
                forgiven={forgiven}
                onForgive={handleForgive}
              />
            ) : null}

            {forgiven ? <ReactionStrip cardId={card.id} live={live} /> : null}
          </section>
        )}
      </div>

      <div className="cardapp__foot">
        <Link href="/">Made with Truce 🤍 Make your own</Link>
      </div>
    </div>
  );
}

/* ==========================================================================
   "Do you forgive me?" — with a No button that would rather not be pressed
   ========================================================================== */

/* How much clear air to leave around the viewport edge and around Yes. */
const EDGE_MARGIN = 10;
const YES_GAP = 12;

/** The part of the screen that is actually visible right now, in the same
 *  client coordinates getBoundingClientRect() reports. On phones the visual
 *  viewport can be smaller and offset from the layout viewport (pinch zoom,
 *  the URL bar collapsing, a keyboard), which is exactly how the No button
 *  used to escape off-screen. */
function visibleViewport() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const left = vv ? vv.offsetLeft : 0;
  const top = vv ? vv.offsetTop : 0;
  const width = vv ? vv.width : window.innerWidth;
  const height = vv ? vv.height : window.innerHeight;
  return {
    left: left + EDGE_MARGIN,
    top: top + EDGE_MARGIN,
    right: left + width - EDGE_MARGIN,
    bottom: top + height - EDGE_MARGIN,
  };
}

function rectsOverlap(a, b, gap) {
  return !(
    a.right + gap <= b.left ||
    a.left >= b.right + gap ||
    a.bottom + gap <= b.top ||
    a.top >= b.bottom + gap
  );
}

/** The button's geometry with no transform applied.
 *  It glides between spots (transition: transform .32s), so a plain
 *  getBoundingClientRect() during a dodge would read a half-finished position
 *  and compound the error. Stripping the transform for one synchronous
 *  measurement — inside a layout effect, so nothing is painted in between —
 *  gives the true resting box every time. */
function measureUntransformed(button) {
  const prevTransform = button.style.transform;
  const prevTransition = button.style.transition;
  button.style.transition = 'none';
  button.style.transform = 'none';
  const rect = button.getBoundingClientRect();
  const base = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  button.style.transform = prevTransform;
  void button.offsetWidth; // commit the restore without animating it
  button.style.transition = prevTransition;
  return base;
}

function ForgiveBlock({ occasion, fromName, forgiven, onForgive }) {
  const zoneRef = useRef(null);
  const noRef = useRef(null);
  const yesRef = useRef(null);
  const lastMoveRef = useRef(0);
  const [noIndex, setNoIndex] = useState(0);
  /* Bumped whenever the viewport changes shape, to re-run the clamp. */
  const [viewportTick, setViewportTick] = useState(0);
  /* The button stays in normal flow and is nudged around with a transform, so
     React owns every style and nothing fights over the DOM. */
  const [nudge, setNudge] = useState({ x: 0, y: 0, scale: 1 });
  /* Mirror of `nudge` we can read synchronously while measuring. */
  const nudgeRef = useRef(nudge);
  const applyNudge = useCallback((next) => {
    nudgeRef.current = next;
    setNudge(next);
  }, []);
  /* Set by dodge(), consumed by the layout effect below. Moving in a layout
     effect (rather than in the click handler) means every measurement happens
     AFTER the new label has been painted — "Are you sure?" is a lot wider than
     "No", and measuring before the swap is what used to throw it off-screen. */
  const pendingRef = useRef(false);

  const surrendered = noIndex >= NO_LABELS.length - 1;

  const dodge = useCallback(() => {
    if (surrendered) return;

    const now = Date.now();
    if (now - lastMoveRef.current < 160) return; // hover and tap can both fire
    lastMoveRef.current = now;

    pendingRef.current = true;
    setNoIndex((i) => Math.min(i + 1, NO_LABELS.length - 1));
  }, [surrendered]);

  /* Place (or re-place) the button so that it is always completely inside both
     its own zone and the visible viewport, and never within YES_GAP of Yes. */
  useLayoutEffect(() => {
    const zone = zoneRef.current;
    const button = noRef.current;
    if (!zone || !button) return;

    const moving = pendingRef.current && !surrendered;
    pendingRef.current = false;
    /* Nothing to do until it has actually been displaced. */
    if (!moving && !surrendered && noIndex === 0) return;

    const current = nudgeRef.current;
    /* Three jobs, one bit of maths:
         dodge    — it ran away, so pick a new spot and shrink a little
         settle   — it gave up, so go back to full size and its place in the row
         re-clamp — the viewport changed, so just pull it back into view       */
    const scale = surrendered ? 1 : moving ? Math.max(0.55, current.scale - 0.12) : current.scale;

    const base = measureUntransformed(button);
    const baseW = base.width;
    const baseH = base.height;
    if (!baseW || !baseH) return;

    /* Size once the new scale is applied. */
    const w = baseW * scale;
    const h = baseH * scale;
    /* Where it is sitting right now, derived rather than measured. */
    const nowLeft = base.left + (baseW - baseW * current.scale) / 2 + current.x;
    const nowTop = base.top + (baseH - baseH * current.scale) / 2 + current.y;

    /* Allowed area = the zone ∩ what the eye can actually see. If that is too
       small to hold the button, the viewport alone wins — staying on screen
       matters more than staying inside the decorative box. */
    const vp = visibleViewport();
    const zr = zone.getBoundingClientRect();
    let box = {
      left: Math.max(zr.left, vp.left),
      top: Math.max(zr.top, vp.top),
      right: Math.min(zr.right, vp.right),
      bottom: Math.min(zr.bottom, vp.bottom),
    };
    if (box.right - box.left < w || box.bottom - box.top < h) box = vp;

    const minX = box.left;
    const maxX = Math.max(box.left, box.right - w);
    const minY = box.top;
    const maxY = Math.max(box.top, box.bottom - h);

    const yesRect = yesRef.current ? yesRef.current.getBoundingClientRect() : null;
    const clampX = (v) => Math.min(Math.max(v, minX), maxX);
    const clampY = (v) => Math.min(Math.max(v, minY), maxY);

    let targetLeft;
    let targetTop;

    if (moving) {
      /* Try a handful of random spots and take the first that keeps clear of
         the Yes button; otherwise take whichever sat furthest away. */
      let bestGap = -Infinity;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const x = clampX(minX + Math.random() * (maxX - minX));
        const y = clampY(minY + Math.random() * (maxY - minY));
        const candidate = { left: x, top: y, right: x + w, bottom: y + h };
        if (!yesRect || !rectsOverlap(candidate, yesRect, YES_GAP)) {
          targetLeft = x;
          targetTop = y;
          break;
        }
        const dx = x + w / 2 - (yesRect.left + yesRect.right) / 2;
        const dy = y + h / 2 - (yesRect.top + yesRect.bottom) / 2;
        const gap = dx * dx + dy * dy;
        if (gap > bestGap) {
          bestGap = gap;
          targetLeft = x;
          targetTop = y;
        }
      }
    } else if (surrendered) {
      /* It gave up: full size, back in the row beside Yes — which is where the
         flex gap already keeps it a polite distance away. If the row happens to
         be scrolled out of sight, bring the page to the button rather than
         parking the button on top of Yes. */
      targetLeft = base.left;
      targetTop = base.top;
      const visible =
        base.left >= vp.left &&
        base.top >= vp.top &&
        base.left + baseW <= vp.right &&
        base.top + baseH <= vp.bottom;
      if (!visible && typeof button.scrollIntoView === 'function') {
        button.scrollIntoView({
          block: 'center',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }
    } else {
      /* A resize / orientation change: keep where it is, just pull it back in. */
      targetLeft = clampX(nowLeft);
      targetTop = clampY(nowTop);
    }

    /* Last word on Yes: wherever we ended up — a random hop or a clamp forced
       by a small viewport — never sit on top of the Yes button. (A surrendered
       button is back in the row, where the flex gap already handles it.) */
    if (yesRect && !surrendered) {
      const overlaps = (l, t) =>
        rectsOverlap({ left: l, top: t, right: l + w, bottom: t + h }, yesRect, YES_GAP);
      if (overlaps(targetLeft, targetTop)) {
        const escapes = [
          [targetLeft, yesRect.bottom + YES_GAP],
          [targetLeft, yesRect.top - YES_GAP - h],
          [yesRect.right + YES_GAP, targetTop],
          [yesRect.left - YES_GAP - w, targetTop],
        ];
        for (const [ex, ey] of escapes) {
          const cx = clampX(ex);
          const cy = clampY(ey);
          if (!overlaps(cx, cy)) {
            targetLeft = cx;
            targetTop = cy;
            break;
          }
        }
      }
    }

    const x = targetLeft - base.left - (baseW - w) / 2;
    const y = targetTop - base.top - (baseH - h) / 2;
    if (
      !moving &&
      Math.abs(x - current.x) < 0.5 &&
      Math.abs(y - current.y) < 0.5 &&
      scale === current.scale
    ) {
      return;
    }
    applyNudge({ x, y, scale });
  }, [noIndex, surrendered, viewportTick, applyNudge]);

  /* Phones rotate, keyboards open, URL bars collapse — re-clamp when they do. */
  useEffect(() => {
    let frame = 0;
    const bump = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewportTick((t) => t + 1));
    };
    window.addEventListener('resize', bump);
    window.addEventListener('orientationchange', bump);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', bump);
      vv.addEventListener('scroll', bump);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', bump);
      window.removeEventListener('orientationchange', bump);
      if (vv) {
        vv.removeEventListener('resize', bump);
        vv.removeEventListener('scroll', bump);
      }
    };
  }, []);

  if (forgiven) {
    return (
      <div className="forgive">
        <div className="forgiven">
          <span className="forgiven__emoji" aria-hidden="true">
            🎉
          </span>
          <h3>{occasion.forgiveDone}</h3>
          <p>{fromName} can breathe again.</p>
          <HugButton />
        </div>
      </div>
    );
  }

  return (
    <div className="forgive">
      <h3>{occasion.forgiveQuestion}</h3>
      <div className="forgive__zone" ref={zoneRef}>
        <button
          type="button"
          className="btn-yes"
          ref={yesRef}
          onClick={(e) => onForgive(e.currentTarget)}
        >
          Yes ❤️
        </button>
        <button
          type="button"
          ref={noRef}
          className={surrendered ? 'btn-yes' : 'btn-no'}
          /* Always transform-positioned, even after it surrenders: if the row
             it belongs to is scrolled off the bottom of the screen the clamp
             keeps it visible, and when it is not the transform is an identity. */
          style={{
            transform: `translate(${nudge.x.toFixed(1)}px, ${nudge.y.toFixed(1)}px) scale(${nudge.scale.toFixed(2)})`,
            position: 'relative',
            zIndex: 2,
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') dodge();
          }}
          onFocus={dodge}
          onClick={(e) => {
            if (surrendered) onForgive(e.currentTarget);
            else dodge();
          }}
        >
          {NO_LABELS[noIndex]}
        </button>
      </div>
    </div>
  );
}

function HugButton() {
  const [label, setLabel] = useState('Send a hug back 🤗');
  return (
    <button
      type="button"
      className="btn-hug"
      onClick={(e) => {
        burstFrom(e.currentTarget, 20);
        setLabel('Hug sent 🤗');
        window.setTimeout(() => setLabel('Send another 🤗'), 1400);
      }}
    >
      {label}
    </button>
  );
}

/* ==========================================================================
   Send something back — emoji reactions
   ========================================================================== */

function ReactionStrip({ cardId, live }) {
  const [sending, setSending] = useState('');
  const [last, setLast] = useState(null);   // what they just sent, shown big
  const [sent, setSent] = useState([]);     // every value sent this visit
  const [note, setNote] = useState('');
  const [packId, setPackId] = useState(PACKS[0].id);   // which sticker pack the tray shows

  /**
   * One path for both kinds of reaction. Emoji are stored as themselves,
   * stickers as "sticker:<id>" — see isValidReaction in lib/constants.js.
   */
  async function send({ kind, value, element }) {
    if (sending) return;
    const stored = kind === 'sticker' ? `${STICKER_REACTION_PREFIX}${value}` : value;
    setSending(stored);

    /* The whole point: the thing they tapped floats up the screen. */
    if (kind === 'sticker') stickerBurstFrom(element, 10);
    else emojiBurstFrom(element, value, 14);
    setLast({ kind, value });

    try {
      const res = await addReaction(cardId, stored);
      if (res.ok) {
        setSent((list) => (list.includes(stored) ? list : [...list, stored]));
        setNote(
          live && res.mode !== 'demo'
            ? 'Sent 🤍 they will see it on their page.'
            : 'Sent 🤍 (this one is a sample card, so nothing is saved.)',
        );
      } else {
        setNote(res.error || 'Could not send that just now.');
      }
    } catch {
      setNote('Could not send that just now.');
    } finally {
      setSending('');
      window.setTimeout(() => setNote(''), 3500);
    }
  }

  return (
    <div className="reactions">
      <h4>Send something back —</h4>

      {last && last.kind === 'emoji' ? (
        <div className="reactions__big" key={`e-${last.value}-${sent.length}`} aria-hidden="true">
          {last.value}
        </div>
      ) : null}
      {last && last.kind === 'sticker' ? (
        <Sticker
          key={`s-${last.value}-${sent.length}`}
          id={last.value}
          size={104}
          className="reactions__big-sticker"
        />
      ) : null}

      <div className="reactions__row">
        {REACTION_EMOJI.map((emoji) => (
          <button
            type="button"
            key={emoji}
            className={`react-btn${sent.includes(emoji) ? ' is-sent' : ''}`}
            aria-label={`Send ${emoji}`}
            disabled={Boolean(sending)}
            onClick={(e) => send({ kind: 'emoji', value: emoji, element: e.currentTarget })}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="tray">
        <p className="tray__label">or send a sticker</p>
        <PackTabs value={packId} onChange={setPackId} idPrefix="tray" panelId="tray-sticker-row" />
        <div
          className="tray__row"
          id="tray-sticker-row"
          role="tabpanel"
          aria-labelledby={`tray-tab-${packId}`}
        >
          {(PACKS.find((p) => p.id === packId) || PACKS[0]).stickers.map((sticker) => {
            const stored = `${STICKER_REACTION_PREFIX}${sticker.id}`;
            return (
              <button
                type="button"
                key={sticker.id}
                className={`tray__btn${sent.includes(stored) ? ' is-sent' : ''}`}
                aria-label={`Send the ${sticker.label} sticker`}
                disabled={Boolean(sending)}
                onClick={(e) => send({ kind: 'sticker', value: sticker.id, element: e.currentTarget })}
              >
                <Sticker id={sticker.id} size={56} />
              </button>
            );
          })}
        </div>
      </div>

      <p className="reactions__state" role="status">
        {note}
      </p>
    </div>
  );
}
