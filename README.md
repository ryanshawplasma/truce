# Truce 🤍

**The sweetest way to say sorry — and, now, to say a few other things too.**

Truce turns a card into something the other person actually wants to open: a
sealed envelope, a hand-written message that types itself out, a promise, a
memory, and a moment at the end that depends on the occasion — a "Do you forgive
me?" button whose *No* option is not entirely cooperative, a birthday cake with
candles to blow out, or one very large question. You get a private link to send,
and a second private link that tells you when it was opened and what they sent
back.

Three occasions so far: **apology 💌**, **birthday 🎂** and **proposal 💍**.

Free while in beta — no accounts, no payments, no card details.

---

## What's in the box

- **A landing page** — the full Truce marketing site: hero with drifting hearts,
  how-it-works, features, a peek at the message library, FAQ.
- **A card maker** — it opens by asking what the occasion is, and the occasion
  decides the rest: an apology asks how big the oops was and what happened, a
  birthday asks how big it should feel and skips straight past "what happened",
  and a proposal skips both. Then style, message, promise, theme, stickers,
  preview, and one button to create the card.
- **Three recipient moments** — the forgive button on an apology, a cake with
  `severity + 2` candles to blow out on a birthday, and "Will you be mine? 💍"
  (with the same dodging *No*) on a proposal.
- **96 hand-written messages** in four styles (sweet, funny, poetic, from the
  heart) — 56 apologies, 24 birthday, 16 proposal — filtered by occasion and by
  who you're writing to. Every word stays editable.
- **Two site appearances** — **Blush 🌸** (the default warm cream) and
  **Sky 💙** (the cool one). The switch is in the nav, the mobile menu and the
  footer, it is remembered by the visitor's browser, and it is applied before
  the page paints so there is never a flash of the wrong colours.
- **Six card themes** — Blush Rose, Sky Blue, Peach Sunset, Lavender Haze,
  Moonlight and Midnight Plum. Each one is a full set of CSS custom properties,
  right down to the colour of the paper and the wax seal. (A *theme* belongs to
  one card and its sender picks it; an *appearance* is the whole site and each
  visitor picks their own. The two never fight: a card always looks the way its
  sender intended.)
- **Time-capsule letters** — optionally seal a card until a date and time. Until
  that moment the recipient sees a sealed envelope and a live countdown, and the
  server sends them *no* message, promise, memory or stickers at all — the lock
  is real, not a CSS trick. (Needs a database; a no-setup link carries the card
  inside itself, so there is nothing to keep shut.)
- **Our corner** at `/couple` — a tiny private chat room for two, opened with a
  name and a shared password. Made for the moment one of you is blocked
  everywhere else and still has something to say. (Also needs a database.)
- **Photos in Our corner** *(beta)* — send a picture with the 📷 button, browse
  every photo in the room with **Gallery 🖼**, tap for a full-screen view. Shrunk
  in the browser, kept in a private bucket, and only ever shown through signed
  links that expire in an hour. (Needs one extra setup step — see below.)
- **Six original sticker packs, 62 stickers** — twelve object stickers plus five
  animal/heart couples (Momo & Pip, Rosie & Plum, Clover & Biscuit, Mochi & Bao,
  Poppy & Truffle), each posed ten ways. Every one is inline SVG drawn by us and
  gently animated. Stick up to four on a card, mixed across packs. They live in
  `app/components/stickers/`; the couple packs are generated, so re-run the
  generator rather than editing those files by hand.
- **The card experience** at `/c/{id}` — envelope, typewriter, promise, memory,
  the forgive moment, then emoji *and stickers* they can send back.
- **A private sender page** at `/s/{token}` — share link, a timeline (created →
  opened → forgiven), the reactions you've received, and a delete button.
- **Open-tracking** — the first time the envelope is opened, we record it.
- **A forgiveness meter** on the card and a **cuteness meter** in the maker —
  both purely for fun, neither is stored anywhere.
- **"My cards"** at `/mine` — a rescue hatch for senders who close the tab and
  lose their private link. Cards made on a device are remembered by that browser.
- **A private stats page** at `/dev` — counts only, never card contents.
- **Works with no setup at all** — with no database configured, cards are packed
  into the link itself (`/c/local#c=…`) and everything still works.

### Routes

