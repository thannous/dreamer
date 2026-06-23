-- Claim authenticated analysis quota before provider work.
--
-- Authenticated analysis routes return AI output before the existing
-- dreams trigger records quota_usage. This RPC is service-role only and
-- charges limited tiers against a pending persisted dream/request before
-- Gemini is called. The trigger update below treats that trusted preclaim
-- as the same analysis event when the client later saves the final result.

create or replace function public.claim_authenticated_analysis_quota(
  p_user_id uuid,
  p_dream_id bigint default null,
  p_analysis_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce((select auth.role()), '');
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  analysis_limit integer;
  lock_key text;
  claim_id uuid;
  claim_time timestamptz := now();
  dream_row public.dreams%rowtype;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'claim_authenticated_analysis_quota requires service role access';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  tier_value := public.get_effective_subscription_tier(p_user_id);

  if tier_value not in ('free', 'plus', 'premium') then
    tier_value := 'free';
  end if;

  select q.quota_limit
  into analysis_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'analysis';

  if not found then
    analysis_limit := case when tier_value in ('plus', 'premium') then null else 3 end;
  end if;

  if analysis_limit is null then
    return jsonb_build_object(
      'allowed', true,
      'code', 'UNLIMITED',
      'tier', tier_value,
      'limit', null,
      'claimed', false
    );
  end if;

  if p_dream_id is null or p_analysis_request_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ANALYSIS_CLAIM_REQUIRED',
      'tier', tier_value,
      'limit', analysis_limit,
      'claimed', false
    );
  end if;

  select *
  into dream_row
  from public.dreams d
  where d.id = p_dream_id
    and d.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DREAM_NOT_FOUND',
      'tier', tier_value,
      'limit', analysis_limit,
      'claimed', false
    );
  end if;

  if dream_row.analysis_request_id is distinct from p_analysis_request_id then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ANALYSIS_REQUEST_MISMATCH',
      'tier', tier_value,
      'limit', analysis_limit,
      'claimed', false
    );
  end if;

  if coalesce(dream_row.is_analyzed, false) is true
    or coalesce(dream_row.analysis_status, 'none') <> 'pending' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'ANALYSIS_NOT_PENDING',
      'tier', tier_value,
      'limit', analysis_limit,
      'claimed', false
    );
  end if;

  period_start := (date_trunc('month', claim_time at time zone 'utc') at time zone 'utc');
  period_end := ((date_trunc('month', claim_time at time zone 'utc') + interval '1 month') at time zone 'utc');
  lock_key := format('quota:analysis:%s:%s', p_user_id::text, to_char(period_start, 'YYYY-MM'));
  perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

  select e.id
  into claim_id
  from public.quota_usage e
  where e.user_id = p_user_id
    and e.quota_type = 'analysis'
    and e.metadata ->> 'analysis_request_id' = p_analysis_request_id::text
  limit 1;

  if found then
    select count(*)
    into used_count
    from public.quota_usage e
    where e.user_id = p_user_id
      and e.quota_type = 'analysis'
      and e.occurred_at >= period_start
      and e.occurred_at < period_end;

    return jsonb_build_object(
      'allowed', false,
      'code', 'ANALYSIS_ALREADY_CLAIMED',
      'tier', tier_value,
      'limit', analysis_limit,
      'new_count', used_count,
      'claimed', false,
      'claim_id', claim_id
    );
  end if;

  select count(*)
  into used_count
  from public.quota_usage e
  where e.user_id = p_user_id
    and e.quota_type = 'analysis'
    and e.occurred_at >= period_start
    and e.occurred_at < period_end;

  if used_count >= analysis_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'QUOTA_EXCEEDED',
      'tier', tier_value,
      'limit', analysis_limit,
      'new_count', used_count,
      'claimed', false
    );
  end if;

  insert into public.quota_usage (user_id, dream_id, quota_type, occurred_at, metadata)
  values (
    p_user_id,
    p_dream_id,
    'analysis',
    claim_time,
    jsonb_build_object(
      'source', 'api_pre_provider',
      'analysis_request_id', p_analysis_request_id
    )
  )
  returning id into claim_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'CLAIMED',
    'tier', tier_value,
    'limit', analysis_limit,
    'new_count', used_count + 1,
    'claimed', true,
    'claim_id', claim_id
  );
end;
$$;

revoke execute on function public.claim_authenticated_analysis_quota(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_authenticated_analysis_quota(uuid, bigint, uuid)
  to service_role;

comment on function public.claim_authenticated_analysis_quota(uuid, bigint, uuid) is
  'Internal service-role RPC that claims authenticated analysis quota before provider work.';

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
