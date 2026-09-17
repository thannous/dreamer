-- Product scope is enforced only for signed OAuth client_id claims.
-- Legacy tokens without client_id intentionally retain existing access.
-- This migration does not activate OAuth or register any production client.
create schema if not exists app_authorization_private;
revoke all on schema app_authorization_private from public, anon, authenticated;
create table app_authorization_private.oauth_clients (
  client_id text primary key check (length(btrim(client_id)) > 0),
  product text not null check (product in ('journal', 'lucid'))
);
revoke all on table app_authorization_private.oauth_clients from public, anon, authenticated;

create or replace function public.current_app_product()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := auth.jwt();
  product_name text;
begin
  if not coalesce(claims ? 'client_id', false) then
    return 'legacy';
  end if;
  if jsonb_typeof(claims -> 'client_id') is distinct from 'string'
     or btrim(claims ->> 'client_id') = '' then
    return 'unknown';
  end if;
  select product into product_name
  from app_authorization_private.oauth_clients
  where client_id = claims ->> 'client_id';
  return coalesce(product_name, 'unknown');
end;
$$;
revoke all on function public.current_app_product() from public, anon;
grant execute on function public.current_app_product() to authenticated, service_role;

-- Remove unused DDL-like client privileges inherited from default grants.
-- TRUNCATE is not governed by RLS; this is least privilege, not a claim that
-- PostgREST exposes a truncate endpoint. Keep normal DML and worker grants.
revoke truncate, references, trigger on table
  public.dreams,
  public.lucid_trainer_entities,
  public.lucid_trainer_reset_fences,
  public.quota_usage,
  public.subscription_state,
  public.subscription_events
from anon, authenticated;

-- Restrictive policies are ANDed with existing ownership policies; they never
-- grant row access. Service-role workers retain their existing BYPASSRLS access.
create policy app_product_scope on public.dreams
  as restrictive for all to authenticated
  using ((select public.current_app_product()) in ('legacy', 'journal'))
  with check ((select public.current_app_product()) in ('legacy', 'journal'));

create policy app_product_scope on public.lucid_trainer_entities
  as restrictive for all to authenticated
  using ((select public.current_app_product()) in ('legacy', 'lucid'))
  with check ((select public.current_app_product()) in ('legacy', 'lucid'));

create policy app_product_scope on public.lucid_trainer_reset_fences
  as restrictive for all to authenticated
  using ((select public.current_app_product()) in ('legacy', 'lucid'))
  with check ((select public.current_app_product()) in ('legacy', 'lucid'));

create policy dream_images_product_scope on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'dream-images' or (select public.current_app_product()) in ('legacy', 'journal'))
  with check (bucket_id <> 'dream-images' or (select public.current_app_product()) in ('legacy', 'journal'));

-- Copied final definitions preserve all existing RPC signatures and grants.
-- SECURITY DEFINER bypasses table RLS, so each RPC checks scope before work.

