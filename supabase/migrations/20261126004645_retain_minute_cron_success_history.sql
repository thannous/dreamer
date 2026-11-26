-- Retain the last 30 days of successful minute-job runs and every failure.
-- At 250 rows/hour, the cleanup can catch up while new runs arrive at 60/hour.
select cron.schedule(
  'retain_minute_cron_success_history',
  '53 * * * *',
  $job$
    with expired as (
      select r.runid
      from cron.job_run_details as r
      join cron.job as j on j.jobid = r.jobid
      where j.jobname = 'ai_jobs_expire_abandoned_every_minute'
        and j.username = current_user
        and j.database = current_database()
        and r.status = 'succeeded'
        and r.end_time < now() - interval '30 days'
      order by r.runid
      limit 250
      for update of r skip locked
    )
    delete from cron.job_run_details as history
    using expired
    where history.runid = expired.runid
  $job$
);
