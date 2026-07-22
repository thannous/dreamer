-- Short-lived, server-owned QA passports let one approved operator exercise the
-- real production guest path without resetting the device's real lifetime
-- quota. The client never receives direct table access; Edge Functions use the
-- service-role-only RPCs below.

create schema if not exists qa_private;

revoke all on schema qa_private from public, anon, authenticated;

create table qa_private.guest_passports (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint_hash text not null,
  enrollment_request_id uuid not null,
  valid_until timestamptz not null,
  reset_daily_limit integer not null default 3,
  paid_call_daily_limit integer not null default 10,
  paid_call_day date not null default ((now() at time zone 'utc')::date),
  paid_call_count integer not null default 0,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  constraint guest_passports_fingerprint_format_check
    check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  constraint guest_passports_enrollment_request_unique
    unique (operator_user_id, enrollment_request_id),
  constraint guest_passports_validity_check
    check (valid_until > created_at),
  constraint guest_passports_reset_daily_limit_check
    check (reset_daily_limit between 1 and 10),
  constraint guest_passports_paid_call_daily_limit_check
    check (paid_call_daily_limit between 1 and 100),
  constraint guest_passports_paid_call_count_check
    check (paid_call_count >= 0)
);

create index guest_passports_operator_created_idx
  on qa_private.guest_passports (operator_user_id, created_at desc);

create index guest_passports_active_fingerprint_idx
  on qa_private.guest_passports (fingerprint_hash, valid_until desc)
  where revoked_at is null;

alter table qa_private.guest_passports enable row level security;
alter table qa_private.guest_passports force row level security;

revoke all on table qa_private.guest_passports from public, anon, authenticated;

create table qa_private.guest_paid_call_claims (
  passport_id uuid not null references qa_private.guest_passports(id) on delete cascade,
  capability text not null,
  request_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (passport_id, capability, request_key),
  constraint guest_paid_call_claims_capability_check
    check (char_length(capability) between 1 and 64),
  constraint guest_paid_call_claims_request_key_check
    check (char_length(request_key) between 1 and 128)
);

create index guest_paid_call_claims_claimed_at_idx
  on qa_private.guest_paid_call_claims (passport_id, claimed_at desc);

alter table qa_private.guest_paid_call_claims enable row level security;
alter table qa_private.guest_paid_call_claims force row level security;

revoke all on table qa_private.guest_paid_call_claims from public, anon, authenticated;

