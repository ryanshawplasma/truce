-- ============================================================================
-- Truce — database schema
-- ----------------------------------------------------------------------------
-- HOW TO USE THIS FILE
--   1. Open your project on https://supabase.com
--   2. Click "SQL Editor" in the left sidebar, then "New query"
--   3. Paste this entire file in and press "Run"
--   4. You should see "Success. No rows returned" — that's it, you're done.
--
-- Running it a second time is safe: everything below is written with
-- "if not exists" / "drop policy if exists" so nothing breaks on a re-run.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- cards — one row per card someone creates
-- ----------------------------------------------------------------------------
create table if not exists public.cards (
  -- Short, URL-safe id that appears in the public link: /c/aB3xY7kP
  id          text primary key,

  -- Which kind of card this is. Only 'sorry' today; 'birthday' and
  -- 'anniversary' will slot in here later without a schema change.
  occasion    text        not null default 'sorry',

  to_name     text,
  from_name   text,
  message     text,
  reason      text,       -- the little "Re: …" line
  promise     text,       -- "I promise to …"
  memory      text,       -- "Remember … ? I want more of that."
  style       text,       -- sweet | funny | poetic | heart
  -- blush | sky | peach | lavender | moonlight | midnight
  -- (the full list lives in THEMES, lib/constants.js)
  theme       text,
  severity    int,        -- 1 tiny oops, 2 pretty bad, 3 really messed up

  -- Time-capsule letters. NULL = open immediately. When set to a moment in the
  -- future the card page refuses to send the message, promise, memory or
  -- stickers to the browser until that moment has passed.
  unlock_at   timestamptz,

  -- Up to four sticker ids the sender stuck on the card, e.g. ["bear-hug"].
  -- The list of valid ids lives in lib/constants.js (STICKER_IDS).
  stickers    jsonb       not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  opened_at   timestamptz,          -- first time the recipient opened it
  forgiven_at timestamptz,          -- when they tapped "yes"

  -- Long secret that unlocks the sender's private page: /s/<edit_token>
  edit_token  text        not null unique
);

-- Public ids are short (6 URL-safe characters for new cards, 8 for older ones)
-- so a link is easy to text and easy to read out loud. app/actions.js retries
-- on a unique violation, so a collision costs one wasted insert and nothing else.

-- Looking a card up by its private token happens on every visit to /s/…
create index if not exists cards_edit_token_idx on public.cards (edit_token);
create index if not exists cards_created_at_idx on public.cards (created_at desc);


-- ----------------------------------------------------------------------------
-- reactions — the emoji a recipient sends back
-- ----------------------------------------------------------------------------
create table if not exists public.reactions (
  id         bigint generated always as identity primary key,

  -- Deleting a card automatically deletes its reactions.
  card_id    text        not null references public.cards (id) on delete cascade,

  -- Either an emoji from the allowlist in lib/constants.js (REACTION_EMOJI),
  -- or a sticker written as "sticker:<id>".
  --
  -- Sticker ids are pack-scoped: the twelve original "classics" keep their bare
  -- ids ("sticker:bear-hug") so rows written before the couple packs still
  -- resolve, and every pack added since is namespaced "<pack>/<pose>", e.g.
  -- "sticker:momo-pip/big-hug" or "sticker:mochi-bao/flowers-shy".
  -- The full id list is STICKER_PACKS in lib/constants.js;
  -- app/actions.js rejects anything else before it reaches this table.
  emoji      text        not null,
  created_at timestamptz not null default now()
);

create index if not exists reactions_card_id_idx on public.reactions (card_id, created_at desc);


-- Upgrades for databases created before these columns existed. Harmless on a
-- fresh install, and the reason you can safely paste this whole file again.
alter table public.cards add column if not exists stickers  jsonb not null default '[]'::jsonb;
alter table public.cards add column if not exists unlock_at timestamptz;


