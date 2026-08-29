-- Blessuth v24 migration — run this once in Supabase SQL Editor.
--
-- Adds the Bible Study page: a shared feed of verses either of you save
-- (typed or from a screenshot, with AI-generated prayer points), plus a
-- simple reminder list. Same RLS pattern as everywhere else in this
-- project — a couple member can read/write rows for their own couple_id.

create table if not exists bible_verses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  user_name text,
  reference text,
  verse_text text,
  image_path text,
  prayer_points jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists bible_reminders (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  created_by uuid not null,
  title text not null,
  remind_at timestamptz not null,
  recurrence text not null default 'none', -- 'none' | 'daily' | 'weekly'
  last_fired_at timestamptz,
  created_at timestamptz default now()
);

alter table bible_verses enable row level security;
alter table bible_reminders enable row level security;

create policy "couple can read bible verses" on bible_verses for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add bible verses" on bible_verses for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can delete bible verses" on bible_verses for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read bible reminders" on bible_reminders for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add bible reminders" on bible_reminders for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can delete bible reminders" on bible_reminders for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table bible_verses;
alter publication supabase_realtime add table bible_reminders;

-- Notify your partner when you save a new verse, same pattern as every
-- other content-sharing table in this app.
drop trigger if exists notify_on_bible_verse on bible_verses;
create trigger notify_on_bible_verse
after insert on bible_verses
for each row execute function notify_webhook();

-- Note: bible_reminders intentionally has no notify_webhook trigger — its
-- push notifications are delivered on a schedule instead (whenever a
-- reminder becomes due), not on insert. See api/check-bible-reminders.js
-- and vercel.json for that piece.
