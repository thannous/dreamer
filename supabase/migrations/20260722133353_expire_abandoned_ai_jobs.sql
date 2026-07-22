-- Durable AI commands must not occupy actor/global concurrency forever when
-- their initial Edge Function dispatch is lost. Status polling already
-- retriggers queued work; this lease is the independent server-side backstop.

create index if not exists ai_jobs_active_lease_idx
  on public.ai_jobs ((coalesce(started_at, created_at)))
  where status in ('queued', 'running');

create or replace function public.expire_abandoned_ai_jobs(
  p_now timestamptz default now(),
  p_lease interval default interval '10 minutes',
  p_batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale_job record;
  expired_count integer := 0;
begin
  if p_now is null
     or p_lease < interval '3 minutes'
     or p_lease > interval '1 day'
     or p_batch_size not between 1 and 1000 then
    raise exception 'invalid AI job lease policy';
  end if;

  for stale_job in
    select
      j.id,
      j.job_type,
      j.guest_fingerprint,
      j.quota_claimed,
      j.request_payload
    from public.ai_jobs j
    where j.status in ('queued', 'running')
      and coalesce(j.started_at, j.created_at) <= p_now - p_lease
    order by coalesce(j.started_at, j.created_at), j.id
    limit p_batch_size
    for update skip locked
  loop
    -- Image quota is claimed only after the worker starts upstream work. A
    -- stale claimed guest job releases that reversible claim before failing.
    if stale_job.job_type = 'generate_image'
       and stale_job.guest_fingerprint is not null
       and stale_job.quota_claimed then
      perform public.release_guest_quota_claim(stale_job.guest_fingerprint, 'image');
    end if;

    update public.ai_jobs
    set
      status = 'failed',
      request_payload = case
        when stale_job.job_type = 'generate_image' then
          jsonb_build_object(
            'redacted', true,
            'hadPrompt', nullif(btrim(coalesce(stale_job.request_payload ->> 'prompt', '')), '') is not null,
            'hadTranscript', nullif(btrim(coalesce(stale_job.request_payload ->> 'transcript', '')), '') is not null,
            'hadPreviousImage', nullif(btrim(coalesce(stale_job.request_payload ->> 'previousImageUrl', '')), '') is not null
          )
        else stale_job.request_payload
      end,
      error_code = 'AI_JOB_LEASE_EXPIRED',
      error_message = 'The AI job was abandoned before completion.',
      quota_claimed = case
        when stale_job.job_type = 'generate_image' and stale_job.guest_fingerprint is not null
          then false
        else quota_claimed
      end,
      quota_claimed_at = case
        when stale_job.job_type = 'generate_image' and stale_job.guest_fingerprint is not null
          then null
        else quota_claimed_at
      end,
      finished_at = p_now
    where id = stale_job.id
      and status in ('queued', 'running');

    if found then
      expired_count := expired_count + 1;
    end if;
  end loop;

  return expired_count;
end;
$$;

revoke all on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)
  from public, anon, authenticated;
grant execute on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)
  to service_role;

comment on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer) is
  'Expires abandoned queued/running AI commands in short SKIP LOCKED batches so stale work cannot monopolize admission limits.';

create extension if not exists pg_cron;

do $migration$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'ai_jobs_expire_abandoned_every_minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'ai_jobs_expire_abandoned_every_minute',
    '* * * * *',
    $job$select public.expire_abandoned_ai_jobs()$job$
  );
end
$migration$;

-- Clear the existing abandoned backlog immediately; subsequent batches are
-- handled by the minute schedule when more than 100 rows are waiting.
select public.expire_abandoned_ai_jobs();