-- ----------------------------------------------------------------------------
-- couple_rooms / couple_messages — "Our corner"
-- ----------------------------------------------------------------------------
-- A tiny private room for two people, opened with a shared name + password.
-- It exists for the moment one of them is blocked everywhere else and still
-- needs somewhere to say something.
--
-- IMPORTANT: this is a shared-secret space, not end-to-end encryption. The
-- password is stored only as a scrypt hash (lib/couple.js) and messages are
-- readable by whoever runs this database — i.e. you. Say so honestly in your
-- own copy if you ever change the wording on /couple.
create table if not exists public.couple_rooms (
  id          text primary key,

  -- The name the pair types to find their room: lowercase, 3-32 characters,
  -- a-z 0-9 and dashes. Unique, because the name is half of the secret.
  name        text        not null unique,

  -- scrypt(password, salt). Never the password itself.
  pass_hash   text        not null,
  pass_salt   text        not null,

  -- Optional: powers the "Day 412 together 💙" counter in the room header.
  anniversary date,

  created_at  timestamptz not null default now()
);

create table if not exists public.couple_messages (
  id         bigint generated always as identity primary key,
  room_id    text        not null references public.couple_rooms (id) on delete cascade,

  -- Which side of the room wrote it: 1 or 2. There are only ever two.
  author     int         not null,

  body       text        not null,   -- capped at 600 characters in app/couple/actions.js

  -- A photo sent in the room, stored as its object path inside the private
  -- `corner-media` bucket: "<roomId>/<nanoid>.jpg". NULL for ordinary messages.
  -- When a photo has a caption it lives in `body` (capped at 200 characters).
  media_path text,

  created_at timestamptz not null default now()
);

create index if not exists couple_messages_room_idx on public.couple_messages (room_id, id);


-- ----------------------------------------------------------------------------
-- Closing a corner takes two people
-- ----------------------------------------------------------------------------
-- A corner is shared, so one person cannot delete it alone. Each side asks
-- separately, with the password, and the room is destroyed only when both asks
-- are live at the same moment — inside a ten-minute window. One person having
-- second thoughts, or simply not being at their phone, is enough to stop it.
--
-- Two nullable timestamps rather than a table: there are only ever two sides,
-- the state is tiny, and "both non-null and within ten minutes of each other"
-- is a condition you can read at a glance in a psql session at 3am.
--
-- Clearing either column cancels. Both are cleared after any successful delete
-- (moot — the row is gone) and whenever a request goes stale.
alter table public.couple_rooms add column if not exists delete_asked_1 timestamptz;
alter table public.couple_rooms add column if not exists delete_asked_2 timestamptz;

-- Reply, reactions and unsend. All three are additive: a corner whose table
-- predates them keeps working, it just loses those three features until this
-- runs. See the extrasColumns note in lib/couple.js.
alter table public.couple_messages add column if not exists reply_to   bigint;
alter table public.couple_messages add column if not exists reactions  jsonb not null default '{}'::jsonb;
alter table public.couple_messages add column if not exists deleted_at timestamptz;


-- ============================================================================
-- PHOTOS — one extra step, in the dashboard rather than in SQL
-- ----------------------------------------------------------------------------
-- Photos in Our corner live in Supabase Storage, not in a table. Create the
-- bucket once:
--
--   1. Supabase dashboard → Storage → "New bucket"
--   2. Name it exactly:  corner-media
--   3. Leave "Public bucket" switched OFF. It must be PRIVATE.
--   4. Create it. That's all — do not add any policies.
--
-- Why no policies? Same reason the tables below have none. Only the service
-- role ever touches this bucket, and the service role bypasses storage policies
-- exactly the way it bypasses RLS. Browsers never hold a key: the server hands
-- out a one-shot signed URL to upload with, and short-lived (1 hour) signed URLs
-- to view with. A photo link that gets forwarded stops working within the hour.
--
-- Object paths are "<roomId>/<nanoid>.jpg" and the server refuses to record a
-- path outside the caller's own room folder (see lib/media.js).
--
-- If the bucket does not exist, Truce says "Photos need one quick setup step by
-- the site owner" in the room and logs the reason on the server. Nothing else
-- breaks — messages, cards and everything else carry on.
--
-- FREE TIER: Supabase includes 1GB of storage. Photos are shrunk in the browser
-- to a 1600px longest edge at roughly 200–800KB each before they are uploaded,
-- so that is a few thousand photos. Storage → Usage in the dashboard shows where
-- you are, and you can delete rows/objects by hand at any time.
-- ============================================================================


