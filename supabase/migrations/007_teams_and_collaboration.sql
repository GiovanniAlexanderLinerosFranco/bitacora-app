-- Layer 2: closed teams. Personal notes stay on bitacora_ledger_entries with user_id = auth.uid().
-- Sharing a subject copies its already-indexed chunks into bitacora_team_embeddings.
-- The team tutor reads that copy. It does not join the personal ledger or the personal embedding table.
-- Policies on bitacora_profiles, bitacora_subjects_or_projects, bitacora_ledger_entries
-- and bitacora_document_embeddings are left unchanged.

-- Membership checks run as the function owner so a policy on bitacora_team_members
-- can read that same table without recursive row level security.
create or replace function public.bitacora_is_team_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.bitacora_team_members m
      where m.team_id = p_team
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.bitacora_team_role(p_team uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.bitacora_team_members m
  where m.team_id = p_team
    and m.user_id = auth.uid()
  limit 1;
$$;

-- bitacora_teams --------------------------------------------------------
create table public.bitacora_teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  slug       text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (slug)
);
create index bitacora_teams_owner_idx on public.bitacora_teams (owner_id);

create or replace function public.bitacora_teams_lock_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
create trigger bitacora_teams_lock_owner
  before update of owner_id on public.bitacora_teams
  for each row execute function public.bitacora_teams_lock_owner();

-- bitacora_team_members -------------------------------------------------
create table public.bitacora_team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.bitacora_teams (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index bitacora_team_members_user_idx on public.bitacora_team_members (user_id);

create or replace function public.bitacora_team_members_lock_identity()
returns trigger
language plpgsql
as $$
begin
  if new.team_id is distinct from old.team_id or new.user_id is distinct from old.user_id then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
create trigger bitacora_team_members_lock_identity
  before update of team_id, user_id on public.bitacora_team_members
  for each row execute function public.bitacora_team_members_lock_identity();

-- bitacora_shared_subjects ----------------------------------------------
-- The link says which subject was published. It does not grant select on the personal rows.
create table public.bitacora_shared_subjects (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.bitacora_teams (id) on delete cascade,
  subject_id uuid not null references public.bitacora_subjects_or_projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, subject_id)
);
create index bitacora_shared_subjects_subject_idx on public.bitacora_shared_subjects (subject_id);

