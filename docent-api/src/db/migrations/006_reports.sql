-- 0006_reports.sql — Phase 6: long-form report / study-guide artifacts
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Extends the artifacts type check to include 'report'.
-- Reports store their Markdown body in the existing content column and the
-- [Source N] -> chunk citation map in the existing citations jsonb column.

alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts
  add constraint artifacts_type_check check (type in ('saved_note', 'flashcard_set', 'quiz', 'mind_map', 'report'));