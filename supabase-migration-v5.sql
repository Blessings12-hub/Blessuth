-- Blessuth v5 migration — run this once in Supabase SQL Editor.

alter table moods add column if not exists now_playing jsonb;

create table if not exists playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  track_id text not null,
  title text not null,
  artist text not null,
  artwork text,
  preview_url text,
  added_by text,
  added_by_uid uuid,
  created_at timestamptz default now()
);

alter table playlist_tracks enable row level security;

create policy "couple can read playlist" on playlist_tracks for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add to playlist" on playlist_tracks for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "adder can remove their track" on playlist_tracks for delete using (
  added_by_uid = auth.uid());

alter publication supabase_realtime add table playlist_tracks;
