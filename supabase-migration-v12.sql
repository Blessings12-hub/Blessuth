-- Blessuth v12 migration — run this once in Supabase SQL Editor.
-- Run after v1-v11.
--
-- Adds emoji reactions to Love Notes, mirroring message_reactions from v10.

create table if not exists note_reactions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid references notes(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (note_id, user_id)
);

alter table note_reactions enable row level security;

create policy "couple can read note reactions" on note_reactions for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "user can add own note reaction" on note_reactions for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "user can update own note reaction" on note_reactions for update using (
  user_id = auth.uid());

create policy "user can remove own note reaction" on note_reactions for delete using (
  user_id = auth.uid());

alter publication supabase_realtime add table note_reactions;
