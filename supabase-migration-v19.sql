-- Blessuth v19 migration — run this once in Supabase SQL Editor.
--
-- Adds the tables behind 5 new games: the collaborative Word Game, Truth or
-- Dare, This or That, Tic-Tac-Toe, and Pictionary. All RLS policies follow
-- the same pattern already used elsewhere in this project: a couple member
-- can read/write rows for their own couple_id, found via their profile.
--
-- Note on trust model: as with the rest of this app (e.g. quiz "self"
-- answers before you've both finished), these tables don't try to hide data
-- from your own partner at the database level — RLS keeps OTHER couples out,
-- but within a couple the client UI is what controls what's shown when
-- (e.g. Pictionary's word is only *displayed* to the drawer client-side).
-- That matches how every other feature here already works.

-- ---------- 1. Collaborative Word Game ----------

create table if not exists word_rounds (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  target_word text not null,
  max_guesses int not null default 6,
  created_by uuid not null,
  created_at timestamptz default now(),
  solved_at timestamptz,
  failed boolean not null default false
);

create table if not exists word_guesses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references word_rounds(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  user_name text,
  guess text not null,
  created_at timestamptz default now()
);

alter table word_rounds enable row level security;
alter table word_guesses enable row level security;

create policy "couple can read word rounds" on word_rounds for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start word rounds" on word_rounds for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update word rounds" on word_rounds for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read word guesses" on word_guesses for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add word guesses" on word_guesses for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table word_rounds;
alter publication supabase_realtime add table word_guesses;

-- ---------- 2. Truth or Dare (one shared row per couple) ----------

create table if not exists truth_or_dare_state (
  couple_id uuid primary key references couples(id) on delete cascade,
  kind text,
  prompt text,
  chosen_by uuid,
  updated_at timestamptz default now()
);

alter table truth_or_dare_state enable row level security;

create policy "couple can read truth or dare" on truth_or_dare_state for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write truth or dare" on truth_or_dare_state for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update truth or dare" on truth_or_dare_state for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table truth_or_dare_state;

-- ---------- 3. This or That ----------

-- Tracks which "round" of This or That is currently active for a couple.
-- The pairs shown are deterministically derived client-side from this
-- batch_key (see seededShuffle in src/data/thisOrThat.js) — this row is
-- just what keeps both partners' clients pointed at the same round, so
-- their answers stay comparable index-by-index. Starting a new round just
-- writes a fresh batch_key here; old answer rows under the old key are
-- harmless leftovers, same as old quiz keys elsewhere in this project.

create table if not exists this_or_that_round (
  couple_id uuid primary key references couples(id) on delete cascade,
  batch_key text not null default 'daily',
  updated_by uuid,
  updated_at timestamptz default now()
);

alter table this_or_that_round enable row level security;

create policy "couple can read this or that round" on this_or_that_round for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write this or that round" on this_or_that_round for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update this or that round" on this_or_that_round for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table this_or_that_round;

create table if not exists this_or_that_answers (
  couple_id uuid references couples(id) on delete cascade not null,
  batch_key text not null,
  user_id uuid not null,
  user_name text,
  answers jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (couple_id, batch_key, user_id)
);

alter table this_or_that_answers enable row level security;

create policy "couple can read this or that" on this_or_that_answers for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write own this or that" on this_or_that_answers for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update own this or that" on this_or_that_answers for update using (
  user_id = auth.uid());

alter publication supabase_realtime add table this_or_that_answers;

-- ---------- 4. Tic-Tac-Toe ----------

create table if not exists tictactoe_games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  board jsonb not null default '[null,null,null,null,null,null,null,null,null]',
  player_x uuid not null,
  player_o uuid not null,
  turn uuid not null,
  winner text,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tictactoe_games enable row level security;

create policy "couple can read tictactoe" on tictactoe_games for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start tictactoe" on tictactoe_games for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can play tictactoe" on tictactoe_games for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table tictactoe_games;

-- ---------- 5. Pictionary ----------

create table if not exists pictionary_rounds (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  word text not null,
  drawer_id uuid not null,
  created_by uuid not null,
  created_at timestamptz default now(),
  solved_at timestamptz,
  winning_guess text
);

create table if not exists pictionary_strokes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references pictionary_rounds(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  color text not null,
  width int not null,
  points jsonb not null,
  by uuid not null,
  created_at timestamptz default now()
);

alter table pictionary_rounds enable row level security;
alter table pictionary_strokes enable row level security;

create policy "couple can read pictionary rounds" on pictionary_rounds for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start pictionary rounds" on pictionary_rounds for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update pictionary rounds" on pictionary_rounds for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read pictionary strokes" on pictionary_strokes for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add pictionary strokes" on pictionary_strokes for insert with check (
  by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table pictionary_rounds;
alter publication supabase_realtime add table pictionary_strokes;
