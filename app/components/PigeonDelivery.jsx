'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Scene 0 — the delivery.
 *
 * A pigeon carries the letter in from the horizon, releases it, and it lands
 * exactly where the envelope is about to be. The envelope it drops IS the
 * envelope you then tap: a match cut, so the whole thing reads as one
 * continuous moment rather than an animation followed by a user interface.
 *
 * WHY GO TO THIS TROUBLE
 * ----------------------
 * The four seconds before somebody reads an apology are the only four seconds
 * they are guaranteed to feel anything. Spent on a spinner they feel nothing;
 * spent on something arriving from a long way away they feel it was carried.
 * That is the entire argument, and it is why this is allowed to cost 4.5s of
 * somebody's time exactly once.
 *
 * THE ANIMATION, BEAT BY BEAT
 * ---------------------------
 *   0.0-1.3  distance    a speck on the horizon, blurred, wings a blur. Clouds
 *                        drift at two speeds so there is depth to cross.
 *   1.3-2.6  approach    it grows along an ARC and banks into the turn. Never
 *                        a straight line — nothing alive travels in one.
 *   2.6-3.1  anticipate  it pulls up and holds still for a beat. The pause is
 *                        what makes the release read as a decision.
 *   3.1-3.9  the fall    a parabola with drag wobble, rotating, slowing.
 *   3.9-4.5  landing     squash, a puff of dust, one small bounce, settle.
 *                        Then a single feather drifts down after it — the
 *                        follow-through, and the detail that sells the whole
 *                        thing as something with weight.
 *
 * Twelve-principles homework, for anyone editing this: arcs on every path,
 * squash-and-stretch on the landing, anticipation before the drop, secondary
 * action (feather, dust, cloud drift), overlapping action (wings keep beating
 * through the glide), slow in and slow out everywhere via cubic-bezier, and
 * staging — a vignette pulls the eye to the middle where the letter will land.
 *
 * WHAT IT WILL NOT DO
 * -------------------
 *   - Run twice. Once per card per device; after that the envelope is simply
 *     there. A four-second delivery on the fifth visit is not charming.
 *   - Fight `prefers-reduced-motion`. That setting is frequently a vestibular
 *     condition, and an arcing, tumbling, squashing thing is precisely what it
 *     is set to prevent. Those visitors get a still sky and a gentle fade.
 *   - Trap anybody. Tap anywhere to skip, Escape to skip, and a visible Skip
 *     control for people who are not going to guess that tapping works.
 *   - Block the card. If anything here throws, the envelope is already
 *     underneath it — the scene is decoration layered over a working page.
 */

/**
 * Is this device going to see the delivery at all?
 *
 * Asked in two places — the layout effect that locks the page and measures the
 * landing, and the effect that starts the clock — and they have to agree. When
 * only the second one knew, a returning visitor got the scroll lock and the
 * card's entrance animation suppressed for one frame before the first effect
 * found out there was nothing to play. That is a flicker on every visit after
 * the first, in service of an animation that is not even going to run.
 *
 * ?replay=1 overrides the memory on purpose: a four-second moment you cannot
 * rewatch is a strange thing to build.
 */
function willPlay(cardId) {
  let replay = false;
  try {
    replay = new URLSearchParams(window.location.search).get('replay') === '1';
  } catch {
    /* No URLSearchParams is old enough that the animation is the lesser worry. */
  }
  if (replay) return true;

  try {
    return window.localStorage.getItem(`truce.delivered.${cardId}`) !== '1';
  } catch {
    /* Unreadable storage counts as never seen — the animation is the point. */
    return true;
  }
}

/* Total run, kept in one place because the CSS and the timeout have to agree.
   If they drift, the scene either cuts off mid-flight or hangs after landing. */
const RUN_MS = 5200;

