-- Blessuth v17 migration — run this once in Supabase SQL Editor.
--
-- Adds a "surprise" you can arm from Settings: a short message that shows
-- as a full-screen animated reveal the next time your partner (not you)
-- opens the app. It stays dormant after being seen once, until you arm it
-- again — so you can reuse it for a birthday, an anniversary, or just a
-- random Tuesday.

alter table couples add column if not exists surprise_message text;
alter table couples add column if not exists surprise_armed_by uuid references profiles(id);
alter table couples add column if not exists surprise_armed_at timestamptz;
alter table couples add column if not exists surprise_seen_at timestamptz;

-- No new RLS policies needed — "members can update their couple" (from the
-- original supabase.sql) already covers writes to these new columns.
