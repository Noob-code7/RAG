-- 0003_chat_and_artifacts.sql — Phase 2: notebook chat history + saved notes
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Adds a per-notebook chat transcript (user questions + grounded answers with
-- citations) and an artifacts table where a saved assistant answer becomes a
-- retrievable note scoped to the same notebook.

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  -- Parsed citations the answer actually cited (array of JSON objects).
  -- NULL for user turns; the assistant turn carries the citations payload.
  citations   jsonb,
  confidence  text check (confidence in ('grounded', 'partial', 'not_found')),
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_notebook_idx
  on public.chat_messages(notebook_id, created_at);

create table if not exists public.artifacts (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  type        text not null check (type in ('saved_note')),
  title       text not null,
  content     text not null,
  citations   jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists artifacts_notebook_idx
  on public.artifacts(notebook_id, created_at);