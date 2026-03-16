-- Spec 03: Converge subscription enforcement on a single server-owned source of truth.

create table if not exists public.subscription_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'plus')),
  is_active boolean not null,
  product_id text,
  entitlement_id text,
  source text not null,
  source_event_id text,
  source_updated_at timestamptz not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscription_state_updated_at
  on public.subscription_state(updated_at desc);

create index if not exists idx_subscription_state_active
  on public.subscription_state(is_active, tier);

alter table public.subscription_state enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'subscription_state'
      and policyname = 'subscription_state_select_own'
  ) then
    create policy subscription_state_select_own
      on public.subscription_state
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_event_id text,
  prior_tier text not null check (prior_tier in ('free', 'plus')),
  next_tier text not null check (next_tier in ('free', 'plus')),
  prior_is_active boolean not null,
  next_is_active boolean not null,
  product_id text,
  entitlement_id text,
  revenuecat_customer_id text,
  source_updated_at timestamptz not null,
  processed_at timestamptz not null default now(),
  outcome text not null,
  version bigint not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_subscription_events_user_processed
  on public.subscription_events(user_id, processed_at desc);

create index if not exists idx_subscription_events_source_event
  on public.subscription_events(source, source_event_id)
  where source_event_id is not null;

alter table public.subscription_events enable row level security;

