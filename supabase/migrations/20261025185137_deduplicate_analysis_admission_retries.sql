-- A transport replay is the same analysis, not another anti-abuse attempt.
-- Keep the receipt across Edge instances and claim both budgets atomically.
create table private.ai_analysis_admissions (
  actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
  capability text not null check (capability in ('analyze_dream', 'analyze_dream_full')),
  request_id uuid not null,
  admitted_at timestamptz not null default now(),
  daily_admitted boolean not null default false,
  primary key (actor_hash, capability, request_id)
);
alter table private.ai_analysis_admissions enable row level security;
revoke all on table private.ai_analysis_admissions from public, anon, authenticated;

create or replace function public.claim_ai_analysis_admission(
  p_actor_hash text, p_capability text, p_request_id uuid,
  p_window_seconds integer, p_actor_limit integer, p_global_limit integer,
  p_daily_limit integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  claim jsonb;
begin
  if coalesce(auth.jwt()->>'role', '') not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'claim_ai_analysis_admission requires service role access';
  end if;
  if p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$'
    or p_capability is null or p_capability not in ('analyze_dream','analyze_dream_full')
    or p_request_id is null or p_daily_limit is null then
    raise exception 'invalid analysis admission';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai_analysis:' || p_actor_hash || ':' || p_capability || ':' || p_request_id::text, 0));
  if exists(select 1 from private.ai_analysis_admissions
    where actor_hash = p_actor_hash and capability = p_capability and request_id = p_request_id and daily_admitted) then
    return jsonb_build_object('allowed', true, 'code', 'ALREADY_ADMITTED');
  end if;
  if not exists(select 1 from private.ai_analysis_admissions
    where actor_hash = p_actor_hash and capability = p_capability and request_id = p_request_id) then
    claim := public.claim_ai_request_window(p_actor_hash, p_capability, p_window_seconds, p_actor_limit, p_global_limit);
    if (claim->>'allowed')::boolean is distinct from true then return claim; end if;
    -- Even a later daily denial must not charge this window again on replay.
    insert into private.ai_analysis_admissions(actor_hash, capability, request_id)
      values (p_actor_hash, p_capability, p_request_id);
  end if;
  claim := public.claim_ai_daily_budget(p_actor_hash, p_capability, p_daily_limit);
  if (claim->>'allowed')::boolean is distinct from true then return claim; end if;
  update private.ai_analysis_admissions set daily_admitted = true
    where actor_hash = p_actor_hash and capability = p_capability and request_id = p_request_id;
  return claim;
end;
$$;
revoke all on function public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.claim_ai_analysis_admission(text,text,uuid,integer,integer,integer,integer) to service_role;
