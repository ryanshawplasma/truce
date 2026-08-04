/**
 * The Truce logo: a heart with a bandage across it, inside a soft circle.
 *
 * The heart takes its colour from --mark-ink, which every appearance sets for
 * itself — blue in Sky, rose in Blush. It used to be hardcoded rose, which put
 * a pink bubble in the corner of an otherwise blue nav bar.
 *
 * `color` overrides that where the background demands it: the footer sits on
 * deep plum and needs a lighter heart than either appearance provides.
 */
export default function BrandMark({ color = 'var(--mark-ink)' }) {
  return (
    <span className="brand__mark">
      <svg style={{ color }} aria-hidden="true">
        <use href="#ic-mark" />
      </svg>
    </span>
  );
}
