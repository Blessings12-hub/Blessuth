-- Blessuth v25 migration — run this once in Supabase SQL Editor.
--
-- Adds a column to track whether a saved verse's text came from a real
-- Bible database (NIV, via API.Bible) or was the AI's own best-effort
-- transcription — so the app can show which one you're looking at.

alter table bible_verses add column if not exists verse_source text;
