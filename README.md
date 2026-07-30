# Truce 🤍

**The sweetest way to say sorry.**

Truce turns an apology into something the other person actually wants to open: a
sealed envelope, a hand-written message that types itself out, a promise, a
memory, and a "Do you forgive me?" button whose *No* option is not entirely
cooperative. You get a private link to send, and a second private link that
tells you when it was opened and what they sent back.

Free while in beta — no accounts, no payments, no card details.

---

## What's in the box

- **A landing page** — the full Truce marketing site: hero with drifting hearts,
  how-it-works, features, a peek at the message library, FAQ.
- **A card maker** — nine short questions (who, names, how bad, what happened,
  style, message, promise, theme, preview), then one button to create the card.
- **56 hand-written messages** in four styles (sweet, funny, poetic, from the
  heart), filtered by who you're writing to. Every word stays editable.
- **Four themes** — Blush Rose, Midnight Plum, Peach Sunset, Lavender Haze.
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
5. You should see *"Success. No rows returned"*. Done — your `cards` and
   `reactions` tables now exist, with security switched on.

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
   | `ADMIN_SECRET` | *(optional)* any long password you invent, for the `/dev` stats page |

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
  globals.css              the entire Truce design system
  data/messages.js         the 56-message library
  components/              nav, hero pieces, wizard, card experience, helpers
  c/[id]/                  the card experience + its social-share image
  s/[token]/               the sender's private page
lib/
  supabase.js              server-only database client
  cards.js                 read helpers
  codec.js                 the no-database link encoder
  constants.js             recipients, styles, themes, limits, sample card
  occasions.js             per-occasion copy (see below)
  format.js                relative/absolute time
supabase/schema.sql        paste-into-Supabase database setup
```

A few deliberate choices:

- **Nothing is stored in the browser.** No localStorage, no cookies. The link is
  the storage.
- **All database access happens on the server.** `lib/supabase.js` imports
  `server-only`, so the build fails loudly if that ever changes.
- **Everything the visitor types is re-validated on the server** in
  `app/actions.js` — lengths, allowed themes/styles, and the emoji allowlist.
- **React escapes all text**, so a name like `<script>` is just an odd name.
  There is no `dangerouslySetInnerHTML` anywhere in this project.

### Adding another occasion later

`lib/occasions.js` holds every string that would change for a birthday or an
anniversary card — the hero headline, the envelope subtitles, the wizard
questions, the sign-off. There's a commented `birthday` example in that file
showing exactly what a new entry looks like. The database already has an
`occasion` column, so no migration is needed.

---

## Roadmap

- **Payments** — Razorpay (India) and Stripe (everywhere else) for paid tiers;
  the maker's final step is the natural place to put checkout.
- **More occasions** — birthday, anniversary, congratulations, proposal; the
  data model and copy layer are already set up for it.
- **Photo uploads** — one photo inside the envelope, via Supabase Storage.
- **Scheduled delivery** — write it tonight, let them get it in the morning.
- **Sender notifications** — an email or push the moment the card is opened.
- **More themes and seasonal art.**

---

Made for the moments words are hard. Questions: hello@truce.love
