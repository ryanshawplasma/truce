import Link from 'next/link';
import MakerProvider from './components/MakerProvider';
import RakhiPrompt from './components/RakhiPrompt';
import Nav from './components/Nav';
import Footer from './components/Footer';
import CtaButton from './components/CtaButton';
import FloatingHearts from './components/FloatingHearts';
import MessageTeaser from './components/MessageTeaser';
import OccasionRow from './components/OccasionRow';
import MESSAGES from './data/messages';
import { LIBRARY_TOTAL, libraryCount } from './data/library';
import { Sticker } from './components/stickers';
import { STICKER_IDS, STICKER_PACKS } from '@/lib/constants';
import { getOccasion } from '@/lib/occasions';
import BetaChip from './components/BetaChip';
import CornerDemo from './components/CornerDemo';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * The landing page.
 *
 * Everything here is a server component except the handful of interactive
 * pieces (nav, hearts, library tabs, footer toasts and the CTA buttons), so
 * the marketing copy costs the visitor almost no JavaScript.
 */

export default function HomePage() {
  const occasion = getOccasion('sorry');
  /* Sealed letters and "Our corner" both need somewhere to keep things, so the
     server tells the client components whether there is a database. */
  const dbEnabled = isSupabaseConfigured();

  return (
    <MakerProvider dbEnabled={dbEnabled}>
      {/* Inside the provider so it can open the maker with the theme already
          chosen. Renders nothing outside the festival window, and nothing at
          all once somebody has answered it. */}
      <RakhiPrompt />

      <Nav />

      <main id="main">
        {/* ---------------------------------------------------------- Hero */}
        <section className="hero" id="top">
          <div className="hero__bg" aria-hidden="true">
            <span className="hero__blob hero__blob--1" />
            <span className="hero__blob hero__blob--2" />
            <span className="hero__blob hero__blob--3" />
          </div>

          <FloatingHearts />

          <div className="wrap hero__inner">
            <div className="hero__copy">
              <span className="eyebrow">✿ Apologies, upgraded</span>
              <h1>
                {occasion.heroTitle}
                <br />
                <span className="accent">{occasion.heroTitleAccent}</span>
              </h1>
              <p className="lede hero__lede">{occasion.heroLede}</p>

              <div className="hero__actions">
                <CtaButton className="btn btn--primary btn--lg">Start your apology</CtaButton>
                <Link className="btn btn--ghost btn--lg" href="/c/demo">
                  See a sample card
                </Link>
              </div>

              <OccasionRow />

              <p className="hero__micro">No app to install · Ready in about 3 minutes · Works on any phone</p>

              {/* The second door. A card is for saying sorry once; a corner is
                  for the conversation afterwards, and people arriving at 2am
                  should not have to find it in a nav menu. */}
              <Link className="hero__corner" href="/couple">
                <span className="hero__corner-mark" aria-hidden="true">
                  💙
                </span>
                <span className="hero__corner-copy">
                  <b>
                    Our corner
                    <BetaChip />
                  </b>
                  <small>A private room for two — one name, one password, no accounts</small>
                </span>
                <span className="hero__corner-go" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>

            <div className="hero__art" aria-hidden="true">
              <div className="preview-card">
                <span className="preview-card__tag">For Sam 💌</span>
                <h3>Dear Sam,</h3>
                <p>
                  I&rsquo;ve been rehearsing this in the shower for two days, so here it goes: I was wrong, you were
                  right, and I miss you already…
                </p>
                <div className="preview-card__sign">— Alex, truly sorry</div>
                <div className="preview-card__btns">
                  <span>Yes ❤️</span>
                  <span>No 😤</span>
                </div>
              </div>
              <span className="preview-chip preview-chip--a">🤍 Sealed with care</span>
              <span className="preview-chip preview-chip--b">✨ Opened 4 minutes ago</span>

              <Sticker id="bandaged-heart" size={62} className="hero-sticker hero-sticker--1" />
              <Sticker id="puppy-eyes" size={70} className="hero-sticker hero-sticker--2" />
              <Sticker id="love-letter" size={54} className="hero-sticker hero-sticker--3" />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- Doors */}
        {/* Truce is two products sharing a front page: a card you send once,
            and a room you keep. The top of the page only ever offered the
            first, which made the second effectively a secret — so put both
            doors where the choice actually gets made. */}
        <section className="section section--tight doors" id="doors">
          <div className="wrap">
            <div className="doors__grid">
              <CtaButton className="door door--card">
                <span className="door__mark" aria-hidden="true">
                  💌
                </span>
                <span className="door__eyebrow">Ready in about three minutes</span>
                <span className="door__title">Send a card</span>
                <span className="door__body">
                  A little letter they open in a browser — a real message, stickers, a promise, and
                  a &ldquo;no&rdquo; button that refuses to be caught.
                </span>
                <span className="door__go">
                  Start your card <span aria-hidden="true">→</span>
                </span>
              </CtaButton>

              <Link className="door door--corner" href="/couple">
                <span className="door__mark" aria-hidden="true">
                  💙
                </span>
                <span className="door__eyebrow">
                  For everything after
                  <BetaChip />
                </span>
                <span className="door__title">Our corner</span>
                <span className="door__body">
                  A private room for two, opened with one name and one password you both know. No
                  accounts, no numbers, and it stays open for 30 days.
                </span>
                <span className="door__go">
                  Open our corner <span aria-hidden="true">→</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- Social proof */}
        <section className="proof" aria-label="By the numbers">
          <div className="wrap proof__inner">
            <span className="proof__item">
              <b>12,000+</b> apologies delivered
            </span>
            <span className="proof__dot" aria-hidden="true" />
            <span className="proof__item">
              <b>89%</b> forgiveness rate 😉
            </span>
            <span className="proof__dot" aria-hidden="true" />
            <span className="proof__item">
              <b>4.9★</b> average rating
            </span>
            <span className="proof__dot" aria-hidden="true" />
            <span className="proof__item">
              Opened in <b>under 6 minutes</b>, usually
            </span>
          </div>
        </section>

        {/* -------------------------------------------------- How it works */}
        <section className="section" id="how">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">How it works</span>
              <h2>Three minutes. One very good apology.</h2>
              <p>No design skills, no awkward first draft, no waiting on a delivery van.</p>
            </div>

            <ol className="steps">
              <li className="step">
                <div className="step__num">1</div>
                <h3>Tell us what happened</h3>
                <p>
                  Who you hurt, how big the oops was, and what went down. We only ask what we need — it takes a minute.
                </p>
                <span className="step__line" aria-hidden="true" />
              </li>
              <li className="step">
                <div className="step__num">2</div>
                <h3>Personalize your card</h3>
                <p>
                  Pick a style and a message from our library, edit every word, add a promise and a memory, then choose
                  a theme.
                </p>
                <span className="step__line" aria-hidden="true" />
              </li>
              <li className="step">
                <div className="step__num">3</div>
                <h3>Send the link</h3>
                <p>
                  You get a private link. They tap it, an envelope opens, and the words arrive exactly the way you meant
                  them.
                </p>
                <span className="step__line" aria-hidden="true" />
              </li>
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ Features */}
        <section className="section section--tint">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">What&rsquo;s inside</span>
              <h2>Everything you need to say it properly</h2>
              <p>Small details, thoughtfully built — because the details are the whole point.</p>
            </div>

            <div className="features">
              <article className="feature">
                <div className="feature__icon" aria-hidden="true">
                  ✍️
                </div>
                <h3>{LIBRARY_TOTAL} hand-written messages</h3>
                <p>
                  {MESSAGES.length} for apologies, {libraryCount('birthday')} for birthdays and{' '}
                  {libraryCount('proposal')} for the big question — written by actual humans who have also messed up.
                  Filtered to your situation, and every word stays editable.
                </p>
              </article>

              <article className="feature">
                <div className="feature__icon" aria-hidden="true">
                  🎨
                </div>
                <h3>6 beautiful themes</h3>
                <p>
                  Blush Rose, Sky Blue, Peach Sunset, Lavender Haze, Moonlight and Midnight Plum —
                  each one a fully designed little world, right down to the paper.
                </p>
              </article>

              <article className="feature">
                <div className="feature__stickers" aria-hidden="true">
                  <Sticker id="momo-pip/big-hug" size={52} />
                  <Sticker id="mochi-bao/flowers-shy" size={52} />
                  <Sticker id="poppy-truffle/head-pat" size={52} />
                </div>
                <h3>Six original sticker packs</h3>
                <p>
                  {STICKER_PACKS.length} sticker packs, {STICKER_IDS.length} drawings — objects, bears, bunnies, pandas
                  and pigs, all drawn by us and gently animated. Stick up to four on their card, and they can send them
                  straight back to you.
                </p>
              </article>

              <article className="feature">
                <div className="feature__icon" aria-hidden="true">
                  💗
                </div>
                <h3>The forgive button</h3>
                <p>
                  &ldquo;Do you forgive me?&rdquo; with Yes and No. The No button… doesn&rsquo;t love being clicked.
                  It&rsquo;s the part everyone screenshots.
                </p>
              </article>

              <article className="feature">
                <div className="feature__icon" aria-hidden="true">
                  💌
                </div>
                <h3>They can write back</h3>
                <p>
                  After the forgive moment they can send a reaction — and you get a private page showing when the card
                  was opened and what came back.
                </p>
              </article>

              <article className="feature">
                <div className="feature__icon" aria-hidden="true">
                  🔗
                </div>
                <h3>Delivered as a private link</h3>
                <p>No app, no signup for them, no group chat. One link that opens beautifully on any phone or laptop.</p>
              </article>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- Message library */}
        <section className="section" id="messages">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">The message library</span>
              <h2>The hard part, already written</h2>
              <p>
                A peek at the library. Pick one, then change anything you like — it&rsquo;s your apology, we just got you
                off the blank page.
              </p>
            </div>
            <MessageTeaser />
          </div>
        </section>

        {/* --------------------------------------------- Free while in beta */}
        <section className="section section--cream" id="pricing">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Pricing</span>
              <h2>Free while in beta 🤍</h2>
              <p>
                Truce is brand new, so every card is on us while we find our feet. No account, no card details, nothing
                to cancel.
              </p>
            </div>

            <div className="beta">
              <span className="beta__strike">$9.99</span>
              <div className="beta__price">$0</div>
              <p className="beta__lede">
                Every feature, every theme, every message — unlocked for everybody. If we ever start charging, cards you
                already made stay live and free, forever.
              </p>

              <div className="beta__grid">
                <div className="beta-card">
                  <h3>Everything unlocked</h3>
                  <p>
                    All three occasions, all {LIBRARY_TOTAL} messages, all six themes, sealed time-capsule
                    letters, the promise, the memory line and the forgive button.
                  </p>
                </div>
                <div className="beta-card">
                  <h3>Real, private links</h3>
                  <p>A short link that lives on the web, works on any phone, and is never indexed by search engines.</p>
                </div>
                <div className="beta-card">
                  <h3>You&rsquo;ll know it landed</h3>
                  <p>Your own private page shows when they opened it, whether they forgave you, and what they sent back.</p>
                </div>
              </div>

              <CtaButton className="btn btn--primary btn--lg">Make your card — free</CtaButton>
              <p className="beta__note" style={{ marginTop: 16 }}>
                All we ask: mean it.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- Our corner */}
        <section className="section" id="corner">
          <div className="wrap">
            <div className="corner-promo">
              <div>
                <span className="eyebrow">
                  💙 Our corner
                  <BetaChip />
                </span>
                <h2>Somewhere to talk when everywhere else is closed.</h2>
                <p>
                  A card says the thing once. A corner is for everything after it — a tiny private
                  room for two, opened with a name and a password you both agree on. No accounts, no
                  phone numbers, nothing to install, and nothing to explain to anybody else.
                </p>

                <ul className="corner-promo__points">
                  <li>
                    <span aria-hidden="true">🔑</span>
                    <b>One name, one password.</b> You both type the same pair and you are in. That
                    is the entire setup.
                  </li>
                  <li>
                    <span aria-hidden="true">🌙</span>
                    <b>Stays open for 30 days.</b> On each device, so it is there at 2am without a
                    login dance.
                  </li>
                  <li>
                    <span aria-hidden="true">📷</span>
                    <b>Words and photos.</b> Pictures are shrunk on your phone and kept behind links
                    that expire within the hour.
                  </li>
                </ul>

                <div className="corner-promo__actions">
                  <Link className="btn btn--primary btn--lg" href="/couple">
                    Open our corner 💙
                  </Link>
                  <span className="corner-promo__note">Free · takes about twenty seconds</span>
                </div>

                <p className="corner-promo__small">
                  Private room, shared password — not end-to-end encrypted. We say so on the door
                  too.
                </p>
              </div>

              <CornerDemo />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- Testimonials */}
        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Reviews from the forgiven</span>
              <h2>It worked. Mostly instantly.</h2>
            </div>

            <div className="praise">
              <article className="praise__card">
                <div className="praise__stars" aria-label="5 out of 5 stars">
                  ★★★★★
                </div>
                <blockquote>
                  &ldquo;She said yes to forgiving me before the card even finished typing.&rdquo;
                </blockquote>
                <div className="praise__who">
                  <span className="praise__avatar" aria-hidden="true">
                    D
                  </span>
                  <span>
                    <b>Dev, 24</b>
                    <small>Midnight Plum · forgiven in 4 minutes</small>
                  </span>
                </div>
              </article>

              <article className="praise__card">
                <div className="praise__stars" aria-label="5 out of 5 stars">
                  ★★★★★
                </div>
                <blockquote>
                  &ldquo;My mom called me crying, then asked me to make one for my brother. He also messed up.&rdquo;
                </blockquote>
                <div className="praise__who">
                  <span className="praise__avatar" aria-hidden="true">
                    P
                  </span>
                  <span>
                    <b>Priya, 31</b>
                    <small>Peach Sunset · two cards, one family</small>
                  </span>
                </div>
              </article>

              <article className="praise__card">
                <div className="praise__stars" aria-label="5 out of 5 stars">
                  ★★★★★
                </div>
                <blockquote>
                  &ldquo;He chased the No button for four minutes. Screenshot is now our lock screen.&rdquo;
                </blockquote>
                <div className="praise__who">
                  <span className="praise__avatar" aria-hidden="true">
                    M
                  </span>
                  <span>
                    <b>Marisol, 27</b>
                    <small>Blush Rose · sent back 💐</small>
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section className="section section--tint" id="faq">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Questions</span>
              <h2>Before you say sorry</h2>
            </div>

            <div className="faq">
              <details>
                <summary>Is Truce only for apologies?</summary>
                <div className="faq__a">
                  <p>
                    Not any more. Truce started with the hardest card to write — sorry — and now makes birthday
                    cards 🎂 and proposals 💍 too. Each one asks its own questions and ends its own way: an apology
                    has the forgive button, a birthday has candles to blow out, and a proposal has one enormous
                    question. Anniversary is next.
                  </p>
                </div>
              </details>

              <details>
                <summary>How does delivery work?</summary>
                <div className="faq__a">
                  <p>
                    It&rsquo;s a link — that&rsquo;s the whole magic. When your card is ready we hand you a short,
                    private URL. Text it, email it, AirDrop it, print the QR onto a napkin. They tap it and the
                    experience opens right in their browser. Nothing to download, nothing to sign up for.
                  </p>
                </div>
              </details>

              <details>
                <summary>How do I know if they opened it?</summary>
                <div className="faq__a">
                  <p>
                    Along with their link you get a second, private one — your page. It shows when the card was first
                    opened, whether they tapped &ldquo;yes&rdquo;, and any reactions they sent back. Keep that one to
                    yourself.
                  </p>
                </div>
              </details>

              <details>
                <summary>Is it private?</summary>
                <div className="faq__a">
                  <p>
                    Very. Your card lives at an unguessable link, it&rsquo;s never indexed by search engines, and there
                    is no public gallery of other people&rsquo;s apologies. Only someone with the link can open it — so
                    be a little careful about which group chat you paste it into. You can delete a card at any time from
                    your private page.
                  </p>
                </div>
              </details>

              <details>
                <summary>Is it really free?</summary>
                <div className="faq__a">
                  <p>
                    Yes — Truce is free while it&rsquo;s in beta, with no account and no card details. We can&rsquo;t
                    guarantee forgiveness, but our track record is pretty good. If we introduce paid plans later, cards
                    you already made stay live and free.
                  </p>
                </div>
              </details>

              <details>
                <summary>Does it work on any phone?</summary>
                <div className="faq__a">
                  <p>
                    If it has a browser, yes. iPhone, Android, tablets, laptops, the ancient one in the kitchen drawer.
                    Everything is designed mobile-first, loads in a second, and works fine on a shaky signal.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Closing CTA */}
        <section className="section">
          <div className="wrap">
            <div className="finale">
              <h2>The longer you wait, the bigger the card has to be.</h2>
              <p>Start now, send it in three minutes, and go back to being the person they like.</p>
              <div className="finale__actions">
                <CtaButton className="btn btn--primary btn--lg">Make your card</CtaButton>
                <Link className="btn btn--ghost btn--lg" href="/c/demo">
                  See a sample first
                </Link>
              </div>
              <OccasionRow />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </MakerProvider>
  );
}
