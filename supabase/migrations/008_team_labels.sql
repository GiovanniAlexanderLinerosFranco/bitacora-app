-- Labels for the team screen. The subject name is copied onto the share row so members
-- do not need select access to the personal subject. The roster returns a display name
-- only for people already on a team the caller belongs to, and never an email address.

alter table public.bitacora_shared_subjects
  add column if not exists subject_name text;

alter table public.bitacora_shared_subjects
  drop constraint if exists bitacora_shared_subjects_name_chk;

alter table public.bitacora_shared_subjects
  add constraint bitacora_shared_subjects_name_chk
    check (subject_name is null or char_length(subject_name) between 1 and 200);

create or replace function public.bitacora_share_subject_with_team(p_team uuid, p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_name text;
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

  select s.name into v_name
  from public.bitacora_subjects_or_projects s
  where s.id = p_subject and s.user_id = auth.uid();
  if v_name is null then
    raise exception 'subject_not_owned';
  end if;

  insert into public.bitacora_shared_subjects (team_id, subject_id, subject_name)
  values (p_team, p_subject, v_name)
  on conflict (team_id, subject_id) do update
    set subject_name = excluded.subject_name
  returning id into v_share;

  for v_entry in
    select e.id
    from public.bitacora_ledger_entries e
    where e.user_id = auth.uid() and e.subject_id = p_subject
  loop
    v_added := public.bitacora_refresh_team_copies(auth.uid(), v_entry, p_team);
    v_copied := v_copied + coalesce(v_added, 0);
  end loop;

  return jsonb_build_object(
    'id', v_share,
    'team_id', p_team,
    'subject_id', p_subject,
    'copied_chunks', v_copied
  );
end $$;

create or replace function public.bitacora_team_roster(p_team uuid)
returns table (user_id uuid, role text, joined_at timestamptz, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role, m.joined_at, p.display_name
  from public.bitacora_team_members m
  left join public.bitacora_profiles p on p.id = m.user_id
  where m.team_id = p_team
    and public.bitacora_is_team_member(p_team);
$$;

revoke all on function public.bitacora_team_roster(uuid) from public, anon;
grant execute on function public.bitacora_team_roster(uuid) to authenticated;