create or replace function public.get_effective_subscription_tier(p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_tier text;
begin
  if p_user_id is null then
    return 'free';
  end if;

  select
    case
      when s.is_active is true and s.tier = 'plus' then 'plus'
      else 'free'
    end
  into resolved_tier
  from public.subscription_state s
  where s.user_id = p_user_id;

  return coalesce(resolved_tier, 'free');
end;
$$;

create or replace function public.apply_subscription_state_update(
  p_user_id uuid,
  p_tier text,
  p_is_active boolean,
  p_product_id text default null,
  p_entitlement_id text default null,
  p_source text default 'unknown',
  p_source_event_id text default null,
  p_source_updated_at timestamptz default now(),
  p_revenuecat_customer_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_state public.subscription_state%rowtype;
  current_meta jsonb := '{}'::jsonb;
  effective_tier text;
  effective_is_active boolean;
  next_version bigint;
  changed boolean;
  stale_event boolean := false;
  duplicate_event boolean := false;
  applied_at timestamptz := now();
  outcome text;
  response jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  effective_tier :=
    case
      when coalesce(p_is_active, false) is true
        and coalesce(p_tier, 'free') in ('plus', 'premium')
      then 'plus'
      else 'free'
    end;
  effective_is_active := effective_tier = 'plus';

  select *
  into current_state
  from public.subscription_state
  where user_id = p_user_id
  for update;

  if current_state.user_id is not null and p_source_event_id is not null and current_state.source_event_id = p_source_event_id then
    duplicate_event := true;
  end if;

  if current_state.user_id is not null and p_source_updated_at < current_state.source_updated_at then
    stale_event := true;
  end if;

  if duplicate_event or stale_event then
    outcome := case when duplicate_event then 'duplicate' else 'stale' end;

    insert into public.subscription_events (
      user_id,
      source,
      source_event_id,
      prior_tier,
      next_tier,
      prior_is_active,
      next_is_active,
      product_id,
      entitlement_id,
      revenuecat_customer_id,
      source_updated_at,
      processed_at,
      outcome,
      version,
      metadata
    )
    values (
      p_user_id,
      p_source,
      p_source_event_id,
      coalesce(current_state.tier, 'free'),
      coalesce(current_state.tier, 'free'),
      coalesce(current_state.is_active, false),
      coalesce(current_state.is_active, false),
      coalesce(current_state.product_id, p_product_id),
      coalesce(current_state.entitlement_id, p_entitlement_id),
      p_revenuecat_customer_id,
      p_source_updated_at,
      applied_at,
      outcome,
      coalesce(current_state.version, 1),
      coalesce(p_metadata, '{}'::jsonb)
    );

    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'outcome', outcome,
      'tier', coalesce(current_state.tier, 'free'),
      'isActive', coalesce(current_state.is_active, false),
      'version', coalesce(current_state.version, 1),
      'changed', false,
      'sourceUpdatedAt', coalesce(current_state.source_updated_at, p_source_updated_at)
    );
  end if;

  changed :=
    current_state.user_id is null
    or current_state.tier is distinct from effective_tier
    or current_state.is_active is distinct from effective_is_active
    or current_state.product_id is distinct from p_product_id
    or current_state.entitlement_id is distinct from p_entitlement_id;

  next_version := coalesce(current_state.version, 0) + 1;
  outcome := case when changed then 'updated' else 'refreshed' end;

  insert into public.subscription_state (
    user_id,
    tier,
    is_active,
    product_id,
    entitlement_id,
    source,
    source_event_id,
    source_updated_at,
    version,
    updated_at
  )
  values (
    p_user_id,
    effective_tier,
    effective_is_active,
    p_product_id,
    p_entitlement_id,
    p_source,
    p_source_event_id,
    p_source_updated_at,
    next_version,
    applied_at
  )
  on conflict (user_id) do update
    set tier = excluded.tier,
        is_active = excluded.is_active,
        product_id = excluded.product_id,
        entitlement_id = excluded.entitlement_id,
        source = excluded.source,
        source_event_id = excluded.source_event_id,
        source_updated_at = excluded.source_updated_at,
        version = excluded.version,
        updated_at = excluded.updated_at;

  select coalesce(raw_app_meta_data, '{}'::jsonb)
  into current_meta
  from auth.users
  where id = p_user_id
  for update;

  update auth.users
  set raw_app_meta_data = jsonb_strip_nulls(
    current_meta || jsonb_build_object(
      'tier', effective_tier,
      'subscription_version', next_version,
      'subscription_is_active', effective_is_active,
      'subscription_product_id', p_product_id,
      'subscription_entitlement_id', p_entitlement_id,
      'subscription_source', p_source,
      'subscription_source_event_id', p_source_event_id,
      'subscription_source_updated_at', p_source_updated_at,
      'tier_source', p_source,
      'tier_updated_at', applied_at,
      'last_tier_event_timestamp_ms', floor(extract(epoch from p_source_updated_at) * 1000)::bigint
    )
  )
  where id = p_user_id;

  insert into public.subscription_events (
    user_id,
    source,
    source_event_id,
    prior_tier,
    next_tier,
    prior_is_active,
    next_is_active,
    product_id,
    entitlement_id,
    revenuecat_customer_id,
    source_updated_at,
    processed_at,
    outcome,
    version,
    metadata
  )
  values (
    p_user_id,
    p_source,
    p_source_event_id,
    coalesce(current_state.tier, 'free'),
    effective_tier,
    coalesce(current_state.is_active, false),
    effective_is_active,
    p_product_id,
    p_entitlement_id,
    p_revenuecat_customer_id,
    p_source_updated_at,
    applied_at,
    outcome,
    next_version,
    coalesce(p_metadata, '{}'::jsonb)
  );

  response := jsonb_build_object(
    'ok', true,
    'skipped', false,
    'outcome', outcome,
    'tier', effective_tier,
    'isActive', effective_is_active,
    'version', next_version,
    'changed', changed,
    'updated', true,
    'sourceUpdatedAt', p_source_updated_at
  );

  return response;
end;
$$;

insert into public.subscription_state (
  user_id,
  tier,
  is_active,
  product_id,
  entitlement_id,
  source,
  source_event_id,
  source_updated_at,
  version,
  updated_at
)
select
  u.id,
  case
    when coalesce(u.raw_app_meta_data ->> 'tier', 'free') in ('plus', 'premium') then 'plus'
    else 'free'
  end as tier,
  case
    when coalesce(u.raw_app_meta_data ->> 'tier', 'free') in ('plus', 'premium') then true
    else false
  end as is_active,
  nullif(u.raw_app_meta_data ->> 'subscription_product_id', ''),
  nullif(u.raw_app_meta_data ->> 'subscription_entitlement_id', ''),
  'app_metadata_backfill',
  null,
  coalesce(
    nullif(u.raw_app_meta_data ->> 'subscription_source_updated_at', '')::timestamptz,
    nullif(u.raw_app_meta_data ->> 'tier_updated_at', '')::timestamptz,
    now()
  ),
  greatest(
    1,
    coalesce(nullif(u.raw_app_meta_data ->> 'subscription_version', '')::bigint, 1)
  ),
  now()
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.enforce_authenticated_monthly_quota()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  lock_key text;
  exploration_limit integer;
  analysis_limit integer;
  occurred_at timestamptz;
begin
  if new.user_id is null then
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  tier_value := public.get_effective_subscription_tier(new.user_id);

  if tier_value not in ('free', 'plus', 'premium') then
    tier_value := 'free';
  end if;

  if (
    (tg_op = 'INSERT' and new.exploration_started_at is not null)
    or (tg_op = 'UPDATE' and old.exploration_started_at is null and new.exploration_started_at is not null)
  ) then
    occurred_at := coalesce(new.exploration_started_at, now());
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    select q.quota_limit
    into exploration_limit
    from public.quota_limits q
    where q.tier = tier_value
      and q.period = 'monthly'
      and q.quota_type = 'exploration';

    if not found then
      exploration_limit := 2;
    end if;

    if exploration_limit is not null then
      lock_key := format('quota:exploration:%s:%s', new.user_id::text, to_char(period_start, 'YYYY-MM'));
      perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      select count(*)
      into used_count
      from public.quota_usage e
      where e.user_id = new.user_id
        and e.quota_type = 'exploration'
        and e.occurred_at >= period_start
        and e.occurred_at < period_end;

      if used_count >= exploration_limit then
        raise exception 'QUOTA_EXPLORATION_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if (
    (tg_op = 'INSERT' and new.is_analyzed is true)
    or (tg_op = 'UPDATE' and coalesce(old.is_analyzed, false) is false and new.is_analyzed is true)
  ) then
    occurred_at := coalesce(new.analyzed_at, now());
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    select q.quota_limit
    into analysis_limit
    from public.quota_limits q
    where q.tier = tier_value
      and q.period = 'monthly'
      and q.quota_type = 'analysis';

    if not found then
      analysis_limit := 3;
    end if;

    if analysis_limit is not null then
      lock_key := format('quota:analysis:%s:%s', new.user_id::text, to_char(period_start, 'YYYY-MM'));
      perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      select count(*)
      into used_count
      from public.quota_usage e
      where e.user_id = new.user_id
        and e.quota_type = 'analysis'
        and e.occurred_at >= period_start
        and e.occurred_at < period_end;

      if used_count >= analysis_limit then
        raise exception 'QUOTA_ANALYSIS_LIMIT_REACHED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_quota_for_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tier_value text;
  message_limit integer;
  new_count integer;
  old_count integer;
  lock_key text;
