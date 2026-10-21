-- The API signs short-lived challenges without writing unauthenticated rows.
-- Only a cryptographically verified proof reaches these completion RPCs.
-- Their transaction consumes its challenge exactly once across Edge instances.
create table public.ios_guest_app_attest_keys (
  key_id text primary key check (key_id ~ '^[A-Za-z0-9+/]{43}=$'),
  fingerprint_hash text not null check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  public_key_pem text not null,
  receipt_base64 text not null,
  environment text not null check (environment in ('development', 'production')),
  app_id text not null,
  assertion_counter bigint not null default 0 check (assertion_counter >= 0),
  created_at timestamptz not null default now(),
  last_asserted_at timestamptz
);

alter table public.ios_guest_app_attest_keys enable row level security;
revoke all on public.ios_guest_app_attest_keys from public, anon, authenticated;
grant select, insert, update on public.ios_guest_app_attest_keys to service_role;

create table public.ios_guest_app_attest_used_challenges (
  challenge_digest text primary key check (challenge_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);
create index ios_guest_app_attest_used_challenges_expiry_idx
  on public.ios_guest_app_attest_used_challenges (expires_at);
alter table public.ios_guest_app_attest_used_challenges enable row level security;
revoke all on public.ios_guest_app_attest_used_challenges
  from public, anon, authenticated, service_role;

create or replace function public.complete_ios_guest_app_attestation(
  p_challenge_digest text,
  p_challenge_expires_at timestamptz,
  p_key_id text,
  p_fingerprint_hash text,
  p_public_key_pem text,
  p_receipt_base64 text,
  p_environment text,
  p_app_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key_id !~ '^[A-Za-z0-9+/]{43}=$'
    or p_challenge_digest !~ '^[0-9a-f]{64}$'
    or p_challenge_expires_at is null
    or p_challenge_expires_at <= now()
    or p_challenge_expires_at > now() + interval '3 minutes'
    or p_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_public_key_pem is null or p_receipt_base64 is null
    or p_environment not in ('development', 'production')
    or p_app_id is null
  then return false; end if;

  delete from public.ios_guest_app_attest_used_challenges
  where expires_at <= now();
  insert into public.ios_guest_app_attest_used_challenges (
    challenge_digest, expires_at
  ) values (
    p_challenge_digest, p_challenge_expires_at
  ) on conflict do nothing;
  if not found then return false; end if;

  insert into public.ios_guest_app_attest_keys (
    key_id, fingerprint_hash, public_key_pem, receipt_base64, environment, app_id
  ) values (
    p_key_id, p_fingerprint_hash, p_public_key_pem, p_receipt_base64, p_environment, p_app_id
  ) on conflict do nothing;
  if not found then
    -- The key was already registered. Keep the failed operation atomic.
    delete from public.ios_guest_app_attest_used_challenges
    where challenge_digest = p_challenge_digest;
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.complete_ios_guest_app_assertion(
  p_challenge_digest text,
  p_challenge_expires_at timestamptz,
  p_key_id text,
  p_fingerprint_hash text,
  p_counter bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_challenge_digest !~ '^[0-9a-f]{64}$'
    or p_challenge_expires_at is null
    or p_challenge_expires_at <= now()
    or p_challenge_expires_at > now() + interval '3 minutes'
    or p_counter is null or p_counter <= 0
  then return false; end if;

  -- Serialize assertions for a key before consuming the challenge. A
  -- duplicate digest cannot advance the counter or mint another token.
  perform 1 from public.ios_guest_app_attest_keys
  where key_id = p_key_id
    and fingerprint_hash = p_fingerprint_hash
    and assertion_counter < p_counter
  for update;
  if not found then return false; end if;

  delete from public.ios_guest_app_attest_used_challenges
  where expires_at <= now();
  insert into public.ios_guest_app_attest_used_challenges (
    challenge_digest, expires_at
  ) values (
    p_challenge_digest, p_challenge_expires_at
  ) on conflict do nothing;
  if not found then return false; end if;

  update public.ios_guest_app_attest_keys
  set assertion_counter = p_counter,
      last_asserted_at = now()
  where key_id = p_key_id
    and fingerprint_hash = p_fingerprint_hash
    and assertion_counter < p_counter;
  if not found then
    delete from public.ios_guest_app_attest_used_challenges
    where challenge_digest = p_challenge_digest;
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.complete_ios_guest_app_attestation(text, timestamptz, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_ios_guest_app_assertion(text, timestamptz, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.complete_ios_guest_app_attestation(text, timestamptz, text, text, text, text, text, text)
  to service_role;
grant execute on function public.complete_ios_guest_app_assertion(text, timestamptz, text, text, bigint)
  to service_role;