/** Pigeon, side profile, built so the near wing can beat independently. */
function Pigeon() {
  return (
    /*
     * Deliberately darker than a real pigeon.
     *
     * The first pass used the actual grey-blues a pigeon wears, and against a
     * pale dusk sky the whole bird dissolved — a light grey shape on a light
     * pink field, at 20% scale, is nothing. Everything here is pushed several
     * steps down in value so the silhouette survives being small, with a warm
     * rim light on top because the sun is on the horizon behind it.
     */
    <svg className="pig__bird" viewBox="0 0 120 90" aria-hidden="true">
      {/* far wing — behind the body, beating slightly behind it, so the bird
          reads as three-dimensional rather than as a cardboard cut-out */}
      <g className="pig__wing pig__wing--far">
        <path d="M62 42 C 50 24, 32 15, 17 21 C 29 28, 42 36, 54 48 Z" fill="#5E6E8C" />
      </g>

      {/* tail — properly fanned, and dark enough to read as a tail rather than
          as a smudge behind the body */}
      <path d="M76 45 C 90 40, 103 42, 112 49 C 101 52, 88 54, 77 51 Z" fill="#6E7F9E" />
      <path d="M78 47 L 108 49" stroke="#5E6E8C" strokeWidth="1.2" opacity=".7" />

      {/* body */}
      <ellipse cx="59" cy="47" rx="23" ry="15.5" fill="#8497B5" />
      {/* one soft light source, low and behind: a warm rim along the top */}
      <path d="M40 40 C 50 32, 70 32, 80 40 C 70 35, 50 35, 40 40 Z" fill="#F6D9C4" opacity=".85" />
      <ellipse cx="53" cy="45" rx="13" ry="8.5" fill="#9BADC8" opacity=".9" />

      {/* head */}
      <circle cx="34" cy="38" r="10.5" fill="#8C9EBC" />
      <path d="M26 32 C 30 28, 39 28, 43 33 C 38 30, 30 30, 26 32 Z" fill="#F6D9C4" opacity=".8" />

      {/* the collar iridescence every pigeon has and almost nobody draws */}
      <path d="M41 45 C 39 49, 43 52, 47 51" stroke="#5FA391" strokeWidth="2.6" fill="none" opacity=".8" />

      {/* eye — a dot with a catchlight. The catchlight is most of the charm. */}
      <circle cx="30" cy="36" r="2.6" fill="#20293C" />
      <circle cx="29.1" cy="35.1" r="1" fill="#FFFFFF" />

      {/* beak */}
      <path d="M25 37.5 L 13 40 L 25 43.5 Z" fill="#D98A70" />

      {/* feet, tucked up the way a bird in flight actually holds them */}
      <path d="M56 61 C 55 65, 53 66, 51 66" stroke="#D98A70" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M63 61 C 62 65, 60 66, 58 66" stroke="#D98A70" strokeWidth="2.6" strokeLinecap="round" fill="none" />

      {/* The letter, in its feet.

          Without this the bird flies in empty-footed and a letter simply
          begins falling near it, which is a thing happening rather than a
          thing being delivered. It vanishes on the frame the falling letter
          takes over, so there is never one of each on screen. */}
      <g className="pig__carry">
        <rect x="50" y="62" width="26" height="17" rx="2.6" fill="#FFFDFB" stroke="#E8C9BF" strokeWidth="1.4" />
        <path d="M50 64 L 63 72 L 76 64" fill="none" stroke="#E8C9BF" strokeWidth="1.4" />
        <circle cx="63" cy="72" r="2.6" fill="#E85D75" />
      </g>

      {/* near wing — the one doing the work, and the darkest thing on screen so
          the downstroke reads even at a distance */}
      <g className="pig__wing pig__wing--near">
        <path d="M59 41 C 47 18, 26 8, 9 16 C 24 25, 39 35, 51 49 Z" fill="#6A7C9C" />
        <path d="M57 41 C 47 27, 33 18, 21 21 C 33 27, 45 35, 53 45 Z" fill="#8497B5" opacity=".85" />
        {/* two flight-feather lines. Almost invisible, and the thing that stops
            the wing reading as a folded paper triangle. */}
        <path d="M52 44 C 42 32, 30 24, 20 22" stroke="#57678A" strokeWidth="1.1" fill="none" opacity=".65" />
        <path d="M49 47 C 40 36, 28 27, 16 20" stroke="#57678A" strokeWidth="1.1" fill="none" opacity=".5" />
      </g>
    </svg>
  );
}

