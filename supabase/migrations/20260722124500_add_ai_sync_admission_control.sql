-- Race-free, privacy-preserving burst budgets for synchronous paid AI routes.
-- The Edge Function hashes the authenticated user id or verified guest
-- fingerprint before calling this service-role-only RPC, so raw actor
-- identifiers are never persisted in the rate-limit table.

create table if not exists public.ai_rate_limit_buckets (
  actor_hash text not null,
  capability text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint ai_rate_limit_buckets_pk
    primary key (actor_hash, capability, window_started_at),
  constraint ai_rate_limit_buckets_actor_hash_check
    check (actor_hash = 'global' or actor_hash ~ '^[a-f0-9]{64}$'),
  constraint ai_rate_limit_buckets_capability_check
    check (capability ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint ai_rate_limit_buckets_request_count_check
    check (request_count >= 0)
);

create index if not exists ai_rate_limit_buckets_window_idx
  on public.ai_rate_limit_buckets (window_started_at);

alter table public.ai_rate_limit_buckets enable row level security;

revoke all on table public.ai_rate_limit_buckets
  from public, anon, authenticated;

create or replace function public.claim_ai_request_window(
  p_actor_hash text,
  p_capability text,
  p_window_seconds integer,
  p_actor_limit integer,
  p_global_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  claim_time timestamptz := clock_timestamp();
  window_start timestamptz;
  window_end timestamptz;
  actor_count integer := 0;
  global_count integer := 0;
  retry_after_seconds integer;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'claim_ai_request_window requires service role access';
  end if;

  if p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid actor hash';
  end if;
  if p_capability is null or p_capability !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'invalid AI capability';
  end if;
  if p_window_seconds not between 10 and 86400
     or p_actor_limit not between 1 and 10000
     or p_global_limit not between 1 and 100000 then
    raise exception 'invalid AI request policy';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from claim_time) / p_window_seconds) * p_window_seconds
  );
  window_end := window_start + make_interval(secs => p_window_seconds);
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from window_end - claim_time))::integer
  );

  -- Every claim takes locks in the same global-then-actor order. This keeps
  -- actor and global counters exact even when several Edge instances race.
  perform pg_advisory_xact_lock(
    hashtextextended('ai_rate:global:' || p_capability || ':' || window_start::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(
      'ai_rate:actor:' || p_actor_hash || ':' || p_capability || ':' || window_start::text,
      0
    )
  );

  select b.request_count
  into global_count
  from public.ai_rate_limit_buckets b
  where b.actor_hash = 'global'
    and b.capability = p_capability
    and b.window_started_at = window_start;
  global_count := coalesce(global_count, 0);

  if global_count >= p_global_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_GLOBAL_RATE_LIMIT',
      'retry_after_seconds', retry_after_seconds,
      'actor_count', null,
      'global_count', global_count
    );
  end if;

  select b.request_count
  into actor_count
  from public.ai_rate_limit_buckets b
  where b.actor_hash = p_actor_hash
    and b.capability = p_capability
    and b.window_started_at = window_start;
  actor_count := coalesce(actor_count, 0);

  if actor_count >= p_actor_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_ACTOR_RATE_LIMIT',
      'retry_after_seconds', retry_after_seconds,
      'actor_count', actor_count,
      'global_count', global_count
    );
  end if;

  insert into public.ai_rate_limit_buckets (
    actor_hash,
    capability,
    window_started_at,
    request_count,
    updated_at
  ) values (
    'global',
    p_capability,
    window_start,
    1,
    claim_time
  )
  on conflict (actor_hash, capability, window_started_at)
  do update set
    request_count = public.ai_rate_limit_buckets.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into global_count;

  insert into public.ai_rate_limit_buckets (
    actor_hash,
    capability,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_actor_hash,
    p_capability,
    window_start,
    1,
    claim_time
  )
  on conflict (actor_hash, capability, window_started_at)
  do update set
    request_count = public.ai_rate_limit_buckets.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into actor_count;

  -- Opportunistic bounded retention without storing any raw identity.
  if random() < 0.01 then
    delete from public.ai_rate_limit_buckets
    where window_started_at < claim_time - interval '7 days';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'ADMITTED',
    'retry_after_seconds', retry_after_seconds,
    'actor_count', actor_count,
    'global_count', global_count
  );
end;
$$;

revoke all on function public.claim_ai_request_window(text, text, integer, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_ai_request_window(text, text, integer, integer, integer)
  to service_role;

comment on table public.ai_rate_limit_buckets is
  'Short-lived hashed counters for synchronous paid AI admission; contains no raw user or guest identifier.';

comment on function public.claim_ai_request_window(text, text, integer, integer, integer) is
  'Atomically enforces per-actor and global fixed-window AI request budgets.';
