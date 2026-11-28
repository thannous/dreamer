-- pg_cron opens a fresh session each minute. When both partial indexes are
-- empty, avoid planning the worker's locking and reconciliation queries.
-- The worker still owns the lease durations, batch limit and locking rules.
do $migration$
declare
  expiry_job_id bigint;
begin
  select jobid into strict expiry_job_id
  from cron.job
  where jobname = 'ai_jobs_expire_abandoned_every_minute'
    and username = current_user
    and database = current_database();

  perform cron.alter_job(
    job_id := expiry_job_id,
    command := $job$
      select case when exists (
        select 1 from public.ai_jobs where status in ('queued', 'running')
      ) or exists (
        select 1 from public.dreams
        where analysis_status = 'pending' and is_analyzed is not true
      ) then public.expire_abandoned_ai_jobs() else 0 end
    $job$
  );
end
$migration$;
