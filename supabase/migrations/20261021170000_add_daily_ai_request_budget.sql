-- Daily anti-abuse budgets for synchronous paid AI routes (Thanh, 2026-10-21):
-- the 10-minute windows of claim_ai_request_window let one account make
-- thousands of calls a day. This counts requests per hashed actor over the
-- last 24 hours, in hourly buckets of the same table, so no new table, no raw
-- identity and the existing 7-day retention apply.

create or replace function public.claim_ai_daily_budget(
  p_actor_hash text,
  p_capability text,
  p_daily_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  claim_time timestamptz := clock_timestamp();
  hour_start timestamptz := date_trunc('hour', claim_time);
  day_capability text;
  daily_count integer;
  oldest_hour timestamptz;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception
      using errcode = '42501', message = 'claim_ai_daily_budget requires service role access';
  end if;

  if p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid actor hash';
  end if;
  -- Leaves room for the "_day" suffix within the table's 64-character check.
  if p_capability is null or p_capability !~ '^[a-z][a-z0-9_]{1,59}$' then
    raise exception 'invalid AI capability';
  end if;
  if p_daily_limit not between 1 and 10000 then
    raise exception 'invalid AI daily policy';
  end if;

  day_capability := p_capability || '_day';
  perform pg_advisory_xact_lock(
    hashtextextended('ai_daily:' || p_actor_hash || ':' || day_capability, 0)
  );

  -- The current hour and the 24 before it: never looser than a rolling day.
  select coalesce(sum(b.request_count), 0)::integer, min(b.window_started_at)
  into daily_count, oldest_hour
  from public.ai_rate_limit_buckets b
  where b.actor_hash = p_actor_hash
    and b.capability = day_capability
    and b.window_started_at >= hour_start - interval '24 hours';

  if daily_count >= p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_DAILY_LIMIT',
      'daily_limit', p_daily_limit,
      'daily_count', daily_count,
      -- The oldest hour leaves the window first and frees its requests.
      'retry_after_seconds', greatest(
        1,
        ceil(extract(epoch from (oldest_hour + interval '25 hours' - claim_time)))::integer
      )
    );
  end if;

  insert into public.ai_rate_limit_buckets (
    actor_hash,
    capability,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_actor_hash,
    day_capability,
    hour_start,
    1,
    claim_time
  )
  on conflict (actor_hash, capability, window_started_at)
  do update set
    request_count = public.ai_rate_limit_buckets.request_count + 1,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'allowed', true,
    'code', 'ADMITTED',
    'daily_limit', p_daily_limit,
    'daily_count', daily_count + 1
  );
end;
$$;

revoke all on function public.claim_ai_daily_budget(text, text, integer)
  from public, anon, authenticated;

grant execute on function public.claim_ai_daily_budget(text, text, integer)
  to service_role;

comment on function public.claim_ai_daily_budget(text, text, integer) is
  'Atomically enforces a per-actor rolling 24-hour budget (hourly buckets) for a synchronous paid AI capability.';