/** The letter, in the air. Deliberately the same shape as the settled one. */
function FallingLetter() {
  return (
    <svg className="pig__env" viewBox="0 0 100 68" aria-hidden="true">
      <rect x="1" y="1" width="98" height="66" rx="7" fill="#FFFDFB" stroke="#F0D9D2" strokeWidth="2" />
      <path d="M1 8 L 50 40 L 99 8" fill="none" stroke="#F0D9D2" strokeWidth="2" />
      <circle cx="50" cy="41" r="9" fill="#E85D75" />
      <path
        d="M50 46 s -5 -3 -5 -6.5 a 2.6 2.6 0 0 1 5 -1 a 2.6 2.6 0 0 1 5 1 c 0 3.5 -5 6.5 -5 6.5 z"
        fill="#FFF7F2"
      />
    </svg>
  );
}

export default function PigeonDelivery({ cardId, onDone, fromName }) {
  /* 'checking' until we know whether this device has already seen it — showing
     the sky for even one frame and then yanking it away is worse than a small
     delay before it starts. */
  const [phase, setPhase] = useState('checking');
  /* Where the real envelope actually is, in pixels.

     The whole scene is built around a match cut: the letter the pigeon drops
     has to BECOME the envelope you tap, not sit next to it. Guessing at the
     position with vh units put the two of them in different places at different
     viewport sizes, and what you saw was two envelopes and a crossfade between
     them. So it is measured instead, before paint, from the element itself. */
  const [land, setLand] = useState(null);
  const doneRef = useRef(false);
  const timerRef = useRef(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);

    try {
      window.localStorage.setItem(`truce.delivered.${cardId}`, '1');
    } catch {
      /* Storage blocked — it plays again next time, which is a small cost and
         nothing like a broken card. */
    }
    try {
      document.documentElement.classList.remove('pig-locked');
    } catch {}

    setPhase('gone');
    if (onDone) onDone();
  }, [cardId, onDone]);

  useLayoutEffect(() => {
    /* Nothing to lock and nothing to measure if it is not going to play. */
    if (!willPlay(cardId)) return undefined;

    /* Lock first, measure second. The lock also stops the envelope's two idle
       animations dead at their base pose, so the rect is the resting one. */
    try {
      document.documentElement.classList.add('pig-locked');
    } catch {}

    const measure = () => {
      const target = document.querySelector('.env');
      if (!target) return;
      const r = target.getBoundingClientRect();
      if (r.width > 0) setLand({ left: r.left, top: r.top, width: r.width });
    };

    measure();

    /*
     * And again once the fonts have landed.
     *
     * The heading and subtitle above the envelope are set in Fraunces. Until it
     * arrives they are drawn in a fallback with different metrics, the block is
     * a different height, and the envelope sits about ten pixels lower than it
     * finally will. Measuring only at mount captured that pre-swap position and
     * the letter landed ten pixels below its target — which is exactly the sort
     * of near-miss that reads as sloppiness rather than as a bug.
     *
     * There is loads of time: nothing falls until 2.6s.
     */
    let alive = true;
    try {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (alive) measure();
        });
      }
    } catch {
      /* No font loading API. The mount measurement stands. */
    }

    /* A rotation mid-flight moves the target too. */
    window.addEventListener('resize', measure);
    return () => {
      alive = false;
      window.removeEventListener('resize', measure);

      /* Whatever happens to this component, the page must not be left locked.
         finish() normally takes the class off, but nothing guarantees finish()
         runs — the card can decide to show the letter and unmount the scene
         underneath it, and a page stuck at overflow:hidden with the sky gone is
         a card nobody can scroll. */
      try {
        document.documentElement.classList.remove('pig-locked');
      } catch {}
    };
  }, [cardId]);
  useEffect(() => {
    /* Once is once.

       finish() calls onDone, the card re-renders, and it hands down a fresh
       onDone identity — which changes this effect's dependencies and runs it
       all over again, setting phase back to 'flying' and putting the sky back
       up. It was invisible only because pigOut had already finished and its
       fill left the element at opacity 0, so a full-screen overlay sat on top
       of the card indefinitely, one CSS change away from being a bug somebody
       reported. */
    if (doneRef.current) return undefined;

    const play = willPlay(cardId);

    /* Frequently a vestibular condition rather than a preference. An arcing,
       tumbling, squashing thing is exactly what it is set to prevent. */
    let calm = false;
    try {
      calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* Old browser, no matchMedia. Play it. */
    }

    if (!play) {
      try {
        document.documentElement.classList.remove('pig-locked');
      } catch {}
      doneRef.current = true;
      setPhase('gone');
      if (onDone) onDone();
      return undefined;
    }

    setPhase(calm ? 'calm' : 'flying');
    timerRef.current = window.setTimeout(finish, calm ? 900 : RUN_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cardId, finish, onDone]);

  useEffect(() => {
    if (phase !== 'flying' && phase !== 'calm') return undefined;
    const onKey = (e) => {
      /* Escape is the one key everybody already knows means "let me out". */
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finish]);

  if (phase === 'checking' || phase === 'gone') return null;

  const calm = phase === 'calm';

  return (
    <div
      className={`pig${calm ? ' pig--calm' : ''}`}
      /* Decorative in full: the card underneath carries the real text, and a
         screen reader should be reading that, not narrating a bird. */
      aria-hidden="true"
      onClick={finish}
    >
      <div className="pig__sky" />
      <div className="pig__sun" />

      {/* Two speeds of cloud. Depth is what makes "far away" mean anything. */}
      <div className="pig__clouds pig__clouds--far">
        <span className="pig__cloud" style={{ top: '18%', left: '-20%' }} />
        <span className="pig__cloud" style={{ top: '31%', left: '30%', transform: 'scale(0.7)' }} />
        <span className="pig__cloud" style={{ top: '12%', left: '70%', transform: 'scale(0.55)' }} />
      </div>
      <div className="pig__clouds pig__clouds--near">
        <span className="pig__cloud" style={{ top: '46%', left: '-30%', transform: 'scale(1.3)' }} />
        <span className="pig__cloud" style={{ top: '58%', left: '55%', transform: 'scale(1.1)' }} />
      </div>

      {/* Staging: darkened edges so the eye has nowhere to go but the middle,
          which is where the letter is about to be. */}
      <div className="pig__vignette" />

      {!calm ? (
        <div className="pig__flight">
          <div className="pig__bank">
            <Pigeon />
          </div>
        </div>
      ) : null}

      {/* Positioned on the measured rect, so the last frame of the fall and
          the first frame of the envelope you tap are the same pixels. */}
      <div
        className="pig__drop"
        style={land ? { left: land.left, top: land.top, width: land.width, marginLeft: 0 } : undefined}
      >
        <FallingLetter />
      </div>

      {/* Landing: dust, and then a feather a beat later. The feather arrives
          after everything has stopped, which is what makes it land. */}
      {!calm ? (
        <>
          <span className="pig__puff" />
          <span className="pig__feather">
            <svg viewBox="0 0 24 40" aria-hidden="true">
              <path d="M12 1 C 19 10, 20 26, 12 39 C 4 26, 5 10, 12 1 Z" fill="#DCE4F1" />
              <path d="M12 3 L 12 37" stroke="#B4C1D6" strokeWidth="1.2" />
            </svg>
          </span>
        </>
      ) : null}

      <p className="pig__caption">
        {fromName ? `Something from ${fromName}` : 'Something is on its way'}
      </p>

      <button type="button" className="pig__skip" onClick={finish}>
        Skip
      </button>
    </div>
  );
}
