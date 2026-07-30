'use client';

import { useMaker } from './MakerProvider';

/**
 * Any button that opens the card maker. Used all over the landing page, so the
 * marketing sections themselves can stay server components.
 */
export default function CtaButton({ className = 'btn btn--primary', children, ...rest }) {
  const { open } = useMaker();
  return (
    <button type="button" className={className} onClick={open} {...rest}>
      {children}
    </button>
  );
}
