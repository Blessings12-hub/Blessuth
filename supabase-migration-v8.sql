-- Blescy v8 migration — run this once in Supabase SQL Editor.
-- Adds Spotify track support to the shared playlist.

alter table playlist_tracks add column if not exists spotify_uri text;
alter table playlist_tracks add column if not exists source text;

update playlist_tracks set source = 'itunes' where source is null;

alter table playlist_tracks alter column source set default 'itunes';
