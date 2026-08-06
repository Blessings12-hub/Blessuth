-- Alternative to using the Supabase dashboard's Database Webhooks UI.
--
-- A "Database Webhook" is really just a Postgres trigger that calls out to
-- a URL over HTTP whenever a row is inserted. This does the exact same
-- thing directly in SQL, using Supabase's built-in http_request function —
-- useful if you can't find the Webhooks screen in your dashboard, or just
-- prefer doing it this way since you're already in the SQL Editor for
-- migrations.
--
-- Before running this, replace the two placeholders below:
--   <YOUR_VERCEL_URL>   e.g. https://blescy.vercel.app  (no trailing slash)
--   <YOUR_WEBHOOK_SECRET>  must exactly match NOTIFY_WEBHOOK_SECRET in Vercel

drop trigger if exists notify_on_message on messages;
create trigger notify_on_message
after insert on messages
for each row execute function supabase_functions.http_request(
  '<YOUR_VERCEL_URL>/api/notify',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<YOUR_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);

drop trigger if exists notify_on_note on notes;
create trigger notify_on_note
after insert on notes
for each row execute function supabase_functions.http_request(
  '<YOUR_VERCEL_URL>/api/notify',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<YOUR_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);

drop trigger if exists notify_on_daily_answer on daily_answers;
create trigger notify_on_daily_answer
after insert on daily_answers
for each row execute function supabase_functions.http_request(
  '<YOUR_VERCEL_URL>/api/notify',
  'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"<YOUR_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);

-- To check these are actually firing (and see any errors), run:
--   select * from net._http_response order by created desc limit 20;
-- after triggering one (e.g. sending a chat message).
