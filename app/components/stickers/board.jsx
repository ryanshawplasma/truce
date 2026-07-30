'use client';

/**
 * The board every Truce sticker is drawn on.
 *
 * One shared 120x120 viewBox keeps the six packs optically consistent: a
 * sticker from Classics and one from Mochi & Bao sit on the same grid, so they
 * line up when they are mixed on a card.
 *
 * `overflow:visible` (set on `.stk` in globals.css) lets the little motion
 * loops nudge a limb past the edge without clipping it.
 */
export function Board({ children, className, ...rest }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className ? `stk ${className}` : 'stk'}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

export default Board;
