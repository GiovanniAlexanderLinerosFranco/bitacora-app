-- Personal-layer product funnel. Rows store an event name, a timestamp and short codes.
-- They must not store note text, questions, quotes or file names. Row level security
-- keeps each owner on their own rows. The indexing pipeline inserts with the service role
-- and always sets user_id to the verified owner.

alter table public.bitacora_profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Accounts that already have a private note should not be sent through first-run setup.
update public.bitacora_profiles p
set onboarding_completed_at = now()
where onboarding_completed_at is null
  and exists (
    select 1 from public.bitacora_ledger_entries e where e.user_id = p.id
  );

create table public.bitacora_product_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.bitacora_profiles (id) on delete cascade,
  event_name text not null check (event_name in (
    'sign_up', 'first_note_created', 'first_embedding_ready', 'first_query_asked', 'citation_miss'
  )),
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bitacora_product_events_metadata_size check (octet_length(metadata::text) <= 500),
  constraint bitacora_product_events_metadata_private check (
    not (metadata ?| array[
      'raw_text', 'rawText', 'question', 'content', 'quote', 'title',
      'extracted_text', 'extractedText', 'answer', 'prompt', 'attachment', 'filename'
    ])
  )
);

-- First-time marks happen once per owner. A missing citation can happen on later questions.
create unique index bitacora_product_events_once_idx
  on public.bitacora_product_events (user_id, event_name)
  where event_name <> 'citation_miss';

create index bitacora_product_events_user_idx
  on public.bitacora_product_events (user_id, created_at desc);

alter table public.bitacora_product_events enable row level security;

create policy "bitacora_product_events_select_own"
  on public.bitacora_product_events
  for select using (user_id = (select auth.uid()));

create policy "bitacora_product_events_insert_own"
  on public.bitacora_product_events
  for insert with check (user_id = (select auth.uid()));
