-- One authenticated snapshot replaces the mobile client's fan-out across
-- quota_limits, quota_usage, dreams and chat_history. Enforcement remains in
-- the server-side claim/trigger paths; this RPC is a display/preflight view.

-- Internal compatibility seam. The later chat-normalization migration replaces
-- this implementation with an append-only message-table count without having
-- to duplicate the public snapshot RPC.
create or replace function public.get_authenticated_chat_message_count(
  p_user_id uuid,
  p_dream_id bigint
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from jsonb_array_elements(
    coalesce(
      (
        select case
          when jsonb_typeof(coalesce(d.chat_history, '[]'::jsonb)) = 'array'
            then coalesce(d.chat_history, '[]'::jsonb)
          else '[]'::jsonb
        end
        from public.dreams d
        where d.id = p_dream_id
          and d.user_id = p_user_id
      ),
      '[]'::jsonb
    )
  ) message
  where message ->> 'role' = 'user'
$$;

revoke all on function public.get_authenticated_chat_message_count(uuid, bigint)
  from public, anon, authenticated, service_role;

create or replace function public.get_authenticated_quota_snapshot(
  p_target_dream_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := (select auth.uid());
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  analysis_limit integer;
  exploration_limit integer;
  messages_limit integer;
  analysis_events integer := 0;
  exploration_events integer := 0;
  analyzed_dreams integer := 0;
  explored_dreams integer := 0;
  analysis_used integer := 0;
  exploration_used integer := 0;
  messages_used integer := 0;
  target_is_analyzed boolean := false;
  target_is_explored boolean := false;
  target_found boolean := false;
begin
  if current_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  tier_value := public.get_effective_subscription_tier(current_user_id);
  if tier_value not in ('free', 'plus', 'premium') then
    tier_value := 'free';
  end if;

  period_start := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  period_end := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';

  select q.quota_limit
  into analysis_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'analysis';
  if not found then
    analysis_limit := case when tier_value in ('plus', 'premium') then null else 3 end;
  end if;

  select q.quota_limit
  into exploration_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'exploration';
  if not found then
    exploration_limit := case when tier_value in ('plus', 'premium') then null else 2 end;
  end if;

  select q.quota_limit
  into messages_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'messages_per_dream';
  if not found then
    messages_limit := case when tier_value in ('plus', 'premium') then null else 20 end;
  end if;

  select count(*)::integer
  into analysis_events
  from public.quota_usage q
  where q.user_id = current_user_id
    and q.quota_type = 'analysis'
    and q.occurred_at >= period_start
    and q.occurred_at < period_end;

  select count(*)::integer
  into exploration_events
  from public.quota_usage q
  where q.user_id = current_user_id
    and q.quota_type = 'exploration'
    and q.occurred_at >= period_start
    and q.occurred_at < period_end;

  -- Keep the defensive max used by the existing client provider in case a
  -- historical trigger was temporarily missing.
  select count(*)::integer
  into analyzed_dreams
  from public.dreams d
  where d.user_id = current_user_id
    and coalesce(d.is_analyzed, false) is true
    and d.analyzed_at >= period_start
    and d.analyzed_at < period_end;

  select count(*)::integer
  into explored_dreams
  from public.dreams d
  where d.user_id = current_user_id
    and d.exploration_started_at >= period_start
    and d.exploration_started_at < period_end;

  analysis_used := greatest(analysis_events, analyzed_dreams);
  exploration_used := greatest(exploration_events, explored_dreams);

  if p_target_dream_id is not null then
    select
      true,
      coalesce(d.is_analyzed, false),
      d.exploration_started_at is not null
    into target_found, target_is_analyzed, target_is_explored
    from public.dreams d
    where d.id = p_target_dream_id
      and d.user_id = current_user_id;
  end if;

  if target_found then
    messages_used := public.get_authenticated_chat_message_count(
      current_user_id,
      p_target_dream_id
    );
  end if;

  return jsonb_build_object(
    'tier', case when tier_value = 'premium' then 'plus' else tier_value end,
    'periodStart', period_start,
    'periodEnd', period_end,
    'usage', jsonb_build_object(
      'analysis', jsonb_build_object(
        'used', analysis_used,
        'limit', analysis_limit,
        'remaining', case
          when analysis_limit is null then null
          else greatest(0, analysis_limit - analysis_used)
        end
      ),
      'exploration', jsonb_build_object(
        'used', exploration_used,
        'limit', exploration_limit,
        'remaining', case
          when exploration_limit is null then null
          else greatest(0, exploration_limit - exploration_used)
        end
      ),
      'messages', jsonb_build_object(
        'used', messages_used,
        'limit', messages_limit,
        'remaining', case
          when messages_limit is null then null
          else greatest(0, messages_limit - messages_used)
        end
      )
    ),
    'canAnalyze', analysis_limit is null or analysis_used < analysis_limit or target_is_analyzed,
    'canExplore', exploration_limit is null or exploration_used < exploration_limit or target_is_explored,
    'targetFound', target_found
  );
end;
$$;

revoke all on function public.get_authenticated_quota_snapshot(bigint)
  from public, anon;

grant execute on function public.get_authenticated_quota_snapshot(bigint)
  to authenticated, service_role;

comment on function public.get_authenticated_quota_snapshot(bigint) is
  'Returns one server-authoritative authenticated quota and target-dream snapshot for the current UTC month.';
