'use client';

import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './ui';

/**
 * The little conversation that plays inside the "Our corner" promo card.
 *
 * It is a picture of the product, not the product: nothing here talks to a
 * server, and the whole thing is aria-hidden because the paragraph beside it
 * already says what a corner is. A screen reader gains nothing from three
 * decorative chat bubbles.
 *
 * WHY IT REPLAYS
 * --------------
 * The promo sits well below the fold. A static mockup that finished animating
 * before anybody scrolled to it is just a flat image, so the sequence waits for
 * the card to actually come into view (IntersectionObserver), plays once, then
 * rests for a beat and plays again. It pauses the moment it scrolls out again
 * so a tab left open in the background is not running a timer forever.
 *
 * REDUCED MOTION
 * --------------
 * `prefers-reduced-motion` gets the finished conversation immediately, with no
 * typing indicator and no replay. The information is identical; only the
 * theatre is gone.
 */

const SCRIPT = [
  { side: 'them', body: 'are you awake?', time: '02:14' },
  { side: 'mine', body: 'always, for this 🤍', time: '02:14' },
  { side: 'them', body: 'ok. can we start over tomorrow?', time: '02:15' },
];

/* How long the "…" shows before each bubble lands. The first is shorter so the
   card does not sit visibly empty while somebody is looking straight at it. */
const TYPING_MS = [420, 900, 1100];
const REST_MS = 3200;

export default function CornerDemo() {
  /* Start with everything shown. If JavaScript never runs, or the observer
     never fires, the visitor sees the finished conversation rather than an
     empty card — the failure mode should be "not animated", not "not there". */
  const [shown, setShown] = useState(SCRIPT.length);
  const [typing, setTyping] = useState(false);
  const ref = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver !== 'function') return undefined;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    /* One pass: type, land, type, land … then rest and start again. */
    const play = () => {
      clear();
      setShown(0);
      setTyping(true);

      let at = 0;
      SCRIPT.forEach((_, i) => {
        at += TYPING_MS[i] ?? 900;
        timers.current.push(
          setTimeout(() => {
            setShown(i + 1);
            setTyping(i + 1 < SCRIPT.length);
          }, at),
        );
      });

      timers.current.push(setTimeout(play, at + REST_MS));
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else {
          clear();
          /* Leave it finished rather than blank, so a glance on the way past
             never catches an empty card. */
          setShown(SCRIPT.length);
          setTyping(false);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clear();
    };
  }, []);

  return (
    <div className="corner-demo" ref={ref} aria-hidden="true">
      <span className="corner-demo__day">Day 412 together 💙</span>

      <div className="corner-demo__thread">
        {SCRIPT.map((line, i) => (
          <div
            key={line.body}
            className={`bubble${line.side === 'mine' ? ' bubble--mine' : ''}${
              i < shown ? ' is-in' : ' is-out'
            }`}
          >
            <p className="bubble__body">{line.body}</p>
            <span className="bubble__time">{line.time}</span>
          </div>
        ))}

        {typing ? (
          <div className="corner-demo__typing">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
    </div>
  );
}
