-- Harden subscription convergence RPCs after the initial rollout.

create or replace function public.get_effective_subscription_tier(p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce((select auth.role()), '');
  caller_user_id uuid := auth.uid();
  resolved_tier text;
begin
  if p_user_id is null then
    return 'free';
  end if;

  if caller_role = 'authenticated' and caller_user_id is distinct from p_user_id then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'Cannot read another user''s subscription tier';
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

revoke execute on function public.get_effective_subscription_tier(uuid) from public, anon;
grant execute on function public.get_effective_subscription_tier(uuid) to authenticated, service_role;

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
  caller_role text := coalesce((select auth.role()), '');
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

  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'apply_subscription_state_update requires service role access';
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

revoke execute on function public.apply_subscription_state_update(uuid, text, boolean, text, text, text, text, timestamptz, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_state_update(uuid, text, boolean, text, text, text, text, timestamptz, text, jsonb)
  to service_role;
