/**
 * The "beta" chip.
 *
 * One small, consistent way of saying "this part is new and free while we find
 * our feet" — used on Our corner (nav, landing section, /couple pages) and on
 * the sealed-letter toggle. No hooks and no browser APIs, so it drops into
 * server components and client components alike.
 *
 * `tone="soft"` is the quiet version for dark or already-busy surfaces.
 */
export default function BetaChip({ label = 'beta', tone = 'default', className = '' }) {
  const classes = ['beta-chip', tone === 'soft' ? 'beta-chip--soft' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      <span className="beta-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
