-- At most two transport replays share admission in the original fixed window.
-- Keep the receipt across Edge instances and claim both budgets atomically.
create table private.ai_analysis_admissions (
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  capability text not null check (capability in ('analyze_dream', 'analyze_dream_full')),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  replay_count integer not null default 0 check (replay_count between 0 and 2),
  admitted_at timestamptz not null default now(),
  daily_admitted boolean not null default false,
  primary key (actor_hash, capability, request_hash)
);
create index ai_analysis_admissions_retention_idx on private.ai_analysis_admissions(admitted_at);
alter table private.ai_analysis_admissions enable row level security;
revoke all on table private.ai_analysis_admissions from public, anon, authenticated;

create or replace function public.claim_ai_analysis_admission(
  p_actor_hash text, p_capability text, p_request_id uuid,
  p_window_seconds integer, p_actor_limit integer, p_global_limit integer,
  p_daily_limit integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  claim jsonb;
  receipt private.ai_analysis_admissions%rowtype;
  v_request_hash text;
  claim_time timestamptz := clock_timestamp();
  window_start timestamptz;
begin
  if coalesce(auth.jwt()->>'role', '') not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'claim_ai_analysis_admission requires service role access';
  end if;
  if p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$'
    or p_capability is null or p_capability not in ('analyze_dream','analyze_dream_full')
    or p_request_id is null or p_daily_limit is null then
    raise exception 'invalid analysis admission';
  end if;
  if p_window_seconds is null or p_window_seconds not between 10 and 86400
    or p_actor_limit is null or p_actor_limit not between 1 and 10000
    or p_global_limit is null or p_global_limit not between 1 and 100000
    or p_daily_limit not between 1 and 10000 then
    raise exception 'invalid analysis admission policy';
  end if;
  v_request_hash := encode(sha256(convert_to(p_request_id::text, 'UTF8')), 'hex');
  window_start := to_timestamp(floor(extract(epoch from claim_time) / p_window_seconds) * p_window_seconds);
  perform pg_advisory_xact_lock(hashtextextended('ai_analysis:' || p_actor_hash || ':' || p_capability || ':' || v_request_hash, 0));
  -- Indexed opportunistic retention also runs on rejected requests.
  delete from private.ai_analysis_admissions where admitted_at < claim_time - interval '7 days';
  select a.* into receipt from private.ai_analysis_admissions a
    where a.actor_hash = p_actor_hash and a.capability = p_capability and a.request_hash = v_request_hash;
  if found and receipt.admitted_at >= window_start and receipt.admitted_at <= claim_time and receipt.replay_count < 2 then
    update private.ai_analysis_admissions a set replay_count = a.replay_count + 1
      where a.actor_hash = p_actor_hash and a.capability = p_capability and a.request_hash = v_request_hash;
    if receipt.daily_admitted then
      return jsonb_build_object('allowed', true, 'code', 'ALREADY_ADMITTED');
    end if;
  else
    -- Exhausted, expired or refunded receipts count as a new attempt, including
    -- when a later quota or provider failure refunds the product allowance.
    claim := public.claim_ai_request_window(p_actor_hash, p_capability, p_window_seconds, p_actor_limit, p_global_limit);
    if (claim->>'allowed')::boolean is distinct from true then return claim; end if;
    insert into private.ai_analysis_admissions as a(actor_hash, capability, request_hash, admitted_at)
      values (p_actor_hash, p_capability, v_request_hash, claim_time)
      on conflict (actor_hash, capability, request_hash) do update
        set admitted_at = excluded.admitted_at, replay_count = 0, daily_admitted = false;
  end if;
  claim := public.claim_ai_daily_budget(p_actor_hash, p_capability, p_daily_limit);
  if (claim->>'allowed')::boolean is distinct from true then return claim; end if;
  update private.ai_analysis_admissions set daily_admitted = true
    where actor_hash = p_actor_hash and capability = p_capability and ai_analysis_admissions.request_hash = v_request_hash;
  return claim;
end;
$$;
revoke all on function public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer) to service_role;
