-- 0007_data_tables.sql — Phase 8: structured data-table artifacts (CSV/XLSX export)
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Extends the artifacts type check to include 'data_table'.
-- Tables store their columns/rows/source-id mapping in the existing payload jsonb.

alter table public.artifacts drop constraint if exists artifacts_type_check;
alter table public.artifacts
  add constraint artifacts_type_check check (type in ('saved_note', 'flashcard_set', 'quiz', 'mind_map', 'report', 'data_table'));