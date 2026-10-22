-- Bind every analysis receipt and durable job to the exact stored transcript bytes.
-- Existing unbound receipts cannot authorize a new provider call.

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
  claimed_transcript_sha256 text;
  current_transcript_sha256 text;
  claim_time timestamptz := now();
  dream_row public.dreams%rowtype;
  -- Keep the current Plus rolling 24-hour guard from 20261021153000.
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

  current_transcript_sha256 := encode(pg_catalog.sha256(convert_to(dream_row.transcript, 'UTF8')), 'hex');

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
  -- The receipt UUID must be unique per user across months as well as across
  -- sync and queued paths. Serialize the lookup/insert on the user before the
  -- period-scoped quota lock; historical duplicate receipts need no index
  -- migration to make new claims safe.
  perform pg_advisory_xact_lock(hashtextextended(format('quota:analysis:all:%s', p_user_id::text), 0));
  lock_key := format('quota:analysis:%s:%s', p_user_id::text, to_char(period_start, 'YYYY-MM'));
  perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

  select e.id, e.dream_id, e.metadata ->> 'transcript_sha256'
  into claim_id, claimed_dream_id, claimed_transcript_sha256
  from public.quota_usage e
  where e.user_id = p_user_id
    and e.quota_type = 'analysis'
    and e.metadata ->> 'analysis_request_id' = p_analysis_request_id::text
  limit 1;

  if found then
    if claimed_dream_id is distinct from p_dream_id then
      return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_REQUEST_MISMATCH');
    end if;
    -- Old receipts have no content identity and cannot safely authorize a retry.
    if claimed_transcript_sha256 is distinct from current_transcript_sha256 then
      return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_TRANSCRIPT_MISMATCH');
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
      'claim_id', claim_id,
      'transcript_sha256', current_transcript_sha256
    );
  end if;

  -- A bound retry returned above; a new Plus analysis still observes the
  -- current rolling 24-hour ceiling across month boundaries.
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
      'analysis_request_id', p_analysis_request_id,
      'transcript_sha256', current_transcript_sha256
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
    'claim_id', claim_id,
    'transcript_sha256', current_transcript_sha256
  );
end;
$$;