| Route | What it is |
| --- | --- |
| `/` | Landing page + the card maker |
| `/c/{id}` | The card experience (what the recipient sees) |
| `/c/demo` | A built-in sample card — no database needed |
| `/c/local#c=…` | A card encoded entirely in the link (no-setup mode) |
| `/s/{token}` | The sender's private page |
| `/couple` | "Our corner" — create or enter a private room for two |
| `/couple/room` | The room itself (needs a session cookie) |
| `/mine` | Cards made on this device (browser storage only) |
| `/dev?key=…` | Private stats for whoever runs the site (see below) |

### Sticker packs

Six packs, sixty-two drawings, all inline SVG and gently animated. A sender can
stick up to four on a card (mix packs freely); a recipient can send any of them
back from the reaction tray.

| Pack | Who | Poses |
| --- | --- | --- |
| Classics 🩹 | Objects — bandaged heart, white flag, bouquet, love letter… | 12 |
| Momo & Pip 🐻 | Bear and bunny | 10 |
| Rosie & Plum 💕 | Two hearts | 10 |
| Clover & Biscuit 🐰 | Bunny and cat | 10 |
| Mochi & Bao 🐼 | Two pandas | 10 |
| Poppy & Truffle 🐷 | Two pigs | 10 |

The couple packs share ten poses each: begging, waterfall cry, big hug, flowers
(shy), pouty, cheek kiss, head pat, "forgive me?" sign, sulk & rain, made up.
Sticker ids are stable — the twelve Classics keep their original unprefixed ids
so older cards and reactions still resolve, and everything since is namespaced
`pack/pose` (e.g. `momo-pip/big-hug`).

---

## Running it locally

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. That's it — Truce runs with **zero configuration**.
Without a database it simply makes self-contained links, which is perfect for
trying it out. When you're ready for real short links and open-tracking, follow
the guide below.

Other commands:

```bash
npm run build   # production build
npm run start   # run the production build locally
```

---

## Going live: the complete guide

This is written for someone who has never done it before. It takes about 20
minutes. Nothing here costs money.

### 1. Create a free Supabase project

Supabase is the database that stores the cards.

1. Go to <https://supabase.com> and click **Start your project**. Sign in with
   GitHub or an email address.
2. Click **New project**.
3. Fill in:
   - **Name**: `truce` (anything you like)
   - **Database password**: click *Generate a password* and save it in your
     password manager. You won't need it for Truce, but don't lose it.
   - **Region**: pick the one closest to where most of your users are.
4. Click **Create new project** and wait a minute or two while it sets up.

### 2. Create the tables

1. In your new project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project, copy **all** of it, and
   paste it into the editor.
4. Click **Run** (or press Ctrl/Cmd + Enter).
5. You should see *"Success. No rows returned"*. Done — your `cards`,
   `reactions`, `couple_rooms` and `couple_messages` tables now exist, with
   security switched on.

> **Upgrading an older Truce database?** Paste the same file again. Every
> statement in it is safe to re-run, and it now includes the `unlock_at` column
> (time-capsule letters), the two "Our corner" tables, and the `media_path`
> column that photos need.

### 2b. Create the photo bucket (one minute, optional)

Photos in Our corner need one bucket. Everything else works without it — the
room simply says *"Photos need one quick setup step by the site owner"* until it
exists.

1. In Supabase, click **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name it **exactly** `corner-media`.
4. Leave **Public bucket** switched **OFF**. It must be private.
5. Click **Create bucket**. Don't add any policies — you don't need any.

That's it. Only the server ever touches the bucket, using the `service_role`
key, which bypasses storage policies the same way it bypasses RLS. Browsers get
a one-shot signed URL to upload with and a one-hour signed URL to look with, so
a photo link that gets forwarded to someone else stops working within the hour.

> **Free tier:** Supabase includes **1 GB** of storage. Truce shrinks every
> photo in the browser before it uploads — longest edge 1600px, JPEG quality
> ~0.82, typically 200–800 KB — so that is a few thousand photos. **Storage →
> Usage** in the dashboard shows where you are.

### 3. Collect your two secret values

1. Still in Supabase, click the **gear icon (Project Settings)** in the sidebar.
2. Open **Data API**. Copy the **Project URL** — it looks like
   `https://abcdefgh.supabase.co`. That is your `SUPABASE_URL`.
3. Open **API Keys**. Find the **`service_role`** key (you may need to click
   *Reveal*). Copy it. That is your `SUPABASE_SERVICE_ROLE_KEY`.

> ⚠️ **The service_role key is a master key.** It can read and change everything
> in your database. Never put it in a public place, never paste it into a chat,
> and never rename it to start with `NEXT_PUBLIC_` — anything with that prefix is
> visible to every visitor of your site. Truce only ever uses it on the server.

