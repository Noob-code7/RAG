-- 0005_mind_maps.sql — Phase 5: hierarchical mind-map artifacts
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Extends the artifacts type check to include 'mind_map'.
-- The node tree is stored in the existing payload jsonb column.

alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts
  add constraint artifacts_type_check check (type in ('saved_note', 'flashcard_set', 'quiz', 'mind_map'));