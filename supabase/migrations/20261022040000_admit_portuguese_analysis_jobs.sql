-- The app and the API both speak Portuguese (AI_LANGUAGES in
-- supabase/functions/api/lib/aiLanguage.ts), but queued analysis admission
-- still refused 'pt', so every signed-in Portuguese account got a 503 instead
-- of an analysis. Only the language list changes; the body is otherwise the
-- one from 20261021201021_bind_analysis_receipts_to_transcript.sql.

-- That body needs the transcript-bound authorization of 20261021201021.
-- Production applies migrations one by one and may still lack it; installed
-- without it, this body would refuse every queued analysis, so stop instead.
do $$
begin
  if position('transcript_sha256' in pg_catalog.pg_get_functiondef(
    'public.reserve_authenticated_analysis_authorization(uuid, bigint, uuid, boolean)'::regprocedure
  )) = 0 then
    raise exception 'apply 20261021201021_bind_analysis_receipts_to_transcript.sql first';
  end if;
end;
$$;

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
  if p_lang not in ('en', 'fr', 'es', 'de', 'it', 'pt') then
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

revoke all on function public.admit_authenticated_analysis_job(uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admit_authenticated_analysis_job(uuid, uuid, bigint, uuid, text, boolean, integer, integer, integer, integer, integer)
  to service_role;
