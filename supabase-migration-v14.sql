-- Blessuth v14 migration — run this once in Supabase SQL Editor.
-- Run after v1-v13.
--
-- Push notification for quiz completion. When a partner finishes a quiz
-- (submits both their own answers and their guesses at once, via the
-- upsert in Quizzes.jsx), the other partner gets a push telling them to
-- come take/compare it. This reuses the notify_webhook() function already
-- defined in supabase-notify-triggers.sql — run that file first if you
-- haven't already.
--
-- Note: a retake overwrites the existing row (same couple_id/quiz_key/
-- user_id primary key), which is an UPDATE, not an INSERT — so retakes
-- don't re-notify. That's intentional: this only fires the first time a
-- given quiz is completed.

drop trigger if exists notify_on_quiz_answer on quiz_answers;
create trigger notify_on_quiz_answer
after insert on quiz_answers
for each row execute function notify_webhook();
