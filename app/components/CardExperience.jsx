'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { addReaction, markOpened, setForgiven } from '../actions';
import { REACTION_EMOJI, MAX_STICKERS, STICKER_REACTION_PREFIX, softenReason } from '@/lib/constants';
import { PACKS, STICKERS, Sticker, getSticker } from './stickers';
import PackTabs from './PackTabs';
import { getOccasion, envelopeSubtitle, envelopeTitle, promiseText, fill } from '@/lib/occasions';
import { findMyCard } from '@/lib/mycards';
import { CUTENESS_MAX, cardCutenessStart, cutenessTapStep, cutenessLabel } from '@/lib/cuteness';
import ShareRow from './ShareRow';
import KeepCard from './KeepCard';
import PigeonDelivery from './PigeonDelivery';
import {
  burstFrom,
  burstGlyphs,
  celebrate,
  emojiBurstFrom,
  stickerBurstFrom,
  prefersReducedMotion,
  withTimeout,
} from './ui';

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

/* The dodging button's script. Each occasion supplies its own — see
   lib/occasions.js — and this is the fallback if one ever forgets to. */
const FALLBACK_NO_LABELS = ['No 😤', 'Are you sure?', 'Really?', 'Please? 🥺', 'Okay fine… yes 🤍'];

/* Meter checkpoints. The meter is forgiveness, birthday spirit or butterflies
   depending on the occasion, but the mechanics never change. */
const METER_OPENED = 35;
const METER_READ = 70;
const METER_FULL = 100;
const METER_NO_PENALTY = 4;

/* ---------------------------------------------------------------- pump mode
   Saying yes used to fill the meter on its own. It looked nice and it asked
   nothing of the person holding the card, which is the one thing this moment
   should do. So "Yes" now hands the meter over: it drops to a starting notch
   and they tap it the rest of the way.

   The numbers are chosen so it always takes five to seven satisfying taps —
   long enough to feel earned, short enough that nobody gives up. */
const PUMP_START = 12;
const PUMP_MIN = 12;
const PUMP_MAX = 18;
/* With reduced motion the whole thing is three firm taps and no rain. */
const PUMP_REDUCED_TAPS = 3;

/* How long the big payoff moment stays on screen. It is pointer-events:none
   throughout and unmounts afterwards, so it can never sit over a button. */
const PAYOFF_MS = 2600;
const PAYOFF_REDUCED_MS = 1800;

/** Reactions are stored as an emoji, or as "sticker:<id>". */
function parseReaction(stored) {
  if (typeof stored !== 'string' || !stored) return null;
  if (stored.startsWith(STICKER_REACTION_PREFIX)) {
    return { kind: 'sticker', value: stored.slice(STICKER_REACTION_PREFIX.length) };
  }
  return { kind: 'emoji', value: stored };
}

