-- Keep the durable AI queue and the dream analysis state convergent when a
-- worker dispatch is lost, a worker lease expires, or a legacy client leaves a
-- pending dream without creating an analysis job.

create index if not exists ai_jobs_dream_id_idx
  on public.ai_jobs (dream_id);

create index if not exists dreams_pending_analysis_lease_idx
  on public.dreams (updated_at)
  where analysis_status = 'pending'
    and is_analyzed is not true;

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
  orphaned_count integer := 0;
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
      j.user_id,
      j.dream_id,
      j.client_request_id,
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

      if stale_job.job_type = 'analyze_dream'
         and stale_job.user_id is not null
         and stale_job.dream_id is not null then
        update public.dreams
        set
          analysis_status = 'failed',
          revision_id = gen_random_uuid(),
          updated_at = p_now
        where id = stale_job.dream_id
          and user_id = stale_job.user_id
          and analysis_status = 'pending'
          and is_analyzed is not true
          and analysis_request_id::text = stale_job.client_request_id;
      end if;
    end if;
  end loop;

  -- A pending dream without active analysis work cannot complete by itself.
  -- Reconcile it in the same bounded cron pass so legacy or interrupted client
  -- flows do not leave the UI permanently waiting.
  with orphaned_dreams as (
    select d.id
    from public.dreams d
    where d.analysis_status = 'pending'
      and d.is_analyzed is not true
      and d.updated_at <= p_now - greatest(p_lease, interval '30 minutes')
      and not exists (
        select 1
        from public.ai_jobs j
        where j.dream_id = d.id
          and j.job_type = 'analyze_dream'
          and j.status in ('queued', 'running')
      )
    order by d.updated_at, d.id
    limit greatest(p_batch_size - expired_count, 0)
    for update skip locked
  )
  update public.dreams d
  set
    analysis_status = 'failed',
    revision_id = gen_random_uuid(),
    updated_at = p_now
  from orphaned_dreams orphaned
  where d.id = orphaned.id;

  get diagnostics orphaned_count = row_count;
  return expired_count + orphaned_count;
end;
$$;

revoke all on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)
  from public, anon, authenticated;
grant execute on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer)
  to service_role;

comment on function public.expire_abandoned_ai_jobs(timestamptz, interval, integer) is
  'Expires abandoned AI jobs and reconciles pending dreams that no longer have active analysis work.';

-- The sync RPC is a signed-in per-user operation. It retains its internal
-- auth.uid() ownership checks, but anonymous callers should not reach it.
revoke execute on function public.sync_dream_mutations(jsonb)
  from public, anon;
grant execute on function public.sync_dream_mutations(jsonb)
  to authenticated;

-- Repair the existing bounded backlog immediately. The existing minute cron
-- continues to call this function for future stale jobs and orphaned dreams.
select public.expire_abandoned_ai_jobs();
