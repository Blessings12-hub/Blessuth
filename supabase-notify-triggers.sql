-- Alternative to using the Supabase dashboard's Database Webhooks UI.
--
-- A "Database Webhook" is really just a Postgres trigger that calls out to
-- a URL over HTTP whenever a row is inserted. This does the same thing
-- directly in SQL using pg_net (a Postgres extension Supabase ships with),
-- which is more reliably available than the older supabase_functions
-- helper this file used before.
--
-- Your real values are already filled in below — nothing to edit, just
-- paste this whole file into the SQL Editor and run it once.

create extension if not exists pg_net;

create or replace function notify_webhook() returns trigger as $$
begin
  perform net.http_post(
    url := 'https://blescy.vercel.app/api/notify',
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

-- To check these are actually firing (and see any errors), run this after
-- triggering one (e.g. sending a chat message):
--   select * from net._http_response order by id desc limit 20;