To use these locally, make a file called `.env.local` in this folder (copy
`.env.example` and fill it in), then restart `npm run dev`.

### 4. Put the code on GitHub

1. Create a free account at <https://github.com> if you don't have one.
2. Click **+** (top right) → **New repository**. Name it `truce`, keep it
   **Private** if you prefer, and click **Create repository**.
3. In a terminal, in this folder, run the commands GitHub shows you. They look
   like this:

```bash
git init
git add .
git commit -m "Truce"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/truce.git
git push -u origin main
```

Your `.env.local` file is ignored by git on purpose, so your secret key stays
on your computer.

### 5. Deploy on Vercel

1. Go to <https://vercel.com> and sign up with your GitHub account.
2. Click **Add New… → Project**, find your `truce` repository, click **Import**.
3. Leave every build setting exactly as it is — Vercel detects Next.js by itself.
4. Before clicking Deploy, open **Environment Variables** and add these:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | the Project URL from step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 3 |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` (no trailing slash) |
   | `ADMIN_SECRET` | *(recommended)* any long password you invent. It unlocks the `/dev` stats page **and** signs the "Our corner" session cookie |

   You won't know the exact site URL until the first deploy finishes — that's
   fine. Deploy once, copy the address Vercel gives you, then come back to
   **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL`, and click
   **Redeploy**.
5. Click **Deploy** and wait a couple of minutes.

Visit your new site, make a card, and check that `/s/{token}` shows "Opened"
after you open the card link in another browser. If it does, you're live. 🎉

### Checking how it's going: the `/dev` page

Truce has a small private dashboard showing how many cards have been made,
opened and forgiven, plus the ten most recent card ids. It shows **counts and
ids only** — it can never display what anybody wrote.

1. Invent a long password, e.g. `truce-9fJ2xQ-stats`.
2. Add it as an environment variable named `ADMIN_SECRET` (in `.env.local`
   locally, or in Vercel → Settings → Environment Variables), then redeploy.
3. Visit `https://your-site/dev?key=truce-9fJ2xQ-stats`.

Without `ADMIN_SECRET` set, the page simply explains how to switch it on. With
the wrong key, it shows a friendly "nothing to see here". Keep the link private:
that key is the only lock on the page.

