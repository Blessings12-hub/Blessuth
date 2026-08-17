-- Blessuth v2 migration — run this once in Supabase SQL Editor.
-- (Safe to run even if you're not sure whether it's been run before —
-- "if not exists" makes it a no-op the second time.)

alter table profiles add column if not exists timezone text;
alter table couples add column if not exists together_since date;