-- Source: 20260721120000_add_dream_analysis_details.sql
create or replace function public.sync_dream_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  mutation jsonb;
  payload jsonb;
  response jsonb := '[]'::jsonb;
  result_entry jsonb;
  existing_receipt jsonb;
  target_row public.dreams%rowtype;
  saved_row public.dreams%rowtype;
  mutation_id text;
  mutation_operation text;
  mutation_client_request_id uuid;
  mutation_entity_key text;
  mutation_base_revision text;
  target_remote_id bigint;
  create_client_request_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if jsonb_typeof(mutations) is distinct from 'array' then
    raise exception 'mutations must be a json array' using errcode = 'P0001';
  end if;

  for mutation in
    select value
    from jsonb_array_elements(mutations)
  loop
    mutation_id := coalesce(mutation->>'mutation_id', '');
    mutation_operation := coalesce(mutation->>'operation', '');
    mutation_entity_key := coalesce(mutation->>'entity_key', '');
    mutation_base_revision := nullif(mutation->>'base_revision', '');
    payload := coalesce(mutation->'payload', '{}'::jsonb);

    begin
      mutation_client_request_id := (mutation->>'client_request_id')::uuid;
    exception when others then
      mutation_client_request_id := null;
    end;

    if mutation_id = '' or mutation_client_request_id is null or mutation_operation = '' then
      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', coalesce(mutation->>'client_request_id', ''),
        'operation', mutation_operation,
        'status', 'failed',
        'error', 'Malformed sync mutation payload'
      );
      response := response || jsonb_build_array(result_entry);
      continue;
    end if;

    select receipt.response
    into existing_receipt
    from public.dream_sync_receipts as receipt
    where receipt.user_id = current_user_id
      and receipt.client_request_id = mutation_client_request_id;

    if existing_receipt is not null then
      response := response || jsonb_build_array(existing_receipt);
      continue;
    end if;

    result_entry := null;

    if mutation_operation = 'create' then
      create_client_request_id := coalesce(
        nullif(payload->>'client_request_id', '')::uuid,
        mutation_client_request_id
      );

      insert into public.dreams (
        user_id,
        client_request_id,
        transcript,
        title,
        interpretation,
        shareable_quote,
        image_url,
        chat_history,
        theme,
        dream_type,
        is_favorite,
        image_generation_failed,
        is_analyzed,
        analyzed_at,
        analysis_status,
        analysis_request_id,
        exploration_started_at,
        has_person,
        has_animal,
        memory,
        analysis_details,
        client_updated_at
      )
      values (
        current_user_id,
        create_client_request_id,
        coalesce(payload->>'transcript', ''),
        coalesce(payload->>'title', ''),
        coalesce(payload->>'interpretation', ''),
        coalesce(payload->>'shareable_quote', ''),
        nullif(payload->>'image_url', ''),
        coalesce(payload->'chat_history', '[]'::jsonb),
        nullif(payload->>'theme', ''),
        coalesce(payload->>'dream_type', 'Symbolic Dream'),
        coalesce((payload->>'is_favorite')::boolean, false),
        coalesce((payload->>'image_generation_failed')::boolean, false),
        coalesce((payload->>'is_analyzed')::boolean, false),
        nullif(payload->>'analyzed_at', '')::timestamptz,
        coalesce(payload->>'analysis_status', 'none'),
        nullif(payload->>'analysis_request_id', '')::uuid,
        nullif(payload->>'exploration_started_at', '')::timestamptz,
        (payload->>'has_person')::boolean,
        (payload->>'has_animal')::boolean,
        coalesce(payload->'memory', '{}'::jsonb),
        payload->'analysis_details',
        coalesce(nullif(payload->>'client_updated_at', '')::timestamptz, now())
      )
      on conflict (user_id, client_request_id)
      do update set
        transcript = excluded.transcript,
        title = excluded.title,
        interpretation = excluded.interpretation,
        shareable_quote = excluded.shareable_quote,
        image_url = excluded.image_url,
        chat_history = excluded.chat_history,
        theme = excluded.theme,
        dream_type = excluded.dream_type,
        is_favorite = excluded.is_favorite,
        image_generation_failed = excluded.image_generation_failed,
        is_analyzed = excluded.is_analyzed,
        analyzed_at = excluded.analyzed_at,
        analysis_status = excluded.analysis_status,
        analysis_request_id = excluded.analysis_request_id,
        exploration_started_at = excluded.exploration_started_at,
        has_person = excluded.has_person,
        has_animal = excluded.has_animal,
        memory = excluded.memory,
        analysis_details = excluded.analysis_details,
        client_updated_at = excluded.client_updated_at
      returning * into saved_row;

      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', mutation_client_request_id,
        'operation', mutation_operation,
        'status', 'ack',
        'dream', public.serialize_dream_for_sync(saved_row),
        'remote_id', saved_row.id
      );
    elsif mutation_operation = 'update' then
      target_remote_id := nullif(payload->>'remote_id', '')::bigint;

      if target_remote_id is null then
        result_entry := jsonb_build_object(
          'mutation_id', mutation_id,
          'client_request_id', mutation_client_request_id,
          'operation', mutation_operation,
          'status', 'failed',
          'error', 'Missing remote dream id for update'
        );
      else
        select *
        into target_row
        from public.dreams
        where id = target_remote_id
          and user_id = current_user_id;

        if not found then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'failed',
            'remote_id', target_remote_id,
            'error', 'Dream not found'
          );
        elsif mutation_base_revision is not null and target_row.revision_id::text <> mutation_base_revision then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'conflict',
            'remote_id', target_row.id,
            'dream', public.serialize_dream_for_sync(target_row),
            'error', 'Dream revision conflict'
          );
        else
          update public.dreams
          set
            transcript = coalesce(payload->>'transcript', target_row.transcript),
            title = coalesce(payload->>'title', target_row.title),
            interpretation = coalesce(payload->>'interpretation', target_row.interpretation),
            shareable_quote = coalesce(payload->>'shareable_quote', target_row.shareable_quote),
            image_url = nullif(coalesce(payload->>'image_url', target_row.image_url), ''),
            chat_history = coalesce(payload->'chat_history', target_row.chat_history),
            theme = nullif(coalesce(payload->>'theme', target_row.theme), ''),
            dream_type = coalesce(payload->>'dream_type', target_row.dream_type),
            is_favorite = coalesce((payload->>'is_favorite')::boolean, target_row.is_favorite),
            image_generation_failed = coalesce((payload->>'image_generation_failed')::boolean, target_row.image_generation_failed),
            is_analyzed = coalesce((payload->>'is_analyzed')::boolean, target_row.is_analyzed),
            analyzed_at = coalesce(nullif(payload->>'analyzed_at', '')::timestamptz, target_row.analyzed_at),
            analysis_status = coalesce(payload->>'analysis_status', target_row.analysis_status),
            analysis_request_id = coalesce(nullif(payload->>'analysis_request_id', '')::uuid, target_row.analysis_request_id),
            exploration_started_at = coalesce(nullif(payload->>'exploration_started_at', '')::timestamptz, target_row.exploration_started_at),
            has_person = coalesce((payload->>'has_person')::boolean, target_row.has_person),
            has_animal = coalesce((payload->>'has_animal')::boolean, target_row.has_animal),
            memory = coalesce(payload->'memory', target_row.memory),
            analysis_details = coalesce(payload->'analysis_details', target_row.analysis_details),
            client_updated_at = coalesce(nullif(payload->>'client_updated_at', '')::timestamptz, now())
          where id = target_remote_id
            and user_id = current_user_id
          returning * into saved_row;

          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'dream', public.serialize_dream_for_sync(saved_row),
            'remote_id', saved_row.id
          );
        end if;
      end if;
    elsif mutation_operation = 'delete' then
      target_remote_id := nullif(payload->>'remote_id', '')::bigint;

      if target_remote_id is null then
        result_entry := jsonb_build_object(
          'mutation_id', mutation_id,
          'client_request_id', mutation_client_request_id,
          'operation', mutation_operation,
          'status', 'failed',
          'error', 'Missing remote dream id for delete'
        );
      else
        select *
        into target_row
        from public.dreams
        where id = target_remote_id
          and user_id = current_user_id;

        if not found then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'remote_id', target_remote_id
          );
        elsif mutation_base_revision is not null and target_row.revision_id::text <> mutation_base_revision then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'conflict',
            'remote_id', target_row.id,
            'dream', public.serialize_dream_for_sync(target_row),
            'error', 'Dream revision conflict'
          );
        else
          delete from public.dreams
          where id = target_remote_id
            and user_id = current_user_id;

          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'remote_id', target_remote_id
          );
        end if;
      end if;
    else
      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', mutation_client_request_id,
        'operation', mutation_operation,
        'status', 'failed',
        'error', 'Unsupported mutation operation'
      );
    end if;

    insert into public.dream_sync_receipts (
      user_id,
      client_request_id,
      entity_type,
      entity_key,
      operation,
      mutation_status,
      dream_id,
      response
    )
    values (
      current_user_id,
      mutation_client_request_id,
      'dream',
      mutation_entity_key,
      mutation_operation,
      coalesce(result_entry->>'status', 'failed'),
      coalesce((result_entry->>'remote_id')::bigint, null),
      result_entry
    )
    on conflict (user_id, client_request_id) do nothing;

    response := response || jsonb_build_array(result_entry);
  end loop;

  return response;
