-- Blessuth v21 migration — run this once in Supabase SQL Editor.
--
-- Adds the Wishlist page: each of you can add things you'd like to get
-- (a pasted link that auto-fetches a preview image, or your own photo),
-- and see each other's lists. No new storage bucket needed — wishlist
-- images reuse the existing private `photos` bucket, under a
-- couple_id/wishlist/... path, which the existing storage policy already
-- covers (it only checks the first path segment).

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  user_name text,
  title text not null,
  image_url text,
  path text,
  link_url text,
  price text,
  note text,
  purchased boolean not null default false,
  purchased_by uuid,
  created_at timestamptz default now()
);

alter table wishlist_items enable row level security;

create policy "couple can read wishlist" on wishlist_items for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add wishlist items" on wishlist_items for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update wishlist items" on wishlist_items for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can delete wishlist items" on wishlist_items for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table wishlist_items;

-- Note on "purchased": this flag IS readable by both partners at the
-- database level (same trust model as everywhere else in this app), but
-- the app's UI deliberately never shows it to the item's own owner, only
-- to their partner — so marking something "got it" stays a surprise
-- without needing to actually hide data in the database.
