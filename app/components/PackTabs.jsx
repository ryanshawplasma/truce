'use client';

import { PACKS, Sticker } from './stickers';

/**
 * Horizontal pack switcher, shared by the wizard's sticker step and the card's
 * reaction tray. Scrolls sideways on a phone rather than wrapping, so the grid
 * below it never jumps around as you move between packs.
 *
 * Each tab wears one of its own drawings (pack.icon) rather than an emoji, so
 * you can see what a pack looks like before opening it. Only the selected
 * tab's icon keeps its motion loop — see .pack-tab__icon in globals.css — so
 * six looping SVGs never compete with the sheet below.
 */
export default function PackTabs({ value, onChange, idPrefix = 'pack', panelId }) {
  return (
    <div className="pack-tabs" role="tablist" aria-label="Sticker packs">
      {PACKS.map((pack) => (
        <button
          type="button"
          key={pack.id}
          id={`${idPrefix}-tab-${pack.id}`}
          role="tab"
          className="pack-tab"
          aria-selected={pack.id === value}
          aria-controls={panelId}
          onClick={() => onChange(pack.id)}
        >
          <span className="pack-tab__icon" aria-hidden="true">
            {pack.icon ? (
              <Sticker id={pack.icon} size={22} />
            ) : (
              <span className="pack-tab__emoji">{pack.emoji}</span>
            )}
          </span>
          <span>{pack.name}</span>
        </button>
      ))}
    </div>
  );
}
