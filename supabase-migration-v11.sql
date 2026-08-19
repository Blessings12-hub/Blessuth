-- Blessuth v11 migration — run this once in Supabase SQL Editor.
-- Run after v1-v10.
--
-- Two independent changes:
--   1. A proper per-stroke table for the Canvas, replacing the old
--      single-JSON-column `boards` table (which had both partners
--      read-modify-write the whole board on every stroke — draw at the
--      same time and one of you could silently lose a stroke).
--   2. A push notification trigger for message reactions, matching the
--      ones v_notify already set up for messages/notes/daily_answers.

-- ---------- 1. Canvas strokes ----------

create table if not exists board_strokes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  color text not null,
  width int not null,
  points jsonb not null,
  by uuid not null,
  created_at timestamptz default now()
);

alter table board_strokes enable row level security;

create policy "couple can read strokes" on board_strokes for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can add strokes" on board_strokes for insert with check (
  by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can clear strokes" on board_strokes for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table board_strokes;

-- The old `boards` table is no longer used by the app (Canvas.jsx now reads
-- and writes board_strokes instead) — left in place rather than dropped, in
-- case you want to keep the old JSON blob around. Safe to drop by hand later:
--   drop table if exists boards;

-- ---------- 2. Push notification for reactions ----------
-- Only run this part if you've already run supabase-notify-triggers.sql —
-- it reuses the notify_webhook() function defined there.

drop trigger if exists notify_on_reaction on message_reactions;
create trigger notify_on_reaction
after insert on message_reactions
for each row execute function notify_webhook();
