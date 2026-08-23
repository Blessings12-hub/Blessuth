-- Blessuth v18 migration — run this once in Supabase SQL Editor.
--
-- Adds real push notifications via Firebase Cloud Messaging, on top of
-- (not instead of) the in-app alerts from v16 — you still get the instant
-- in-app banner while the app is open, and now also a real push when it's
-- closed or the phone is locked.

-- ---------- 1. Table for Firebase push tokens ----------
-- One row per registered browser/device. Tokens are opaque strings from
-- Firebase, unlike the old push_subscriptions table's endpoint+keys shape.

create table if not exists fcm_tokens (
  token text primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table fcm_tokens enable row level security;

drop policy if exists "users can insert their own token" on fcm_tokens;
create policy "users can insert their own token" on fcm_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists "users can select their own token" on fcm_tokens;
create policy "users can select their own token" on fcm_tokens
  for select using (user_id = auth.uid());

drop policy if exists "users can update their own token" on fcm_tokens;
create policy "users can update their own token" on fcm_tokens
  for update using (user_id = auth.uid());

drop policy if exists "users can delete their own token" on fcm_tokens;
create policy "users can delete their own token" on fcm_tokens
  for delete using (user_id = auth.uid());

-- ---------- 2. Webhook trigger infrastructure (removed by v16, needed again) ----------
-- Same approach as the original supabase-notify-triggers.sql: a Postgres
-- trigger that calls out to /api/notify over HTTP via pg_net whenever a
-- row is inserted into one of the 5 notifiable tables. /api/notify now
-- sends via Firebase instead of raw VAPID, but the trigger side is
-- unchanged.
--
-- Reusing the same URL + secret that were already live in this project
-- (from the original supabase-notify-triggers.sql) so nothing needs to
-- change on the Supabase side if you'd already run that file before.
-- Make sure Vercel's NOTIFY_WEBHOOK_SECRET env var is set to the same
-- value below.

create extension if not exists pg_net;

create or replace function notify_webhook() returns trigger as $$
begin
  perform net.http_post(
    url := 'https://blessuth.vercel.app/api/notify',
    headers := '{"Content-Type": "application/json", "x-webhook-secret": "W0yZoiBBbDxdVXp6c19WEnwcmPpgmCBZ"}'::jsonb,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', 'public',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists notify_on_message on messages;
create trigger notify_on_message
after insert on messages
for each row execute function notify_webhook();

drop trigger if exists notify_on_note on notes;
create trigger notify_on_note
after insert on notes
for each row execute function notify_webhook();

drop trigger if exists notify_on_daily_answer on daily_answers;
create trigger notify_on_daily_answer
after insert on daily_answers
for each row execute function notify_webhook();

drop trigger if exists notify_on_reaction on message_reactions;
create trigger notify_on_reaction
after insert on message_reactions
for each row execute function notify_webhook();

drop trigger if exists notify_on_quiz_answer on quiz_answers;
create trigger notify_on_quiz_answer
after insert on quiz_answers
for each row execute function notify_webhook();

-- To check these are actually firing (and see any errors), run this after
-- triggering one (e.g. sending a chat message):
--   select * from net._http_response order by id desc limit 20;
