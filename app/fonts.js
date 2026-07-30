import localFont from 'next/font/local';

/**
 * Truce's two typefaces.
 *
 * These are the same Google Fonts the design was built with (Fraunces + Nunito),
 * but self-hosted from app/fonts/ via next/font/local: no request to Google at
 * runtime, no layout shift, and the build works even with no network access.
 * The .woff2 files are the official variable builds (SIL Open Font License —
 * see the two OFL.txt files next to them). The "full" Fraunces build carries the
 * SOFT and WONK axes, which globals.css uses on headings.
 *
 * If you would rather have Next fetch them from Google at build time, swap the
 * two definitions below for:
 *
 *   import { Fraunces, Nunito } from 'next/font/google';
 *   export const fraunces = Fraunces({ subsets: ['latin'], display: 'swap', variable: '--font-fraunces' });
 *   export const nunito  = Nunito({ subsets: ['latin'], display: 'swap', variable: '--font-nunito' });
 *
 * Everything else keeps working — globals.css only ever reads the CSS variables.
 */

export const fraunces = localFont({
  src: [
    { path: './fonts/fraunces-latin-full-normal.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/fraunces-latin-full-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-fraunces',
  display: 'swap',
  fallback: ['Iowan Old Style', 'Palatino Linotype', 'Georgia', 'Times New Roman', 'serif'],
});

export const nunito = localFont({
  src: [{ path: './fonts/nunito-latin-wght-normal.woff2', weight: '200 1000', style: 'normal' }],
  variable: '--font-nunito',
  display: 'swap',
  fallback: ['Avenir Next', 'Segoe UI', 'system-ui', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
});
