-- Plus analyses stay unlimited per month, subject to abuse prevention: at most
-- 10 new analyses per rolling 24 hours, each with its illustration (Thanh,
-- 2026-10-21). Retries of a claimed request, the free monthly quota and every
-- other rule of 20260917172941 are unchanged. No backfill, no grant change.

create or replace function public.reserve_authenticated_analysis_authorization(
  p_user_id uuid,
  p_dream_id bigint default null,
  p_analysis_request_id uuid default null,
  p_start_pending boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  analysis_limit integer;
  lock_key text;
  claim_id uuid;
  claimed_dream_id bigint;
  claim_time timestamptz := now();
  dream_row public.dreams%rowtype;
  -- Plus is sold as unlimited, subject to abuse prevention. Keep equal to
  -- PLUS_DAILY_LIMITS.analysis in supabase/functions/api/lib/plusDailyLimits.ts.
  daily_limit constant integer := 10;
  daily_count integer;
  daily_release timestamptz;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception
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

  if p_start_pending then
    if coalesce(dream_row.is_analyzed, false) then
      return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_ALREADY_COMPLETE');
    end if;
    if dream_row.analysis_status = 'pending'
      and dream_row.analysis_request_id is distinct from p_analysis_request_id then
      return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_REQUEST_CONFLICT');
    end if;
  else
    if dream_row.analysis_request_id is distinct from p_analysis_request_id then
      return jsonb_build_object(
        'allowed', false,
        'code', 'ANALYSIS_REQUEST_MISMATCH',
        'tier', tier_value,
        'limit', analysis_limit,
        'claimed', false
      );
    end if;

    -- Plus may explicitly re-analyze an existing dream; it must still own a
    -- persisted pending request. Free behavior remains unchanged.
    if (analysis_limit is not null and coalesce(dream_row.is_analyzed, false) is true)
      or coalesce(dream_row.analysis_status, 'none') <> 'pending' then
      return jsonb_build_object(
        'allowed', false,
        'code', 'ANALYSIS_NOT_PENDING',
        'tier', tier_value,
        'limit', analysis_limit,
        'claimed', false
      );
    end if;
  end if;

  period_start := (date_trunc('month', claim_time at time zone 'utc') at time zone 'utc');
  period_end := ((date_trunc('month', claim_time at time zone 'utc') + interval '1 month') at time zone 'utc');
  lock_key := format('quota:analysis:%s:%s', p_user_id::text, to_char(period_start, 'YYYY-MM'));
  perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

  select e.id, e.dream_id
  into claim_id, claimed_dream_id
  from public.quota_usage e
  where e.user_id = p_user_id
    and e.quota_type = 'analysis'
    and e.metadata ->> 'analysis_request_id' = p_analysis_request_id::text
  limit 1;

  if found then
    if claimed_dream_id is distinct from p_dream_id then
      return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_REQUEST_MISMATCH');
    end if;
    if p_start_pending then
      update public.dreams set analysis_status = 'pending', analysis_request_id = p_analysis_request_id
      where id = p_dream_id and user_id = p_user_id;
    end if;
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

  -- A retry of a claimed request returned above, so only new analyses meet the
  -- rolling 24-hour ceiling. Only authorization receipts count: the legacy
  -- trigger rows of imported guest dreams carry no request id. Its own lock
  -- covers windows across month changes.
  if analysis_limit is null then
    perform pg_advisory_xact_lock(hashtextextended(format('quota:analysis-daily:%s', p_user_id::text), 0));

    select count(*)::integer
    into daily_count
    from public.quota_usage e
    where e.user_id = p_user_id
      and e.quota_type = 'analysis'
      and e.metadata ? 'analysis_request_id'
      and e.occurred_at > claim_time - interval '24 hours';

    if daily_count >= daily_limit then
      -- Once this claim leaves the window, fewer than daily_limit remain in it.
      select e.occurred_at
      into daily_release
      from public.quota_usage e
      where e.user_id = p_user_id
        and e.quota_type = 'analysis'
        and e.metadata ? 'analysis_request_id'
        and e.occurred_at > claim_time - interval '24 hours'
      order by e.occurred_at desc
      offset daily_limit - 1
      limit 1;

      return jsonb_build_object(
        'allowed', false,
        'code', 'DAILY_ANALYSIS_LIMIT',
        'tier', tier_value,
        'limit', analysis_limit,
        'daily_limit', daily_limit,
        'new_count', daily_count,
        'claimed', false,
        'retry_after_seconds', greatest(
          1,
          ceil(extract(epoch from (daily_release + interval '24 hours' - claim_time)))::integer
        )
      );
    end if;
  end if;

  select count(*)
  into used_count
  from public.quota_usage e
  where e.user_id = p_user_id
    and e.quota_type = 'analysis'
    and e.occurred_at >= period_start
    and e.occurred_at < period_end;

  if analysis_limit is not null and used_count >= analysis_limit then
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
      'source', case when p_start_pending then 'analysis_job_admission' else 'api_pre_provider' end,
      'authorized_tier', tier_value,
      'analysis_request_id', p_analysis_request_id
    )
  )
  returning id into claim_id;

  if p_start_pending then
    update public.dreams set analysis_status = 'pending', analysis_request_id = p_analysis_request_id
    where id = p_dream_id and user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', case when analysis_limit is null then 'UNLIMITED' else 'CLAIMED' end,
    'tier', tier_value,
    'limit', analysis_limit,
    'new_count', case when analysis_limit is null then null else used_count + 1 end,
    'claimed', true,
    'claim_id', claim_id
  );
end;
$$;

revoke execute on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  to service_role;
