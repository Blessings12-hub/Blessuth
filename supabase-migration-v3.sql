-- Blescy v3 migration — run this once in Supabase SQL Editor.

create table if not exists daily_answers (
  couple_id uuid references couples(id) on delete cascade not null,
  answer_date date not null,
  user_id uuid references profiles(id) not null,
  answer text not null,
  created_at timestamptz default now(),
  primary key (couple_id, answer_date, user_id)
);

alter table daily_answers enable row level security;

create policy "couple can read daily answers" on daily_answers for select using (
  couple_id in (select couple_id from profiles where id = auth.uid()));
create policy "user can insert own daily answer" on daily_answers for insert with check (
  user_id = auth.uid() and couple_id in (select couple_id from profiles where id = auth.uid()));

alter table couples add column if not exists streak_count int default 0;
alter table couples add column if not exists streak_last_date date;

-- Records an answer, and — once both partners have answered for the day —
-- bumps the streak if it's a consecutive day, or resets it if a day was missed.
create or replace function record_daily_answer(p_couple_id uuid, p_date date, p_answer text)
returns void
language plpgsql
as $$
declare
  answer_count int;
  c couples%rowtype;
begin
  insert into daily_answers (couple_id, answer_date, user_id, answer)
  values (p_couple_id, p_date, auth.uid(), p_answer);

  select count(*) into answer_count from daily_answers
    where couple_id = p_couple_id and answer_date = p_date;

  if answer_count = 2 then
    select * into c from couples where id = p_couple_id;
    if c.streak_last_date = p_date - 1 then
      update couples set streak_count = coalesce(streak_count, 0) + 1, streak_last_date = p_date
        where id = p_couple_id;
    elsif c.streak_last_date is distinct from p_date then
      update couples set streak_count = 1, streak_last_date = p_date
        where id = p_couple_id;
    end if;
  end if;
end;
$$;

alter publication supabase_realtime add table daily_answers;