create or replace function public.enroll_guest_qa_passport(
  p_operator_user_id uuid,
  p_fingerprint text,
  p_request_id uuid,
  p_valid_hours integer default 24,
  p_daily_reset_limit integer default 3,
  p_daily_paid_call_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing qa_private.guest_passports%rowtype;
  v_active qa_private.guest_passports%rowtype;
  v_created qa_private.guest_passports%rowtype;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_resets_today integer := 0;
begin
  if p_operator_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_operator_user_id
  ) then
    return jsonb_build_object('allowed', false, 'code', 'QA_OPERATOR_NOT_FOUND');
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed', false, 'code', 'QA_INVALID_FINGERPRINT');
  end if;

  if p_request_id is null then
    return jsonb_build_object('allowed', false, 'code', 'QA_REQUEST_ID_REQUIRED');
  end if;

  if p_valid_hours not between 1 and 48
    or p_daily_reset_limit not between 1 and 10
    or p_daily_paid_call_limit not between 1 and 100 then
    return jsonb_build_object('allowed', false, 'code', 'QA_INVALID_POLICY');
  end if;

  -- Serialize enrollments for one operator so concurrent taps cannot create
  -- multiple active devices or exceed the daily reset budget.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_operator_user_id::text, 0)
  );

  select p.*
  into v_existing
  from qa_private.guest_passports p
  where p.operator_user_id = p_operator_user_id
    and p.enrollment_request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'duplicate', true,
      'passportId', v_existing.id,
      'validUntil', v_existing.valid_until,
      'resetLimit', v_existing.reset_daily_limit,
      'paidCallLimit', v_existing.paid_call_daily_limit,
      'paidCallsUsed', case
        when v_existing.paid_call_day = (now() at time zone 'utc')::date
          then v_existing.paid_call_count
        else 0
      end
    );
  end if;

  select p.*
  into v_active
  from qa_private.guest_passports p
  where p.operator_user_id = p_operator_user_id
    and p.revoked_at is null
    and p.valid_until > now()
  order by p.created_at desc
  limit 1
  for update;

  if found and v_active.fingerprint_hash <> p_fingerprint then
    return jsonb_build_object(
      'allowed', false,
      'code', 'QA_DEVICE_LIMIT',
      'validUntil', v_active.valid_until
    );
  end if;

  select count(*)::integer
  into v_resets_today
  from qa_private.guest_passports p
  where p.operator_user_id = p_operator_user_id
    and p.created_at >= v_day_start;

  if v_resets_today >= p_daily_reset_limit then
    return jsonb_build_object(
      'allowed', false,
      'code', 'QA_DAILY_RESET_LIMIT',
      'resetsUsed', v_resets_today,
      'resetLimit', p_daily_reset_limit,
      'retryAfter', greatest(
        1,
        floor(extract(epoch from ((v_day_start + interval '1 day') - now())))::integer
      )
    );
  end if;

  update qa_private.guest_passports p
  set
    revoked_at = now(),
    revoke_reason = 'replaced_by_reset'
  where p.operator_user_id = p_operator_user_id
    and p.fingerprint_hash = p_fingerprint
    and p.revoked_at is null
    and p.valid_until > now();

  insert into qa_private.guest_passports (
    operator_user_id,
    fingerprint_hash,
    enrollment_request_id,
    valid_until,
    reset_daily_limit,
    paid_call_daily_limit
  )
  values (
    p_operator_user_id,
    p_fingerprint,
    p_request_id,
    now() + make_interval(hours => p_valid_hours),
    p_daily_reset_limit,
    p_daily_paid_call_limit
  )
  returning * into v_created;

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'passportId', v_created.id,
    'validUntil', v_created.valid_until,
    'resetsUsed', v_resets_today + 1,
    'resetLimit', v_created.reset_daily_limit,
    'paidCallsUsed', 0,
    'paidCallLimit', v_created.paid_call_daily_limit
  );
end;
$$;

create or replace function public.get_guest_qa_operator_status(
  p_operator_user_id uuid,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active qa_private.guest_passports%rowtype;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_resets_today integer := 0;
begin
  select count(*)::integer
  into v_resets_today
  from qa_private.guest_passports p
  where p.operator_user_id = p_operator_user_id
    and p.created_at >= v_day_start;

  select p.*
  into v_active
  from qa_private.guest_passports p
  where p.operator_user_id = p_operator_user_id
    and p.revoked_at is null
    and p.valid_until > now()
  order by p.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'active', false,
      'deviceMatches', false,
      'resetsUsed', v_resets_today,
      'resetLimit', 3,
      'paidCallsUsed', 0,
      'paidCallLimit', 10
    );
  end if;

  return jsonb_build_object(
    'active', true,
    'deviceMatches', v_active.fingerprint_hash = p_fingerprint,
    'passportId', v_active.id,
    'validUntil', v_active.valid_until,
    'resetsUsed', v_resets_today,
    'resetLimit', v_active.reset_daily_limit,
    'paidCallsUsed', case
      when v_active.paid_call_day = (now() at time zone 'utc')::date
        then v_active.paid_call_count
      else 0
    end,
    'paidCallLimit', v_active.paid_call_daily_limit
  );
end;
$$;