-- ============================================================================
-- SECURITY MODEL — please don't skip this bit
-- ----------------------------------------------------------------------------
-- Row Level Security is switched ON for both tables and we deliberately create
-- NO policies. In Postgres, "RLS enabled + no policies" means: deny everything.
--
-- So:
--   * The public/anon key (the one that is safe to expose in a browser) can
--     read nothing and write nothing. Even if someone finds your project URL,
--     they cannot list other people's cards.
--   * The service_role key BYPASSES RLS entirely. Truce uses that key, and only
--     ever from the server (server components and server actions — see
--     lib/supabase.js, which imports 'server-only' so it can never be bundled
--     into browser code).
--
-- That is why the key is called SUPABASE_SERVICE_ROLE_KEY and NOT
-- NEXT_PUBLIC_ANYTHING. Never prefix it with NEXT_PUBLIC_, and never paste it
-- into a client component: anything NEXT_PUBLIC_ is visible to every visitor.
--
-- If you later add sign-in and want the browser to talk to Supabase directly,
-- that is the moment to write real policies here.
-- ============================================================================

alter table public.cards           enable row level security;
alter table public.reactions       enable row level security;
alter table public.couple_rooms    enable row level security;
alter table public.couple_messages enable row level security;

-- Belt and braces: make sure no permissive policy is left over from testing.
drop policy if exists "public read cards"           on public.cards;
drop policy if exists "public read reactions"       on public.reactions;
drop policy if exists "public read couple_rooms"    on public.couple_rooms;
drop policy if exists "public read couple_messages" on public.couple_messages;


-- ----------------------------------------------------------------------------
-- Already ran an earlier version of this file?
-- ----------------------------------------------------------------------------
-- The `stickers` column was added after the first release. If your tables were
-- created before that, run this one line once (it is safe to run again):
--
--   alter table public.cards add column if not exists stickers jsonb not null default '[]'::jsonb;
--
-- The `unlock_at` column (time-capsule letters) came later still. Same deal —
-- run this one line once if your `cards` table predates it:
--
--   alter table public.cards add column if not exists unlock_at timestamptz;
--
-- Photos in Our corner added `media_path`. If your `couple_messages` table was
-- made before that, run this one line once (safe to run again), then create the
-- `corner-media` bucket as described above:
--
--   alter table public.couple_messages add column if not exists media_path text;
--
-- Two-key deletion added the two `delete_asked_*` columns. If your
-- `couple_rooms` table predates it, run these two lines once:
--
--   alter table public.couple_rooms add column if not exists delete_asked_1 timestamptz;
--   alter table public.couple_rooms add column if not exists delete_asked_2 timestamptz;
--
-- Reply, reactions and unsend added three more to couple_messages. Without
-- them the chat still sends and receives; only those features switch off:
--
--   alter table public.couple_messages add column if not exists reply_to   bigint;
--   alter table public.couple_messages add column if not exists reactions  jsonb not null default '{}'::jsonb;
--   alter table public.couple_messages add column if not exists deleted_at timestamptz;
--
-- Everything else in this file is already idempotent, so a fresh paste of the
-- whole thing is fine too.


-- ----------------------------------------------------------------------------
-- Optional housekeeping
-- ----------------------------------------------------------------------------
-- Cards are small, but if you ever want to clear out very old unopened ones,
-- this is the query to run by hand (or from a scheduled job):
--
--   delete from public.cards
--   where created_at < now() - interval '1 year'
--     and opened_at is null;
