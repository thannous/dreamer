-- Give guest analysis retries the same quota semantics as authenticated
-- analysis requests. A request UUID can be retried after a network failure or
-- app restart without incrementing the device quota a second time.

create table if not exists public.guest_analysis_quota_claims (
  fingerprint_hash text not null,
  analysis_request_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (fingerprint_hash, analysis_request_id)
);

alter table public.guest_analysis_quota_claims enable row level security;

revoke all on table public.guest_analysis_quota_claims from public, anon, authenticated;

create or replace function public.claim_guest_analysis_quota(
  p_fingerprint text,
  p_analysis_request_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer := 0;
  already_claimed boolean := false;
  upgraded boolean := false;
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;

  if p_analysis_request_id is null then
    raise exception 'p_analysis_request_id is required';
  end if;

  if p_limit is null or p_limit < 0 then
    raise exception 'p_limit must be non-negative';
  end if;

  insert into public.guest_usage (fingerprint_hash)
  values (p_fingerprint)
  on conflict (fingerprint_hash) do nothing;

  -- The guest row serializes quota checks and claims for one installation.
  select analysis_count, is_upgraded
  into current_count, upgraded
  from public.guest_usage
  where fingerprint_hash = p_fingerprint
  for update;

  select exists (
    select 1
    from public.guest_analysis_quota_claims c
    where c.fingerprint_hash = p_fingerprint
      and c.analysis_request_id = p_analysis_request_id
  )
  into already_claimed;

  if already_claimed then
    return jsonb_build_object(
      'allowed', true,
      'new_count', coalesce(current_count, 0),
      'is_upgraded', coalesce(upgraded, false),
      'claimed', false,
      'duplicate', true
    );
  end if;

  if upgraded then
    return jsonb_build_object(
      'allowed', false,
      'new_count', coalesce(current_count, 0),
      'is_upgraded', true,
      'claimed', false,
      'duplicate', false
    );
  end if;

  if current_count >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'new_count', coalesce(current_count, 0),
      'is_upgraded', false,
      'claimed', false,
      'duplicate', false
    );
  end if;

  insert into public.guest_analysis_quota_claims (
    fingerprint_hash,
    analysis_request_id
  )
  values (
    p_fingerprint,
    p_analysis_request_id
  );

  update public.guest_usage
  set
    analysis_count = analysis_count + 1,
    last_seen_at = now()
  where fingerprint_hash = p_fingerprint
  returning analysis_count into current_count;

  return jsonb_build_object(
    'allowed', true,
    'new_count', current_count,
    'is_upgraded', false,
    'claimed', true,
    'duplicate', false
  );
end;
$$;

revoke execute on function public.claim_guest_analysis_quota(text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_guest_analysis_quota(text, uuid, integer)
  to service_role;

comment on table public.guest_analysis_quota_claims is
  'Server-only idempotency claims for guest analysis quota consumption.';

comment on function public.claim_guest_analysis_quota(text, uuid, integer) is
  'Claims guest analysis quota exactly once per fingerprint and analysis request UUID.';
