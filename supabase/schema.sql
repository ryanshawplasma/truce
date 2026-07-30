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
  theme       text,       -- blush | midnight | peach | lavender
  severity    int,        -- 1 tiny oops, 2 pretty bad, 3 really messed up

  -- Up to four sticker ids the sender stuck on the card, e.g. ["bear-hug"].
  -- The list of valid ids lives in lib/constants.js (STICKER_IDS).
  stickers    jsonb       not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  opened_at   timestamptz,          -- first time the recipient opened it
  forgiven_at timestamptz,          -- when they tapped "yes"

  -- Long secret that unlocks the sender's private page: /s/<edit_token>
  edit_token  text        not null unique
);

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

alter table public.cards     enable row level security;
alter table public.reactions enable row level security;

-- Belt and braces: make sure no permissive policy is left over from testing.
drop policy if exists "public read cards"     on public.cards;
drop policy if exists "public read reactions" on public.reactions;


-- ----------------------------------------------------------------------------
-- Already ran an earlier version of this file?
-- ----------------------------------------------------------------------------
-- The `stickers` column was added after the first release. If your tables were
-- created before that, run this one line once (it is safe to run again):
--
--   alter table public.cards add column if not exists stickers jsonb not null default '[]'::jsonb;
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
