'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { absoluteTime, friendlyDateTime } from '@/lib/format';

/**
 * A sealed time-capsule letter.
 *
 * This component is deliberately incapable of showing the letter: the server
 * never sent it. All it receives is the two names, the theme and the moment the
 * seal breaks (see app/c/[id]/page.js). When the countdown reaches zero it
 * reloads, and the server hands over the real card.
 */
/**
 * Reload guard, deliberately a module-level variable.
 *
 * It must survive this component unmounting and remounting, but NOT survive a
 * real page load — which is exactly what a module variable does. Storage is not
 * an option (Truce keeps nothing in sessionStorage), and a ref would be reset
 * by the very remount we are guarding against.
 */
let reloadRequested = false;

export default function LockedCard({ card, serverNow }) {
  const unlockAt = card.unlock_at;

  /* Dates and countdowns are local-clock things, so nothing time-shaped is
     rendered until after mount — otherwise the server's timezone and the
     visitor's would disagree and React would complain about it. */
  const [mounted, setMounted] = useState(false);
  /* Starts empty rather than "however many seconds are left right now": the
     server and the browser run that sum at different moments, and React would
     rightly complain that the two renders disagree. */
  const [left, setLeft] = useState(null);

  useEffect(() => {
    setMounted(true);

    /**
     * Whose clock decides when this opens?
     *
     * The server's — because the server is what actually refuses to send the
     * words. A device running ten minutes fast used to hit zero early, reload,
     * get the sealed page again (the server still says "not yet"), and reload
     * again, forever.
     *
     * So we measure the offset between the two clocks ONCE at mount and count
     * down against server time from then on. Every later tick uses the
     * browser's own elapsed time, which is reliable even when its wall clock is
     * not.
     */
    const mountedAt = Date.now();
    const offset = typeof serverNow === 'number' && Number.isFinite(serverNow) ? serverNow - mountedAt : 0;
    const serverTime = () => Date.now() + offset;

    let reloadTimer = 0;

    const tick = () => {
      const next = remaining(unlockAt, serverTime());
      setLeft(next);
      if (next.total > 0 || reloadRequested) return;

      /* The moment has arrived. Ask the server again — it is the only one that
         can hand over the words. Exactly once: if it comes back still sealed
         (clock skew, a slow write) we show the countdown at zero rather than
         reloading in a loop. The 2s wait also lets a just-passed deadline
         settle on the server side. */
      reloadRequested = true;
      window.clearInterval(timer);
      reloadTimer = window.setTimeout(() => window.location.reload(), 2000);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
      if (reloadTimer) window.clearTimeout(reloadTimer);
    };
  }, [unlockAt, serverNow]);

  useEffect(() => {
    document.body.classList.add('is-locked');
    return () => document.body.classList.remove('is-locked');
  }, []);

  const when = mounted ? friendlyDateTime(unlockAt) : absoluteTime(unlockAt);

  return (
    <div className="cardapp themed" data-theme={card.theme || 'blush'}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <section className="cardapp__scene env-scene">
          <div className="env-scene__stack">
            <span className="sealed-flag">🕰️ Sealed letter</span>

            <h2>For {card.to_name}</h2>
            <p className="env-scene__sub">
              {card.from_name} sealed this until <b>{when}</b>.
            </p>

            <span className="env-wrap">
              <span className="env-idle env-idle--sealed">
                <span className="env env--sealed">
                  <span className="env__back" />
                  <span className="env__letter">
                    <span>A letter from {card.from_name}</span>
                  </span>
                  <span className="env__front" />
                  <span className="env__flap" />
                  <span className="env__seal env__seal--clock">
                    <ClockFace />
                  </span>
                </span>
              </span>
            </span>

            <Countdown left={left} ready={mounted && Boolean(left)} />

            <p className="sealed-note">
              It opens by itself — no need to keep tapping. Come back then, or leave this page
              open and it will unseal in front of you.
            </p>
          </div>
        </section>
      </div>

      <div className="cardapp__foot">
        <Link href="/">Made with Truce 🤍 Make your own</Link>
      </div>
    </div>
  );
}

/* A little wax-stamped clock, drawn rather than an emoji so it inherits the
   seal colour of every theme. */
function ClockFace() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".95" />
      <path
        d="M12 7.6V12l3 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Countdown({ left, ready }) {
  const value = left || { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const parts = [
    { value: value.days, label: value.days === 1 && ready ? 'day' : 'days' },
    { value: value.hours, label: value.hours === 1 && ready ? 'hour' : 'hours' },
    { value: value.minutes, label: value.minutes === 1 && ready ? 'min' : 'mins' },
    { value: value.seconds, label: value.seconds === 1 && ready ? 'sec' : 'secs' },
  ];

  return (
    <div className="countdown" role="timer" aria-label="Time until this letter opens">
      {parts.map((part) => (
        <span className="countdown__cell" key={part.label}>
          <b>{ready ? String(part.value).padStart(2, '0') : '––'}</b>
          <small>{part.label}</small>
        </span>
      ))}
    </div>
  );
}

/** Milliseconds left, split into whole days / hours / minutes / seconds.
 *  `now` is server time (see the offset calculation above), not the device's. */
function remaining(unlockAt, now = Date.now()) {
  const target = new Date(unlockAt).getTime();
  const total = Number.isNaN(target) ? 0 : Math.max(0, target - now);
  return {
    total,
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000),
  };
}
