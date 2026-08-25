-- ============================================================================
-- TRUCE — upgrade an existing database
-- ============================================================================
--
-- WHAT THIS IS
-- ------------
-- Everything added to "Our corner" since the first release, in one paste.
-- If your tables already exist and you only want to catch up, run this.
-- If you are starting from nothing, run schema.sql instead — it contains all
-- of this already.
--
-- HOW TO RUN IT
-- -------------
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- It is safe to run more than once. Every statement is `if not exists`, so a
-- second run changes nothing and reports success. It never drops a column and
-- never touches a row, so there is nothing here that can lose a message.
--
-- WHAT HAPPENS IF YOU DON'T RUN IT
-- --------------------------------
-- The site keeps working. Each feature below switches itself off the first
-- time PostgREST answers 42703 ("column does not exist"), logs the exact line
-- to run, and the conversation carries on without it. Messages always send.
-- See the mediaColumn / extrasColumns notes in lib/couple.js.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Photos                                                    (adds: 1 column)
-- ----------------------------------------------------------------------------
-- The object path of a photo inside the private `corner-media` bucket, as
-- "<roomId>/<id>.jpg". NULL on an ordinary message. A photo's caption lives in
-- `body`, capped shorter than a normal message.
--
-- Photos ALSO need the bucket itself, which is not SQL — see the note at the
-- bottom of this file.

alter table public.couple_messages add column if not exists media_path text;


-- ----------------------------------------------------------------------------
-- 2. Two-key deletion                                         (adds: 2 columns)
-- ----------------------------------------------------------------------------
-- Closing a corner takes both people. Each side's "yes" is a timestamp, and
-- the room only goes when both are present and neither has gone stale.

alter table public.couple_rooms add column if not exists delete_asked_1 timestamptz;
alter table public.couple_rooms add column if not exists delete_asked_2 timestamptz;


-- ----------------------------------------------------------------------------
-- 3. Reply, reactions and unsend                              (adds: 3 columns)
-- ----------------------------------------------------------------------------
-- reply_to    the id of the message this one answers. Plain bigint rather than
--             a foreign key on purpose: an unsent message keeps its row, but a
--             room that is deleted takes its messages with it, and a dangling
--             reply should degrade to "message unavailable" rather than block
--             a delete.
--
-- reactions   { "<emoji>": [1, 2] } — emoji to the sides holding it. There are
--             only ever two sides, so this is at most two entries long.
--             Defaults to an empty object so nothing has to handle NULL.
--
-- deleted_at  the tombstone for unsend. The row deliberately stays: ids are
--             how the poll knows what it has already seen, and a hole in that
--             sequence makes a room wait for a message that is never coming.
--             The body is emptied at the same time, so the words are gone from
--             the database rather than merely hidden by the client.

alter table public.couple_messages add column if not exists reply_to   bigint;
alter table public.couple_messages add column if not exists reactions  jsonb not null default '{}'::jsonb;
alter table public.couple_messages add column if not exists deleted_at timestamptz;


-- ----------------------------------------------------------------------------
-- 4. Voice notes                                               (adds: 1 column)
-- ----------------------------------------------------------------------------
-- How long the recording runs, in milliseconds, measured while recording.
--
-- It is stored rather than read from the file because it cannot be trusted to
-- be in the file: MediaRecorder writes streaming WebM with no duration in the
-- header, so a browser asked for `audio.duration` before playing it through
-- once answers Infinity. A voice note whose length only appears after you
-- listen to it is not much of a length.
--
-- Voice notes reuse media_path — the extension says which kind it is, so no
-- second column is needed to tell a photo from a recording.

alter table public.couple_messages add column if not exists media_ms integer;


-- ----------------------------------------------------------------------------
-- Check it worked
-- ----------------------------------------------------------------------------
-- Should list all seven of the columns above.

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and (
        (table_name = 'couple_messages'
         and column_name in ('media_path', 'reply_to', 'reactions', 'deleted_at', 'media_ms'))
     or (table_name = 'couple_rooms'
         and column_name in ('delete_asked_1', 'delete_asked_2'))
       )
 order by table_name, column_name;


-- ============================================================================
-- ONE THING THAT IS NOT SQL
-- ============================================================================
-- Photos and voice notes are stored as files, and the bucket cannot be made
-- from here. Once, in the dashboard:
--
--   Storage -> New bucket
--     Name:    corner-media
--     Public:  OFF   <- this matters. Leave it private.
--
-- Add no policies. Nothing reads that bucket except the service role, from the
-- server, and browsers only ever receive short-lived signed URLs. A private
-- bucket with no policies is what makes a forwarded link stop working.
-- ============================================================================
