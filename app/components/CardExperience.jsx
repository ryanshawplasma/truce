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
    const delay = prefersReducedMotion() ? 60 : 950;
    window.setTimeout(() => setShowLetter(true), delay);
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
              <span className={`env${opened ? ' is-open' : ''}`} ref={envRef}>
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

function ForgiveBlock({ occasion, fromName, forgiven, onForgive }) {
  const zoneRef = useRef(null);
  const noRef = useRef(null);
  const lastMoveRef = useRef(0);
  const [noIndex, setNoIndex] = useState(0);
  /* The button stays in normal flow and is nudged around with a transform, so
     React owns every style and nothing fights over the DOM. */
  const [nudge, setNudge] = useState({ x: 0, y: 0, scale: 1 });

  const surrendered = noIndex >= NO_LABELS.length - 1;

  const dodge = useCallback(() => {
    if (surrendered) return;

    const now = Date.now();
    if (now - lastMoveRef.current < 160) return; // hover and tap can both fire
    lastMoveRef.current = now;

    const nextIndex = Math.min(noIndex + 1, NO_LABELS.length - 1);
    setNoIndex(nextIndex);

    /* Once it gives up it stops running and goes back to full size. */
    if (nextIndex >= NO_LABELS.length - 1) {
      setNudge({ x: 0, y: 0, scale: 1 });
      return;
    }

    const zone = zoneRef.current;
    const button = noRef.current;
    if (!zone || !button) return;

    const zr = zone.getBoundingClientRect();
    const br = button.getBoundingClientRect();

    setNudge((current) => {
      const scale = Math.max(0.55, current.scale - 0.12);
      /* Where the button would sit with no transform at all. */
      const baseLeft = br.left - current.x;
      const baseTop = br.top - current.y;
      /* Somewhere else inside the zone — it never escapes its box. */
      const targetLeft = zr.left + Math.random() * Math.max(0, zr.width - br.width);
      const targetTop = zr.top + Math.random() * Math.max(0, zr.height - br.height);
      return { x: targetLeft - baseLeft, y: targetTop - baseTop, scale };
    });
  }, [noIndex, surrendered]);

  /* The label changes width as it panics ("No" → "Are you sure?"), which nudges
     its resting position. After every move, check it is still inside its box and
     pull it back in if not. Self-correcting, so it can never run off screen. */
  useLayoutEffect(() => {
    const zone = zoneRef.current;
    const button = noRef.current;
    if (!zone || !button || surrendered) return;

    const zr = zone.getBoundingClientRect();
    const br = button.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (br.left < zr.left) dx = zr.left - br.left;
    else if (br.right > zr.right) dx = zr.right - br.right;
    if (br.top < zr.top) dy = zr.top - br.top;
    else if (br.bottom > zr.bottom) dy = zr.bottom - br.bottom;

    if (dx || dy) setNudge((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }, [noIndex, surrendered, nudge.x, nudge.y]);

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
        <button type="button" className="btn-yes" onClick={(e) => onForgive(e.currentTarget)}>
          Yes ❤️
        </button>
        <button
          type="button"
          ref={noRef}
          className={surrendered ? 'btn-yes' : 'btn-no'}
          style={
            surrendered
              ? undefined
              : {
                  transform: `translate(${nudge.x.toFixed(1)}px, ${nudge.y.toFixed(1)}px) scale(${nudge.scale.toFixed(2)})`,
                  position: 'relative',
                  zIndex: 2,
                }
          }
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
