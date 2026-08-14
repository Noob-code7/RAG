-- 0002_notebooks.sql — Phase 1: notebooks + notebook-scoped documents
-- Apply via `supabase db push` or the Supabase SQL editor.
-- Extends the 0001 schema: adds a notebooks table and scopes every document
-- row to exactly one notebook (foreign key, cascade delete). Also adds
-- source_type ('pdf' | 'text') so pasted-text sources share the same
-- documents table, and an optional content column to hold pasted text.

create table if not exists public.notebooks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A fixed, well-known "Default" notebook keeps the legacy /documents endpoints
-- working while the rest of the app moves to notebooks. Deleting it is blocked
-- at the API layer.
insert into public.notebooks (id, name)
values ('00000000-0000-0000-0000-000000000000', 'Default')
on conflict (id) do nothing;

-- Scope every document to a notebook.
alter table public.documents add column if not exists notebook_id uuid;
alter table public.documents alter column notebook_id set default '00000000-0000-0000-0000-000000000000';
update public.documents set notebook_id = '00000000-0000-0000-0000-000000000000' where notebook_id is null;
alter table public.documents alter column notebook_id set not null;
alter table public.documents drop constraint if exists documents_notebook_id_fkey;
alter table public.documents
  add constraint documents_notebook_id_fkey
  foreign key (notebook_id) references public.notebooks(id) on delete cascade;
create index if not exists documents_notebook_id_idx on public.documents(notebook_id);

-- Source type: pdf (uploaded file) or text (pasted source).
alter table public.documents add column if not exists source_type text;
update public.documents set source_type = 'pdf' where source_type is null;
alter table public.documents alter column source_type set default 'pdf';
alter table public.documents alter column source_type set not null;
alter table public.documents drop constraint if exists documents_source_type_check;
alter table public.documents
  add constraint documents_source_type_check check (source_type in ('pdf', 'text'));

-- Raw pasted text for text sources (nullable; PDFs store to object storage).
alter table public.documents add column if not exists content text;

-- Keep notebooks.updated_at fresh on rename.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at
  before update on public.notebooks
  for each row execute function public.set_updated_at();
