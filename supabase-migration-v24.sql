-- Blessuth v24 migration: game completion tracking and live chat stickers.
create table if not exists public.quick_game_scores (
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  score integer not null default 0 check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (couple_id, game_key, user_id)
);

alter table public.quick_game_scores enable row level security;
create policy "Couple members can read game scores" on public.quick_game_scores for select using (auth.uid() = user_id or exists (select 1 from public.couple_members cm where cm.couple_id = quick_game_scores.couple_id and cm.user_id = auth.uid()));
create policy "Users can write own game scores" on public.quick_game_scores for insert with check (auth.uid() = user_id);
create policy "Users can update own game scores" on public.quick_game_scores for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.messages add column if not exists sticker text;
