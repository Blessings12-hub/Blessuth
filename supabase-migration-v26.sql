-- Blessuth v26 migration — run this once in Supabase SQL Editor.

-- ---------- 1. Pictures + voice notes in Chat ----------
alter table messages add column if not exists image_path text;
alter table messages add column if not exists audio_path text;
alter table messages alter column text drop not null;

-- ---------- 2. Seen receipts + voice notes in Notes ----------
-- Same shape as Chat's existing read_at pattern, just under a name that
-- matches how Notes already talks about itself.
alter table notes add column if not exists seen_at timestamptz;
alter table notes add column if not exists audio_path text;
alter table notes alter column text drop not null;

-- ---------- 3. Multiple canvas pages (flip through them like a notebook) ----------
create table if not exists canvas_pages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  page_number int not null,
  created_by uuid,
  created_at timestamptz default now(),
  unique (couple_id, page_number)
);

alter table canvas_pages enable row level security;

create policy "couple can read canvas pages" on canvas_pages for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add canvas pages" on canvas_pages for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can delete canvas pages" on canvas_pages for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table canvas_pages;

-- Every existing stroke belongs to "page 1" by default — nothing about
-- your current canvas changes, it just becomes the first page of what can
-- now be a multi-page notebook.
alter table board_strokes add column if not exists page_number int not null default 1;
