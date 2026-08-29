-- Retry a failed generate_image job in place when the same actor, dream,
-- request payload and client_request_id come back. Preserve the unique id and
-- idempotency key; never insert a second row or claim quota twice.
-- Payload / dream mismatches stay AI_IDEMPOTENCY_KEY_REUSED.
-- Newly admitted image jobs store an internal md5 fingerprint so a later
-- redacted retry cannot match on field presence alone.
-- Duplicate authenticated analysis admission ignores replaceExistingImage-only
-- differences so mixed clients during rollout still resume the same job.
-- New analysis inserts default replaceExistingImage to false.

create or replace function public.admit_ai_job(
  p_job_id uuid,
  p_user_id uuid,
  p_guest_fingerprint text,
  p_dream_id bigint,
  p_job_type text,
  p_request_payload jsonb,
  p_client_request_id text,
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
  actor_key text;
  existing_job public.ai_jobs%rowtype;
  inserted_job public.ai_jobs%rowtype;
  requeued_job public.ai_jobs%rowtype;
  incoming_payload jsonb;
  incoming_hash text;
  existing_hash text;
  stored_payload jsonb;
  payload_conflict boolean := false;
  active_for_actor integer := 0;
  created_in_window integer := 0;
  global_active integer := 0;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'admit_ai_job requires service role access';
  end if;

  if p_job_id is null then
    raise exception 'p_job_id is required';
  end if;
  if (p_user_id is null) = (nullif(btrim(p_guest_fingerprint), '') is null) then
    raise exception 'exactly one AI job actor is required';
  end if;
  if p_job_type <> 'generate_image' then
    raise exception 'unsupported AI job type';
  end if;
  if nullif(btrim(p_client_request_id), '') is null
     or length(p_client_request_id) > 128
     or p_client_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception 'invalid client request id';
  end if;
  if p_request_payload is null
     or jsonb_typeof(p_request_payload) <> 'object'
     or pg_column_size(p_request_payload) > 32768 then
    raise exception 'invalid AI job payload';
  end if;
  if p_max_attempts not between 1 and 5
     or p_max_active_per_actor not between 1 and 10
     or p_window_seconds not between 10 and 86400
     or p_max_created_in_window not between 1 and 1000
     or p_max_global_active not between 1 and 10000 then
    raise exception 'invalid AI admission policy';
  end if;

  actor_key := case
    when p_user_id is not null then 'user:' || p_user_id::text
    else 'guest:' || btrim(p_guest_fingerprint)
  end;

  incoming_payload := p_request_payload - '_retryPayloadHash'::text;
  incoming_hash := md5(incoming_payload::text);
  stored_payload := incoming_payload || jsonb_build_object('_retryPayloadHash', incoming_hash);

  -- Lock order is global then actor for every admission to avoid deadlocks and
  -- make the global backlog ceiling exact across different actors.
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:global'));
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:' || actor_key));

  select *
  into existing_job
  from public.ai_jobs j
  where j.job_type = p_job_type
    and j.client_request_id = p_client_request_id
    and (
      (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
      or (
        p_user_id is null
        and j.user_id is null
        and j.guest_fingerprint = btrim(p_guest_fingerprint)
      )
    )
  limit 1;

  if found then
    existing_hash := nullif(btrim(coalesce(existing_job.request_payload ->> '_retryPayloadHash', '')), '');
    payload_conflict := case
      when coalesce((existing_job.request_payload ->> 'redacted')::boolean, false)
           and existing_hash is not null then
        existing_hash is distinct from incoming_hash
      when coalesce((existing_job.request_payload ->> 'redacted')::boolean, false) then
        (
          coalesce((existing_job.request_payload ->> 'hadPrompt')::boolean, false)
            is distinct from (nullif(btrim(coalesce(incoming_payload ->> 'prompt', '')), '') is not null)
          or coalesce((existing_job.request_payload ->> 'hadTranscript')::boolean, false)
            is distinct from (nullif(btrim(coalesce(incoming_payload ->> 'transcript', '')), '') is not null)
          or coalesce((existing_job.request_payload ->> 'hadPreviousImage')::boolean, false)
            is distinct from (
              nullif(btrim(coalesce(incoming_payload ->> 'previousImageUrl', '')), '') is not null
            )
        )
      else
        (existing_job.request_payload - '_retryPayloadHash'::text) is distinct from incoming_payload
    end;

    if existing_job.dream_id is distinct from p_dream_id or payload_conflict then
      return jsonb_build_object(
        'allowed', false,
        'code', 'AI_IDEMPOTENCY_KEY_REUSED'
      );
    end if;

    if existing_job.status = 'failed' then
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
      where j.status in ('queued', 'running')
        and j.job_type = p_job_type
        and (
          (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
          or (
            p_user_id is null
            and j.user_id is null
            and j.guest_fingerprint = btrim(p_guest_fingerprint)
          )
        );

      if active_for_actor >= p_max_active_per_actor then
        return jsonb_build_object(
          'allowed', false,
          'code', 'AI_ACTOR_CONCURRENCY_LIMIT',
          'retry_after_seconds', 10
        );
      end if;

      update public.ai_jobs
      set
        status = 'queued',
        request_payload = stored_payload,
        result_payload = null,
        error_code = null,
        error_message = null,
        attempt_count = 0,
        started_at = null,
        finished_at = null
      where id = existing_job.id
        and job_type = 'generate_image'
        and status = 'failed'
      returning * into requeued_job;

      if not found then
        return jsonb_build_object(
          'allowed', true,
          'duplicate', true,
          'requeued', false,
          'job', to_jsonb(existing_job)
        );
      end if;

      return jsonb_build_object(
        'allowed', true,
        'duplicate', true,
        'requeued', true,
        'job', to_jsonb(requeued_job)
      );
    end if;

    return jsonb_build_object(
      'allowed', true,
      'duplicate', true,
      'requeued', false,
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
  where j.status in ('queued', 'running')
    and j.job_type = p_job_type
    and (
      (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
      or (
        p_user_id is null
        and j.user_id is null
        and j.guest_fingerprint = btrim(p_guest_fingerprint)
      )
    );

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
  where j.created_at >= now() - make_interval(secs => p_window_seconds)
    and j.job_type = p_job_type
    and (
      (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
      or (
        p_user_id is null
        and j.user_id is null
        and j.guest_fingerprint = btrim(p_guest_fingerprint)
      )
    );

  if created_in_window >= p_max_created_in_window then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_ACTOR_RATE_LIMIT',
      'retry_after_seconds', p_window_seconds
    );
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
    max_attempts
  ) values (
    p_job_id,
    p_user_id,
    case when p_user_id is null then btrim(p_guest_fingerprint) else null end,
    p_dream_id,
    p_job_type,
    'queued',
    stored_payload,
    p_client_request_id,
    p_max_attempts
  )
  returning * into inserted_job;

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'requeued', false,
    'job', to_jsonb(inserted_job)
  );
exception
  when unique_violation then
    select *
    into existing_job
    from public.ai_jobs j
    where j.job_type = p_job_type
      and j.client_request_id = p_client_request_id
      and (
        (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
        or (
          p_user_id is null
          and j.user_id is null
          and j.guest_fingerprint = btrim(p_guest_fingerprint)
        )
      )
    limit 1;

    if found then
      existing_hash := nullif(btrim(coalesce(existing_job.request_payload ->> '_retryPayloadHash', '')), '');
      payload_conflict := case
        when coalesce((existing_job.request_payload ->> 'redacted')::boolean, false)
             and existing_hash is not null then
          existing_hash is distinct from incoming_hash
        when coalesce((existing_job.request_payload ->> 'redacted')::boolean, false) then
          (
            coalesce((existing_job.request_payload ->> 'hadPrompt')::boolean, false)
              is distinct from (nullif(btrim(coalesce(incoming_payload ->> 'prompt', '')), '') is not null)
            or coalesce((existing_job.request_payload ->> 'hadTranscript')::boolean, false)
              is distinct from (nullif(btrim(coalesce(incoming_payload ->> 'transcript', '')), '') is not null)
            or coalesce((existing_job.request_payload ->> 'hadPreviousImage')::boolean, false)
              is distinct from (
                nullif(btrim(coalesce(incoming_payload ->> 'previousImageUrl', '')), '') is not null
              )
          )
        else
          (existing_job.request_payload - '_retryPayloadHash'::text) is distinct from incoming_payload
      end;

      if existing_job.dream_id is distinct from p_dream_id or payload_conflict then
        return jsonb_build_object(
          'allowed', false,
          'code', 'AI_IDEMPOTENCY_KEY_REUSED'
        );
      end if;

      if existing_job.status = 'failed' then
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
        where j.status in ('queued', 'running')
          and j.job_type = p_job_type
          and (
            (p_user_id is not null and j.user_id = p_user_id and j.guest_fingerprint is null)
            or (
              p_user_id is null
              and j.user_id is null
              and j.guest_fingerprint = btrim(p_guest_fingerprint)
            )
          );

        if active_for_actor >= p_max_active_per_actor then
          return jsonb_build_object(
            'allowed', false,
            'code', 'AI_ACTOR_CONCURRENCY_LIMIT',
            'retry_after_seconds', 10
          );
        end if;

        update public.ai_jobs
        set
          status = 'queued',
          request_payload = stored_payload,
          result_payload = null,
          error_code = null,
          error_message = null,
          attempt_count = 0,
          started_at = null,
          finished_at = null
        where id = existing_job.id
          and job_type = 'generate_image'
          and status = 'failed'
        returning * into requeued_job;

        if not found then
          return jsonb_build_object(
            'allowed', true,
            'duplicate', true,
            'requeued', false,
            'job', to_jsonb(existing_job)
          );
        end if;

        return jsonb_build_object(
          'allowed', true,
          'duplicate', true,
          'requeued', true,
          'job', to_jsonb(requeued_job)
        );
      end if;

      return jsonb_build_object(
        'allowed', true,
        'duplicate', true,
        'requeued', false,
        'job', to_jsonb(existing_job)
      );
    end if;
    raise;
end;
$$;

comment on function public.admit_ai_job(
  uuid, uuid, text, bigint, text, jsonb, text, integer, integer, integer, integer, integer
) is 'Atomically returns an existing idempotent AI job, requeues a matching failed generate_image row in place, or admits a new one under actor and global capacity limits. Image payloads are bound by an internal md5 fingerprint so redacted retries cannot match on field presence alone.';

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
  dream_row public.dreams%rowtype;
  tier_value text;
  analysis_limit integer;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer := 0;
  existing_claim_id uuid;
  claim_id uuid;
  active_for_actor integer := 0;
  created_in_window integer := 0;
  global_active integer := 0;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
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

  select *
  into dream_row
  from public.dreams d
  where d.id = p_dream_id
    and d.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'DREAM_NOT_FOUND');
  end if;

  if coalesce(dream_row.is_analyzed, false) is true then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_ALREADY_COMPLETE');
  end if;

  if coalesce(dream_row.analysis_status, 'none') = 'pending'
     and dream_row.analysis_request_id is distinct from p_analysis_request_id then
    return jsonb_build_object('allowed', false, 'code', 'ANALYSIS_REQUEST_CONFLICT');
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

  period_start := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  period_end := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';

  if analysis_limit is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        format('quota:analysis:%s:%s', p_user_id::text, to_char(period_start, 'YYYY-MM')),
        0
      )
    );

    select e.id
    into existing_claim_id
    from public.quota_usage e
    where e.user_id = p_user_id
      and e.quota_type = 'analysis'
      and e.metadata ->> 'analysis_request_id' = p_analysis_request_id::text
    limit 1;

    select count(*)::integer
    into used_count
    from public.quota_usage e
    where e.user_id = p_user_id
      and e.quota_type = 'analysis'
      and e.occurred_at >= period_start
      and e.occurred_at < period_end;

    if existing_claim_id is null and used_count >= analysis_limit then
      return jsonb_build_object(
        'allowed', false,
        'code', 'QUOTA_EXCEEDED',
        'tier', tier_value,
        'limit', analysis_limit,
        'new_count', used_count
      );
    end if;

    if existing_claim_id is null then
      insert into public.quota_usage (
        user_id,
        dream_id,
        quota_type,
        occurred_at,
        metadata
      ) values (
        p_user_id,
        p_dream_id,
        'analysis',
        now(),
        jsonb_build_object(
          'source', 'analysis_job_admission',
          'analysis_request_id', p_analysis_request_id
        )
      )
      returning id into claim_id;
      used_count := used_count + 1;
    else
      claim_id := existing_claim_id;
    end if;
  end if;

  update public.dreams
  set
    analysis_status = 'pending',
    analysis_request_id = p_analysis_request_id
  where id = p_dream_id
    and user_id = p_user_id;

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
    analysis_limit is not null,
    case when analysis_limit is not null then now() else null end
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
