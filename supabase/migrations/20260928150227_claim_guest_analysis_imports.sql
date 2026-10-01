-- A guest analysis is paid for by the guest quota before it can be moved to
-- an account. Import that historical result once even if the account's Free
-- quota is exhausted; ordinary new account analyses remain quota-gated.
-- Both existing BEFORE INSERT triggers invoke the same function, so the
-- private ledger recognizes a repeated call for the same client dream key.
-- Existing projects may have this schema from Dashboard setup; fresh databases do not.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.guest_analysis_imports (
  analysis_request_id uuid primary key,
  user_id uuid not null,
  client_request_id uuid not null,
  imported_at timestamptz not null default now()
);

alter table private.guest_analysis_imports enable row level security;
revoke all on private.guest_analysis_imports from public, anon, authenticated;

create or replace function private.claim_guest_analysis_import(
  p_user_id uuid,
  p_client_request_id uuid,
  p_analysis_request_id uuid,
  p_analysis_status text,
  p_analyzed_at timestamptz,
  p_interpretation text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id is distinct from (select auth.uid())
     or p_client_request_id is null
     or p_analysis_request_id is null or p_analysis_status is distinct from 'done'
     or p_analyzed_at is null or btrim(coalesce(p_interpretation, '')) = '' then
    return false;
  end if;

  insert into private.guest_analysis_imports (
    analysis_request_id, user_id, client_request_id
  )
  select p_analysis_request_id, p_user_id, p_client_request_id
  where exists (
    select 1 from public.guest_analysis_quota_claims c
    where c.analysis_request_id = p_analysis_request_id
  )
  on conflict (analysis_request_id) do nothing;

  return exists (
    select 1 from private.guest_analysis_imports i
    where i.analysis_request_id = p_analysis_request_id
      and i.user_id = p_user_id
      and i.client_request_id = p_client_request_id
  );
end;
$$;

revoke execute on function private.claim_guest_analysis_import(
  uuid, uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function private.claim_guest_analysis_import(
  uuid, uuid, uuid, text, timestamptz, text
) to authenticated;

create or replace function public.enforce_authenticated_monthly_quota()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  lock_key text;
  exploration_limit integer;
  analysis_limit integer;
  occurred_at timestamptz;
begin
  if new.user_id is null then
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  -- Guest AI was already admitted by the server before account sign-in. The
  -- private helper accepts each guest request ID for one dream identity only.
  -- Both existing quota triggers call this function on INSERT, so repeat calls
  -- for that same row must return the same answer.
  if tg_op = 'INSERT' and new.is_analyzed is true and
     private.claim_guest_analysis_import(
       new.user_id, new.client_request_id, new.analysis_request_id,
       new.analysis_status, new.analyzed_at, new.interpretation
     ) then
    return new;
  end if;

  tier_value := public.get_effective_subscription_tier(new.user_id);

  if tier_value not in ('free', 'plus', 'premium') then
    tier_value := 'free';
  end if;

  if (
    (tg_op = 'INSERT' and new.exploration_started_at is not null)
    or (tg_op = 'UPDATE' and old.exploration_started_at is null and new.exploration_started_at is not null)
  ) then
    occurred_at := coalesce(new.exploration_started_at, now());
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    select q.quota_limit
    into exploration_limit
    from public.quota_limits q
    where q.tier = tier_value
      and q.period = 'monthly'
      and q.quota_type = 'exploration';

    if not found then
      exploration_limit := 2;
    end if;

    if exploration_limit is not null then
      lock_key := format('quota:exploration:%s:%s', new.user_id::text, to_char(period_start, 'YYYY-MM'));
      perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      select count(*)
      into used_count
      from public.quota_usage e
      where e.user_id = new.user_id
        and e.quota_type = 'exploration'
        and e.occurred_at >= period_start
        and e.occurred_at < period_end;

      if used_count >= exploration_limit then
        raise exception 'QUOTA_EXPLORATION_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if (
    (tg_op = 'INSERT' and new.is_analyzed is true)
    or (tg_op = 'UPDATE' and coalesce(old.is_analyzed, false) is false and new.is_analyzed is true)
  ) then
    if exists (
      select 1
      from public.quota_usage e
      where e.user_id = new.user_id
        and e.dream_id = new.id
        and e.quota_type = 'analysis'
    ) then
      return new;
    end if;

    occurred_at := coalesce(new.analyzed_at, now());
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    select q.quota_limit
    into analysis_limit
    from public.quota_limits q
    where q.tier = tier_value
      and q.period = 'monthly'
      and q.quota_type = 'analysis';

    if not found then
      analysis_limit := 3;
    end if;

    if analysis_limit is not null then
      lock_key := format('quota:analysis:%s:%s', new.user_id::text, to_char(period_start, 'YYYY-MM'));
      perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      select count(*)
      into used_count
      from public.quota_usage e
      where e.user_id = new.user_id
        and e.quota_type = 'analysis'
        and e.occurred_at >= period_start
        and e.occurred_at < period_end;

      if used_count >= analysis_limit then
        raise exception 'QUOTA_ANALYSIS_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;