-- Team corpus. Titles and dates are copied so search never joins the personal ledger.
create table public.bitacora_team_embeddings (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.bitacora_teams (id) on delete cascade,
  subject_id      uuid not null,
  source_entry_id uuid not null references public.bitacora_ledger_entries (id) on delete cascade,
  chunk_index     integer not null check (chunk_index >= 0),
  content         text not null,
  page_number     integer,
  entry_title     text not null,
  entry_date      date,
  embedding       extensions.vector(1536) not null,
  copied_at       timestamptz not null default now(),
  unique (team_id, source_entry_id, chunk_index),
  foreign key (team_id, subject_id)
    references public.bitacora_shared_subjects (team_id, subject_id) on delete cascade
);
create index bitacora_team_embeddings_subject_idx on public.bitacora_team_embeddings (team_id, subject_id);
create index bitacora_team_embeddings_hnsw_idx on public.bitacora_team_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- Rewrites the team copy of one personal entry. p_team null refreshes every team that has the subject.
-- The entry filter is the owner id passed by the indexing pipeline or by the sharing function.
create or replace function public.bitacora_refresh_team_copies(
  p_user_id uuid,
  p_entry_id uuid,
  p_team uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer := 0;
begin
  if p_user_id is null or p_entry_id is null then
    return 0;
  end if;
  if not exists (
    select 1 from public.bitacora_ledger_entries e
    where e.id = p_entry_id and e.user_id = p_user_id
  ) then
    return 0;
  end if;

  delete from public.bitacora_team_embeddings te
  where te.source_entry_id = p_entry_id
    and (p_team is null or te.team_id = p_team);

  insert into public.bitacora_team_embeddings (
    team_id, subject_id, source_entry_id, chunk_index, content, page_number, entry_title, entry_date, embedding
  )
  select sh.team_id, e.subject_id, e.id, d.chunk_index, d.content, d.page_number, e.title, e.entry_date, d.embedding
  from public.bitacora_ledger_entries e
  join public.bitacora_document_embeddings d
    on d.entry_id = e.id and d.user_id = e.user_id
  join public.bitacora_subjects_or_projects s
    on s.id = e.subject_id and s.user_id = e.user_id
  join public.bitacora_shared_subjects sh
    on sh.subject_id = e.subject_id
  where e.id = p_entry_id
    and e.user_id = p_user_id
    and e.subject_id is not null
    and d.subject_id = e.subject_id
    and (p_team is null or sh.team_id = p_team);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Keep the personal chunk subject in sync, then rebuild only that entry's team copies.
create or replace function public.bitacora_sync_chunk_subject()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.bitacora_document_embeddings
  set subject_id = new.subject_id
  where entry_id = new.id
    and user_id = new.user_id;
  perform public.bitacora_refresh_team_copies(new.user_id, new.id);
  return new;
end $$;

-- After a personal re-index, refresh team copies of that same entry. Still scoped by p_user_id.
create or replace function public.bitacora_replace_entry_embeddings(
  p_entry_id uuid,
  p_user_id uuid,
  p_expected_updated_at timestamptz,
  p_extracted_text text,
  p_chunks jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
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

  delete from public.bitacora_document_embeddings where entry_id = p_entry_id and user_id = p_user_id;

  insert into public.bitacora_document_embeddings (user_id, entry_id, subject_id, chunk_index, content, token_count, embedding)
  select p_user_id, p_entry_id, v_subject,
         (c ->> 'chunk_index')::int, c ->> 'content', (c ->> 'token_count')::int,
         (c ->> 'embedding')::extensions.vector(1536)
  from jsonb_array_elements(p_chunks) as c;

  update public.bitacora_ledger_entries
  set embedding_status = 'ready', extracted_text = p_extracted_text
  where id = p_entry_id and user_id = p_user_id;

  perform public.bitacora_refresh_team_copies(p_user_id, p_entry_id);
  return true;
end $$;

create or replace function public.bitacora_create_team(p_name text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_name);
  v_team public.bitacora_teams;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'validation';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slug) < 2 or char_length(p_slug) > 60 then
    raise exception 'validation';
  end if;

  begin
    insert into public.bitacora_teams (name, slug, owner_id)
    values (v_name, p_slug, auth.uid())
    returning * into v_team;
  exception when unique_violation then
    raise exception 'slug_taken';
  end;

  insert into public.bitacora_team_members (team_id, user_id, role)
  values (v_team.id, auth.uid(), 'owner');

  return jsonb_build_object(
    'id', v_team.id,
    'name', v_team.name,
    'slug', v_team.slug,
    'owner_id', v_team.owner_id,
    'created_at', v_team.created_at
  );
end $$;

create or replace function public.bitacora_invite_team_member(p_team uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text;
  v_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;
  v_caller := public.bitacora_team_role(p_team);
  if p_role = 'admin' then
    v_role := 'admin';
  elsif p_role is null or p_role = 'member' then
    v_role := 'member';
  else
    raise exception 'forbidden';
  end if;
  if v_caller = 'owner' then
    null;
  elsif v_caller = 'admin' and v_role = 'member' then
    null;
  else
    raise exception 'forbidden';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 320 then
    raise exception 'validation';
  end if;

  select p.id into v_user
  from public.bitacora_profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = v_email;
  if v_user is null then
    raise exception 'invitee_not_found';
  end if;
  if exists (
    select 1 from public.bitacora_team_members m
    where m.team_id = p_team and m.user_id = v_user
  ) then
    raise exception 'already_member';
  end if;

  insert into public.bitacora_team_members (team_id, user_id, role)
  values (p_team, v_user, v_role)
  returning id into v_member;

  return jsonb_build_object('member_id', v_member, 'role', v_role);
end $$;

create or replace function public.bitacora_share_subject_with_team(p_team uuid, p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_share uuid;
  v_entry uuid;
  v_copied integer := 0;
  v_added integer;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;
  v_role := public.bitacora_team_role(p_team);
  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from public.bitacora_subjects_or_projects s
    where s.id = p_subject and s.user_id = auth.uid()
  ) then
    raise exception 'subject_not_owned';
  end if;

  insert into public.bitacora_shared_subjects (team_id, subject_id)
  values (p_team, p_subject)
  on conflict (team_id, subject_id) do nothing;

  select sh.id into v_share
  from public.bitacora_shared_subjects sh
  where sh.team_id = p_team and sh.subject_id = p_subject;

  for v_entry in
    select e.id
    from public.bitacora_ledger_entries e
    where e.user_id = auth.uid() and e.subject_id = p_subject
  loop
    v_added := public.bitacora_refresh_team_copies(auth.uid(), v_entry, p_team);
    v_copied := v_copied + coalesce(v_added, 0);
  end loop;

  return jsonb_build_object('id', v_share, 'team_id', p_team, 'subject_id', p_subject, 'copied_chunks', v_copied);
end $$;

-- Team search. SECURITY INVOKER so the select policy applies, plus an explicit membership check.
-- No join to bitacora_ledger_entries or bitacora_document_embeddings.
create or replace function public.bitacora_match_team_embeddings(
  query_embedding extensions.vector(1536),
  filter_team uuid,
  match_threshold float default 0.5,
  match_count int default 8,
  filter_subject uuid default null
)
returns table (
  id uuid, entry_id uuid, subject_id uuid, chunk_index int, content text,
  page_number int, metadata jsonb, entry_title text, entry_date date, similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select d.id, d.source_entry_id, d.subject_id, d.chunk_index, d.content, d.page_number,
         '{}'::jsonb, d.entry_title, d.entry_date,
         (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.bitacora_team_embeddings d
  where filter_team is not null
    and d.team_id = filter_team
    and public.bitacora_is_team_member(filter_team)
    and exists (
      select 1 from public.bitacora_shared_subjects sh
      where sh.team_id = d.team_id and sh.subject_id = d.subject_id
    )
    and (filter_subject is null or d.subject_id = filter_subject)
    and 1 - (d.embedding <=> query_embedding) >= match_threshold
  order by d.embedding <=> query_embedding
  limit least(match_count, 50);
$$;

-- Row level security ----------------------------------------------------
alter table public.bitacora_teams enable row level security;
alter table public.bitacora_team_members enable row level security;
alter table public.bitacora_shared_subjects enable row level security;
alter table public.bitacora_team_embeddings enable row level security;

create policy "bitacora_teams_select_member" on public.bitacora_teams
  for select to authenticated
  using (public.bitacora_is_team_member(id));
create policy "bitacora_teams_insert_owner" on public.bitacora_teams
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "bitacora_teams_update_manager" on public.bitacora_teams
  for update to authenticated
  using (public.bitacora_team_role(id) in ('owner', 'admin'))
  with check (public.bitacora_team_role(id) in ('owner', 'admin'));
create policy "bitacora_teams_delete_owner" on public.bitacora_teams
  for delete to authenticated
  using (public.bitacora_team_role(id) = 'owner');

-- Direct inserts only bootstrap the creator as owner. Invitations go through bitacora_invite_team_member.
create policy "bitacora_team_members_select_member" on public.bitacora_team_members
  for select to authenticated
  using (public.bitacora_is_team_member(team_id));
create policy "bitacora_team_members_insert_owner" on public.bitacora_team_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (
      select 1 from public.bitacora_teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  );
create policy "bitacora_team_members_update_manager" on public.bitacora_team_members
  for update to authenticated
  using (public.bitacora_team_role(team_id) in ('owner', 'admin'))
  with check (
    (
      public.bitacora_team_role(team_id) = 'owner'
      and (
        role <> 'owner'
        or user_id = (select t.owner_id from public.bitacora_teams t where t.id = team_id)
      )
    )
    or (
      public.bitacora_team_role(team_id) = 'admin'
      and role = 'member'
    )
  );
create policy "bitacora_team_members_delete_manager" on public.bitacora_team_members
  for delete to authenticated
  using (
    user_id <> (select t.owner_id from public.bitacora_teams t where t.id = team_id)
    and (
      user_id = (select auth.uid())
      or public.bitacora_team_role(team_id) = 'owner'
      or (public.bitacora_team_role(team_id) = 'admin' and role = 'member')
    )
  );

create policy "bitacora_shared_subjects_select_member" on public.bitacora_shared_subjects
  for select to authenticated
  using (public.bitacora_is_team_member(team_id));
create policy "bitacora_shared_subjects_delete_publisher" on public.bitacora_shared_subjects
  for delete to authenticated
  using (
    public.bitacora_team_role(team_id) in ('owner', 'admin')
    or exists (
      select 1 from public.bitacora_subjects_or_projects s
      where s.id = subject_id and s.user_id = (select auth.uid())
    )
  );

create policy "bitacora_team_embeddings_select_member" on public.bitacora_team_embeddings
  for select to authenticated
  using (
    public.bitacora_is_team_member(team_id)
    and exists (
      select 1 from public.bitacora_shared_subjects sh
      where sh.team_id = bitacora_team_embeddings.team_id
        and sh.subject_id = bitacora_team_embeddings.subject_id
    )
  );

revoke all on table public.bitacora_teams from anon;
revoke all on table public.bitacora_team_members from anon;
revoke all on table public.bitacora_shared_subjects from anon;
revoke all on table public.bitacora_team_embeddings from anon, authenticated;
grant select, insert, update, delete on table public.bitacora_teams to authenticated;
grant select, insert, update, delete on table public.bitacora_team_members to authenticated;
grant select, delete on table public.bitacora_shared_subjects to authenticated;
grant select on table public.bitacora_team_embeddings to authenticated;

revoke all on function public.bitacora_is_team_member(uuid) from public, anon;
revoke all on function public.bitacora_team_role(uuid) from public, anon;
grant execute on function public.bitacora_is_team_member(uuid) to authenticated;
grant execute on function public.bitacora_team_role(uuid) to authenticated;

revoke all on function public.bitacora_refresh_team_copies(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.bitacora_create_team(text, text) from public, anon;
revoke all on function public.bitacora_invite_team_member(uuid, text, text) from public, anon;
revoke all on function public.bitacora_share_subject_with_team(uuid, uuid) from public, anon;
do $$
declare
  fn regprocedure;
begin
  select p.oid::regprocedure into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bitacora_match_team_embeddings';
  execute format('revoke all on function %s from public, anon', fn);
  execute format('grant execute on function %s to authenticated', fn);
end $$;
grant execute on function public.bitacora_create_team(text, text) to authenticated;
grant execute on function public.bitacora_invite_team_member(uuid, text, text) to authenticated;
grant execute on function public.bitacora_share_subject_with_team(uuid, uuid) to authenticated;

revoke all on function public.bitacora_replace_entry_embeddings(uuid, uuid, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.bitacora_replace_entry_embeddings(uuid, uuid, timestamptz, text, jsonb) to service_role;
