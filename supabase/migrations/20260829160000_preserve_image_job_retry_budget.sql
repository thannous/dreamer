-- Failed generate_image retries must not reset attempt_count or quota_claimed.
-- A matching failed row is requeued in place with the same id and client_request_id.
-- attempt_count stays as spent budget so Gemini cannot be retried unbounded.
-- quota_claimed and quota_claimed_at stay untouched so a guest claim is not
-- taken twice; the worker still skips increment_guest_quota when claimed.

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

      -- Keep attempt_count and quota_claimed as-is: retries reuse spent budget
      -- and any guest image claim already attached to this job id.
      update public.ai_jobs
      set
        status = 'queued',
        request_payload = stored_payload,
        result_payload = null,
        error_code = null,
        error_message = null,
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
) is 'Atomically returns an existing idempotent AI job, requeues a matching failed generate_image row in place without resetting attempt_count or quota_claimed, or admits a new one under actor and global capacity limits. Image payloads are bound by an internal md5 fingerprint so redacted retries cannot match on field presence alone.';
