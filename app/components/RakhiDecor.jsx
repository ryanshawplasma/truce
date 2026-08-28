/**
 * Raksha Bandhan decoration — a rakhi tied across the card, and marigolds.
 *
 * Only drawn when the card wears the seasonal theme. It is decoration in the
 * strictest sense: no state, no interactivity, aria-hidden throughout, and
 * nothing here is load-bearing for reading the letter. If it all failed to
 * render the card would be a plain gold card and nobody would be stuck.
 *
 * WHY IT IS DRAWN AND NOT AN EMOJI
 * --------------------------------
 * 🪢 and 🌼 are a rope and a blossom, not a rakhi and a marigold, and they
 * render as four different pictures across four platforms — on the one screen
 * where getting the festival right is the entire job. Paths look the same
 * everywhere, scale to any size, and take the theme's colours.
 *
 * The motion lives in globals.css so `prefers-reduced-motion` can switch it
 * off in one place: the ornament and the petals hold still, and what is left
 * is the composition, which was always the part doing the work.
 */

/** One marigold petal — a teardrop with a crease. */
function Petal({ className }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path
          d="M12 1c5 5.5 8 10 8 13.6A8 8 0 0 1 4 14.6C4 11 7 6.5 12 1z"
          fill="#F2A43C"
        />
        <path d="M12 4.6c3.2 4 5 7.2 5 9.8a5 5 0 0 1-5 5z" fill="#E9862B" opacity=".65" />
        <path d="M12 3.5v16" stroke="#C96C1E" strokeWidth=".9" opacity=".45" />
      </svg>
    </span>
  );
}

export default function RakhiDecor() {
  return (
    <>
      {/* Behind the card: marigolds coming down. */}
      <div className="petals" aria-hidden="true">
        <Petal className="petal petal--1" />
        <Petal className="petal petal--2" />
        <Petal className="petal petal--3" />
        <Petal className="petal petal--4" />
        <Petal className="petal petal--5" />
        <Petal className="petal petal--6" />
      </div>

      {/* Across the top: the thread itself. */}
      <div className="rakhi" aria-hidden="true">
        <svg className="rakhi__svg" viewBox="0 0 340 96" role="presentation">
          <defs>
            <linearGradient id="rakhiThread" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#D4451F" />
              <stop offset="0.5" stopColor="#E8632F" />
              <stop offset="1" stopColor="#D4451F" />
            </linearGradient>
            <linearGradient id="rakhiGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FBDC9A" />
              <stop offset="1" stopColor="#E0A038" />
            </linearGradient>
          </defs>

          {/* The thread, slung across with a real sag rather than a straight
              line — a tied thread hangs, and the curve is most of the charm. */}
          <path
            d="M0 26 C 70 52, 120 56, 170 56 C 220 56, 270 52, 340 26"
            fill="none"
            stroke="url(#rakhiThread)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Gold beads threaded along it. */}
          <circle cx="86" cy="45" r="4.6" fill="url(#rakhiGold)" />
          <circle cx="120" cy="51" r="3.6" fill="url(#rakhiGold)" />
          <circle cx="220" cy="51" r="3.6" fill="url(#rakhiGold)" />
          <circle cx="254" cy="45" r="4.6" fill="url(#rakhiGold)" />

          <g className="rakhi__knot">
            {/* the two hanging tails, each trailing the knot by a beat */}
            <g className="rakhi__tail">
              <path
                d="M158 60 C 152 74, 150 82, 152 93"
                fill="none"
                stroke="#D4451F"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <circle cx="152" cy="94" r="3.2" fill="#E0A038" />
            </g>
            <g className="rakhi__tail rakhi__tail--right">
              <path
                d="M182 60 C 188 74, 190 82, 188 93"
                fill="none"
                stroke="#D4451F"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
              <circle cx="188" cy="94" r="3.2" fill="#E0A038" />
            </g>

            {/* the flower in the middle */}
            <g className="rakhi__bloom">
              {/* eight petals, placed by rotation so they stay even */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <ellipse
                  key={deg}
                  cx="170"
                  cy="41"
                  rx="6.5"
                  ry="13"
                  fill="url(#rakhiGold)"
                  transform={`rotate(${deg} 170 56)`}
                />
              ))}
              <circle cx="170" cy="56" r="11" fill="#D4451F" />
              <circle cx="170" cy="56" r="6.5" fill="#FBDC9A" />
              <circle cx="170" cy="56" r="2.6" fill="#D4451F" />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
