create table public.product_analytics_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  event_name text not null check (event_name = any (array[
    'app_session_started',
    'onboarding_started',
    'onboarding_step_viewed',
    'onboarding_completed',
    'onboarding_destination_viewed',
    'dream_capture_started',
    'recording_started',
    'recording_saved',
    'recording_activation_insight_shown',
    'analysis_started',
    'analysis_completed',
    'analysis_offer_viewed',
    'first_dream_next_action_selected',
    'analysis_failed',
    'analysis_result_viewed',
    'symbol_detail_viewed',
    'first_value_viewed',
    'paywall_viewed',
    'empty_journal_remembered_cta_clicked',
    'onboarding_choice_selected'
  ]::text[])),
  schema_version smallint not null check (schema_version = 1),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  journey_id uuid,
  platform text not null check (platform = 'android'),
  app_version varchar(32) not null,
  locale text not null check (locale = any (array['fr', 'en', 'es', 'de', 'it']::text[])),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object')
);

comment on table public.product_analytics_events is
  'Pseudonymous product events. No user id, device fingerprint, IP, dream id, or dream content is stored.';
comment on column public.product_analytics_events.journey_id is
  'Random client journey identifier with a seven-day client lifetime; never derived from an account or device.';

create index product_analytics_events_name_occurred_idx
  on public.product_analytics_events (event_name, occurred_at desc);
create index product_analytics_events_journey_occurred_idx
  on public.product_analytics_events (journey_id, occurred_at)
  where journey_id is not null;
create index product_analytics_events_received_idx
  on public.product_analytics_events (received_at);

alter table public.product_analytics_events enable row level security;
alter table public.product_analytics_events force row level security;

-- This table is intentionally absent from the public Data API. The Edge Function
-- writes with the service role after authentication and strict allowlist validation.
revoke all on table public.product_analytics_events from public, anon, authenticated;
revoke all on sequence public.product_analytics_events_id_seq from public, anon, authenticated;
grant select, insert, delete on table public.product_analytics_events to service_role;
grant usage, select on sequence public.product_analytics_events_id_seq to service_role;

create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;
grant usage on schema analytics_private to service_role;

create table analytics_private.product_analytics_daily_aggregates (
  id bigint generated always as identity primary key,
  event_date date not null,
  event_name text not null,
  platform text not null,
  locale text not null,
  app_version varchar(32) not null,
  properties jsonb not null check (jsonb_typeof(properties) = 'object'),
  journey_count integer not null check (journey_count >= 10),
  event_count bigint not null check (event_count >= journey_count),
  refreshed_at timestamptz not null default now()
);

comment on table analytics_private.product_analytics_daily_aggregates is
  'Anonymous daily product cohorts. Rows exist only for groups with at least ten distinct journeys and expire after 24 months.';

create index product_analytics_daily_aggregates_date_event_idx
  on analytics_private.product_analytics_daily_aggregates (event_date desc, event_name);

alter table analytics_private.product_analytics_daily_aggregates enable row level security;
alter table analytics_private.product_analytics_daily_aggregates force row level security;
revoke all on table analytics_private.product_analytics_daily_aggregates from public, anon, authenticated;
revoke all on sequence analytics_private.product_analytics_daily_aggregates_id_seq from public, anon, authenticated;
grant select on table analytics_private.product_analytics_daily_aggregates to service_role;

create or replace function analytics_private.refresh_product_analytics_daily_aggregates()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Rebuild every date still backed by raw retention. This removes a cohort if
  -- late events or privacy deletions leave it below the ten-journey threshold.
  delete from analytics_private.product_analytics_daily_aggregates
  where event_date >= current_date - 90;

  insert into analytics_private.product_analytics_daily_aggregates (
    event_date,
    event_name,
    platform,
    locale,
    app_version,
    properties,
    journey_count,
    event_count,
    refreshed_at
  )
  select
    occurred_at::date,
    event_name,
    platform,
    locale,
    app_version,
    properties,
    count(distinct journey_id)::integer,
    count(*)::bigint,
    now()
  from public.product_analytics_events
  where journey_id is not null
    and occurred_at >= current_date - 90
    and occurred_at < current_date
  group by occurred_at::date, event_name, platform, locale, app_version, properties
  having count(distinct journey_id) >= 10;

  delete from analytics_private.product_analytics_daily_aggregates
  where event_date < current_date - interval '24 months';
end
$function$;

revoke all on function analytics_private.refresh_product_analytics_daily_aggregates()
  from public, anon, authenticated, service_role;

create extension if not exists pg_cron;

do $migration$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'product_analytics_purge_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'product_analytics_purge_daily',
    '20 4 * * *',
    $job$delete from public.product_analytics_events where received_at < now() - interval '90 days'$job$
  );
end
$migration$;

do $migration$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'product_analytics_aggregate_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'product_analytics_aggregate_daily',
    '0 4 * * *',
    $job$select analytics_private.refresh_product_analytics_daily_aggregates()$job$
  );
end
$migration$;
