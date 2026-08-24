-- Blessuth v20 migration — run this once in Supabase SQL Editor.
--
-- Adds tables for 5 more games: Connect Four, Never Have I Ever, 20
-- Questions, Emoji Charades, and Story Chain. Same RLS pattern as v19: a
-- couple member can read/write rows for their own couple_id, found via
-- their profile. Same trust model too — nothing here hides data from your
-- own partner at the database level, only from other couples.

-- ---------- 1. Connect Four ----------

create table if not exists connect4_games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  board jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]',
  player_r uuid not null,
  player_y uuid not null,
  turn uuid not null,
  winner text,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table connect4_games enable row level security;

create policy "couple can read connect4" on connect4_games for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start connect4" on connect4_games for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can play connect4" on connect4_games for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table connect4_games;

-- ---------- 2. Never Have I Ever ----------
-- Same shared-round pattern as This or That: a small control row so both
-- clients derive the identical shuffled prompt order, plus a per-user
-- answers row per round.

create table if not exists nhie_round (
  couple_id uuid primary key references couples(id) on delete cascade,
  batch_key text not null default 'daily',
  updated_by uuid,
  updated_at timestamptz default now()
);

create table if not exists nhie_answers (
  couple_id uuid references couples(id) on delete cascade not null,
  batch_key text not null,
  user_id uuid not null,
  user_name text,
  answers jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (couple_id, batch_key, user_id)
);

alter table nhie_round enable row level security;
alter table nhie_answers enable row level security;

create policy "couple can read nhie round" on nhie_round for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write nhie round" on nhie_round for insert with check (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update nhie round" on nhie_round for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read nhie answers" on nhie_answers for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can write own nhie answers" on nhie_answers for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update own nhie answers" on nhie_answers for update using (
  user_id = auth.uid());

alter publication supabase_realtime add table nhie_round;
alter publication supabase_realtime add table nhie_answers;

-- ---------- 3. 20 Questions ----------

create table if not exists twenty_q_rounds (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  answerer_id uuid not null,
  secret text not null,
  created_by uuid not null,
  created_at timestamptz default now(),
  solved_at timestamptz,
  winning_guess text
);

create table if not exists twenty_q_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references twenty_q_rounds(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  question text not null,
  answer text,
  asked_by uuid not null,
  created_at timestamptz default now()
);

alter table twenty_q_rounds enable row level security;
alter table twenty_q_questions enable row level security;

create policy "couple can read 20q rounds" on twenty_q_rounds for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start 20q rounds" on twenty_q_rounds for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update 20q rounds" on twenty_q_rounds for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read 20q questions" on twenty_q_questions for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can ask 20q questions" on twenty_q_questions for insert with check (
  asked_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can answer 20q questions" on twenty_q_questions for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table twenty_q_rounds;
alter publication supabase_realtime add table twenty_q_questions;

-- ---------- 4. Emoji Charades ----------

create table if not exists emoji_charades_rounds (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  phrase text not null,
  clue_giver_id uuid not null,
  emojis text not null default '',
  created_by uuid not null,
  created_at timestamptz default now(),
  solved_at timestamptz,
  winning_guess text
);

alter table emoji_charades_rounds enable row level security;

create policy "couple can read emoji charades" on emoji_charades_rounds for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start emoji charades" on emoji_charades_rounds for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update emoji charades" on emoji_charades_rounds for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table emoji_charades_rounds;

-- ---------- 5. Story Chain ----------

create table if not exists story_chain_rounds (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references couples(id) on delete cascade not null,
  max_lines int not null default 12,
  created_by uuid not null,
  created_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists story_chain_lines (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references story_chain_rounds(id) on delete cascade not null,
  couple_id uuid references couples(id) on delete cascade not null,
  user_id uuid not null,
  user_name text,
  text text not null,
  created_at timestamptz default now()
);

alter table story_chain_rounds enable row level security;
alter table story_chain_lines enable row level security;

create policy "couple can read story rounds" on story_chain_rounds for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can start story rounds" on story_chain_rounds for insert with check (
  created_by = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can update story rounds" on story_chain_rounds for update using (
  couple_id in (select couple_id from profiles where id = auth.uid()));

create policy "couple can read story lines" on story_chain_lines for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "couple can add story lines" on story_chain_lines for insert with check (
  user_id = auth.uid()
  and couple_id in (select couple_id from profiles where id = auth.uid()));

alter publication supabase_realtime add table story_chain_rounds;
alter publication supabase_realtime add table story_chain_lines;
