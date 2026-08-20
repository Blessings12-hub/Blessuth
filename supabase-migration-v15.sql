-- Blessuth v15 migration — run this once in Supabase SQL Editor.
-- Run after v1-v14.
--
-- Switches push notifications from OneSignal (a third-party service) back
-- to native Web Push using VAPID keys — entirely free, no account signup,
-- no external SDK.
--
-- This reuses the `push_subscriptions` table already created back in
-- `supabase-migration-v7.sql` (it was built for exactly this, then sat
-- unused while the app was on OneSignal) — nothing to create. It's only
-- missing one thing: browsers need to be able to *update* their own
-- subscription row, not just insert/select/delete, since re-enabling
-- notifications does an upsert (insert-or-update) rather than a plain
-- insert.
--
-- After running this, see README "Turn on notifications" for the
-- remaining steps (generating your VAPID key pair and adding it to
-- Vercel) — nothing works until that's done.

drop policy if exists "users can update their own subscription" on push_subscriptions;
create policy "users can update their own subscription" on push_subscriptions
  for update using (user_id = auth.uid());

-- Once you've confirmed VAPID push works, it's safe to remove the
-- ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY / VITE_ONESIGNAL_APP_ID
-- environment variables from Vercel — they're no longer read by anything.
