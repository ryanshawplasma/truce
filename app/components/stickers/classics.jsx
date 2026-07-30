'use client';

import { Board } from './board';

/**
 * Classics — twelve original object stickers, hand-built as inline SVG.
 *
 * Pack 1 of 6. The five couple packs are generated from the sample-sheet
 * sources; these twelve are hand-drawn and stay hand-maintained.
 *
 * House style, so the twelve read as one set:
 *   · 120 x 120 board, everything sitting inside a ~14px margin
 *   · one ink colour for every outline (deep plum), 4–4.5px, round caps/joins
 *   · flat fills from the Truce palette, no gradients, no raster images
 *   · big dot eyes with a single white glint, tiny mouths, blush on everything
 *   · one small looped animation each, driven by the .stk-* classes in
 *     globals.css so it can be switched off with prefers-reduced-motion
 *
 * Nothing here is traced from or based on any existing sticker pack.
 */

/* ----------------------------------------------------------------- palette */
const INK = '#3D2137';
const ROSE = '#E85D75';
const ROSE_DEEP = '#C94360';
const PINK = '#FFE4E9';
const BLUSH = '#FF9FB0';
const CREAM = '#FFF7F2';
const SAND = '#FFEDE2';
const GOLD = '#F2B880';
const GOLD_DEEP = '#E09A57';
const WHITE = '#FFFFFF';
const LILAC = '#C9B3F0';
const SAGE = '#A9C3A0';
const SKY = '#C9DCF7';
const SKIN_A = '#FFDCC7';
const SKIN_B = '#F8C6A8';

/* Shared stroke settings for outlines. */
const line = { stroke: INK, strokeWidth: 4.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
const thin = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };

/* ------------------------------------------------------------ little parts */
function Eye({ x, y, r = 5 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={INK} />
      <circle cx={x - r * 0.34} cy={y - r * 0.42} r={Math.max(1.3, r * 0.3)} fill={WHITE} />
    </g>
  );
}

function Blush({ x, y, rx = 6.5, ry = 4.4, opacity = 0.8 }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={BLUSH} opacity={opacity} />;
}

function Sparkle({ x, y, s = 7, fill = GOLD, className }) {
  return (
    <path
      className={className}
      d={`M${x} ${y - s} Q${x + s * 0.22} ${y - s * 0.22} ${x + s} ${y} Q${x + s * 0.22} ${y + s * 0.22} ${x} ${y + s} Q${x - s * 0.22} ${y + s * 0.22} ${x - s} ${y} Q${x - s * 0.22} ${y - s * 0.22} ${x} ${y - s} Z`}
      fill={fill}
      stroke={INK}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  );
}

/* ==========================================================================
   1. Patched-up heart — the Truce mascot
   ========================================================================== */
