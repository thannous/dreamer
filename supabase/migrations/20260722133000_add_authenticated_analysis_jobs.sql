-- Durable authenticated analysis commands. Admission, idempotency, quota
-- claim and dream pending state are committed in one transaction before any
-- provider work starts.

alter table public.ai_jobs
  drop constraint if exists ai_jobs_job_type_check;

alter table public.ai_jobs
  add constraint ai_jobs_job_type_check
  check (job_type in ('generate_image', 'analyze_dream')) not valid;

alter table public.ai_jobs
  validate constraint ai_jobs_job_type_check;

comment on table public.ai_jobs is
  'Durable server-owned AI commands for dream analysis and image generation; accessible only through service-role functions.';

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
    if existing_job.dream_id is distinct from p_dream_id
       or existing_job.request_payload ->> 'lang' is distinct from p_lang
       or coalesce(
         (existing_job.request_payload ->> 'replaceExistingImage')::boolean,
         true
       ) is distinct from coalesce(p_replace_existing_image, true) then
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
      'replaceExistingImage', coalesce(p_replace_existing_image, true)
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
         or existing_job.request_payload ->> 'lang' is distinct from p_lang
         or coalesce(
           (existing_job.request_payload ->> 'replaceExistingImage')::boolean,
           true
         ) is distinct from coalesce(p_replace_existing_image, true) then
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