end;
$$;

-- Source: 20260316154500_harden_subscription_state_rpcs.sql
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
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  if p_user_id is null then
    return 'free';
  end if;

  if caller_role = 'authenticated' and caller_user_id is distinct from p_user_id then
    raise exception using errcode = '42501',
      message = 'Cannot read another user''s subscription tier';
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

-- Source: 20260722130000_add_authenticated_quota_snapshot.sql
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
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
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

-- Source: 20260722134500_add_idempotent_chat_turns.sql
create or replace function public.begin_authenticated_chat_turn(
  p_dream_id bigint,
  p_request_id uuid,
  p_user_message jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  dream_row public.dreams%rowtype;
  existing_turn public.dream_chat_turns%rowtype;
  tier_value text;
  message_limit integer;
  exploration_limit integer;
  user_message_count integer := 0;
  exploration_count integer := 0;
  period_start timestamptz;
  period_end timestamptz;
  reserved_explorations integer := 0;
  active_turn_count integer := 0;
  active_turn_limit integer := 2;
  current_attempt_count integer := 1;
  next_history jsonb;
  normalized_history jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_dream_id is null or p_request_id is null then
    raise exception 'chat turn identity is required';
  end if;
  if p_user_message is null
     or jsonb_typeof(p_user_message) <> 'object'
     or p_user_message ->> 'role' <> 'user'
     or btrim(coalesce(p_user_message ->> 'text', '')) = ''
     or length(p_user_message ->> 'text') > 4000
     or pg_column_size(p_user_message) > 16384 then
    raise exception 'invalid user chat message';
  end if;

  -- Serialize admissions per authenticated actor so the active-turn cap and
  -- stale-lease cleanup remain exact across different dreams.
  perform pg_advisory_xact_lock(
    hashtextextended(format('chat_actor:%s', current_user_id::text), 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(format('chat_turn:%s:%s', current_user_id::text, p_dream_id::text), 0)
  );

  select *
  into dream_row
  from public.dreams d
  where d.id = p_dream_id
    and d.user_id = current_user_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'DREAM_NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(m.message order by m.created_at, m.id), '[]'::jsonb)
  into normalized_history
  from public.dream_chat_messages m
  where m.dream_id = p_dream_id
    and m.user_id = current_user_id;

  -- Provider calls are expected to finish well inside this lease. Releasing a
  -- stale row lets the user recover while the attempt token below prevents a
  -- late response from overwriting the replacement attempt.
  update public.dream_chat_turns
  set
    status = 'failed',
    error_code = 'CHAT_TURN_LEASE_EXPIRED',
    updated_at = now(),
    finished_at = now()
  where user_id = current_user_id
    and status = 'pending'
    and updated_at <= now() - interval '3 minutes';

  select *
  into existing_turn
  from public.dream_chat_turns t
  where t.dream_id = p_dream_id
    and t.request_id = p_request_id
    and t.user_id = current_user_id
  for update;

  if found and existing_turn.status = 'succeeded' then
    return jsonb_build_object(
      'allowed', true,
      'duplicate', true,
      'completed', true,
      'modelMessage', existing_turn.model_message,
      'history', normalized_history,
      'dream', jsonb_build_object(
        'id', dream_row.id,
        'transcript', dream_row.transcript,
        'title', dream_row.title,
        'interpretation', dream_row.interpretation,
        'shareable_quote', dream_row.shareable_quote,
        'dream_type', dream_row.dream_type,
        'theme', dream_row.theme
      )
    );
  end if;

  if found
     and existing_turn.status = 'pending'
     and existing_turn.updated_at > now() - interval '3 minutes' then
    return jsonb_build_object(
      'allowed', false,
      'code', 'CHAT_TURN_IN_PROGRESS',
      'retry_after_seconds', 5
    );
  end if;

  tier_value := public.get_effective_subscription_tier(current_user_id);
  if tier_value not in ('free', 'plus', 'premium') then
    tier_value := 'free';
  end if;

  if found then
    if exists (
      select 1
      from public.dream_chat_turns t
      where t.dream_id = p_dream_id
        and t.user_id = current_user_id
        and t.request_id <> p_request_id
        and t.status = 'pending'
    ) then
      return jsonb_build_object(
        'allowed', false,
        'code', 'CHAT_DREAM_BUSY',
        'retry_after_seconds', 5
      );
    end if;

    active_turn_limit := case when tier_value in ('plus', 'premium') then 4 else 2 end;
    select count(*)::integer
    into active_turn_count
    from public.dream_chat_turns t
    where t.user_id = current_user_id
      and t.status = 'pending';

    if active_turn_count >= active_turn_limit then
      return jsonb_build_object(
        'allowed', false,
        'code', 'CHAT_ACTOR_CONCURRENCY_LIMIT',
        'retry_after_seconds', 10
      );
    end if;

    if existing_turn.attempt_count >= 10 then
      return jsonb_build_object(
        'allowed', false,
        'code', 'CHAT_TURN_ATTEMPTS_EXHAUSTED'
      );
    end if;

    update public.dream_chat_turns
    set
      status = 'pending',
      error_code = null,
      attempt_count = attempt_count + 1,
      started_at = now(),
      updated_at = now(),
      finished_at = null
    where dream_id = p_dream_id
      and request_id = p_request_id
    returning attempt_count into current_attempt_count;

    return jsonb_build_object(
      'allowed', true,
      'duplicate', true,
      'completed', false,
      'attemptCount', current_attempt_count,
      'history', normalized_history,
      'dream', jsonb_build_object(
        'id', dream_row.id,
        'transcript', dream_row.transcript,
        'title', dream_row.title,
        'interpretation', dream_row.interpretation,
        'shareable_quote', dream_row.shareable_quote,
        'dream_type', dream_row.dream_type,
        'theme', dream_row.theme
      )
    );
  end if;

  if exists (
    select 1
    from public.dream_chat_turns t
    where t.dream_id = p_dream_id
      and t.user_id = current_user_id
      and t.status = 'pending'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'CHAT_DREAM_BUSY',
      'retry_after_seconds', 5
    );
  end if;

  active_turn_limit := case when tier_value in ('plus', 'premium') then 4 else 2 end;
  select count(*)::integer
  into active_turn_count
  from public.dream_chat_turns t
  where t.user_id = current_user_id
    and t.status = 'pending';

  if active_turn_count >= active_turn_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'CHAT_ACTOR_CONCURRENCY_LIMIT',
      'retry_after_seconds', 10
    );
  end if;

  select q.quota_limit
  into message_limit
  from public.quota_limits q
  where q.tier = tier_value
    and q.period = 'monthly'
    and q.quota_type = 'messages_per_dream';
  if not found then
    message_limit := case when tier_value in ('plus', 'premium') then null else 20 end;
  end if;

  select count(*)::integer
  into user_message_count
  from public.dream_chat_messages m
  where m.dream_id = p_dream_id
    and m.user_id = current_user_id
    and m.role = 'user';

  if message_limit is not null and user_message_count >= message_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'QUOTA_MESSAGE_LIMIT_REACHED',
      'used', user_message_count,
      'limit', message_limit
    );
  end if;

  if dream_row.exploration_started_at is null then
    period_start := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
    period_end := (date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc';
    perform pg_advisory_xact_lock(
      hashtextextended(
        format('quota:exploration:%s:%s', current_user_id::text, to_char(period_start, 'YYYY-MM')),
        0
      )
    );

    select q.quota_limit
    into exploration_limit
    from public.quota_limits q
    where q.tier = tier_value
      and q.period = 'monthly'
      and q.quota_type = 'exploration';
    if not found then
      exploration_limit := case when tier_value in ('plus', 'premium') then null else 2 end;
    end if;

    if exploration_limit is not null then
      select count(*)::integer
      into exploration_count
      from public.quota_usage q
      where q.user_id = current_user_id
        and q.quota_type = 'exploration'
        and q.occurred_at >= period_start
        and q.occurred_at < period_end;

      select count(distinct t.dream_id)::integer
      into reserved_explorations
      from public.dream_chat_turns t
      join public.dreams d on d.id = t.dream_id
      where t.user_id = current_user_id
        and t.status = 'pending'
        and d.exploration_started_at is null;

      if exploration_count + reserved_explorations >= exploration_limit then
        return jsonb_build_object(
          'allowed', false,
          'code', 'QUOTA_EXPLORATION_LIMIT_REACHED',
          'used', exploration_count + reserved_explorations,
          'limit', exploration_limit
        );
      end if;
    end if;
  end if;

  next_history := normalized_history || jsonb_build_array(p_user_message);
  update public.dreams
  set chat_history = next_history
  where id = p_dream_id
    and user_id = current_user_id;

  insert into public.dream_chat_turns (
    dream_id,
    user_id,
    request_id,
    status,
    user_message
  ) values (
    p_dream_id,
    current_user_id,
    p_request_id,
    'pending',
    p_user_message
  );

  insert into public.dream_chat_messages (
    dream_id,
    user_id,
    request_id,
    role,
    message
  ) values (
    p_dream_id,
    current_user_id,
    p_request_id,
    'user',
    p_user_message
  );

  normalized_history := normalized_history || jsonb_build_array(p_user_message);

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'completed', false,
    'attemptCount', current_attempt_count,
    'history', normalized_history,
    'dream', jsonb_build_object(
      'id', dream_row.id,
      'transcript', dream_row.transcript,
      'title', dream_row.title,
      'interpretation', dream_row.interpretation,
      'shareable_quote', dream_row.shareable_quote,
      'dream_type', dream_row.dream_type,
      'theme', dream_row.theme
    )
  );
