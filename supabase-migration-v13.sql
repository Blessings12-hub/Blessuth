-- Blessuth v13 migration — run this once in Supabase SQL Editor.
-- Run after v1-v12.
--
-- The Quiz page's mechanic changed: each quiz now has two rounds — your own
-- honest answers, and your guesses at your partner's answers — so results
-- can show how well you actually know each other, not just how similar you
-- are. This needs one new column to hold the guesses alongside the existing
-- answers.

alter table quiz_answers add column if not exists guesses jsonb not null default '[]';

-- Quiz keys also changed shape, from a flat topic key ("gettingToKnow") to
-- "topic.subtopic" ("gettingToKnow.personality"), since quizzes are now
-- organized in subtopics. Old rows under the old flat keys are simply no
-- longer matched by anything in the app — harmless leftover rows, not worth
-- a migration to rename. Nothing to do here; each subtopic just starts
-- fresh.
