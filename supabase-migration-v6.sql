-- Blescy v6 migration — run this once in Supabase SQL Editor.
-- Adds a real-time chat thread between the two partners.

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  sender_id uuid not null,
  sender_name text,
  text text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists messages_couple_id_created_at_idx
  on messages (couple_id, created_at);

alter table messages enable row level security;

create policy "couple can read messages" on messages for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can send messages to their couple" on messages for insert with check (
  sender_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can mark messages read" on messages for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "sender can delete their own message" on messages for delete using (
  sender_id = auth.uid());

alter publication supabase_realtime add table messages;