function BandagedHeart(props) {
  return (
    <Board {...props}>
      <g className="stk-wobble">
        <path
          d="M60 104C18 77 11 47 25 34 38 22 55 26 60 39 65 26 82 22 95 34c14 13 7 43-35 70Z"
          fill={ROSE}
          stroke={INK}
          strokeWidth="4.4"
          strokeLinejoin="round"
        />
        {/* the plaster */}
        <g transform="rotate(-30 60 46)">
          <rect x="26" y="37" width="68" height="18" rx="9" fill={CREAM} stroke={INK} strokeWidth="3.8" />
          <rect x="47" y="38.5" width="26" height="15" rx="4" fill={SAND} />
          <g fill={INK} opacity="0.35">
            <circle cx="52" cy="43" r="1.5" />
            <circle cx="52" cy="49" r="1.5" />
            <circle cx="68" cy="43" r="1.5" />
            <circle cx="68" cy="49" r="1.5" />
          </g>
        </g>
        {/* worried little face */}
        <Eye x={48} y={68} r={4.8} />
        <Eye x={72} y={68} r={4.8} />
        <path d="M53 83q7-6 14 0" {...thin} />
        <Blush x={38} y={76} rx={6} ry={4} />
        <Blush x={82} y={76} rx={6} ry={4} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   2. Puppy eyes
   ========================================================================== */
function PuppyEyes(props) {
  return (
    <Board {...props}>
      <g className="stk-bob">
        {/* ears, behind the head */}
        <ellipse cx="24" cy="60" rx="13" ry="24" fill={GOLD_DEEP} stroke={INK} strokeWidth="4.2" transform="rotate(-16 24 60)" />
        <ellipse cx="96" cy="60" rx="13" ry="24" fill={GOLD_DEEP} stroke={INK} strokeWidth="4.2" transform="rotate(16 96 60)" />

        <ellipse cx="60" cy="62" rx="38" ry="35" fill={GOLD} stroke={INK} strokeWidth="4.4" />

        {/* the huge pleading eyes */}
        <g>
          <ellipse cx="45" cy="60" rx="12.5" ry="13.5" fill={INK} />
          <ellipse cx="75" cy="60" rx="12.5" ry="13.5" fill={INK} />
          <circle cx="41" cy="55" r="5" fill={WHITE} />
          <circle cx="71" cy="55" r="5" fill={WHITE} />
          <circle cx="49" cy="66" r="2.4" fill={WHITE} opacity="0.9" />
          <circle cx="79" cy="66" r="2.4" fill={WHITE} opacity="0.9" />
        </g>
        {/* eyelids — invisible until they snap shut for a blink */}
        <g className="stk-blink">
          <rect x="31" y="44" width="28" height="32" rx="13" fill={GOLD} />
          <rect x="61" y="44" width="28" height="32" rx="13" fill={GOLD} />
          <path d="M35 64q10 7 20 0M65 64q10 7 20 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        </g>

        <path d="M53 79q7-5 14 0q-2 8-7 10q-5-2-7-10Z" fill={INK} />
        <path d="M60 89q-5 6-10 2M60 89q5 6 10 2" {...thin} />
        <Blush x={28} y={78} />
        <Blush x={92} y={78} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   3. White flag
   ========================================================================== */
function WhiteFlag(props) {
  return (
    <Board {...props}>
      {/* pole */}
      <path d="M32 108V22" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      {/* the flag itself, waving */}
      <g className="stk-wave">
        <path
          d="M32 22c16-8 28 7 44 1 8-3 14-5 14-5v42s-6 3-14 6c-16 6-28-8-44 0Z"
          fill={WHITE}
          stroke={INK}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        <Eye x={56} y={40} r={4.4} />
        <Eye x={76} y={37} r={4.4} />
        <path d="M58 52q7 6 14 1" {...thin} />
        <Blush x={47} y={49} rx={5.4} ry={3.6} />
        <Blush x={85} y={45} rx={5.4} ry={3.6} />
      </g>
      {/* the little hand holding it */}
      <g>
        <path
          d="M20 88c0-8 7-14 15-14h8c8 0 14 6 14 14v6c0 9-7 15-16 15h-6c-9 0-15-6-15-15Z"
          fill={SKIN_A}
          stroke={INK}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        {/* thumb */}
        <path d="M20 88c-6 1-9 5-8 10 1 4 5 6 9 5" fill={SKIN_A} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M33 86v20M43 86v20" {...thin} strokeWidth="2.6" opacity="0.45" />
        <Blush x={48} y={102} rx={5} ry={3.2} opacity={0.7} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   4. Bear hug
   ========================================================================== */
function BearHug(props) {
  return (
    <Board {...props}>
      {/* arms, opening wide */}
      <g className="stk-hug">
        <path d="M40 82C26 82 16 74 12 62" stroke={INK} strokeWidth="17" strokeLinecap="round" fill="none" />
        <path d="M80 82c14 0 24-8 28-20" stroke={INK} strokeWidth="17" strokeLinecap="round" fill="none" />
        <path d="M40 82C26 82 16 74 12 62" stroke={GOLD} strokeWidth="11" strokeLinecap="round" fill="none" />
        <path d="M80 82c14 0 24-8 28-20" stroke={GOLD} strokeWidth="11" strokeLinecap="round" fill="none" />
      </g>

      {/* ears */}
      <circle cx="38" cy="30" r="11" fill={GOLD} stroke={INK} strokeWidth="4.2" />
      <circle cx="82" cy="30" r="11" fill={GOLD} stroke={INK} strokeWidth="4.2" />
      <circle cx="38" cy="30" r="4.6" fill={PINK} />
      <circle cx="82" cy="30" r="4.6" fill={PINK} />

      {/* body + head */}
      <ellipse cx="60" cy="90" rx="25" ry="20" fill={GOLD} stroke={INK} strokeWidth="4.2" />
      <circle cx="60" cy="52" r="27" fill={GOLD} stroke={INK} strokeWidth="4.4" />

      <ellipse cx="60" cy="61" rx="15" ry="11" fill={CREAM} stroke={INK} strokeWidth="3.4" />
      <ellipse cx="60" cy="56" rx="5" ry="3.8" fill={INK} />
      <path d="M60 60v3M60 63q-4 5-8 2M60 63q4 5 8 2" {...thin} />
      <Eye x={48} y={45} r={4.6} />
      <Eye x={72} y={45} r={4.6} />
      <Blush x={36} y={57} />
      <Blush x={84} y={57} />
    </Board>
  );
}

/* ==========================================================================
   5. Melting heart
   ========================================================================== */
function MeltingHeart(props) {
  return (
    <Board {...props}>
      {/* the puddle it is turning into */}
      <g className="stk-ripple">
        <path
          d="M20 98c0-6 8-9 18-9h44c10 0 18 3 18 9s-9 10-22 10H41c-13 0-21-4-21-10Z"
          fill={ROSE_DEEP}
          stroke={INK}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
      </g>
      {/* the softening heart */}
      <g className="stk-melt">
        <path
          d="M60 94C26 74 18 47 30 35 41 24 56 28 60 40 64 28 79 24 90 35c12 12 4 39-30 59Z"
          fill={ROSE}
          stroke={INK}
          strokeWidth="4.4"
          strokeLinejoin="round"
        />
        <path d="M42 56q6-7 12 0M66 56q6-7 12 0" {...thin} />
        <path d="M50 74q5 5 10 0q5-5 10 0" {...thin} />
        <Blush x={38} y={66} />
        <Blush x={82} y={66} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   6. Bouquet
   ========================================================================== */
function Flower({ x, y, petal, face }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={x} cy={y - 11} r="7.6" fill={petal} stroke={INK} strokeWidth="3.4" transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r="7.4" fill={CREAM} stroke={INK} strokeWidth="3.4" />
      {face ? (
        <g>
          <circle cx={x - 2.6} cy={y - 1} r="1.7" fill={INK} />
          <circle cx={x + 2.6} cy={y - 1} r="1.7" fill={INK} />
          <path d={`M${x - 2.4} ${y + 2.6}q2.4 2.6 4.8 0`} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
}

function Bouquet(props) {
  return (
    <Board {...props}>
      <g className="stk-sway">
        {/* stems */}
        <path d="M60 80 36 40M60 80V32M60 80l24-38" stroke={SAGE} strokeWidth="4.4" strokeLinecap="round" fill="none" />
        <path d="M50 64q-11-3-13-11 11-2 15 8ZM72 68q11-3 13-11-11-2-15 8Z" fill={SAGE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />

        <Flower x={32} y={34} petal={ROSE} />
        <Flower x={88} y={36} petal={LILAC} />
        <Flower x={60} y={24} petal={GOLD} face />

        {/* the paper cone */}
        <path d="M36 76h48l-16 32a4 4 0 0 1-4 2h-8a4 4 0 0 1-4-2Z" fill={CREAM} stroke={INK} strokeWidth="4.2" strokeLinejoin="round" />
        {/* ribbon, tied at the top of the cone */}
        <path d="M46 82q-9-7-13 0 7 7 13 0ZM74 82q9-7 13 0-7 7-13 0Z" fill={ROSE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="60" cy="82" r="4.5" fill={ROSE} stroke={INK} strokeWidth="3" />
        <Blush x={52} y={98} rx={4.6} ry={3.2} />
        <Blush x={68} y={98} rx={4.6} ry={3.2} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   7. Sorry! burst
   ========================================================================== */
/* Twelve-point starburst, worked out once at module load so the markup is
   identical on the server and in the browser. */
const BURST_PATH = (() => {
  const points = 12;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? 50 : 37;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = 60 + radius * Math.cos(angle);
    const y = 54 + radius * Math.sin(angle);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
})();

function SorryBurst(props) {
  return (
    <Board {...props}>
      <g className="stk-pulse">
        <path d="M48 86 40 116 68 94Z" fill={GOLD} stroke={INK} strokeWidth="4.2" strokeLinejoin="round" />
        <path d={BURST_PATH} fill={GOLD} stroke={INK} strokeWidth="4.2" strokeLinejoin="round" />
        <circle cx="60" cy="54" r="31" fill={CREAM} stroke={INK} strokeWidth="3.4" />
        <text x="60" y="61" textAnchor="middle" className="stk-word" fontSize="19" fill={ROSE_DEEP}>
          sorry!
        </text>
        <Blush x={40} y={68} rx={5} ry={3.4} opacity={0.7} />
        <Blush x={80} y={68} rx={5} ry={3.4} opacity={0.7} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   8. Little cry
   ========================================================================== */
function CryingBlob(props) {
  return (
    <Board {...props}>
      <g className="stk-sniff">
        <path
          d="M60 18c26 0 42 18 42 40s-16 44-42 44S18 80 18 58 34 18 60 18Z"
          fill={PINK}
          stroke={INK}
          strokeWidth="4.4"
          strokeLinejoin="round"
        />
        <Eye x={46} y={56} r={5.4} />
        <Eye x={74} y={56} r={5.4} />
        <path d="M39 45q7-6 14-1M67 44q7-5 14 1" {...thin} />
        <path d="M47 79q6-7 13 0q7 7 13 0" {...thin} />
        <Blush x={34} y={70} />
        <Blush x={86} y={70} />
      </g>
      {/* one fat tear, over and over */}
      <g className="stk-tear">
        <path d="M80 62c6 10 9 14 9 19a9 9 0 0 1-18 0c0-5 3-9 9-19Z" fill={SKY} stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        <ellipse cx="76" cy="80" rx="2.4" ry="3.4" fill={WHITE} opacity="0.85" />
      </g>
    </Board>
  );
}

/* ==========================================================================
   9. Peace dove
   ========================================================================== */
function DoveBranch(props) {
  return (
    <Board {...props}>
      <g className="stk-bob">
        {/* fanned tail */}
        <path
          d="M36 60 10 52l8 10-8 10 8 10 26-8Z"
          fill={WHITE}
          stroke={INK}
          strokeWidth="4.2"
          strokeLinejoin="round"
        />
        {/* body, tapering into the neck */}
        <path
          d="M74 42c8 2 12 8 12 15 0 16-18 29-38 29-14 0-22-7-22-17s10-19 24-24c9-3 17-4 24-3Z"
          fill={WHITE}
          stroke={INK}
          strokeWidth="4.4"
          strokeLinejoin="round"
        />
        {/* head */}
        <circle cx="80" cy="40" r="14" fill={WHITE} stroke={INK} strokeWidth="4.4" />
        <path d="M93 37 106 41 93 46Z" fill={GOLD} stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
        <Eye x={83} y={36} r={3.8} />
        <Blush x={73} y={46} rx={5} ry={3.4} />
        {/* raised wing */}
        <g className="stk-flap">
          <path
            d="M40 62c6-12 18-19 30-17 3 9-1 19-9 24-9 5-18 3-21-7Z"
            fill={SAND}
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M48 66q9-6 16-6M52 73q8-6 15-7" {...thin} strokeWidth="2.4" opacity="0.5" />
        </g>
      </g>
      {/* olive branch */}
      <g>
        <path d="M104 46q8 10 8 24" stroke={SAGE} strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="112" cy="54" rx="7" ry="4.6" fill={SAGE} stroke={INK} strokeWidth="2.8" transform="rotate(28 112 54)" />
        <ellipse cx="114" cy="68" rx="7" ry="4.6" fill={SAGE} stroke={INK} strokeWidth="2.8" transform="rotate(-14 114 68)" />
        <ellipse cx="100" cy="58" rx="6.4" ry="4.2" fill={SAGE} stroke={INK} strokeWidth="2.8" transform="rotate(-52 100 58)" />
      </g>
    </Board>
  );
}

/* ==========================================================================
   10. Love letter with legs
   ========================================================================== */
function LoveLetter(props) {
  return (
    <Board {...props}>
      <g className="stk-hop">
        {/* legs */}
        <path d="M46 84 44 100M74 84l2 16" stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
        <ellipse cx="41" cy="104" rx="9" ry="5.4" fill={ROSE} stroke={INK} strokeWidth="3.6" />
        <ellipse cx="79" cy="104" rx="9" ry="5.4" fill={ROSE} stroke={INK} strokeWidth="3.6" />
        {/* envelope */}
        <rect x="18" y="28" width="84" height="58" rx="11" fill={CREAM} stroke={INK} strokeWidth="4.4" />
        <path d="M20 36 60 64 100 36" {...line} strokeWidth="3.8" />
        <Eye x={38} y={50} r={4.4} />
        <Eye x={82} y={50} r={4.4} />
        <Blush x={29} y={60} rx={5.6} ry={3.8} />
        <Blush x={91} y={60} rx={5.6} ry={3.8} />
        {/* wax seal */}
        <circle cx="60" cy="68" r="13" fill={ROSE} stroke={INK} strokeWidth="3.8" />
        <path d="M60 74c-7-4-9-9-6-11 2-2 5-1 6 1 1-2 4-3 6-1 3 2 1 7-6 11Z" fill={CREAM} />
      </g>
    </Board>
  );
}

/* ==========================================================================
   11. Pinky promise
   ========================================================================== */
function PinkyPromise(props) {
  return (
    <Board {...props}>
      {/* the little heart hovering over the deal */}
      <g className="stk-float">
        <path d="M60 30c-11-7-15-15-10-19 4-3 8-1 10 2 2-3 6-5 10-2 5 4 1 12-10 19Z" fill={ROSE} stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
      </g>

      <g className="stk-squeeze">
        {/* left pinky, hooking up and over */}
        <path d="M44 70c0-16 6-24 16-20 6 2 8 8 6 13" stroke={INK} strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d="M44 70c0-16 6-24 16-20 6 2 8 8 6 13" stroke={SKIN_A} strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* right pinky, hooking the other way through it */}
        <path d="M76 70c0-16-6-24-16-20-6 2-8 8-6 13" stroke={INK} strokeWidth="14" strokeLinecap="round" fill="none" />
        <path d="M76 70c0-16-6-24-16-20-6 2-8 8-6 13" stroke={SKIN_B} strokeWidth="8" strokeLinecap="round" fill="none" />

        {/* two little fists, leaning in */}
        <g transform="rotate(-12 32 86)">
          <rect x="12" y="66" width="42" height="36" rx="16" fill={SKIN_A} stroke={INK} strokeWidth="4.2" />
          <path d="M14 76c-6 1-9 5-8 10 1 4 5 6 9 5" fill={SKIN_A} stroke={INK} strokeWidth="3.8" strokeLinejoin="round" />
          <path d="M28 74v20M38 74v20" {...thin} strokeWidth="2.6" opacity="0.4" />
          <Blush x={44} y={94} rx={5} ry={3.4} opacity={0.75} />
        </g>
        <g transform="rotate(12 88 86)">
          <rect x="66" y="66" width="42" height="36" rx="16" fill={SKIN_B} stroke={INK} strokeWidth="4.2" />
          <path d="M106 76c6 1 9 5 8 10-1 4-5 6-9 5" fill={SKIN_B} stroke={INK} strokeWidth="3.8" strokeLinejoin="round" />
          <path d="M82 74v20M92 74v20" {...thin} strokeWidth="2.6" opacity="0.4" />
          <Blush x={76} y={94} rx={5} ry={3.4} opacity={0.75} />
        </g>
      </g>
    </Board>
  );
}

/* ==========================================================================
   12. Cheer up
   ========================================================================== */
function CheerUp(props) {
  return (
    <Board {...props}>
      <g className="stk-spin">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect
            key={a}
            x="55.5"
            y="8"
            width="9"
            height="18"
            rx="4.5"
            fill={GOLD}
            stroke={INK}
            strokeWidth="3.4"
            transform={`rotate(${a} 60 60)`}
          />
        ))}
      </g>

      <circle cx="60" cy="60" r="32" fill={GOLD} stroke={INK} strokeWidth="4.4" />
      <path
        d="M60 82C40 70 35 57 42 51c5-4 12-2 15 4 3-6 10-8 15-4 7 6 2 19-12 31Z"
        fill={ROSE}
        stroke={INK}
        strokeWidth="3.8"
        strokeLinejoin="round"
      />
      <path d="M48 57q4-5 8 0M64 57q4-5 8 0" stroke={CREAM} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M54 66q6 6 12 0" stroke={CREAM} strokeWidth="3" strokeLinecap="round" fill="none" />

      <Sparkle x={19} y={24} s={8} className="stk-twinkle" />
      <Sparkle x={104} y={38} s={6.5} className="stk-twinkle stk-twinkle--b" />
      <Sparkle x={96} y={101} s={7} className="stk-twinkle stk-twinkle--c" />
    </Board>
  );
}

/* ==========================================================================
   Registry — the twelve original object stickers.
   These ids stay UNPREFIXED so links and reactions created before the couple
   packs existed keep resolving. Every later pack is namespaced "<pack>/<pose>".
   ========================================================================== */
export const COMPONENTS = {
  'bandaged-heart': BandagedHeart,
  'puppy-eyes': PuppyEyes,
  'white-flag': WhiteFlag,
  'bear-hug': BearHug,
  'melting-heart': MeltingHeart,
  bouquet: Bouquet,
  'sorry-burst': SorryBurst,
  'crying-blob': CryingBlob,
  'dove-branch': DoveBranch,
  'love-letter': LoveLetter,
  'pinky-promise': PinkyPromise,
  'cheer-up': CheerUp,
};

export default COMPONENTS;
