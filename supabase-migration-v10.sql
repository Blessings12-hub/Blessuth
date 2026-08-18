-- Blessuth v10 migration — run this once in Supabase SQL Editor.
-- Adds emoji reactions to chat messages. Run after v1-v9.

create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (message_id, user_id)
);

alter table message_reactions enable row level security;

create policy "couple can read reactions" on message_reactions for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "user can add own reaction" on message_reactions for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "user can update own reaction" on message_reactions for update using (
  user_id = auth.uid());

create policy "user can remove own reaction" on message_reactions for delete using (
  user_id = auth.uid());

-- Needed so both partners see reactions appear live without refreshing.
alter publication supabase_realtime add table message_reactions;