create or replace function public.claim_authenticated_analysis_quota_bound(
  p_user_id uuid,
  p_dream_id bigint,
  p_analysis_request_id uuid,
  p_transcript_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  stored_transcript text;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'analysis quota claim requires service role access';
  end if;
  if p_dream_id is null or p_analysis_request_id is null then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_CLAIM_REQUIRED');
  end if;
  if p_transcript_sha256 is null or p_transcript_sha256 !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_TRANSCRIPT_MISMATCH');
  end if;

  -- Hold the dream lock through receipt creation so a sync cannot change the
  -- stored transcript between comparison and admission.
  select d.transcript into stored_transcript
  from public.dreams d
  where d.id = p_dream_id and d.user_id = p_user_id
  for update;
  if not found then
    return jsonb_build_object('allowed', false, 'code', 'DREAM_NOT_FOUND');
  end if;
  if encode(pg_catalog.sha256(convert_to(stored_transcript, 'UTF8')), 'hex') <> p_transcript_sha256 then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_TRANSCRIPT_MISMATCH');
  end if;
  return public.reserve_authenticated_analysis_authorization(
    p_user_id, p_dream_id, p_analysis_request_id, false
  );
end;
$$;

revoke all on function public.claim_authenticated_analysis_quota_bound(uuid, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_authenticated_analysis_quota_bound(uuid, bigint, uuid, text)
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
  transcript_sha256 text;
  existing_transcript_sha256 text;
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
    select encode(pg_catalog.sha256(convert_to(d.transcript, 'UTF8')), 'hex')
    into existing_transcript_sha256
    from public.dreams d
    where d.id = p_dream_id and d.user_id = p_user_id
    for update;
    if not found then
      return jsonb_build_object('allowed', false, 'code', 'DREAM_NOT_FOUND');
    end if;
    -- Mid-rollout clients may omit or flip replaceExistingImage on retry.
    -- Identity stays bound to dream, language and the analysis request id.
    if existing_job.dream_id is distinct from p_dream_id
       or existing_job.request_payload ->> 'lang' is distinct from p_lang
       or existing_job.request_payload ->> 'transcript_sha256' is distinct from existing_transcript_sha256 then
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
  -- Existing queued-job duplicates returned above. A receipt without a job
  -- came from synchronous analysis and cannot sponsor a second provider call.
  if not coalesce((authorization_result ->> 'allowed')::boolean, false) then
    return authorization_result;
  end if;
  tier_value := authorization_result ->> 'tier';
  analysis_limit := (authorization_result ->> 'limit')::integer;
  used_count := coalesce((authorization_result ->> 'new_count')::integer, 0);
  claim_id := (authorization_result ->> 'claim_id')::uuid;
  transcript_sha256 := authorization_result ->> 'transcript_sha256';
  if transcript_sha256 is null then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_TRANSCRIPT_MISMATCH');
  end if;

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
      'replaceExistingImage', coalesce(p_replace_existing_image, false),
      'transcript_sha256', transcript_sha256
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
      select encode(pg_catalog.sha256(convert_to(d.transcript, 'UTF8')), 'hex')
      into existing_transcript_sha256
      from public.dreams d
      where d.id = p_dream_id and d.user_id = p_user_id
      for update;
      if not found then
        return jsonb_build_object('allowed', false, 'code', 'DREAM_NOT_FOUND');
      end if;
      if existing_job.dream_id is distinct from p_dream_id
         or existing_job.request_payload ->> 'lang' is distinct from p_lang
         or existing_job.request_payload ->> 'transcript_sha256' is distinct from existing_transcript_sha256 then
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

comment on function public.claim_authenticated_analysis_quota_bound(uuid, bigint, uuid, text) is
  'Service-only transcript-bound synchronous analysis claim.';

-- Keep old rows nullable so they remain auditable; their duplicates fail closed.
alter table public.guest_analysis_quota_claims
  add column if not exists transcript_sha256 text;
alter table public.guest_analysis_quota_claims
  add constraint guest_analysis_claim_transcript_hash_check
  check (transcript_sha256 is null or transcript_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.claim_guest_analysis_quota(
  p_fingerprint text,
  p_analysis_request_id uuid,
  p_limit integer,
  p_transcript_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer := 0;
  already_claimed boolean := false;
  claimed_transcript_sha256 text;
  effective_limit integer := p_limit;
  risk jsonb;
  level text;
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;
  if p_analysis_request_id is null then
    raise exception 'p_analysis_request_id is required';
  end if;
  if p_transcript_sha256 is null or p_transcript_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'p_transcript_sha256 must be a lowercase SHA-256 digest';
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception 'p_limit must be non-negative';
  end if;

  insert into public.guest_usage (fingerprint_hash, is_upgraded)
  values (p_fingerprint, false)
  on conflict (fingerprint_hash) do nothing;

  select g.analysis_count
  into current_count
  from public.guest_usage g
  where g.fingerprint_hash = p_fingerprint
  for update;

  select c.transcript_sha256
  into claimed_transcript_sha256
  from public.guest_analysis_quota_claims c
  where c.fingerprint_hash = p_fingerprint
    and c.analysis_request_id = p_analysis_request_id;
  already_claimed := found;

  risk := public.get_guest_abuse_risk(p_fingerprint);
  level := coalesce(risk ->> 'risk_level', 'low');
  effective_limit := case
    when level = 'high' then 0
    when level = 'elevated' then least(p_limit, 1)
    else p_limit
  end;

  if already_claimed then
    -- Historical unbound claims cannot authorize a fresh provider request.
    if claimed_transcript_sha256 is distinct from p_transcript_sha256 then
      return jsonb_build_object(
        'allowed', false,
        'code', 'ANALYSIS_TRANSCRIPT_MISMATCH',
        'new_count', coalesce(current_count, 0),
        'claimed', false,
        'duplicate', true
      );
    end if;
    return jsonb_build_object(
      'allowed', false,
      'code', 'ANALYSIS_ALREADY_CLAIMED',
      'new_count', coalesce(current_count, 0),
      'limit', effective_limit,
      'is_upgraded', false,
      'claimed', false,
      'duplicate', true,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  if current_count >= effective_limit then
    return jsonb_build_object(
      'allowed', false,
      'new_count', coalesce(current_count, 0),
      'limit', effective_limit,
      'is_upgraded', false,
      'claimed', false,
      'duplicate', false,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  insert into public.guest_analysis_quota_claims (
    fingerprint_hash,
    analysis_request_id,
    transcript_sha256
  ) values (
    p_fingerprint,
    p_analysis_request_id,
    p_transcript_sha256
  );

  update public.guest_usage
  set analysis_count = analysis_count + 1, last_seen_at = now(), is_upgraded = false
  where fingerprint_hash = p_fingerprint
  returning analysis_count into current_count;

  return jsonb_build_object(
    'allowed', true,
    'new_count', current_count,
    'limit', effective_limit,
    'is_upgraded', false,
    'claimed', true,
    'duplicate', false,
    'risk_score', (risk ->> 'risk_score')::integer,
    'risk_level', level
  );
end;
$$;


revoke all on function public.claim_guest_analysis_quota(text, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_guest_analysis_quota(text, uuid, integer, text)
  to service_role;

-- The unbound service-only overload would still permit provider work on a new UUID.
drop function public.claim_guest_analysis_quota(text, uuid, integer);

-- Internal helpers run only under the API service role; do not leave
-- SECURITY DEFINER entry points executable by default roles.
revoke all on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)
  to service_role;
revoke all on function public.admit_authenticated_analysis_job(uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admit_authenticated_analysis_job(uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer)
  to service_role;
