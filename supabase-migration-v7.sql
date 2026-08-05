-- Blescy v7 migration — run this once in Supabase SQL Editor.
-- Adds message editing and push notification subscriptions.

alter table messages add column if not exists edited_at timestamptz;

-- The existing "couple can mark messages read" policy lets either partner
-- update a row (needed so the recipient can set read_at). This trigger
-- makes sure that door can only be used to touch read_at — nothing else —
-- unless you're the original sender.
create or replace function protect_message_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> old.sender_id then
    if new.text is distinct from old.text
       or new.sender_id is distinct from old.sender_id
       or new.sender_name is distinct from old.sender_name
       or new.couple_id is distinct from old.couple_id
       or new.edited_at is distinct from old.edited_at then
      raise exception 'Cannot modify another person''s message';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_message_edit_trigger on messages;
create trigger protect_message_edit_trigger
before update on messages
for each row execute function protect_message_edit();

-- ---------- Push notification subscriptions ----------

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  couple_id uuid references couples(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "users can insert their own subscription" on push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "users can read their own subscriptions" on push_subscriptions
  for select using (user_id = auth.uid());
create policy "users can delete their own subscriptions" on push_subscriptions
  for delete using (user_id = auth.uid());

-- Note: push_subscriptions is intentionally NOT added to supabase_realtime —
-- it's only ever read by the server-side notify function using the
-- service role key, which bypasses RLS entirely.