**A deliberate tradeoff:** the key travels in the query string, so the full URL
can end up in your browser history, in a proxy log, or in a `Referer` header if
you ever click a link from that page. That is the price of a dashboard with no
login screen, and it is a fair one here — the worst case is that someone sees
counts, never what anybody wrote. If a URL does leak, change `ADMIN_SECRET` and
redeploy. (The comparison itself is constant-time and leaks nothing about the
key's length or contents.)

### Using your own domain

In Vercel: **Settings → Domains → Add**, type your domain, and follow the DNS
instructions. Afterwards, update `NEXT_PUBLIC_SITE_URL` to the new address and
redeploy, so new links use it.

---

## How it's put together

```
app/
  page.js                  landing page (server) + the maker
  layout.js                fonts, metadata, icon sprite
  actions.js               all server actions (create, react, forgive, delete)
  globals.css              the entire Truce design system, incl. both appearances
  data/messages.js         the 56 apology messages
  data/occasion-messages.js  the birthday + proposal messages
  data/library.js          all three libraries, and the occasion-aware filter
  components/              nav, hero pieces, wizard, card experience, helpers
  components/AppearanceToggle.jsx  the Sky 💙 / Blush 🌸 switch
  c/[id]/                  the card experience + its social-share image
  s/[token]/               the sender's private page
lib/
  appearance.js            the site skin: storage, defaults, pre-paint script
  supabase.js              server-only database client
  cards.js                 read helpers
  codec.js                 the no-database link encoder
  constants.js             recipients, styles, themes, limits, sample card
  occasions.js             the occasion config — copy, steps, moments (see below)
  format.js                relative/absolute time
supabase/schema.sql        paste-into-Supabase database setup
```

A few deliberate choices:

- **The link is the storage.** No cookies, no accounts, no sessions. The one
  exception is the small "My cards" list described below.
- **All database access happens on the server.** `lib/supabase.js` imports
  `server-only`, so the build fails loudly if that ever changes.
- **Everything the visitor types is re-validated on the server** in
  `app/actions.js` — lengths, allowed themes/styles, and the emoji allowlist.
- **React escapes all text**, so a name like `<script>` is just an odd name.
  Nothing anybody types ever reaches `dangerouslySetInnerHTML`. There is exactly
  one use of it in the whole project — the appearance script in `app/layout.js`
  — and it inlines a fixed string written by us (`APPEARANCE_BOOT_SCRIPT` in
  `lib/appearance.js`) with no user input anywhere near it. It has to be inline
  because it runs while the browser is still parsing the HTML, which is the only
  moment early enough to avoid a flash of the wrong palette.

### Appearance: the site skin

`html[data-appearance="blush"]` (or `"sky"`) is the switch everything hangs off.
`app/globals.css` defines one block of semantic tokens per appearance — `--page`,
`--ink`, `--accent`, `--footer-bg` and friends — and the rest of the stylesheet
only ever refers to those names, so adding a third skin means copying one block
and changing about thirty values. Every text colour is chosen against the
background it actually sits on and clears WCAG AA (4.5:1) in both appearances.

Two things deliberately stay rose in every appearance: the logo and the primary
buttons. That pop of Truce rose is the brand, and blush is where it feels at home.

The choice lives in `localStorage` under `truce.appearance`. As with "My cards",
every read and write is wrapped — if storage is blocked the site simply stays on
the default. `qa/appearance.js` is the regression suite: it checks the toggle,
persistence, axe in both skins, and screencasts a throttled page load frame by
frame to prove there is no flash.

### Device memory and "My cards"

Every card gives the sender two links: the public `/c/{id}` one they send, and
the private `/s/{token}` one that shows opens, forgiveness and reactions. People
close the tab and lose the private one, so when a card is created against a real
database the browser keeps a small note of it — id, edit token, recipient's first
name and the date — under the `truce.mycards` key in `localStorage`. `/mine`
reads that list back, newest first, and the card page shows a quiet "this is your
card" banner when the visitor is the one who made it.

Privacy and robustness, because both matter here:

- **It never leaves the device.** Nothing is sent to a server, there is no
  account behind it, and it is not shared between phones or browsers. Those edit
  tokens sit in the visitor's own browser and nowhere else.
- **It is best-effort.** Every read and write is wrapped in `try/catch`
  (`lib/mycards.js`). Private browsing, blocked storage or a full quota simply
  means the list stays empty — nothing breaks, no error is shown, and creating
  and sending cards keeps working exactly as before.
- **Clearing browsing data clears it**, which `/mine` says out loud. The private
  link is still the thing worth saving somewhere safe.
- **No-setup (hash) mode is not remembered**, because those cards have no id and
  no private page — the whole card already lives inside its own link.

### Adding another occasion later

`lib/occasions.js` is the only file that knows one occasion from another. Each
entry holds:

- which **questions** to ask, and in what order (`steps`)
- which **recipients** to offer (`recipientIds`)
- the **envelope** headline and subtitles, the sign-off, the share preview copy
- what the **promise** field is called and how it reads back (a birthday calls
  it a wish and stores it in the same column)
- which **moment** the recipient gets: `forgive`, `candles` or `question`
- the **meter** labels, the reply-back strip, and the sender's timeline wording

To add "anniversary", copy the `birthday` entry, add a message library to
`app/data/library.js`, and add the id to `OCCASION_IDS` and the allowlist in
`app/actions.js`. No new UI code is needed unless the occasion wants a brand new
recipient moment — that is the one switch, in
`app/components/CardExperience.jsx`. The database already has an `occasion`
column, so no migration is needed.

---

## Photos in Our corner

The 📷 button next to the message box sends a picture. It is in **beta**, and it
works like this:

1. **Your phone does the shrinking.** The photo is drawn onto a canvas, resized
   so its longest edge is 1600px, and saved as a JPEG at about 0.82 quality —
   dropping the quality further if it is still over ~800 KB. Files over 12 MB and
   anything that is not an image are refused with a friendly line before any of
   this starts.
2. **The server picks where it goes.** It hands back a one-shot signed upload URL
   for `corner-media/<your room id>/<random>.jpg`. The browser does not get to
   choose the path, and the server refuses to record a path outside your own
   room's folder even if the browser tries.
3. **The bytes go straight to Supabase.** They never pass through the Truce
   server, which keeps a serverless function from having to hold a photo in
   memory.
4. **Looking at them uses one-hour signed URLs**, re-issued every time the room
   loads or polls. There is no public URL for any photo, ever.

**Gallery 🖼** in the room header shows every photo in the corner, newest first,
three across on a phone. Tap any photo — in the chat or the gallery — for a
full-screen view.

**Captions** are the words in the box when you tap 📷; they are capped at 200
characters. **Limit:** 12 photos an hour per person, which is a politeness limit
rather than a security one (see the rate-limiting section).

If the bucket has not been made yet, or the `media_path` column is missing, the
room says one calm sentence and everything else — messages, cards, the lot —
carries on working. The reason is written to the server log with the exact SQL
or dashboard step needed to fix it.

## Our corner: how it works, and what it is not

`/couple` is a shared-secret room. Two people agree on a **name** and a
**password**; whoever knows both is in, and nobody else is. There are no
accounts, no email addresses and no phone numbers, which is the whole point —
it works when every other channel is closed.

**What we do properly**

- The password is never stored. We keep `scrypt(password, random salt)` and
  compare with a constant-time equal, so a wrong guess leaks nothing about how
  close it was (`lib/couple.js`).
- The session is an **httpOnly, signed cookie** — `roomId|side|expiry` plus an
  HMAC-SHA256 over exactly that. JavaScript in the browser cannot read it, and
  it cannot be forged without the server secret. It lasts 30 days.
- A wrong name and a wrong password give the *same* answer, so the form cannot
  be used to discover which rooms exist.
- Messages are capped at 600 characters, with a one-per-second soft throttle.
- Both tables have RLS on with no policies, exactly like `cards`.
- Photos live in a **private** bucket with no policies. Uploads use one-shot
  signed URLs at a server-chosen path inside your own room's folder; views use
  signed URLs that expire in an hour and are re-issued on every fetch.

**What it is not — please read this bit**

It is **not end-to-end encrypted.** Messages are stored as plain text in your
Supabase project, which means whoever runs that project (you) can read them.
Treat it like a note passed in class: private from the world, not private from
the person paying for the database.

Two things to tell your users, and they are already written on `/couple`:

1. **Don't reuse an important password here.** Make up something new.
2. **Don't put anything in it you would be devastated to lose.** There is no
   password recovery, because there is no email address to send it to.

**Set `ADMIN_SECRET`.** It signs the session cookie (hashed with a purpose
label, so it is never the same bytes as the `/dev` key). Without it, Truce
derives a key from your service-role key instead — which works, but rotating
that key would silently sign everybody out of their corner.

## Rate limiting: what protects the site, honestly

Two things in Truce are unauthenticated and do real work: joining a corner
(which runs `scrypt`, deliberately costing ~46ms of CPU and 16MB of memory per
attempt) and creating a card. Both are throttled per IP address, and the check
happens *before* any expensive work — see `lib/throttle.js`.

Be clear about what that buys you. **The counters live in the memory of one
serverless instance.** Vercel runs several, and a cold start starts from zero,
so somebody determined enough to spread requests around gets a higher effective
limit than the numbers suggest. This is a speed bump, not a wall: it turns
"trivially cheap to abuse" into "annoying to abuse", with no extra services to
pay for or run.

Current limits (per IP, per minute): 5 corner joins against one room name, 20
joins overall, 5 new corners, 10 cards, 30 reactions. Every failed join also
takes a uniform minimum time, so "no such room" and "wrong password" cannot be
told apart with a stopwatch, and repeat failures earn a rising delay.

One more honest caveat: mobile networks put thousands of people behind a single
public IP (carrier-grade NAT), so a per-IP limit is really a per-*network* limit.
The numbers above are set high enough that this should never be felt by a person
making one card, and every rejection is a friendly, temporary "one sec 🤍" that
succeeds on retry a moment later — never a hard failure and never lost words.

When Truce outgrows this, the fix is a shared counter (Upstash or Vercel KV) or
a database-side limit — a deliberate next step, listed in the roadmap below.

## Roadmap

- **Payments** — Razorpay (India) and Stripe (everywhere else) for paid tiers;
  the maker's final step is the natural place to put checkout.
- **More occasions** — anniversary, congratulations, new baby, thank you; the
  data model and copy layer take a new one in a single config entry (see
  "Adding another occasion later").
- **Photo uploads** — one photo inside the envelope, via Supabase Storage.
- **Our corner v2** — typing indicators, read receipts, and a way to turn a
  conversation into a card without leaving the room.
- **Scheduled *delivery*** — time-capsule letters already hold a card shut until
  its moment; the next step is sending the link at that moment too, by email.
- **Sender notifications** — an email or push the moment the card is opened.
- **More themes and seasonal art.**
- **Shared rate limiting** — move the in-memory throttle described above into
  Upstash or Vercel KV so the limits hold across every serverless instance.

---

Made for the moments words are hard. Questions: hello@truce.love