end;
$$;

-- Source: 20260722134500_add_idempotent_chat_turns.sql
create or replace function public.complete_authenticated_chat_turn(
  p_dream_id bigint,
  p_request_id uuid,
  p_attempt_count integer,
  p_model_message jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  dream_row public.dreams%rowtype;
  turn_row public.dream_chat_turns%rowtype;
  next_history jsonb;
  normalized_history jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_attempt_count is null or p_attempt_count not between 1 and 10 then
    raise exception 'invalid chat attempt';
  end if;
  if p_model_message is null
     or jsonb_typeof(p_model_message) <> 'object'
     or p_model_message ->> 'role' <> 'model'
     or btrim(coalesce(p_model_message ->> 'text', '')) = ''
     or length(p_model_message ->> 'text') > 16000
     or pg_column_size(p_model_message) > 65536 then
    raise exception 'invalid model chat message';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(format('chat_turn:%s:%s', current_user_id::text, p_dream_id::text), 0)
  );

  select *
  into turn_row
  from public.dream_chat_turns t
  where t.dream_id = p_dream_id
    and t.request_id = p_request_id
    and t.user_id = current_user_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'code', 'CHAT_TURN_NOT_FOUND');
  end if;
  if turn_row.status = 'succeeded' then
    return jsonb_build_object(
      'completed', true,
      'duplicate', true,
      'modelMessage', turn_row.model_message
    );
  end if;
  if turn_row.status <> 'pending' then
    return jsonb_build_object('completed', false, 'code', 'CHAT_TURN_NOT_PENDING');
  end if;
  if turn_row.attempt_count <> p_attempt_count then
    return jsonb_build_object('completed', false, 'code', 'CHAT_TURN_LEASE_LOST');
  end if;

  select *
  into dream_row
  from public.dreams d
  where d.id = p_dream_id
    and d.user_id = current_user_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'code', 'DREAM_NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(m.message order by m.created_at, m.id), '[]'::jsonb)
  into normalized_history
  from public.dream_chat_messages m
  where m.dream_id = p_dream_id
    and m.user_id = current_user_id;

  next_history := normalized_history || jsonb_build_array(p_model_message);
  update public.dreams
  set chat_history = next_history
  where id = p_dream_id
    and user_id = current_user_id;

  insert into public.dream_chat_messages (
    dream_id,
    user_id,
    request_id,
    role,
    message
  ) values (
    p_dream_id,
    current_user_id,
    p_request_id,
    'model',
    p_model_message
  )
  on conflict (dream_id, request_id, role) do nothing;

  update public.dream_chat_turns
  set
    status = 'succeeded',
    model_message = p_model_message,
    error_code = null,
    updated_at = now(),
    finished_at = now()
  where dream_id = p_dream_id
    and request_id = p_request_id;

  return jsonb_build_object(
    'completed', true,
    'duplicate', false,
    'modelMessage', p_model_message,
    'history', next_history
  );
