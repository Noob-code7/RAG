-- 0004_flashcards_and_quizzes.sql — Phase 4: study artifacts
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Extends the artifacts table: new types ('flashcard_set', 'quiz') and a
-- structured `payload` jsonb column for the generated item arrays.
-- (saved_note continues to use content + citations only.)

alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts
  add constraint artifacts_type_check check (type in ('saved_note', 'flashcard_set', 'quiz'));

alter table public.artifacts add column if not exists payload jsonb;