-- Normalize new authenticated chat turns while retaining dreams.chat_history as
-- a compatibility projection for existing clients and sync code.

create table if not exists public.dream_chat_turns (
  dream_id bigint not null references public.dreams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  user_message jsonb not null,
  model_message jsonb,
  error_code text,
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (dream_id, request_id)
);

create table if not exists public.dream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  dream_id bigint not null references public.dreams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user', 'model')),
  message jsonb not null,
  legacy_ordinal bigint,
  created_at timestamptz not null default now(),
  unique (dream_id, request_id, role)
);

create index if not exists dream_chat_messages_dream_created_idx
  on public.dream_chat_messages (dream_id, created_at desc);

create unique index if not exists dream_chat_turns_one_pending_per_dream_idx
  on public.dream_chat_turns (dream_id)
  where status = 'pending';

create index if not exists dream_chat_turns_user_status_updated_idx
  on public.dream_chat_turns (user_id, status, updated_at);

create unique index if not exists dream_chat_messages_legacy_ordinal_idx
  on public.dream_chat_messages (dream_id, legacy_ordinal)
  where legacy_ordinal is not null;

-- One-time compatibility backfill. New requests always use request_id pairs;
-- historical JSON messages receive independent request ids because legacy data
-- did not retain a turn identifier.
insert into public.dream_chat_messages (
  dream_id,
  user_id,
  request_id,
  role,
  message,
  legacy_ordinal,
  created_at
)
select
  d.id,
  d.user_id,
  gen_random_uuid(),
  message.value ->> 'role',
  message.value,
  message.ordinality,
  coalesce(d.created_at, now()) + make_interval(secs => message.ordinality::double precision / 1000.0)
from public.dreams d
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(coalesce(d.chat_history, '[]'::jsonb)) = 'array'
      then coalesce(d.chat_history, '[]'::jsonb)
    else '[]'::jsonb
  end
) with ordinality as message(value, ordinality)
where d.user_id is not null
  and message.value ->> 'role' in ('user', 'model')
  and btrim(coalesce(message.value ->> 'text', '')) <> ''
on conflict (dream_id, legacy_ordinal) where legacy_ordinal is not null do nothing;

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
  from public.dream_chat_messages m
  where m.dream_id = p_dream_id
    and m.user_id = p_user_id
    and m.role = 'user'
$$;

comment on function public.get_authenticated_chat_message_count(uuid, bigint) is
  'Internal quota helper backed by normalized append-only authenticated chat messages.';

alter table public.dream_chat_turns enable row level security;
alter table public.dream_chat_messages enable row level security;

revoke all on table public.dream_chat_turns from public, anon, authenticated;
revoke all on table public.dream_chat_messages from public, anon, authenticated;

comment on table public.dream_chat_turns is
  'Authenticated idempotent chat command state. Access is restricted to security-definer RPCs scoped by auth.uid().';
comment on table public.dream_chat_messages is
  'Append-only normalized authenticated chat messages. dreams.chat_history remains a temporary compatibility projection.';

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

revoke all on function public.begin_authenticated_chat_turn(bigint, uuid, jsonb)
  from public, anon;
revoke all on function public.complete_authenticated_chat_turn(bigint, uuid, integer, jsonb)
  from public, anon;
revoke all on function public.fail_authenticated_chat_turn(bigint, uuid, integer, text)
  from public, anon;

grant execute on function public.begin_authenticated_chat_turn(bigint, uuid, jsonb)
  to authenticated;
grant execute on function public.complete_authenticated_chat_turn(bigint, uuid, integer, jsonb)
  to authenticated;
grant execute on function public.fail_authenticated_chat_turn(bigint, uuid, integer, text)
  to authenticated;