create or replace function public.revoke_guest_qa_passport(
  p_operator_user_id uuid,
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked integer := 0;
begin
  update qa_private.guest_passports p
  set
    revoked_at = now(),
    revoke_reason = 'operator_revoked'
  where p.operator_user_id = p_operator_user_id
    and p.fingerprint_hash = p_fingerprint
    and p.revoked_at is null
    and p.valid_until > now();

  get diagnostics v_revoked = row_count;
  return jsonb_build_object('revoked', v_revoked > 0);
end;
$$;

create or replace function public.resolve_guest_qa_passport(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active qa_private.guest_passports%rowtype;
begin
  select p.*
  into v_active
  from qa_private.guest_passports p
  where p.fingerprint_hash = p_fingerprint
    and p.revoked_at is null
    and p.valid_until > now()
  order by p.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'passportId', v_active.id,
    'quotaSubject', 'qa:' || v_active.id::text,
    'validUntil', v_active.valid_until
  );
end;
$$;

create or replace function public.claim_guest_qa_paid_call(
  p_quota_subject text,
  p_capability text,
  p_request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_passport_id uuid;
  v_passport qa_private.guest_passports%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_retry_after integer;
begin
  if p_quota_subject is null or p_quota_subject !~* '^qa:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('qa', false, 'allowed', true);
  end if;

  if p_capability is null or char_length(btrim(p_capability)) not between 1 and 64
    or p_request_key is null or char_length(btrim(p_request_key)) not between 1 and 128 then
    return jsonb_build_object('qa', true, 'allowed', false, 'code', 'QA_INVALID_PAID_CALL');
  end if;

  v_passport_id := substring(p_quota_subject from 4)::uuid;

  select p.*
  into v_passport
  from qa_private.guest_passports p
  where p.id = v_passport_id
  for update;

  if not found or v_passport.revoked_at is not null or v_passport.valid_until <= now() then
    return jsonb_build_object('qa', true, 'allowed', false, 'code', 'QA_PASSPORT_EXPIRED');
  end if;

  if exists (
    select 1
    from qa_private.guest_paid_call_claims c
    where c.passport_id = v_passport_id
      and c.capability = btrim(p_capability)
      and c.request_key = btrim(p_request_key)
  ) then
    return jsonb_build_object(
      'qa', true,
      'allowed', true,
      'duplicate', true,
      'used', case when v_passport.paid_call_day = v_today then v_passport.paid_call_count else 0 end,
      'limit', v_passport.paid_call_daily_limit
    );
  end if;

  if v_passport.paid_call_day <> v_today then
    update qa_private.guest_passports p
    set paid_call_day = v_today, paid_call_count = 0
    where p.id = v_passport_id
    returning * into v_passport;
  end if;

  if v_passport.paid_call_count >= v_passport.paid_call_daily_limit then
    v_retry_after := greatest(
      1,
      floor(extract(epoch from (
        least(
          v_passport.valid_until,
          (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc'
        ) - now()
      )))::integer
    );
    return jsonb_build_object(
      'qa', true,
      'allowed', false,
      'code', 'QA_DAILY_BUDGET_EXCEEDED',
      'used', v_passport.paid_call_count,
      'limit', v_passport.paid_call_daily_limit,
      'retryAfter', v_retry_after
    );
  end if;

  insert into qa_private.guest_paid_call_claims (
    passport_id,
    capability,
    request_key
  )
  values (
    v_passport_id,
    btrim(p_capability),
    btrim(p_request_key)
  );

  update qa_private.guest_passports p
  set paid_call_count = paid_call_count + 1
  where p.id = v_passport_id
  returning * into v_passport;

  return jsonb_build_object(
    'qa', true,
    'allowed', true,
    'duplicate', false,
    'used', v_passport.paid_call_count,
    'limit', v_passport.paid_call_daily_limit
  );
end;
$$;

revoke all on function public.enroll_guest_qa_passport(uuid, text, uuid, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_guest_qa_operator_status(uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_guest_qa_passport(uuid, text)
  from public, anon, authenticated;
revoke all on function public.resolve_guest_qa_passport(text)
  from public, anon, authenticated;
revoke all on function public.claim_guest_qa_paid_call(text, text, text)
  from public, anon, authenticated;

grant execute on function public.enroll_guest_qa_passport(uuid, text, uuid, integer, integer, integer)
  to service_role;
grant execute on function public.get_guest_qa_operator_status(uuid, text)
  to service_role;
grant execute on function public.revoke_guest_qa_passport(uuid, text)
  to service_role;
grant execute on function public.resolve_guest_qa_passport(text)
  to service_role;
grant execute on function public.claim_guest_qa_paid_call(text, text, text)
  to service_role;

comment on schema qa_private is
  'Non-exposed state for temporary production guest QA passports.';
comment on table qa_private.guest_passports is
  'Audited, short-lived QA sessions scoped to one approved operator and device fingerprint.';
comment on table qa_private.guest_paid_call_claims is
  'Content-free audit and idempotency log for paid AI calls made through QA guest passports.';
