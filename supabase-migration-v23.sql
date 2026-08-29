-- Blessuth v23 migration — run this once in Supabase SQL Editor.
--
-- Adds notifications for the 10 games: most fire "your partner did
-- something, your turn" on a new round/answer/guess, same pattern as
-- messages/notes/quizzes. Tic-Tac-Toe and Connect Four are different —
-- the recipient is whoever `turn` currently points to, not "whoever didn't
-- cause the event" (a fresh game can hand the very first turn to either
-- player), so those two are handled specially in api/notify.js.

-- ---------- 0. Fix notify_webhook() to report the real operation type ----------
-- Previously hardcoded 'type' to the literal string 'INSERT' even for
-- update-triggered calls. Nothing read that field before, so this was
-- harmless — but the Tic-Tac-Toe/Connect Four logic below needs to tell
-- INSERT and UPDATE apart (to avoid notifying a game's creator about their
-- own coin-flip result), so this makes it accurate.

create or replace function notify_webhook() returns trigger as $$
begin
  perform net.http_post(
    url := 'https://blessuth.vercel.app/api/notify',
    headers := '{"Content-Type": "application/json", "x-webhook-secret": "W0yZoiBBbDxdVXp6c19WEnwcmPpgmCBZ"}'::jsonb,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', 'public',
      'record', row_to_json(NEW)
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

-- ---------- 1. Simple "your turn" games (fire once per new activity) ----------

drop trigger if exists notify_on_word_guess on word_guesses;
create trigger notify_on_word_guess
after insert on word_guesses
for each row execute function notify_webhook();

drop trigger if exists notify_on_this_or_that on this_or_that_answers;
create trigger notify_on_this_or_that
after insert on this_or_that_answers
for each row execute function notify_webhook();

drop trigger if exists notify_on_nhie on nhie_answers;
create trigger notify_on_nhie
after insert on nhie_answers
for each row execute function notify_webhook();

drop trigger if exists notify_on_pictionary_round on pictionary_rounds;
create trigger notify_on_pictionary_round
after insert on pictionary_rounds
for each row execute function notify_webhook();

drop trigger if exists notify_on_twenty_q_round on twenty_q_rounds;
create trigger notify_on_twenty_q_round
after insert on twenty_q_rounds
for each row execute function notify_webhook();

drop trigger if exists notify_on_twenty_q_question on twenty_q_questions;
create trigger notify_on_twenty_q_question
after insert on twenty_q_questions
for each row execute function notify_webhook();

drop trigger if exists notify_on_emoji_charades on emoji_charades_rounds;
create trigger notify_on_emoji_charades
after insert on emoji_charades_rounds
for each row execute function notify_webhook();

drop trigger if exists notify_on_story_line on story_chain_lines;
create trigger notify_on_story_line
after insert on story_chain_lines
for each row execute function notify_webhook();

-- Truth or Dare is one shared row per couple (upsert) — the first ever pick
-- is an INSERT, every pick after that is an UPDATE, so both need to fire.
drop trigger if exists notify_on_truth_or_dare on truth_or_dare_state;
create trigger notify_on_truth_or_dare
after insert or update on truth_or_dare_state
for each row execute function notify_webhook();

-- ---------- 2. Turn-based board games ----------
-- Fires on every insert/update while the game is still ongoing — api/notify.js
-- reads `turn` directly as the recipient and separately guards against
-- notifying the creator about their own coin-flip result.

drop trigger if exists notify_on_tictactoe on tictactoe_games;
create trigger notify_on_tictactoe
after insert or update on tictactoe_games
for each row when (NEW.winner is null) execute function notify_webhook();

drop trigger if exists notify_on_connect4 on connect4_games;
create trigger notify_on_connect4
after insert or update on connect4_games
for each row when (NEW.winner is null) execute function notify_webhook();
