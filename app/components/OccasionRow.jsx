'use client';

import { OCCASION_CHOICES } from '@/lib/occasions';
import { useMaker } from './MakerProvider';

/**
 * The row under the hero buttons: "Also: Birthday 🎂 · Proposal 💍".
 *
 * The hero itself stays apology-first — that is the brand — but the other two
 * occasions need a door on the front page. Each one opens the maker with the
 * occasion already answered, so they land straight on "whose birthday is it?".
 */
export default function OccasionRow({ exclude = 'sorry' }) {
  const { open } = useMaker();
  const others = OCCASION_CHOICES.filter((o) => o.id !== exclude);
  if (!others.length) return null;

  return (
    <p className="occasion-row">
      <span className="occasion-row__label">Also:</span>
      {others.map((o, i) => (
        <span key={o.id}>
          {i > 0 ? <span className="occasion-row__dot" aria-hidden="true">·</span> : null}
          <button type="button" className="occasion-row__btn" onClick={() => open(o.id)}>
            {o.label} <span aria-hidden="true">{o.emoji}</span>
          </button>
        </span>
      ))}
    </p>
  );
}
