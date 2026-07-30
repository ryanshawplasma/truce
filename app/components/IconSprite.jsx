/**
 * One hidden SVG sprite, rendered once in the root layout.
 * Everything else just does <svg><use href="#ic-heart" /></svg>.
 */
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="ic-mark" viewBox="0 0 32 32">
          <path
            d="M16 26.4S4.6 19.6 4.6 12.6A5.9 5.9 0 0 1 16 10.1a5.9 5.9 0 0 1 11.4 2.5c0 7-11.4 13.8-11.4 13.8z"
            fill="currentColor"
          />
          <rect
            x="7.6"
            y="13.1"
            width="16.8"
            height="6.1"
            rx="3.05"
            transform="rotate(-38 16 16.15)"
            fill="#FFF7F2"
          />
          <g fill="currentColor" opacity=".55" transform="rotate(-38 16 16.15)">
            <circle cx="11.4" cy="14.8" r=".62" />
            <circle cx="11.4" cy="17.5" r=".62" />
            <circle cx="20.6" cy="14.8" r=".62" />
            <circle cx="20.6" cy="17.5" r=".62" />
          </g>
        </symbol>

        <symbol id="ic-heart" viewBox="0 0 24 24">
          <path d="M12 20.3S3 15 3 9.3A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 9 1.9c0 5.7-9 11-9 11z" fill="currentColor" />
        </symbol>

        <symbol id="ic-check" viewBox="0 0 20 20">
          <path
            d="M4 10.6l3.9 3.9L16 5.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>

        <symbol id="ic-back" viewBox="0 0 24 24">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </symbol>

        <symbol id="ic-close" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}
