-- Blessuth v9 migration — run this once in Supabase SQL Editor.
-- Adds profile photos.

alter table profiles add column if not exists avatar_url text;

-- Creates the storage bucket for avatars directly (public, since profile
-- photos need to display for both partners via a plain URL — lower
-- sensitivity than the private "photos" album, so this is simpler than
-- signed URLs). If this insert errors in your project for any reason, just
-- create it by hand instead: Storage → New bucket → name it exactly
-- "avatars" → check "Public bucket" → Create.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Each person can only create/replace/delete their own avatar file — the
-- app always uploads to "{your-user-id}.jpg", so this just checks the
-- filename matches whoever is signed in. Reads don't need a policy since
-- the bucket is public.
create policy "user can manage own avatar"
on storage.objects for all
using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
