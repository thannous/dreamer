create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  job_name text := 'revenuecat_reconcile_daily';
  job_sql text := $job$
    select
      case
        when (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'revenuecat_reconcile_secret'
          limit 1
        ) is null then null
        else net.http_post(
          url := 'https://usuyppgsmmowzizhaoqj.functions.supabase.co/api/subscription/reconcile',
          headers := jsonb_build_object(
            'Authorization',
            'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'revenuecat_reconcile_secret'
              limit 1
            ),
            'Content-Type',
            'application/json'
          ),
          body := jsonb_build_object('source', 'cron')
        )
      end;
  $job$;
begin
  perform cron.schedule(job_name, '0 3 * * *', job_sql);
end $$;
