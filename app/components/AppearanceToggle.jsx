'use client';

import { applyAppearance, currentAppearance, nextAppearance, readAppearance, writeAppearance, APPEARANCES } from '@/lib/appearance';

/**
 * The site Appearance switch: Sky 💙 ⇄ Blush 🌸.
 *
 * Two details worth knowing:
 *
 * 1. The label is not React state. Both options are rendered and CSS shows the
 *    one matching html[data-appearance]. The server has no idea which skin this
 *    visitor prefers, so state would mean either a hydration mismatch or a
 *    visible label flip on every load. CSS has the answer before React wakes up.
 *
 * 2. Because of (1) the current value is read from the document, which the
 *    pre-paint script in app/layout.js has already set correctly.
 *
 * Variants: `pill` in the nav bar, `row` in the mobile drawer, `link` in the
 * footer. All three are the same button wearing different clothes.
 */
export default function AppearanceToggle({ variant = 'pill', className = '' }) {
  const toggle = () => {
    const next = nextAppearance(currentAppearance());
    applyAppearance(next);
    writeAppearance(next);
  };

  /* Keep the document honest if storage and the DOM ever disagree — e.g. the
     visitor changed the setting in another tab and came back to this one. */
  const sync = () => {
    const stored = readAppearance();
    if (stored !== currentAppearance()) applyAppearance(stored);
  };

  return (
    <button
      type="button"
      className={`appearance ${`appearance--${variant}`} ${className}`.trim()}
      onClick={toggle}
      onPointerEnter={sync}
      onFocus={sync}
      title="Switch the site appearance"
    >
      {/* Visible in the drawer and the footer, clipped to screen readers only
          in the compact nav pill — the word is what keeps "Appearance" (the
          site) and "Theme" (one card) apart for everybody. */}
      <span className="appearance__name">Appearance</span>
      {APPEARANCES.map((a) => (
        <span className={`appearance__opt appearance__opt--${a.id}`} key={a.id}>
          <span className="appearance__emoji" aria-hidden="true">
            {a.emoji}
          </span>
          <span className="appearance__label">{a.label}</span>
        </span>
      ))}
      <span className="appearance__hint" aria-hidden="true">
        Tap to switch
      </span>
    </button>
  );
}
