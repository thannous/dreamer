-- Atomically admit durable AI jobs with actor burst/concurrency limits and a
-- global backlog circuit breaker. The Edge Function supplies tier-specific
-- limits, while this service-role-only function owns the race-free decision.

create index if not exists ai_jobs_user_type_status_created_idx
  on public.ai_jobs (user_id, job_type, status, created_at desc)
  where user_id is not null;

create index if not exists ai_jobs_guest_type_status_created_idx
  on public.ai_jobs (guest_fingerprint, job_type, status, created_at desc)
  where guest_fingerprint is not null;

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
    if existing_job.dream_id is distinct from p_dream_id
       or existing_job.request_payload is distinct from p_request_payload then
      return jsonb_build_object(
        'allowed', false,
        'code', 'AI_IDEMPOTENCY_KEY_REUSED'
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
    p_request_payload,
    p_client_request_id,
    p_max_attempts
  )
  returning * into inserted_job;

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
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
      if existing_job.dream_id is distinct from p_dream_id
         or existing_job.request_payload is distinct from p_request_payload then
        return jsonb_build_object(
          'allowed', false,
          'code', 'AI_IDEMPOTENCY_KEY_REUSED'
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

revoke all on function public.admit_ai_job(
  uuid, uuid, text, bigint, text, jsonb, text, integer, integer, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.admit_ai_job(
  uuid, uuid, text, bigint, text, jsonb, text, integer, integer, integer, integer, integer
) to service_role;

comment on function public.admit_ai_job(
  uuid, uuid, text, bigint, text, jsonb, text, integer, integer, integer, integer, integer
) is 'Atomically returns an existing idempotent AI job or admits a new one under actor and global capacity limits.';
