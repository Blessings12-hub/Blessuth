-- Blescy — Supabase schema
-- Run this whole file in Supabase Dashboard → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  pair_code text unique not null,
  couple_id uuid,
  created_at timestamptz default now()
);

create table couples (
  id uuid primary key default gen_random_uuid(),
  member1 uuid references profiles(id) not null,
  member2 uuid references profiles(id) not null,
  next_visit_date date,
  created_at timestamptz default now()
);

alter table profiles
  add constraint profiles_couple_fk foreign key (couple_id) references couples(id);

create table boards (
  couple_id uuid primary key references couples(id) on delete cascade,
  strokes jsonb not null default '[]'
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  url text not null,
  path text not null,
  caption text,
  uploaded_by text,
  uploaded_by_uid uuid,
  created_at timestamptz default now()
);

create table quiz_answers (
  couple_id uuid references couples(id) on delete cascade not null,
  quiz_key text not null,
  user_id uuid references profiles(id) not null,
  user_name text,
  answers jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (couple_id, quiz_key, user_id)
);

create table locations (
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  lat double precision not null,
  lng double precision not null,
  label text,
  updated_at timestamptz default now(),
  primary key (couple_id, user_id)
);

create table moods (
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  mood text not null,
  song text,
  label text,
  updated_at timestamptz default now(),
  primary key (couple_id, user_id)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  text text not null,
  from_name text,
  from_uid uuid,
  created_at timestamptz default now()
);

-- ---------- Row Level Security ----------

alter table profiles enable row level security;
alter table couples enable row level security;
alter table boards enable row level security;
alter table photos enable row level security;
alter table quiz_answers enable row level security;
alter table locations enable row level security;
alter table moods enable row level security;
alter table notes enable row level security;

-- profiles: any signed-in user can look people up (needed for pair codes),
-- but can only edit their own row.
create policy "profiles are readable by signed-in users" on profiles
  for select using (auth.uid() is not null);
create policy "users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- couples: only the two members can see or touch their couple row.
create policy "members can read their couple" on couples
  for select using (auth.uid() = member1 or auth.uid() = member2);
create policy "members can update their couple" on couples
  for update using (auth.uid() = member1 or auth.uid() = member2);

-- everything else is scoped to "your couple_id", read via your profile row.
create policy "couple can read boards" on boards for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write boards" on boards for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update boards" on boards for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read photos" on photos for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can insert photos" on photos for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can delete photos" on photos for delete using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read quiz answers" on quiz_answers for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write own quiz answers" on quiz_answers for insert with check (
  user_id = auth.uid() and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update own quiz answers" on quiz_answers for update using (
  user_id = auth.uid());

create policy "couple can read locations" on locations for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can write own location" on locations for insert with check (
  user_id = auth.uid() and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can update own location" on locations for update using (
  user_id = auth.uid());

create policy "couple can read moods" on moods for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can write own mood" on moods for insert with check (
  user_id = auth.uid() and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can update own mood" on moods for update using (
  user_id = auth.uid());

create policy "couple can read notes" on notes for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can insert own notes" on notes for insert with check (
  from_uid = auth.uid() and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can delete own notes" on notes for delete using (
  from_uid = auth.uid());

-- ---------- Pairing function ----------
-- Runs with elevated privilege so it can safely update BOTH partners'
-- profile rows in one transaction (a normal user can only update their own row).
create or replace function pair_with_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles%rowtype;
  partner profiles%rowtype;
  new_couple_id uuid;
begin
  select * into me from profiles where id = auth.uid();
  if me.pair_code = upper(code) then
    raise exception 'That is your own code — ask your partner for theirs.';
  end if;

  select * into partner from profiles where pair_code = upper(code);
  if partner.id is null then
    raise exception 'No account found with that code.';
  end if;
  if partner.couple_id is not null then
    raise exception 'That person is already paired with someone.';
  end if;
  if me.couple_id is not null then
    raise exception 'You are already paired with someone.';
  end if;

  insert into couples (member1, member2)
    values (me.id, partner.id)
    returning id into new_couple_id;

  update profiles set couple_id = new_couple_id where id = me.id;
  update profiles set couple_id = new_couple_id where id = partner.id;

  return new_couple_id;
end;
$$;

-- ---------- Realtime ----------
-- Enable realtime updates so both partners see changes live.
alter publication supabase_realtime add table boards, photos, quiz_answers, locations, moods, notes, profiles, couples;

-- ---------- Storage ----------
-- Create a bucket named "photos" in Storage → New bucket (uncheck "Public bucket").
-- Then run this so each couple can only read/write their own folder (named after their couple_id).
create policy "couple can manage own photo files"
on storage.objects for all
using (
  bucket_id = 'photos' and
  (storage.foldername(name))[1]::uuid in (select couple_id from profiles where id = auth.uid())
)
with check (
  bucket_id = 'photos' and
  (storage.foldername(name))[1]::uuid in (select couple_id from profiles where id = auth.uid())
);
