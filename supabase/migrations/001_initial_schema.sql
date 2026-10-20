-- Evolving Smart Knowledge & Learning Ledger: initial schema
-- Every object is prefixed with bitacora_ because this database is shared with other apps.
-- Embedding dimension: 1536 (OpenAI text-embedding-3-small).
-- Changing models/dimension requires a new migration and re-embedding.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Enums -----------------------------------------------------------------
create type public.bitacora_user_role as enum ('student', 'professional');
create type public.bitacora_workspace_kind as enum ('subject', 'project');
create type public.bitacora_entry_type as enum ('class_note', 'meeting', 'document', 'task', 'reflection');
create type public.bitacora_task_status as enum ('todo', 'in_progress', 'done');
create type public.bitacora_embedding_status as enum ('pending', 'processing', 'ready', 'failed');

-- Helpers ---------------------------------------------------------------
create or replace function public.bitacora_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- bitacora_profiles -----------------------------------------------------
create table public.bitacora_profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  role               public.bitacora_user_role not null default 'student',
  academic_level     text,   -- e.g. 'undergraduate', 'phd' (students)
  career_or_field    text,   -- e.g. 'Biology', 'Product Management'
  preferred_language text not null default 'en' check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  timezone           text not null default 'UTC',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger bitacora_profiles_updated_at before update on public.bitacora_profiles
  for each row execute function public.bitacora_set_updated_at();

-- Auto-create a profile on signup (values come from signUp options.data).
-- This trigger fires for every user of the shared auth.users table, so it must never block another
-- app's signup: any failure is downgraded to a warning.
create or replace function public.bitacora_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  meta_lang text := new.raw_user_meta_data ->> 'preferred_language';
begin
  insert into public.bitacora_profiles (id, display_name, role, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when meta_role in ('student', 'professional') then meta_role::public.bitacora_user_role else 'student' end,
    case when meta_lang ~ '^[a-z]{2}(-[A-Z]{2})?$' then meta_lang else 'en' end
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'bitacora_handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end $$;
create trigger bitacora_on_auth_user_created after insert on auth.users
  for each row execute function public.bitacora_handle_new_user();

-- bitacora_subjects_or_projects -----------------------------------------
create table public.bitacora_subjects_or_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.bitacora_profiles (id) on delete cascade,
  kind        public.bitacora_workspace_kind not null default 'subject',
  name        text not null check (char_length(name) between 1 and 200),
  description text,
  color       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index bitacora_subjects_user_idx on public.bitacora_subjects_or_projects (user_id);
create trigger bitacora_subjects_updated_at before update on public.bitacora_subjects_or_projects
  for each row execute function public.bitacora_set_updated_at();

-- bitacora_ledger_entries -----------------------------------------------
create table public.bitacora_ledger_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.bitacora_profiles (id) on delete cascade,
  subject_id       uuid references public.bitacora_subjects_or_projects (id) on delete set null,
  entry_type       public.bitacora_entry_type not null default 'class_note',
  title            text not null check (char_length(title) between 1 and 300),
  raw_text         text not null default '',
  language         text,                               -- detected content language
  entry_date       date not null default current_date,
  task_status      public.bitacora_task_status,        -- only for entry_type = 'task'
  due_date         date,
  source_file_path text,                               -- Supabase Storage path for uploads
  source_mime_type text,
  tags             text[] not null default '{}',
  metadata         jsonb not null default '{}'::jsonb,
  embedding_status public.bitacora_embedding_status not null default 'pending',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index bitacora_ledger_user_date_idx on public.bitacora_ledger_entries (user_id, entry_date desc);
create index bitacora_ledger_subject_idx on public.bitacora_ledger_entries (subject_id);
create index bitacora_ledger_tags_idx on public.bitacora_ledger_entries using gin (tags);
create trigger bitacora_ledger_updated_at before update on public.bitacora_ledger_entries
  for each row execute function public.bitacora_set_updated_at();

-- A subject referenced by an entry must belong to the same user.
create or replace function public.bitacora_check_entry_subject_owner()
returns trigger language plpgsql as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from public.bitacora_subjects_or_projects s
    where s.id = new.subject_id and s.user_id = new.user_id
  ) then
    raise exception 'subject_id does not belong to user';
  end if;
  return new;
end $$;
create trigger bitacora_ledger_subject_owner before insert or update of subject_id, user_id on public.bitacora_ledger_entries
  for each row execute function public.bitacora_check_entry_subject_owner();

-- bitacora_document_embeddings ------------------------------------------
create table public.bitacora_document_embeddings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.bitacora_profiles (id) on delete cascade,
  entry_id    uuid not null references public.bitacora_ledger_entries (id) on delete cascade,
  subject_id  uuid references public.bitacora_subjects_or_projects (id) on delete set null,
  chunk_index integer not null check (chunk_index >= 0),
  content     text not null,
  token_count integer,
  page_number integer,                                 -- for PDFs
  metadata    jsonb not null default '{}'::jsonb,
  embedding   extensions.vector(1536) not null,
  created_at  timestamptz not null default now(),
  unique (entry_id, chunk_index)
);
create index bitacora_embeddings_user_idx on public.bitacora_document_embeddings (user_id);
create index bitacora_embeddings_subject_idx on public.bitacora_document_embeddings (subject_id);
create index bitacora_embeddings_hnsw_idx on public.bitacora_document_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- Semantic search. SECURITY INVOKER => RLS applies, so users only match their own chunks;
-- the explicit auth.uid() filter keeps intent obvious and defends against policy drift.
create or replace function public.bitacora_match_document_embeddings(
  query_embedding  extensions.vector(1536),
  match_threshold  float default 0.5,
  match_count      int default 8,
  filter_subject   uuid default null
)
returns table (
  id uuid, entry_id uuid, subject_id uuid, chunk_index int, content text,
  page_number int, metadata jsonb, entry_title text, entry_date date, similarity float
)
language sql stable security invoker set search_path = public, extensions as $$
  select d.id, d.entry_id, d.subject_id, d.chunk_index, d.content, d.page_number, d.metadata,
         e.title, e.entry_date,
         (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.bitacora_document_embeddings d
  join public.bitacora_ledger_entries e on e.id = d.entry_id
  where d.user_id = auth.uid()
    and (filter_subject is null or d.subject_id = filter_subject)
    and 1 - (d.embedding <=> query_embedding) >= match_threshold
  order by d.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

-- Row Level Security ----------------------------------------------------
alter table public.bitacora_profiles             enable row level security;
alter table public.bitacora_subjects_or_projects enable row level security;
alter table public.bitacora_ledger_entries       enable row level security;
alter table public.bitacora_document_embeddings  enable row level security;

create policy "bitacora_profiles_select_own" on public.bitacora_profiles
  for select using (id = (select auth.uid()));
create policy "bitacora_profiles_update_own" on public.bitacora_profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Inserts happen via the signup trigger (security definer); deletes cascade from auth.users.

create policy "bitacora_subjects_all_own" on public.bitacora_subjects_or_projects
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "bitacora_ledger_all_own" on public.bitacora_ledger_entries
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Users may read/delete their chunks; writes go through the service role (embedding pipeline)
-- so clients cannot forge chunks that the assistant would later cite as sources.
create policy "bitacora_embeddings_select_own" on public.bitacora_document_embeddings
  for select using (user_id = (select auth.uid()));
create policy "bitacora_embeddings_delete_own" on public.bitacora_document_embeddings
  for delete using (user_id = (select auth.uid()));
