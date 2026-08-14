-- 0001_init.sql — Docent Phase 1 schema
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Written as explicit, inspectable SQL (no ORM auto-migrations).

-- pgvector: vector column type + HNSW index used by Phase 2 retrieval.
create extension if not exists vector;
-- gen_random_uuid() availability on older Postgres versions.
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  filename     text not null,
  uploaded_at  timestamptz not null default now(),
  status       text not null default 'processing'
               check (status in ('processing', 'ready', 'failed')),
  page_count   integer,
  -- 0..1 progress so the frontend can show a live progress bar while polling.
  progress     real not null default 0,
  error        text,
  storage_path text
);

create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content     text not null,
  page_number integer not null,
  chunk_index integer not null,
  -- 1536-dim vectors from OpenAI text-embedding-3-small.
  embedding   vector(1536),
  token_count integer not null,
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists chunks_document_id_idx on public.chunks(document_id);
-- HNSW cosine index for fast approximate vector search in Phase 2.
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);