end;
$$;

-- Source: 20260722134500_add_idempotent_chat_turns.sql
create or replace function public.fail_authenticated_chat_turn(
  p_dream_id bigint,
  p_request_id uuid,
  p_attempt_count integer,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_attempt_count is null or p_attempt_count not between 1 and 10 then
    raise exception 'invalid chat attempt';
  end if;

  update public.dream_chat_turns
  set
    status = 'failed',
    error_code = left(coalesce(p_error_code, 'CHAT_PROVIDER_FAILED'), 128),
    updated_at = now(),
    finished_at = now()
  where dream_id = p_dream_id
    and request_id = p_request_id
    and user_id = current_user_id
    and status = 'pending'
    and attempt_count = p_attempt_count;

  return found;
end;
$$;

-- Source: 20260813010000_lucid_trainer_sync.sql
create or replace function public.sync_lucid_trainer_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  mutation jsonb;
  stored public.lucid_trainer_entities%rowtype;
  receipt jsonb;
  result jsonb;
  mutation_id text;
  request_id uuid;
  requested_type text;
  requested_key text;
  requested_operation text;
  requested_base_revision bigint;
  requested_reset_revision bigint;
  requested_updated_at timestamptz;
  requested_entity jsonb;
  next_revision bigint;
  active_reset_revision bigint;
  active_reset_at timestamptz;
  results jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'lucid') then
    raise exception 'Application scope does not allow lucid access' using errcode = '42501';
  end if;
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  if jsonb_typeof(mutations) <> 'array' or jsonb_array_length(mutations) > 100 then
    raise exception 'Invalid Lucid Trainer mutation batch' using errcode = '22023';
  end if;

  for mutation in select value from jsonb_array_elements(mutations)
  loop
    begin
      mutation_id := mutation->>'mutation_id';
      request_id := (mutation->>'client_request_id')::uuid;
      requested_type := mutation->>'entity_type';
      requested_key := mutation->>'entity_key';
      requested_operation := mutation->>'operation';
      requested_updated_at := (mutation->>'client_updated_at')::timestamptz;
      requested_entity := mutation#>'{payload,entity}';
      requested_base_revision := case
        when mutation->>'base_revision' is null then null
        else (mutation->>'base_revision')::bigint
      end;
      requested_reset_revision := case
        when mutation->>'reset_revision' is null then null
        else (mutation->>'reset_revision')::bigint
      end;

      if mutation_id is null or char_length(mutation_id) not between 1 and 256
        or requested_type not in ('onboarding', 'preferences', 'progress', 'experiment', 'reality_check', 'weekly_review', 'dream_sign', 'dream_atlas')
        or requested_key is null or char_length(requested_key) not between 1 and 256
        or requested_operation not in ('upsert', 'delete') then
        raise exception 'Invalid Lucid Trainer mutation';
      end if;

      select r.result into receipt
      from public.lucid_trainer_sync_receipts r
      where r.user_id = current_user_id and r.client_request_id = request_id;
      if receipt is not null then
        results := results || jsonb_build_array(receipt);
        continue;
      end if;

      -- The reset generation changes only when full Lucid data is deleted and
      -- remains available after singleton entities have been recreated.
      select f.generation, f.deleted_at
      into active_reset_revision, active_reset_at
      from public.lucid_trainer_reset_fences f
      where f.user_id = current_user_id;

      if active_reset_at is not null
        and requested_reset_revision is distinct from active_reset_revision then
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'conflict',
          'remote_revision', active_reset_revision::text,
          'error', 'remote_reset_required'
        );
        results := results || jsonb_build_array(result);
        continue;
      end if;

      select * into stored
      from public.lucid_trainer_entities e
      where e.user_id = current_user_id
        and e.entity_type = requested_type
        and e.entity_key = requested_key
      for update;

      if found and (
        requested_base_revision is null
        or requested_base_revision <> stored.revision
      ) then
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'conflict',
          'remote_revision', stored.revision::text,
          'error', 'revision_conflict'
        ) || case when stored.deleted_at is null then jsonb_build_object(
          'remote_entity', jsonb_build_object(
            'entityType', stored.entity_type,
            'entityKey', stored.entity_key,
            'value', stored.value
          )
        ) else '{}'::jsonb end;
      elsif requested_operation = 'upsert' then
        if requested_entity is null
          or requested_entity->>'entityType' <> requested_type
          or requested_entity->>'entityKey' <> requested_key
          or requested_entity->'value' is null then
          raise exception 'Invalid Lucid Trainer entity payload';
        end if;
        next_revision := case when stored.user_id is null then 1 else stored.revision + 1 end;
        insert into public.lucid_trainer_entities (
          user_id, entity_type, entity_key, revision, value, client_updated_at, deleted_at, updated_at
        ) values (
          current_user_id, requested_type, requested_key, next_revision,
          requested_entity->'value', requested_updated_at, null, now()
        )
        on conflict (user_id, entity_type, entity_key) do update set
          revision = excluded.revision,
          value = excluded.value,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null,
          updated_at = now();
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'ack',
          'remote_revision', next_revision::text,
          'remote_entity', jsonb_build_object(
            'entityType', requested_type,
            'entityKey', requested_key,
            'value', requested_entity->'value'
          )
        );
      else
        next_revision := case when stored.user_id is null then 1 else stored.revision + 1 end;
        insert into public.lucid_trainer_entities (
          user_id, entity_type, entity_key, revision, value, client_updated_at, deleted_at, updated_at
        ) values (
          current_user_id, requested_type, requested_key, next_revision,
          null, requested_updated_at, requested_updated_at, now()
        )
        on conflict (user_id, entity_type, entity_key) do update set
          revision = excluded.revision,
          value = null,
          client_updated_at = excluded.client_updated_at,
          deleted_at = excluded.deleted_at,
          updated_at = now();
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'ack',
          'remote_revision', next_revision::text
        );
      end if;

      insert into public.lucid_trainer_sync_receipts (
        user_id, client_request_id, mutation_id, result
      ) values (current_user_id, request_id, mutation_id, result)
      on conflict (user_id, client_request_id) do nothing;
      results := results || jsonb_build_array(result);
    exception when others then
      result := jsonb_build_object(
        'mutation_id', coalesce(mutation_id, mutation->>'mutation_id', 'invalid'),
        'status', 'failed',
        'error', left(sqlerrm, 500)
      );
      results := results || jsonb_build_array(result);
    end;
  end loop;

  return results;