begin
  if old.chat_history is not distinct from new.chat_history then
    return new;
  end if;

  if new.user_id is null then
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  tier_value := public.get_effective_subscription_tier(new.user_id);

  if tier_value not in ('free', 'plus', 'guest') then
    tier_value := 'free';
  end if;

  select q.quota_limit
  into message_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'messages_per_dream';

  if not found then
    message_limit := case
      when tier_value = 'guest' then 10
      when tier_value = 'free' then 20
      when tier_value = 'plus' then null
      else 20
    end;
  elsif message_limit is null then
    return new;
  end if;

  old_count := coalesce(
    (
      select count(*)::int
      from jsonb_array_elements(coalesce(old.chat_history, '[]'::jsonb)) as msg
      where msg ->> 'role' = 'user'
    ),
    0
  );

  new_count := coalesce(
    (
      select count(*)::int
      from jsonb_array_elements(coalesce(new.chat_history, '[]'::jsonb)) as msg
      where msg ->> 'role' = 'user'
    ),
    0
  );

  if new_count > message_limit then
    lock_key := format('chat_quota:%s:%s', new.id::text, new.user_id::text);
    perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    raise exception 'QUOTA_MESSAGE_LIMIT_REACHED: Tier "%" allows max % messages per dream, attempted %',
      tier_value, message_limit, new_count
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on table public.subscription_state is
  'Authoritative server-owned subscription state used for quota enforcement and entitlement convergence.';

comment on table public.subscription_events is
  'Audit log for subscription convergence events across webhook, refresh, and reconcile paths.';
