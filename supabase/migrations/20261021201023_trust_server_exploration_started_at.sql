-- A sync payload or a direct authenticated dreams write can supply an old
-- exploration_started_at and move the charge out of the current UTC month.
-- Preserve already-stored history, but only a server-completed model turn may
-- mint a new marker. Historical imported chat remains visible and is charged
-- when the first new authenticated model reply is committed.

create or replace function public.set_exploration_started_at_from_chat_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
begin
  -- Trusted service operations and migrations may preserve historical values.
  -- The completion RPC below still gets server time when its model row appears.
  if caller_role in ('service_role', 'supabase_admin') or (select auth.uid()) is null then
    if new.exploration_started_at is null
       and tg_op = 'UPDATE'
       and exists (
         select 1 from public.dream_chat_messages m
         where m.dream_id = new.id
           and m.user_id = new.user_id
           and m.role = 'model'
           and m.legacy_ordinal is null
       ) then
      new.exploration_started_at := now();
    end if;
    return new;
  end if;

  -- Client writes cannot create, erase, or backdate the quota marker.
  if tg_op = 'INSERT' then
    new.exploration_started_at := null;
  else
    new.exploration_started_at := old.exploration_started_at;
  end if;
  return new;
end;
$$;

-- Fire on direct Data API mutations and sync upserts, including updates that
-- mention only exploration_started_at. This runs before quota enforcement.
drop trigger if exists trg_00_set_exploration_started_at_from_chat_history on public.dreams;
create trigger trg_00_set_exploration_started_at_from_chat_history
  before insert or update on public.dreams
  for each row
  execute function public.set_exploration_started_at_from_chat_history();

-- The API now completes provider responses through this service-only RPC.
-- The old four-argument overload let an authenticated client self-attest a
-- fabricated model response, so removing its grant is part of the boundary.
create or replace function public.complete_authenticated_chat_turn(
  p_user_id uuid,
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
  current_user_id uuid := p_user_id;
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  dream_row public.dreams%rowtype;
  turn_row public.dream_chat_turns%rowtype;
  next_history jsonb;
  normalized_history jsonb := '[]'::jsonb;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'Chat completion requires service role access' using errcode = '42501';
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
  -- The append-only model receipt must exist before the dreams trigger can
  -- mint the first trusted exploration timestamp. Both writes are atomic.
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

  update public.dreams
  set chat_history = next_history
  where id = p_dream_id
    and user_id = current_user_id;

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

revoke all on function public.complete_authenticated_chat_turn(uuid, bigint, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_authenticated_chat_turn(uuid, bigint, uuid, integer, jsonb)
  to service_role;
drop function public.complete_authenticated_chat_turn(bigint, uuid, integer, jsonb);

-- This trigger function runs as its owner; clients cannot invoke it directly.
revoke all on function public.set_exploration_started_at_from_chat_history()
  from public, anon, authenticated;
grant execute on function public.set_exploration_started_at_from_chat_history()
  to service_role;