end;
$$;

-- Source: 20260813010000_lucid_trainer_sync.sql
create or replace function public.get_lucid_trainer_entities()
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'entities', coalesce((
      select jsonb_agg(rows.payload order by rows.entity_type, rows.entity_key)
      from (
        select
          e.entity_type,
          e.entity_key,
          case when e.deleted_at is null then jsonb_build_object(
            'entity_type', e.entity_type,
            'entity_key', e.entity_key,
            'revision', e.revision::text,
            'client_updated_at', e.client_updated_at,
            'entity', jsonb_build_object(
              'entityType', e.entity_type,
              'entityKey', e.entity_key,
              'value', e.value
            )
          ) else jsonb_build_object(
            'entity_type', e.entity_type,
            'entity_key', e.entity_key,
            'revision', e.revision::text,
            'client_updated_at', e.client_updated_at,
            'deleted_at', e.deleted_at
          ) end as payload
        from public.lucid_trainer_entities e
        where e.user_id = (select auth.uid())
      ) as rows
    ), '[]'::jsonb)
  ) || coalesce((
    select jsonb_build_object(
      'reset_revision', f.generation::text,
      'reset_at', f.deleted_at
    )
    from public.lucid_trainer_reset_fences f
    where f.user_id = (select auth.uid())
  ), '{}'::jsonb);
