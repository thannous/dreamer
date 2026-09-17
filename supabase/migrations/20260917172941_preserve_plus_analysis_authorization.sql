-- One atomic, service-owned authorization receipt for both analysis entry points.
-- Unlimited plans still need a durable receipt for their initial image after expiry.
-- No backfill of client-written done flags, no historical job replay, no entitlement edits.

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

create or replace function public.claim_authenticated_analysis_quota(
  p_user_id uuid,
  p_dream_id bigint default null,
  p_analysis_request_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.reserve_authenticated_analysis_authorization(
    p_user_id, p_dream_id, p_analysis_request_id, false
  );
$$;

revoke execute on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  to service_role;
revoke execute on function public.claim_authenticated_analysis_quota(uuid, bigint, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_authenticated_analysis_quota(uuid, bigint, uuid)
  to service_role;

create or replace function public.admit_authenticated_analysis_job(
  p_job_id uuid,
  p_user_id uuid,
  p_dream_id bigint,
  p_analysis_request_id uuid,
  p_lang text,
  p_replace_existing_image boolean,
  p_max_attempts integer,
  p_max_active_per_actor integer,
  p_window_seconds integer,
  p_max_created_in_window integer,
  p_max_global_active integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  existing_job public.ai_jobs%rowtype;
  inserted_job public.ai_jobs%rowtype;
  tier_value text;
  analysis_limit integer;
  used_count integer := 0;
  claim_id uuid;
  authorization_result jsonb;
  active_for_actor integer := 0;
  created_in_window integer := 0;
  global_active integer := 0;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception
      using errcode = '42501', message = 'admit_authenticated_analysis_job requires service role access';
  end if;

  if p_job_id is null or p_user_id is null or p_dream_id is null or p_analysis_request_id is null then
    raise exception 'analysis job identity is required';
  end if;
  if p_lang not in ('en', 'fr', 'es', 'de', 'it') then
    raise exception 'unsupported analysis language';
  end if;
  if p_max_attempts not between 1 and 5
     or p_max_active_per_actor not between 1 and 10
     or p_window_seconds not between 10 and 86400
     or p_max_created_in_window not between 1 and 1000
     or p_max_global_active not between 1 and 10000 then
    raise exception 'invalid analysis admission policy';
  end if;

  -- Match generic job admission lock order: global, actor, then domain rows.
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:global'));
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:user:' || p_user_id::text));

  select *
  into existing_job
  from public.ai_jobs j
  where j.job_type = 'analyze_dream'
    and j.user_id = p_user_id
    and j.guest_fingerprint is null
    and j.client_request_id = p_analysis_request_id::text
  limit 1;

  if found then
    -- Mid-rollout clients may omit or flip replaceExistingImage on retry.
    -- Identity stays bound to dream, language and the analysis request id.
    if existing_job.dream_id is distinct from p_dream_id
       or existing_job.request_payload ->> 'lang' is distinct from p_lang then
      return jsonb_build_object(
        'allowed', false,
        'code', 'ANALYSIS_IDEMPOTENCY_KEY_REUSED'
      );
    end if;
    return jsonb_build_object(
      'allowed', true,
      'duplicate', true,
      'job', to_jsonb(existing_job)
    );
  end if;

  select count(*)::integer
  into global_active
  from public.ai_jobs j
  where j.status in ('queued', 'running');

  if global_active >= p_max_global_active then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_GLOBAL_BACKLOG_LIMIT',
      'retry_after_seconds', 30
    );
  end if;

  select count(*)::integer
  into active_for_actor
  from public.ai_jobs j
  where j.job_type = 'analyze_dream'
    and j.status in ('queued', 'running')
    and j.user_id = p_user_id
    and j.guest_fingerprint is null;

  if active_for_actor >= p_max_active_per_actor then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_ACTOR_CONCURRENCY_LIMIT',
      'retry_after_seconds', 10
    );
  end if;

  select count(*)::integer
  into created_in_window
  from public.ai_jobs j
  where j.job_type = 'analyze_dream'
    and j.created_at >= now() - make_interval(secs => p_window_seconds)
    and j.user_id = p_user_id
    and j.guest_fingerprint is null;

  if created_in_window >= p_max_created_in_window then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_ACTOR_RATE_LIMIT',
      'retry_after_seconds', p_window_seconds
    );
  end if;

  -- The same atomic receipt owns authorization for both sync and queued analysis.
  authorization_result := public.reserve_authenticated_analysis_authorization(
    p_user_id, p_dream_id, p_analysis_request_id, true
  );
  if not coalesce((authorization_result ->> 'allowed')::boolean, false)
    and coalesce(authorization_result ->> 'code', '') <> 'ANALYSIS_ALREADY_CLAIMED' then
    return authorization_result;
  end if;
  tier_value := authorization_result ->> 'tier';
  analysis_limit := (authorization_result ->> 'limit')::integer;
  used_count := coalesce((authorization_result ->> 'new_count')::integer, 0);
  claim_id := (authorization_result ->> 'claim_id')::uuid;

  insert into public.ai_jobs (
    id,
    user_id,
    guest_fingerprint,
    dream_id,
    job_type,
    status,
    request_payload,
    client_request_id,
    max_attempts,
    quota_claimed,
    quota_claimed_at
  ) values (
    p_job_id,
    p_user_id,
    null,
    p_dream_id,
    'analyze_dream',
    'queued',
    jsonb_build_object(
      'lang', p_lang,
      'replaceExistingImage', coalesce(p_replace_existing_image, false)
    ),
    p_analysis_request_id::text,
    p_max_attempts,
    true,
    now()
  )
  returning * into inserted_job;

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'tier', case when tier_value = 'premium' then 'plus' else tier_value end,
    'limit', analysis_limit,
    'new_count', case when analysis_limit is null then null else used_count end,
    'claim_id', claim_id,
    'job', to_jsonb(inserted_job)
  );
exception
  when unique_violation then
    select *
    into existing_job
    from public.ai_jobs j
    where j.job_type = 'analyze_dream'
      and j.user_id = p_user_id
      and j.guest_fingerprint is null
      and j.client_request_id = p_analysis_request_id::text
    limit 1;

    if found then
      if existing_job.dream_id is distinct from p_dream_id
         or existing_job.request_payload ->> 'lang' is distinct from p_lang then
        return jsonb_build_object(
          'allowed', false,
          'code', 'ANALYSIS_IDEMPOTENCY_KEY_REUSED'
        );
      end if;
      return jsonb_build_object(
        'allowed', true,
        'duplicate', true,
        'job', to_jsonb(existing_job)
      );
    end if;
    raise;
end;
$$;

comment on function public.admit_authenticated_analysis_job(
  uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer
) is 'Atomically owns authenticated analysis idempotency, quota, pending dream state and durable job admission. Duplicate retries stay bound to dream, language and request id; replaceExistingImage-only drift is ignored.';
