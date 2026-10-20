-- Phase 3: attachments storage, extracted text, atomic indexing (all objects bitacora_-prefixed)

-- 1. bitacora_ledger_entries additions ------------------------------------
alter table public.bitacora_ledger_entries add column extracted_text text;

-- A file path must live under the owner's folder. Blocks pointing at another user's file,
-- which matters because the indexing pipeline reads files with the service role.
alter table public.bitacora_ledger_entries add constraint bitacora_ledger_source_path_owner
  check (source_file_path is null or split_part(source_file_path, '/', 1) = user_id::text);

create index bitacora_ledger_embedding_status_idx on public.bitacora_ledger_entries (embedding_status)
  where embedding_status in ('pending', 'failed');

-- 2. Keep denormalised chunk.subject_id in sync when an entry moves subject --
create or replace function public.bitacora_sync_chunk_subject()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.bitacora_document_embeddings set subject_id = new.subject_id where entry_id = new.id;
  return new;
end $$;
create trigger bitacora_ledger_sync_chunk_subject after update of subject_id on public.bitacora_ledger_entries
  for each row when (old.subject_id is distinct from new.subject_id)
  execute function public.bitacora_sync_chunk_subject();

-- 3. Storage bucket ---------------------------------------------------------
-- Private bucket; keep limits/mime types in sync with src/lib/attachments.ts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bitacora-ledger-attachments', 'bitacora-ledger-attachments', false, 10485760,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac',
    'text/plain', 'text/markdown', 'text/csv'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object path convention: <user_id>/<entry_id>/<uuid>-<filename>
-- Policy names on storage.objects are global, hence the prefix.
create policy "bitacora_attachments_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'bitacora-ledger-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bitacora_attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bitacora-ledger-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bitacora_attachments_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'bitacora-ledger-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'bitacora-ledger-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bitacora_attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bitacora-ledger-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 4. Atomic re-index ----------------------------------------------------------
-- Replaces all chunks and marks the entry 'ready' in one transaction, but only if the entry has not
-- changed since indexing started (optimistic check on updated_at). Returns false when stale.
-- p_chunks: [{ "chunk_index": int, "content": text, "token_count": int, "embedding": "[...]" }]
create or replace function public.bitacora_replace_entry_embeddings(
  p_entry_id uuid,
  p_user_id uuid,
  p_expected_updated_at timestamptz,
  p_extracted_text text,
  p_chunks jsonb
)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_subject uuid;
begin
  select subject_id into v_subject
  from public.bitacora_ledger_entries
  where id = p_entry_id and user_id = p_user_id and updated_at = p_expected_updated_at
  for update;
  if not found then
    return false;
  end if;

  delete from public.bitacora_document_embeddings where entry_id = p_entry_id;

  insert into public.bitacora_document_embeddings (user_id, entry_id, subject_id, chunk_index, content, token_count, embedding)
  select p_user_id, p_entry_id, v_subject,
         (c ->> 'chunk_index')::int, c ->> 'content', (c ->> 'token_count')::int,
         (c ->> 'embedding')::extensions.vector(1536)
  from jsonb_array_elements(p_chunks) as c;

  update public.bitacora_ledger_entries
  set embedding_status = 'ready', extracted_text = p_extracted_text
  where id = p_entry_id;
  return true;
end $$;

-- Only the service role (indexing pipeline) may call it.
revoke all on function public.bitacora_replace_entry_embeddings(uuid, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.bitacora_replace_entry_embeddings(uuid, uuid, timestamptz, text, jsonb) to service_role;
