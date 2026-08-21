-- Blessuth v16 migration — run this once in Supabase SQL Editor.
--
-- Replaces the push-notification system (native Web Push / VAPID, driven
-- by a Database Webhook or SQL trigger calling out to /api/notify) with
-- in-app alerts powered directly by Supabase Realtime. The app now
-- subscribes to these tables straight from the browser — no VAPID keys,
-- no webhook secret, no serverless function, nothing to configure here
-- beyond running this file.
--
-- Tradeoff: alerts only show up while Blessuth is open in a tab/PWA
-- window. There's no way to notify someone whose phone is locked or app
-- is fully closed without a real push system — see git history / README
-- if you ever want to bring that back.

-- ---------- 1. Turn on Realtime for the tables the app now watches ----------
-- (board_strokes was already added to this publication back in v11.)

do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table notes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table daily_answers;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table message_reactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table quiz_answers;
exception when duplicate_object then null;
end $$;

-- ---------- 2. Tear down the old webhook-triggered push system ----------
-- Safe to run whether or not you ever finished setting these up.

drop trigger if exists notify_on_message on messages;
drop trigger if exists notify_on_note on notes;
drop trigger if exists notify_on_daily_answer on daily_answers;
drop trigger if exists notify_on_reaction on message_reactions;
drop trigger if exists notify_on_quiz_answer on quiz_answers;
drop function if exists notify_webhook();
drop table if exists push_subscriptions;

-- If you'd set one up, you can also now delete the "notify" Database
-- Webhook in the Supabase dashboard (Database → Webhooks), and in Vercel
-- you can remove the VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
-- VITE_VAPID_PUBLIC_KEY, and NOTIFY_WEBHOOK_SECRET env vars — none of them
-- are read anymore.