export default function CardExperience({ card, live = false, initialReactions = [] }) {
  const occasion = getOccasion(card.occasion);
  const stickers = Array.isArray(card.stickers) ? card.stickers.slice(0, MAX_STICKERS) : [];
  const about = softenReason(card.reason);

  /* If this device made this card, quietly offer the way back to the private
     page — for senders who kept the share link but lost the /s/ one. Read in an
     effect so the server render and the first client render match. */
  const [myEntry, setMyEntry] = useState(null);
  useEffect(() => {
    if (!live || !card.id) return;
    setMyEntry(findMyCard(card.id));
  }, [live, card.id]);

  const [opened, setOpened] = useState(false);
  /* Scene 0 is still in the air. The envelope underneath is real and tappable
     the whole time — the delivery is decoration layered over a working page,
     never a gate in front of one — but the tap hint waits so nobody is invited
     to press something a pigeon is still carrying. */
  const [delivering, setDelivering] = useState(true);
  /* Stable identity: an inline arrow here is a new function on every render,
     which re-triggers the delivery effect that depends on it. */
  const stopDelivering = useCallback(() => setDelivering(false), []);
  /* `envDone` = the opening animation has finished. It flips the envelope out
     of its "mid-flight" stacking into a plain, unambiguous one (see .env.is-done
     in globals.css) so the letter can never end up behind the envelope front. */
  const [envDone, setEnvDone] = useState(false);
  const [showLetter, setShowLetter] = useState(false);
  const [typedDone, setTypedDone] = useState(false);
  const [showForgive, setShowForgive] = useState(false);
  const [forgiven, setForgivenState] = useState(false);   // "the moment happened" 
  /* The beat between "Yes" and the confetti, while the meter fills. */
  const [forgiving, setForgiving] = useState(false);
  /* Set once they send anything back, so the reply row stays put afterwards. */
  const [replied, setReplied] = useState(false);

  /* Pump mode: "Yes" has been said and the meter is now theirs to fill. */
  const [pumping, setPumping] = useState(false);
  const pumpTapsRef = useRef(0);
  const [pumpTaps, setPumpTaps] = useState(0);

  /* The big dramatic moment — the 120% cuteness overload, or a filled meter.
     `{ text, key }`; key only exists so a second payoff restarts the animation. */
  const [payoff, setPayoff] = useState(null);
  const payoffTimer = useRef(null);

  /* The forgiveness meter: 0 while the envelope is shut, then it climbs. */
  const [meter, setMeter] = useState(0);
  const [teasing, setTeasing] = useState(false);
  const teaseTimer = useRef(null);
  const fillRaf = useRef(null);
  const fillTimer = useRef(null);
  /* A readable-on-demand mirror of `meter`, so the fill animation knows where
     to start from without adding `meter` to its dependency list. */
  const meterRef = useRef(0);
  useEffect(() => {
    meterRef.current = meter;
  }, [meter]);

  /* Where to send the sender.
     A saved card gets its own reply page, /r/<id> — one screen answering "did
     they see it, and what did they say?", which is a far better thing to land
     on (and to unfurl in a chat) than the sender's own letter reopened.
     A hash-mode card has no server-side state at all, so there is nothing for a
     reply page to read: those keep sharing the card link itself.
     Read after mount so the server render and the first client render agree. */
  const [pageUrl, setPageUrl] = useState('');
  const [replyUrl, setReplyUrl] = useState('');
  const [hashMode, setHashMode] = useState(false);
  useEffect(() => {
    setPageUrl(window.location.href);
    const saved = Boolean(card.id) && card.id !== 'local';
    setHashMode(!saved);
    setReplyUrl(saved ? `${window.location.origin}/r/${card.id}` : window.location.href);
  }, [card.id]);

  /* Stickers the recipient has sent back, stuck onto the letter. Seeded from
     whatever they sent on an earlier visit. */
  const [stuckBack, setStuckBack] = useState(() =>
    initialReactions
      .map((r) => parseReaction(r.emoji))
      .filter((r) => r && r.kind === 'sticker')
      .map((r) => r.value),
  );

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

  useEffect(
    () => () => {
      window.clearTimeout(teaseTimer.current);
      window.clearTimeout(fillTimer.current);
      if (fillRaf.current) cancelAnimationFrame(fillRaf.current);
    },
    [],
  );

  /* ---------------------------------------------------- opening the envelope */
  const openEnvelope = useCallback(() => {
    if (opened) return;
    setOpened(true);
    setMeter(METER_OPENED);
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

  /* Finishing the letter is worth a good chunk of the meter. */
  useEffect(() => {
    if (typedDone) setMeter((v) => Math.max(v, METER_READ));
  }, [typedDone]);

  /* Reveal the forgive question a beat after the letter finishes. */
  useEffect(() => {
    if (!typedDone) return undefined;
    const t = window.setTimeout(() => setShowForgive(true), prefersReducedMotion() ? 0 : 450);
    return () => window.clearTimeout(t);
  }, [typedDone]);

  /**
   * Put the big overlay up, then take it down again.
   *
   * It never blocks anything: the overlay is pointer-events:none while it is
   * there, and it is removed from the tree the moment it is done — a celebration
   * that eats the "send something back" buttons is not a celebration.
   */
  const firePayoff = useCallback((text) => {
    if (!text) return;
    const reduced = prefersReducedMotion();
    setPayoff({ text, key: Date.now(), reduced });
    window.clearTimeout(payoffTimer.current);
    payoffTimer.current = window.setTimeout(
      () => setPayoff(null),
      reduced ? PAYOFF_REDUCED_MS : PAYOFF_MS,
    );
  }, []);

  useEffect(() => () => window.clearTimeout(payoffTimer.current), []);

  /* ---------------------------------------------------- forgiveness */
  /**
   * "Yes" does not simply flip a switch. The meter loads from wherever it had
   * got to up to a full 100 over FORGIVE_FILL_MS, and only then does the
   * celebration land — so forgiveness reads as something that happened rather
   * than something that was already true.
   */
  /* The moment itself lands here — from "Yes ❤️", from the last candle, from
     "Yes 💍". It records the answer, then hands the meter to the recipient. */
  const handleForgive = useCallback(
    (originEl) => {
      if (forgiven || forgiving || pumping) return;
      setTeasing(false);

      /* Record it straight away; the animation is for the eyes, not the data.
         Whether they finish pumping or wander off, they said yes. */
      if (live) {
        setForgiven(card.id).catch(() => {});
      }

      /* A short "here we go" beat, then the meter drops to its starting notch
         and waits to be tapped. Dropping it is the point: a bar that is already
         nearly full has nothing to give them to do. */
      setForgiving(true);
      pumpTapsRef.current = 0;
      setPumpTaps(0);
      if (originEl) burstFrom(originEl, 10);

      const begin = () => {
        setForgiving(false);
        setMeter(PUMP_START);
        setPumping(true);
      };

      if (prefersReducedMotion()) {
        begin();
        return;
      }
      fillTimer.current = window.setTimeout(begin, 420);
    },
    [forgiven, forgiving, pumping, live, card.id],
  );

  /**
   * One pump. Adds a random 12–18% (a fixed, bigger step under reduced motion so
   * three taps do it), puffs hearts where the finger landed, and when the bar
   * tops out runs the celebration plus the full dramatic payoff.
   */
  const handlePump = useCallback(
    (point) => {
      if (!pumping) return;
      const reduced = prefersReducedMotion();
      const step = reduced
        ? Math.ceil((METER_FULL - PUMP_START) / PUMP_REDUCED_TAPS)
        : PUMP_MIN + Math.random() * (PUMP_MAX - PUMP_MIN);

      pumpTapsRef.current += 1;
      setPumpTaps(pumpTapsRef.current);

      const next = Math.min(METER_FULL, meterRef.current + step);
      meterRef.current = next;
      setMeter(next);

      if (point && !reduced) {
        burstGlyphs(point.x, point.y, { count: 6, rise: true, min: 12, max: 24 });
      }

      if (next >= METER_FULL) {
        setPumping(false);
        setForgivenState(true);
        celebrate(point ? point.el : null);
        firePayoff(occasion.meter.payoff);
      }
    },
    [pumping, firePayoff, occasion],
  );

  /**
   * A candle going out is progress, not a refusal — so the birthday flow nudges
   * the meter UP a little (and borrows the same "teasing" flash for the label,
   * which reads as "ooh…" on a birthday card).
   */
  const handleBoost = useCallback(() => {
    setMeter((v) => Math.min(METER_FULL - 5, v + 6));
    setTeasing(true);
    window.clearTimeout(teaseTimer.current);
    teaseTimer.current = window.setTimeout(() => setTeasing(false), 1200);
  }, []);

  /* Every "No" costs them a little forgiveness. Never below the opening score —
     the meter teases, it never punishes. */
  const handleNo = useCallback(() => {
    setMeter((v) => Math.max(METER_OPENED, v - METER_NO_PENALTY));
    setTeasing(true);
    window.clearTimeout(teaseTimer.current);
    teaseTimer.current = window.setTimeout(() => setTeasing(false), 1500);
  }, []);

  /* A sticker sent back gets stuck onto the letter, right there and then. */
  const handleStickerBack = useCallback((id) => {
    setStuckBack((list) => [...list, id]);
  }, []);

  /* Tapping the paper (not a button) makes a tiny heart poof where you tapped. */
  const onLetterTap = useCallback(
    (e) => {
      if (!typedDone) {
        finishTyping();
        return;
      }
      if (e.target && e.target.closest && e.target.closest('button, a, input, textarea')) return;
      burstGlyphs(e.clientX, e.clientY, { count: 5, min: 11, max: 20 });
    },
    [typedDone, finishTyping],
  );

  return (
    <div className="cardapp themed" data-theme={card.theme || 'blush'}>
      {myEntry ? (
        <Link className="creator-banner" href={`/s/${myEntry.editToken}`}>
          <span aria-hidden="true">🔒</span> This is your card — view your private page →
        </Link>
      ) : null}

      {/* Scene 0 — the delivery. Sits over the top and lets itself out. */}
      {!showLetter ? (
        <PigeonDelivery
          cardId={resolveCardId(card)}
          fromName={card.from_name}
          onDone={stopDelivering}
        />
      ) : null}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* ---------- Scene 1: the envelope ---------- */}
        {!showLetter ? (
          <section className="cardapp__scene env-scene">
            {/* One big tap target covering the whole scene — the name, the
                envelope and the hint are all "open the letter". The visuals sit
                behind it so the button stays a single, simple control. */}
            <button
              type="button"
              className="env-scene__hit"
              onClick={openEnvelope}
              aria-label="Open your letter"
            />

            <div className="env-scene__stack">
              <h2>{envelopeTitle(card.occasion, card.to_name)}</h2>
              <p className="env-scene__sub">{envelopeSubtitle(card.occasion, card.severity)}</p>

              <span className="env-wrap">
                {/* Separate element from .env so the every-6s "notice me" wiggle
                    and the constant breathing animation never fight over
                    the same transform. */}
                <span className={`env-idle${opened ? ' is-open' : ''}`}>
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

                  {!opened ? (
                    <span className="env-sparkles" aria-hidden="true">
                      <span className="env-sparkle env-sparkle--1">✨</span>
                      <span className="env-sparkle env-sparkle--2">✨</span>
                      <span className="env-sparkle env-sparkle--3">🤍</span>
                    </span>
                  ) : null}
                </span>

                {stickers.length ? (
                  <span className="env-stickers">
                    {stickers.slice(0, 2).map((id, i) => (
                      <Sticker key={id} id={id} size={58} className={`env-sticker env-sticker--${i + 1}`} />
                    ))}
                  </span>
                ) : null}
              </span>

              <span className="tap-hint" style={{ opacity: opened || delivering ? 0 : 1 }}>
                {occasion.openHint || 'Tap to open 💌'}
              </span>
            </div>
          </section>
        ) : (
          /* ---------- Scene 2: the letter ---------- */
          <section className="cardapp__scene">
            <MomentMeter
              occasion={occasion}
              value={meter}
              teasing={teasing}
              full={forgiven}
              loading={forgiving}
              pumping={pumping}
              pumpTaps={pumpTaps}
              onPump={handlePump}
            />

            {/* `letter--stickered` reserves the top/bottom sticker band (see globals.css)
                so a stuck-on sticker can never land on the message. */}
            <article
              className={stickers.length ? 'letter letter--stickered' : 'letter'}
              onClick={onLetterTap}
            >
              {stickers.length ? (
                <span className="sticker-layer">
                  {stickers.map((id, i) => (
                    <Sticker key={id} id={id} size={72} className={`sticker-slot sticker-slot--${i + 1}`} />
                  ))}
                </span>
              ) : null}

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

              {/* The gentle version of the old "Re:" label — under the message,
                  where it reads like an aside instead of a subject line. */}
              {typedDone && about ? <p className="letter__about">…about {about} 🙈</p> : null}

              {typedDone && (card.promise || card.memory) ? (
                <div className="letter__extras">
                  {card.promise ? (
                    <div className="promise-box">
                      <h4>{occasion.promise.boxTitle}</h4>
                      <p>{promiseText(card.occasion, card.promise)}</p>
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

              {/* The sender's stickers again, clustered under the signature the
                  way you would stick them on a real letter. */}
              {typedDone && stickers.length ? (
                <span className="letter__cluster" aria-hidden="true">
                  {stickers.map((id, i) => (
                    <Sticker key={id} id={id} size={52} className={`cluster-sticker cluster-sticker--${i + 1}`} />
                  ))}
                </span>
              ) : null}

              {/* Their turn to play with something. Purely local — see below. */}
              {typedDone ? <CardCutenessMeter card={card} onOverload={firePayoff} /> : null}

              {/* …and anything the recipient has sent back, stuck on live. */}
              {stuckBack.length ? (
                <span className="letter__stuck">
                  <span className="letter__stuck-label">stuck on by {card.to_name}</span>
                  <span className="letter__stuck-row">
                    {stuckBack.map((id, i) => (
                      <Sticker
                        key={`${id}-${i}`}
                        id={id}
                        size={46}
                        className="stuck-sticker"
                        style={{ '--stuck-rot': `${((i * 37) % 15) - 7}deg` }}
                      />
                    ))}
                  </span>
                </span>
              ) : null}
            </article>

            {/* The recipient's moment. Three shapes so far — an apology asks
                to be forgiven, a birthday has candles to blow out, and a
                proposal asks the only question that matters. They all end the
                same way: `handleForgive` fills the meter, celebrates, and
                stamps the card. */}
            {showForgive ? (
              occasion.moment === 'candles' ? (
                <CandleMoment
                  occasion={occasion}
                  toName={card.to_name}
                  fromName={card.from_name}
                  severity={card.severity}
                  done={forgiven}
                  working={forgiving}
                  pumping={pumping}
                  pumpTaps={pumpTaps}
                  onPump={handlePump}
                  meterValue={meter}
                  onComplete={handleForgive}
                  onProgress={handleBoost}
                />
              ) : (
                <ForgiveBlock
                  occasion={occasion}
                  toName={card.to_name}
                  fromName={card.from_name}
                  forgiven={forgiven}
                  forgiving={forgiving}
                  pumping={pumping}
                  pumpTaps={pumpTaps}
                  onPump={handlePump}
                  meterValue={meter}
                  onForgive={handleForgive}
                  onNo={handleNo}
                />
              )
            ) : null}

            {forgiven ? (
              <ReactionStrip
                cardId={resolveCardId(card)}
                live={live}
                initialReactions={initialReactions}
                onSticker={handleStickerBack}
                onSent={() => setReplied(true)}
              />
            ) : null}

            {/* Their reply, back to the sender. Appears with the celebration and
                stays for good once anything has been sent. */}
            {forgiven || replied ? (
              <div className="replyback">
                <p className="replyback__title">{fill(occasion.reply.title, { from: card.from_name })}</p>
                <p className="replyback__sub">{occasion.reply.sub}</p>
                <ShareRow
                  text={occasion.reply.shareText}
                  url={replyUrl || pageUrl}
                  channels={['native', 'whatsapp', 'telegram', 'sms', 'copy']}
                  hint={
                    hashMode
                      ? `This card lives entirely in its own link, so there is no separate reply page for it — sending this back is what tells ${card.from_name} you opened it.`
                      : `This opens a little page just for ${card.from_name}: that you opened it, that you said yes, and everything you sent back.`
                  }
                />
              </div>
            ) : null}
          </section>
        )}
      </div>

      {payoff ? (
        <PayoffOverlay key={payoff.key} text={payoff.text} reduced={payoff.reduced} stickers={stickers} />
      ) : null}

      {/* Theirs to keep, once it is open. A link is a promise about a server
          staying up; a picture in a camera roll is not. */}
      <KeepCard card={card} className="cardapp__keep" />

      <div className="cardapp__foot">
        <Link href="/">Made with Truce 🤍 Make your own</Link>
      </div>
    </div>
  );
}

/* Hash-mode cards have no id at all; the actions treat "local" as a no-op. */
function resolveCardId(card) {
  return card.id || 'local';
}

/* ==========================================================================
   The moment meter
   --------------------------------------------------------------------------
   One bar, three personalities: "Forgiveness" on an apology, "Birthday spirit"
   on a birthday, "Butterflies" on a proposal. Identical mechanics — it starts
   when the envelope opens, jumps when the letter has been read, and fills to
   the top at the moment itself. Only the words come from lib/occasions.js.
   ========================================================================== */

function meterLabel(meter, value, teasing, full) {
  if (teasing) return meter.teasing;
  if (full || value >= METER_FULL) return meter.full;
  if (value >= METER_READ) return meter.near;
  if (value > 0) return meter.warm;
  return meter.idle;
}

function MomentMeter({
  occasion,
  value,
  teasing,
  full,
  loading = false,
  pumping = false,
  pumpTaps = 0,
  onPump,
}) {
  const meter = occasion.meter;
  const pct = Math.max(0, Math.min(100, value));

  /* While they are pumping, the label escalates with every tap instead of
     describing a value — "keep going…", "more…", "so close!!". */
  const pumpLabels = meter.pumpLabels || [];
  const label = pumping
    ? pumpLabels[Math.min(pumpTaps, pumpLabels.length - 1)] || meter.pump
    : loading
      ? meter.loading
      : meterLabel(meter, value, teasing, full);

  const className = [
    'meter',
    teasing ? 'is-teasing' : '',
    pct >= METER_FULL && !loading ? 'is-full' : '',
    loading ? 'is-loading' : '',
    pumping ? 'is-pumping' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const bar = (
    <>
      <span className="meter__fill" style={{ width: `${pct}%` }} />
      <span className="meter__heart" style={{ left: `${pct}%` }} aria-hidden="true">
        💗
      </span>
    </>
  );

  const handlePump = (e) => {
    e.stopPropagation();
    if (!onPump) return;
    let x = e.clientX;
    let y = e.clientY;
    if (!x && !y) {
      const r = e.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    onPump({ x, y, el: e.currentTarget });
  };

  return (
    <div className={className}>
      <div className="meter__head">
        <span className="meter__title">{meter.title}</span>
        <span className="meter__label">{label}</span>
      </div>

      {pumping ? (
        /* A real <button>, so a keyboard can pump it too. The progress value
           lives in the accessible name — a progressbar inside a button would
           only get in the way. */
        <button
          type="button"
          className="meter__track meter__track--pump"
          onClick={handlePump}
          aria-label={`${meter.ariaLabel}, ${Math.round(pct)} percent. Tap to fill it up.`}
        >
          {bar}
        </button>
      ) : (
        <div
          className="meter__track"
          role="progressbar"
          aria-label={meter.ariaLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={label}
        >
          {bar}
        </div>
      )}

      {pumping ? <p className="meter__pump">{meter.pump}</p> : null}
    </div>
  );
}

/* ==========================================================================
   The payoff — the moment something goes all the way
   --------------------------------------------------------------------------
   Used twice: when the cuteness meter is tapped past 120%, and when the
   forgiveness / birthday / butterflies meter is pumped to the top. Big wobbling
   words, a rain of the card's own stickers, and then it gets out of the way.

   Two rules it must never break:
     - pointer-events:none the whole time, and unmounted when it is done, so it
       cannot swallow a tap meant for "Send something back";
     - with reduced motion it is a still frame — no wobble, no rain, no drift.
   ========================================================================== */

/** 8–12 stickers to rain, drawn from the packs the sender actually used. */
function rainStickers(cardStickers) {
  const pool = [];
  const packIds = [];
  for (const id of cardStickers || []) {
    const meta = getSticker(id);
    if (!meta) continue;
    const pack = PACKS.find((pk) => pk.stickers.some((st) => st.id === id));
    if (pack && !packIds.includes(pack.id)) {
      packIds.push(pack.id);
      pool.push(...pack.stickers.map((st) => st.id));
    }
  }
  /* A card with no stickers still deserves a party. */
  const source = pool.length ? pool : STICKERS.map((st) => st.id);
  const count = 8 + Math.floor(Math.random() * 5); // 8–12
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(source[Math.floor(Math.random() * source.length)]);
  }
  return out;
}

function PayoffOverlay({ text, reduced = false, stickers = [] }) {
  /* Chosen once per appearance of the overlay, never on re-render. */
  const [rain] = useState(() => (reduced ? [] : rainStickers(stickers)));

  return (
    <div className={`payoff${reduced ? ' payoff--still' : ''}`} aria-hidden="true">
      {rain.length ? (
        <div className="payoff__rain">
          {rain.map((id, i) => (
            <span
              key={`${id}-${i}`}
              className="payoff__drop"
              style={{
                left: `${4 + (i * 92) / rain.length + Math.random() * 6}%`,
                animationDelay: `${(i * 90 + Math.random() * 160).toFixed(0)}ms`,
                animationDuration: `${(1900 + Math.random() * 700).toFixed(0)}ms`,
                '--spin': `${Math.round(Math.random() * 120 - 60)}deg`,
              }}
            >
              <Sticker id={id} size={54 + Math.round(Math.random() * 26)} />
            </span>
          ))}
        </div>
      ) : null}

      <p className="payoff__text">{text}</p>

      {/* Announced once, calmly, for anyone not watching the fireworks. */}
      <p className="sr-only" role="status">
        {text}
      </p>
    </div>
  );
}

/* ==========================================================================
   The cuteness meter, recipient's edition
   --------------------------------------------------------------------------
   The sender watched this climb while they wrote. Now the person holding the
   letter gets to poke it — every tap adds a few percent and a puff of hearts
   where their finger landed, and around the sixth tap it gives up entirely at
   120%. Nothing here is sent anywhere or remembered; it is a toy.

   It is its own <button>, and it stops the click from bubbling, so it can
   never be mistaken for "skip the typewriter" or "tap the paper".
   ========================================================================== */

function CardCutenessMeter({ card, onOverload }) {
  const [start] = useState(() => cardCutenessStart(card));
  const [score, setScore] = useState(start);
  /* Mirrors `score` so the tap handler can do its arithmetic (and its one-off
     "it broke" burst) outside the state updater, which React is free to call
     more than once. */
  const scoreRef = useRef(start);
  const brokenRef = useRef(start >= CUTENESS_MAX);

  const step = cutenessTapStep(start);
  const broken = score >= CUTENESS_MAX;
  const label = cutenessLabel(score);

  const onTap = (e) => {
    e.stopPropagation();

    /* Hearts from exactly where they tapped — pointer events carry the point,
       keyboard activation does not, so fall back to the middle of the meter. */
    let x = e.clientX;
    let y = e.clientY;
    if (!x && !y) {
      const r = e.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    const next = Math.min(CUTENESS_MAX, scoreRef.current + step);
    scoreRef.current = next;
    setScore(next);

    if (next >= CUTENESS_MAX && !brokenRef.current) {
      brokenRef.current = true;
      /* It gave everything it had — and that deserves the whole show. */
      burstGlyphs(x, y, { count: 20, rise: true, min: 18, max: 42 });
      if (!prefersReducedMotion()) {
        window.setTimeout(() => burstGlyphs(x, y - 40, { count: 14, rise: true, min: 14, max: 34 }), 260);
      }
      if (onOverload) onOverload('CUTENESS OVERLOAD 🚨🧸💘');
    } else {
      burstGlyphs(x, y, { count: 5, min: 11, max: 20 });
    }
  };

  return (
    <button
      type="button"
      className={`cutetap${broken ? ' is-broken' : ''}`}
      onClick={onTap}
      aria-label={`Cuteness meter, ${score} percent. Tap to add more.`}
    >
      <span className="cutetap__head">
        <span className="cutetap__title">Cuteness</span>
        <span className="cutetap__label">
          {score}% · {label}
        </span>
      </span>
      {/* Decoration: the button's own label carries the number for anyone who
          cannot see the bar, and a widget role inside a button would only get
          in the way. */}
      <span className="cutetap__track" aria-hidden="true">
        <span className="cutetap__fill" style={{ width: `${(score / CUTENESS_MAX) * 100}%` }} />
      </span>
      <span className="cutetap__hint">
        {broken ? 'You broke it. Well done, honestly. 🚨' : 'Tap it. Go on — see how far it goes.'}
      </span>
    </button>
  );
}


/**
 * The pump panel, mirrored under the question.
 *
 * The meter itself lives at the top of the scene — on a phone that is a screen
 * and a half away by the time the moment happens, so the thing they are asked
 * to tap has to be right here, under their thumb, as well as up there.
 */
function PumpPanel({ occasion, value, taps, onPump }) {
  const pct = Math.max(0, Math.min(100, value));
  const labels = occasion.meter.pumpLabels || [];
  const nudge = labels[Math.min(taps, labels.length - 1)] || '';

  const tap = (e) => {
    e.stopPropagation();
    if (!onPump) return;
    let x = e.clientX;
    let y = e.clientY;
    if (!x && !y) {
      const r = e.currentTarget.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    onPump({ x, y, el: e.currentTarget });
  };

  return (
    <div className="forgive">
      <h3>{occasion.momentQuestion}</h3>
      <div className="pumpbox">
        <button
          type="button"
          className="pumpbox__btn"
          onClick={tap}
          aria-label={`${occasion.meter.ariaLabel}, ${Math.round(pct)} percent. Tap to fill it up.`}
        >
          <span className="pumpbox__heart" aria-hidden="true">
            💗
          </span>
          <span className="pumpbox__track" aria-hidden="true">
            <span className="pumpbox__fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="pumpbox__cta">{occasion.meter.pump}</span>
        </button>
        <p className="pumpbox__nudge" aria-live="polite">
          {taps > 0 ? nudge : ''}
        </p>
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

function ForgiveBlock({
  occasion,
  toName,
  fromName,
  forgiven,
  forgiving = false,
  pumping = false,
  pumpTaps = 0,
  meterValue = 0,
  onForgive,
  onNo,
  onPump,
}) {
  /* "No 😤 → Are you sure? → … → Okay fine… yes 🤍" for an apology; a softer
     script for a proposal. Same machinery, same surrender. */
  const NO_LABELS = occasion.noLabels || FALLBACK_NO_LABELS;
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

  /* Belt and braces: whatever else happens, the question is on screen when it
     appears. A forgive block half below the fold is what made the flow feel
     like it had stalled. */
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || typeof zone.scrollIntoView !== 'function') return;
    const t = window.setTimeout(() => {
      try {
        zone.scrollIntoView({
          block: 'center',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      } catch {
        zone.scrollIntoView();
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  const dodge = useCallback(() => {
    if (surrendered) return;

    const now = Date.now();
    if (now - lastMoveRef.current < 160) return; // hover and tap can both fire
    lastMoveRef.current = now;

    pendingRef.current = true;
    setNoIndex((i) => Math.min(i + 1, NO_LABELS.length - 1));
    if (onNo) onNo();
  }, [surrendered, onNo]);

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

    /* If any of this throws, or the button cannot be measured, it gives up
       immediately rather than leaving the recipient with a button that has
       gone somewhere unhelpful. The flow must never dead-end. */
    try {
      const current = nudgeRef.current;
      /* Three jobs, one bit of maths:
           dodge    — it ran away, so pick a new spot and shrink a little
           settle   — it gave up, so go back to full size and its place in the row
           re-clamp — the viewport changed, so just pull it back into view       */
      const scale = surrendered ? 1 : moving ? Math.max(0.55, current.scale - 0.12) : current.scale;

      const base = measureUntransformed(button);
      const baseW = base.width;
      const baseH = base.height;
      if (!baseW || !baseH) {
        if (!surrendered) setNoIndex(NO_LABELS.length - 1);
        return;
      }

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
    } catch {
      /* Something about this layout defeated us — hand them the easy way out. */
      if (!surrendered) {
        applyNudge({ x: 0, y: 0, scale: 1 });
        setNoIndex(NO_LABELS.length - 1);
      }
    }
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

  /* The beat while the meter fills. The question is answered, so the buttons
     go — but the celebration waits for the bar to reach the end.

     The forgiveness meter itself lives at the top of the scene, which on a
     phone is a screen and a half away by now, so the same value is mirrored
     here: the payoff has to happen where they are actually looking. */
  if (pumping) {
    return <PumpPanel occasion={occasion} value={meterValue} taps={pumpTaps} onPump={onPump} />;
  }

  if (forgiving) {
    const pct = Math.max(0, Math.min(100, meterValue));
    return (
      <div className="forgive">
        <h3>{occasion.momentQuestion}</h3>
        <div className="forgive__loading" role="status">
          <span className="forgive__loading-heart" aria-hidden="true">
            💗
          </span>
          <span className="forgive__loading-track" aria-hidden="true">
            <span className="forgive__loading-fill" style={{ width: `${pct}%` }} />
          </span>
          <p>{occasion.meter.loadingCaption}</p>
        </div>
      </div>
    );
  }

  if (forgiven) {
    return (
      <div className="forgive">
        <div className="forgiven">
          <span className="forgiven__emoji" aria-hidden="true">
            {occasion.momentDoneEmoji}
          </span>
          <h3>{fill(occasion.momentDone, { name: toName, from: fromName })}</h3>
          <p>{fill(occasion.momentDoneSub, { name: toName, from: fromName })}</p>
          <HugButton label={occasion.hugLabel} />
        </div>
      </div>
    );
  }

  return (
    <div className="forgive">
      <h3>{occasion.momentQuestion}</h3>
      <div className="forgive__zone" ref={zoneRef}>
        <button
          type="button"
          className="btn-yes"
          ref={yesRef}
          onClick={(e) => onForgive(e.currentTarget)}
        >
          {occasion.momentYes || 'Yes ❤️'}
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

function HugButton({ label: initial = 'Send a hug back 🤗' }) {
  const [label, setLabel] = useState(initial);
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
   The candles — a birthday's version of the forgive moment
   --------------------------------------------------------------------------
   A drawn cake in the card's own theme, with `severity + 2` lit candles: three
   for a quiet little moment, five for the full fireworks. Each tap puts one out
   with a puff of smoke, and the last one takes the confetti.

   Everything is drawn with CSS and one small SVG so it themes itself — the cake
   is made of var(--t-accent) and var(--t-paper) like the rest of the card, and
   looks right on Midnight Plum as well as Blush Rose.
   ========================================================================== */

/** How many candles for a given "how big should this feel?" answer. */
function candleCount(severity) {
  const n = Number(severity);
  return ([1, 2, 3].includes(n) ? n : 2) + 2;
}

/**
 * The cake, in one viewBox with no wasted space at the top — the candles are
 * real DOM buttons sitting directly above it, so any padding inside the SVG
 * would leave them hovering in mid-air.
 *
 *   y  2 – 22   frosting, with drips reaching ~33
 *   y 14 – 76   the cake itself (its top hidden under the frosting)
 *   y 74 – 85   the plate
 */
const CAKE = { left: 26, right: 194, radius: 13, frostTop: 2, frostBase: 22, bumps: 7 };

/**
 * The scalloped frosting: rounded shoulders, then drips drawn right to left so
 * they line up however wide the cake is.
 */
function frostingPath({ left, right, radius, frostTop, frostBase, bumps }) {
  const w = (right - left) / bumps;
  let d =
    `M${left} ${frostTop + radius}` +
    ` a${radius} ${radius} 0 0 1 ${radius} ${-radius}` +
    ` H${right - radius}` +
    ` a${radius} ${radius} 0 0 1 ${radius} ${radius}` +
    ` V${frostBase}`;
  for (let i = 0; i < bumps; i += 1) d += ` q ${-w / 2} 11 ${-w} 0`;
  return `${d} Z`;
}

/* Fixed so the cake looks identical on every render. */
const SPRINKLES = [
  { x: 50, y: 44, r: 3.1, o: 0.5 },
  { x: 76, y: 56, r: 2.4, o: 0.38 },
  { x: 104, y: 42, r: 3.4, o: 0.46 },
  { x: 133, y: 57, r: 2.6, o: 0.4 },
  { x: 160, y: 45, r: 3, o: 0.48 },
  { x: 90, y: 64, r: 2.2, o: 0.32 },
  { x: 146, y: 38, r: 2.2, o: 0.32 },
  { x: 118, y: 66, r: 2.4, o: 0.3 },
];

function CandleMoment({
  occasion,
  toName,
  fromName,
  severity,
  done,
  working = false,
  pumping = false,
  pumpTaps = 0,
  onPump,
  meterValue = 0,
  onComplete,
  onProgress,
}) {
  const total = candleCount(severity);
  const [outCount, setOutCount] = useState(0);
  const zoneRef = useRef(null);

  /* Same courtesy as the forgive block: make sure the moment is on screen when
     it arrives, rather than half a scroll below the fold. */
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || typeof zone.scrollIntoView !== 'function') return undefined;
    const t = window.setTimeout(() => {
      try {
        zone.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      } catch {
        zone.scrollIntoView();
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  const blowOut = (index, element) => {
    if (done || working) return;
    if (index < outCount) return;              // already out
    if (index !== outCount) return;            // one at a time, left to right

    const next = outCount + 1;
    setOutCount(next);

    /* A puff of wish-sparkle from the wick itself. */
    if (element) {
      const r = element.getBoundingClientRect();
      burstGlyphs(r.left + r.width / 2, r.top, {
        count: next >= total ? 12 : 5,
        glyphs: ['✨', '💫', '🕯️'],
        rise: true,
        min: 12,
        max: 24,
      });
    }

    if (next >= total) {
      onComplete(element);
      return;
    }
    if (onProgress) onProgress();
  };

  if (pumping) {
    return <PumpPanel occasion={occasion} value={meterValue} taps={pumpTaps} onPump={onPump} />;
  }

  if (working) {
    const pct = Math.max(0, Math.min(100, meterValue));
    return (
      <div className="forgive" ref={zoneRef}>
        <h3>{occasion.momentQuestion}</h3>
        <div className="forgive__loading" role="status">
          <span className="forgive__loading-heart" aria-hidden="true">
            🕯️
          </span>
          <span className="forgive__loading-track" aria-hidden="true">
            <span className="forgive__loading-fill" style={{ width: `${pct}%` }} />
          </span>
          <p>{occasion.meter.loadingCaption}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="forgive" ref={zoneRef}>
        <div className="forgiven">
          <span className="forgiven__emoji" aria-hidden="true">
            {occasion.momentDoneEmoji}
          </span>
          <h3>{fill(occasion.momentDone, { name: toName, from: fromName })}</h3>
          <p>{fill(occasion.momentDoneSub, { name: toName, from: fromName })}</p>
          <HugButton label={occasion.hugLabel} />
        </div>
      </div>
    );
  }

  const lit = total - outCount;

  return (
    <div className="forgive" ref={zoneRef}>
      <h3>{occasion.momentQuestion}</h3>
      {occasion.momentSub ? <p className="cake__sub">{occasion.momentSub}</p> : null}

      <div className="cake">
        <div className="cake__candles">
          {Array.from({ length: total }, (_, i) => {
            const isOut = i < outCount;
            return (
              <button
                type="button"
                key={i}
                className={`candle${isOut ? ' is-out' : ''}`}
                disabled={isOut}
                aria-label={
                  isOut
                    ? `Candle ${i + 1} of ${total}, blown out`
                    : `Blow out candle ${i + 1} of ${total}`
                }
                onClick={(e) => blowOut(i, e.currentTarget)}
              >
                <span className="candle__smoke" aria-hidden="true" />
                <span className="candle__flame" aria-hidden="true" />
                <span className="candle__wick" aria-hidden="true" />
                <span className="candle__stick" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <svg className="cake__art" viewBox="0 0 220 92" role="img" aria-label="A birthday cake">
          {/* the shadow it sits in */}
          <ellipse cx="110" cy="86" rx="80" ry="5" fill="var(--t-ink)" opacity="0.11" />
          {/* the plate */}
          <rect x="16" y="73" width="188" height="11" rx="5.5" fill="var(--t-accent-soft)" />
          <rect x="16" y="73" width="188" height="4" rx="2" fill="var(--t-paper)" opacity="0.4" />
          {/* the cake itself — its top edge hides under the frosting */}
          <rect x="26" y="14" width="168" height="62" rx="13" fill="var(--t-accent)" />
          {SPRINKLES.map((sp, i) => (
            <circle key={i} cx={sp.x} cy={sp.y} r={sp.r} fill="var(--t-paper)" opacity={sp.o} />
          ))}
          {/* a soft highlight so the side does not read flat */}
          <rect x="36" y="30" width="42" height="7" rx="3.5" fill="var(--t-paper)" opacity="0.2" />
          {/* frosting, dripping over the edge */}
          <path d={frostingPath(CAKE)} fill="var(--t-paper)" />
          <path d={frostingPath(CAKE)} fill="var(--t-accent)" opacity="0.09" />
        </svg>
      </div>

      <p className="cake__count" role="status">
        {lit > 0
          ? `${lit} candle${lit === 1 ? '' : 's'} still lit 🕯️`
          : 'All out — make it count ✨'}
      </p>
    </div>
  );
}

/* ==========================================================================
   Send something back — emoji reactions
   ========================================================================== */

function ReactionStrip({ cardId, live, initialReactions = [], onSticker, onSent }) {
  const [sending, setSending] = useState('');
  const [last, setLast] = useState(null);   // what they just sent, shown big
  const [sent, setSent] = useState([]);     // every value sent this visit
  const [note, setNote] = useState('');
  const [packId, setPackId] = useState(PACKS[0].id);   // which sticker pack the tray shows
  const isDemo = cardId === 'demo';
  /* Everything sent for this card, oldest first: what the server already had,
     plus anything tapped since the page loaded. */
  const [history, setHistory] = useState(() =>
    initialReactions.map((r, i) => ({ key: `s${r.id ?? i}`, stored: r.emoji })),
  );

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

    /* Optimistic: it appears in the strip (and on the letter) straight away. */
    setHistory((list) => [...list, { key: `local-${Date.now()}-${list.length}`, stored }]);
    if (kind === 'sticker' && onSticker) onSticker(value);
    if (onSent) onSent();

    try {
      /* Bounded: a stalled request must not leave every reaction button
         disabled with a spinner nobody can dismiss. */
      const res = await withTimeout(addReaction(cardId, stored), 8000, {
        ok: false,
        error: 'That is taking a while — it may not have sent. Try again?',
      });
      if (res.ok) {
        setSent((list) => (list.includes(stored) ? list : [...list, stored]));
        setNote(
          live && res.mode !== 'demo'
            ? 'Sent 🤍 they will see it on their page.'
            : isDemo
              ? 'Sent 🤍 (this is the sample card, so nothing is saved.)'
              : 'Sent 🤍 (nothing is saved for this one — it stays on your screen.)',
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
      {history.length ? (
        <div className="sentback">
          <p className="sentback__label">Sent back so far</p>
          <div className="sentback__row">
            {history.map((item) => {
              const parsed = parseReaction(item.stored);
              if (!parsed) return null;
              return parsed.kind === 'sticker' ? (
                <span className="sentback__item" key={item.key}>
                  <Sticker id={parsed.value} size={40} />
                </span>
              ) : (
                <span className="sentback__item sentback__item--emoji" key={item.key}>
                  {parsed.value}
                </span>
              );
            })}
          </div>
          {!live ? (
            <p className="sentback__note">
              {isDemo
                ? 'This is the sample card, so these stay on your screen only — nothing is saved.'
                : 'This letter arrived with everything tucked inside its link, so these stay on your screen only.'}
            </p>
          ) : null}
        </div>
      ) : null}

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