$$;

-- Source: 20260813010000_lucid_trainer_sync.sql
create or replace function public.delete_lucid_trainer_data()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deletion_timestamp timestamptz := clock_timestamp();
  reset_generation bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'lucid') then
    raise exception 'Application scope does not allow lucid access' using errcode = '42501';
  end if;
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  delete from public.lucid_trainer_sync_receipts where user_id = current_user_id;

  insert into public.lucid_trainer_reset_fences (user_id, generation, deleted_at)
  values (current_user_id, 1, deletion_timestamp)
  on conflict (user_id) do update set
    generation = public.lucid_trainer_reset_fences.generation + 1,
    deleted_at = excluded.deleted_at
  returning generation into reset_generation;

  update public.lucid_trainer_entities
  set
    revision = revision + 1,
    value = null,
    client_updated_at = deletion_timestamp,
    deleted_at = deletion_timestamp,
    updated_at = deletion_timestamp
  where user_id = current_user_id;

  -- Singleton tombstones reset local state immediately. The separate reset
  -- fence remains durable if these rows are later recreated.
  insert into public.lucid_trainer_entities (
    user_id,
    entity_type,
    entity_key,
    revision,
    value,
    client_updated_at,
    deleted_at,
    updated_at
  ) values
    (
      current_user_id,
      'onboarding',
      'onboarding',
      reset_generation,
      null,
      deletion_timestamp,
      deletion_timestamp,
      deletion_timestamp
    ),
    (
      current_user_id,
      'preferences',
      'preferences',
      reset_generation,
      null,
      deletion_timestamp,
      deletion_timestamp,
      deletion_timestamp
    )
  on conflict (user_id, entity_type, entity_key) do nothing;
  return true;
end;
$$;
