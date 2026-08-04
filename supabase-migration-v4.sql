-- Blescy v4 migration — run this once in Supabase SQL Editor.

alter table profiles add column if not exists birthday date;
alter table profiles add column if not exists location_sharing_enabled boolean not null default false;

-- Disconnects the caller from their current partner and wipes the shared
-- couple data (canvas, photos, quiz answers, locations, moods, notes,
-- daily answers all cascade-delete with the couple row). Both profiles are
-- freed up to pair again — with the same code or a fresh one.
-- SECURITY DEFINER because a normal user can only update their own profile
-- row via RLS, but unpairing needs to clear couple_id on both sides at once.
create or replace function unpair_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_couple_id uuid;
begin
  select couple_id into my_couple_id from profiles where id = auth.uid();
  if my_couple_id is null then
    raise exception 'You are not currently paired with anyone.';
  end if;

  update profiles set couple_id = null where couple_id = my_couple_id;
  delete from couples where id = my_couple_id;
end;
$$;