revoke all on function public.admit_authenticated_analysis_job(
  uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.admit_authenticated_analysis_job(
  uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer
) to service_role;

comment on function public.admit_authenticated_analysis_job(
  uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer
) is 'Atomically owns authenticated analysis idempotency, quota, pending dream state and durable job admission.';

create or replace function public.complete_authenticated_analysis_job(
  p_job_id uuid,
  p_analysis_result jsonb,
  p_image_job_id uuid,
  p_image_max_attempts integer,
  p_image_max_active_per_actor integer,
  p_image_window_seconds integer,
  p_image_max_created_in_window integer,
  p_max_global_active integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  initial_job public.ai_jobs%rowtype;
  analysis_job public.ai_jobs%rowtype;
  completed_job public.ai_jobs%rowtype;
  dream_row public.dreams%rowtype;
  image_admission jsonb;
  image_job jsonb;
  image_error_code text;
  replace_existing_image boolean := true;
  title_value text;
  interpretation_value text;
  quote_value text;
  theme_value text;
  dream_type_value text;
  image_prompt_value text;
  analysis_details_value jsonb;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'complete_authenticated_analysis_job requires service role access';
  end if;

  if p_job_id is null or p_image_job_id is null then
    raise exception 'job identifiers are required';
  end if;
  if p_analysis_result is null
     or jsonb_typeof(p_analysis_result) <> 'object'
     or pg_column_size(p_analysis_result) > 65536 then
    raise exception 'invalid analysis result';
  end if;

  select *
  into initial_job
  from public.ai_jobs j
  where j.id = p_job_id
    and j.job_type = 'analyze_dream';

  if not found then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_JOB_NOT_FOUND');
  end if;

  -- Keep completion lock order compatible with every admission path before
  -- touching the job or dream rows.
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:global'));
  perform pg_advisory_xact_lock(
    hashtext('ai_jobs:admission:user:' || initial_job.user_id::text)
  );

  select *
  into analysis_job
  from public.ai_jobs j
  where j.id = p_job_id
    and j.job_type = 'analyze_dream'
  for update;

  if analysis_job.status = 'succeeded' then
    return jsonb_build_object(
      'completed', true,
      'duplicate', true,
      'job', to_jsonb(analysis_job),
      'image_job', analysis_job.result_payload -> 'imageJob'
    );
  end if;
  if analysis_job.status <> 'running' then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_JOB_NOT_RUNNING');
  end if;

  select *
  into dream_row
  from public.dreams d
  where d.id = analysis_job.dream_id
    and d.user_id = analysis_job.user_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'code', 'DREAM_NOT_FOUND');
  end if;
  if dream_row.analysis_request_id::text is distinct from analysis_job.client_request_id then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_REQUEST_STALE');
  end if;

  title_value := btrim(coalesce(p_analysis_result ->> 'title', ''));
  interpretation_value := btrim(coalesce(p_analysis_result ->> 'interpretation', ''));
  quote_value := btrim(coalesce(p_analysis_result ->> 'shareableQuote', ''));
  theme_value := btrim(coalesce(p_analysis_result ->> 'theme', 'surreal'));
  dream_type_value := btrim(coalesce(p_analysis_result ->> 'dreamType', 'Symbolic Dream'));
  image_prompt_value := btrim(coalesce(p_analysis_result ->> 'imagePrompt', ''));

  if title_value = '' or length(title_value) > 500
     or interpretation_value = '' or length(interpretation_value) > 20000
     or length(quote_value) > 2000
     or theme_value not in ('surreal', 'mystical', 'calm', 'noir')
     or length(dream_type_value) > 200
     or image_prompt_value = '' or length(image_prompt_value) > 1000 then
    raise exception 'analysis result fields are invalid';
  end if;

  analysis_details_value := jsonb_build_object(
    'symbols', case
      when jsonb_typeof(p_analysis_result -> 'symbols') = 'array'
        then p_analysis_result -> 'symbols'
      else '[]'::jsonb
    end,
    'emotions', case
      when jsonb_typeof(p_analysis_result -> 'emotions') = 'array'
        then p_analysis_result -> 'emotions'
      else '[]'::jsonb
    end,
    'reflectionQuestions', case
      when jsonb_typeof(p_analysis_result -> 'reflectionQuestions') = 'array'
        then p_analysis_result -> 'reflectionQuestions'
      else '[]'::jsonb
    end
  );
  if pg_column_size(analysis_details_value) > 32768 then
    raise exception 'analysis details are too large';
  end if;

  update public.dreams
  set
    title = title_value,
    interpretation = interpretation_value,
    shareable_quote = quote_value,
    theme = theme_value,
    dream_type = dream_type_value,
    analysis_details = analysis_details_value,
    is_analyzed = true,
    analyzed_at = now(),
    analysis_status = 'done',
    revision_id = gen_random_uuid(),
    updated_at = now()
  where id = dream_row.id
    and user_id = dream_row.user_id;

  replace_existing_image := coalesce(
    (analysis_job.request_payload ->> 'replaceExistingImage')::boolean,
    true
  );

  if replace_existing_image then
    image_admission := public.admit_ai_job(
      p_image_job_id,
      analysis_job.user_id,
      null,
      analysis_job.dream_id,
      'generate_image',
      jsonb_build_object(
        'prompt', image_prompt_value,
        'transcript', null,
        'previousImageUrl', nullif(dream_row.image_url, '')
      ),
      analysis_job.client_request_id,
      p_image_max_attempts,
      p_image_max_active_per_actor,
      p_image_window_seconds,
      p_image_max_created_in_window,
      p_max_global_active
    );

    if coalesce((image_admission ->> 'allowed')::boolean, false) then
      image_job := image_admission -> 'job';
    else
      image_error_code := coalesce(image_admission ->> 'code', 'IMAGE_JOB_ADMISSION_DENIED');
    end if;
  end if;

  update public.ai_jobs
  set
    status = 'succeeded',
    result_payload = jsonb_strip_nulls(jsonb_build_object(
      'dreamId', analysis_job.dream_id,
      'imageJob', image_job,
      'imageJobErrorCode', image_error_code
    )),
    error_code = null,
    error_message = null,
    finished_at = now()
  where id = analysis_job.id
  returning * into completed_job;

  return jsonb_build_object(
    'completed', true,
    'duplicate', false,
    'job', to_jsonb(completed_job),
    'image_job', image_job,
    'image_error_code', image_error_code
  );
end;
$$;

revoke all on function public.complete_authenticated_analysis_job(
  uuid, jsonb, uuid, integer, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.complete_authenticated_analysis_job(
  uuid, jsonb, uuid, integer, integer, integer, integer, integer
) to service_role;

comment on function public.complete_authenticated_analysis_job(
  uuid, jsonb, uuid, integer, integer, integer, integer, integer
) is 'Atomically persists a validated analysis result, completes its job and admits the initial image using the same generated prompt.';
