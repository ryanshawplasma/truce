import { fraunces, nunito } from './fonts';
import IconSprite from './components/IconSprite';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
  themeColor: '#FFF7F2',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    /* data-scroll-behavior tells Next 16 to keep route changes snappy even
       though globals.css sets `scroll-behavior: smooth` for in-page anchors. */
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${nunito.variable}`}>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
