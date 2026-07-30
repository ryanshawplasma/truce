import { fraunces, nunito } from './fonts';
import IconSprite from './components/IconSprite';
import { APPEARANCE_BOOT_SCRIPT, DEFAULT_APPEARANCE, appearanceMeta } from '@/lib/appearance';
import './globals.css';

/* metadataBase is what relative OG/Twitter URLs are resolved against. Falling
   back to localhost meant a deploy that forgot NEXT_PUBLIC_SITE_URL published
   share previews pointing at the visitor's own machine. The deployed origin is
   a far better default. Replace this when a custom domain lands. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trucea.vercel.app';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Truce — The sweetest way to say sorry',
    template: '%s',
  },
  description:
    "Truce turns an apology into an experience they'll actually want to open. 56 hand-written messages, six beautiful themes, sealed time-capsule letters and a playful “Do you forgive me?” — delivered as a private link. Free while in beta.",
  applicationName: 'Truce',
  openGraph: {
    type: 'website',
    siteName: 'Truce',
    title: 'Truce — The sweetest way to say sorry',
    description:
      'Create a personalized apology experience they’ll actually want to open. Sealed envelope, hand-written message, and a forgive button that plays fair (mostly).',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truce — The sweetest way to say sorry',
    description: 'An apology they’ll actually want to open. Delivered as a private link. Free while in beta.',
  },
};

export const viewport = {
  /* The default appearance's page colour. The pre-paint script below rewrites
     it for visitors who chose the other one. */
  themeColor: appearanceMeta(DEFAULT_APPEARANCE).themeColor,
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    /* data-scroll-behavior tells Next 16 to keep route changes snappy even
       though globals.css sets `scroll-behavior: smooth` for in-page anchors. */
    <html
      lang="en"
      data-scroll-behavior="smooth"
      /* The server cannot know which skin this visitor picked, so it renders
         the default and the script below corrects it while the HTML is still
         being parsed — before the first paint, and before React hydrates.
         suppressHydrationWarning tells React the DOM is right, not the payload.
         See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md */
      data-appearance={DEFAULT_APPEARANCE}
      suppressHydrationWarning
      className={`${fraunces.variable} ${nunito.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
