-- Free-plan tutor quota for the personal layer.
-- Rows belong to one owner. The consume function is security invoker, so RLS applies
-- and the inserted user_id is auth.uid(). There is no delete policy: a user cannot reset the counter.

create table public.bitacora_assistant_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.bitacora_profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index bitacora_assistant_requests_user_created_idx
  on public.bitacora_assistant_requests (user_id, created_at desc);

alter table public.bitacora_assistant_requests enable row level security;

create policy "bitacora_assistant_requests_select_own"
  on public.bitacora_assistant_requests
  for select using (user_id = (select auth.uid()));

create policy "bitacora_assistant_requests_insert_own"
  on public.bitacora_assistant_requests
  for insert with check (user_id = (select auth.uid()));

-- Returns 'ok', 'monthly_quota', or 'rate_limited'.
-- The advisory lock serializes concurrent questions from the same owner for this transaction.
create or replace function public.bitacora_consume_assistant_request(
  p_monthly_limit int,
  p_rate_limit int,
  p_window_seconds int
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  month_count int;
  recent_count int;
  month_start timestamptz;
begin
  if uid is null then
    raise exception 'unauthorized';
  end if;
  if p_monthly_limit < 1 or p_rate_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid quota parameters';
  end if;

  perform pg_advisory_xact_lock(hashtext('bitacora_assistant:' || uid::text)::bigint);

  month_start := (date_trunc('month', timezone('utc', now())) at time zone 'utc');

  select count(*) into month_count
  from public.bitacora_assistant_requests
  where user_id = uid
    and created_at >= month_start;
  if month_count >= p_monthly_limit then
    return 'monthly_quota';
  end if;

  select count(*) into recent_count
  from public.bitacora_assistant_requests
  where user_id = uid
    and created_at >= now() - make_interval(secs => p_window_seconds);
  if recent_count >= p_rate_limit then
    return 'rate_limited';
  end if;

  insert into public.bitacora_assistant_requests (user_id) values (uid);
  return 'ok';
end $$;

revoke all on function public.bitacora_consume_assistant_request(int, int, int) from public, anon;
grant execute on function public.bitacora_consume_assistant_request(int, int, int) to authenticated;
