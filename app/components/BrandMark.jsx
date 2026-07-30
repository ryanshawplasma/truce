/**
 * The Truce logo: a heart with a bandage across it, inside a soft circle.
 * `color` lets the footer use a lighter heart on the plum background.
 */
export default function BrandMark({ color = 'var(--rose)' }) {
  return (
    <span className="brand__mark">
      <svg style={{ color }} aria-hidden="true">
        <use href="#ic-mark" />
      </svg>
    </span>
  );
}
