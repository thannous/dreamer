-- Product contract:
-- - one monthly entitlement is exposed to users: interpreted dreams;
-- - chat is included with an interpreted dream and only has a per-dream
--   safety ceiling;
-- - a device fingerprint is a risk signal, never a standalone account ban.

insert into public.quota_limits (tier, period, quota_type, quota_limit)
values
  ('guest', 'monthly', 'analysis', 2),
  ('guest', 'monthly', 'exploration', null),
  ('guest', 'monthly', 'messages_per_dream', 10),
  ('free', 'monthly', 'analysis', 3),
  ('free', 'monthly', 'exploration', null),
  ('free', 'monthly', 'messages_per_dream', 10),
  ('plus', 'monthly', 'analysis', null),
  ('plus', 'monthly', 'exploration', null),
  ('plus', 'monthly', 'messages_per_dream', 20),
  ('premium', 'monthly', 'analysis', null),
  ('premium', 'monthly', 'exploration', null),
  ('premium', 'monthly', 'messages_per_dream', 20)
on conflict (tier, period, quota_type)
do update set
  quota_limit = excluded.quota_limit,
  updated_at = now();

-- Legacy rows used to hard-block guest access after any account was linked to
-- an installation. Keep the columns for compatibility, but clear and ignore
-- the flag from this migration onward.
update public.guest_usage
set is_upgraded = false
where is_upgraded is true;

create table if not exists public.device_account_links (
  fingerprint_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  integrity_provider text not null
    check (integrity_provider in ('play_integrity', 'app_attest', 'unknown')),
  integrity_verified boolean not null default false,
  account_created_at timestamptz not null,
  first_linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (fingerprint_hash, user_id)
);

create index if not exists device_account_links_fingerprint_created_idx
  on public.device_account_links (fingerprint_hash, account_created_at desc);

alter table public.device_account_links enable row level security;
revoke all on table public.device_account_links from public, anon, authenticated;

create or replace function public.get_guest_abuse_risk(
  p_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_integrity_provider text := 'unknown';
  latest_integrity_verified boolean := false;
  accounts_created_24h integer := 0;
  accounts_created_30d integer := 0;
  accounts_total integer := 0;
  score integer := 0;
  level text := 'low';
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;

  select l.integrity_provider, l.integrity_verified
  into latest_integrity_provider, latest_integrity_verified
  from public.device_account_links l
  where l.fingerprint_hash = p_fingerprint
  order by l.last_seen_at desc
  limit 1;

  if not found then
    latest_integrity_provider := 'unknown';
    latest_integrity_verified := false;
  end if;

  select
    count(*) filter (
      where l.account_created_at >= now() - interval '24 hours'
        and l.first_linked_at <= l.account_created_at + interval '24 hours'
    )::integer,
    count(*) filter (
      where l.account_created_at >= now() - interval '30 days'
        and l.first_linked_at <= l.account_created_at + interval '24 hours'
    )::integer,
    count(*)::integer
  into accounts_created_24h, accounts_created_30d, accounts_total
  from public.device_account_links l
  where l.fingerprint_hash = p_fingerprint;

  -- Progressive signals. A normal shared or refurbished phone is not blocked:
  -- three verified accounts in one day remain low risk. Restrictions require
  -- a combination of weak integrity and/or unusually fast account creation.
  if not latest_integrity_verified then
    score := score + 35;
  end if;
  if accounts_created_24h >= 3 then
    score := score + 25;
  end if;
  if accounts_created_24h >= 5 then
    score := score + 20;
  end if;
  if accounts_created_30d >= 5 then
    score := score + 20;
  end if;
  if accounts_created_30d >= 8 then
    score := score + 20;
  end if;
  if accounts_total >= 10 then
    score := score + 15;
  end if;

  score := least(score, 100);
  level := case
    when score >= 80 then 'high'
    when score >= 50 then 'elevated'
    else 'low'
  end;

  return jsonb_build_object(
    'risk_score', score,
    'risk_level', level,
    'integrity_provider', latest_integrity_provider,
    'integrity_verified', latest_integrity_verified,
    'accounts_created_24h', accounts_created_24h,
    'accounts_created_30d', accounts_created_30d,
    'accounts_total', accounts_total
  );
end;
$$;

create or replace function public.register_device_account_link(
  p_fingerprint text,
  p_user_id uuid,
  p_integrity_provider text,
  p_integrity_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_at_value timestamptz;
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if p_integrity_provider not in ('play_integrity', 'app_attest', 'unknown') then
    raise exception 'invalid integrity provider';
  end if;

  select u.created_at
  into created_at_value
  from auth.users u
  where u.id = p_user_id;

  if not found then
    raise exception 'user not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(format('device_account_link:%s', p_fingerprint), 0)
  );

  insert into public.device_account_links as existing (
    fingerprint_hash,
    user_id,
    integrity_provider,
    integrity_verified,
    account_created_at
  ) values (
    p_fingerprint,
    p_user_id,
    p_integrity_provider,
    coalesce(p_integrity_verified, false),
    created_at_value
  )
  on conflict (fingerprint_hash, user_id)
  do update set
    integrity_provider = case
      when excluded.integrity_verified then excluded.integrity_provider
      else existing.integrity_provider
    end,
    integrity_verified = existing.integrity_verified
      or excluded.integrity_verified,
    last_seen_at = now();

  insert into public.guest_usage (fingerprint_hash, is_upgraded)
  values (p_fingerprint, false)
  on conflict (fingerprint_hash)
  do update set
    is_upgraded = false,
    upgraded_user_id = p_user_id,
    upgraded_at = now(),
    last_seen_at = now();

  return public.get_guest_abuse_risk(p_fingerprint);
end;
$$;

create or replace function public.get_guest_quota_status(
  p_fingerprint text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_count_value integer := 0;
  exploration_count_value integer := 0;
  image_count_value integer := 0;
  risk jsonb;
  level text;
  analysis_limit integer;
  message_limit integer;
  image_limit integer;
begin
  select g.analysis_count, g.exploration_count, g.image_count
  into analysis_count_value, exploration_count_value, image_count_value
  from public.guest_usage g
  where g.fingerprint_hash = p_fingerprint;

  risk := public.get_guest_abuse_risk(p_fingerprint);
  level := coalesce(risk ->> 'risk_level', 'low');
  analysis_limit := case when level = 'high' then 0 when level = 'elevated' then 1 else 2 end;
  message_limit := case when level = 'high' then 3 when level = 'elevated' then 5 else 10 end;
  image_limit := case when level = 'high' then 0 when level = 'elevated' then 1 else 2 end;

  return jsonb_build_object(
    'analysis_count', coalesce(analysis_count_value, 0),
    'exploration_count', coalesce(exploration_count_value, 0),
    'image_count', coalesce(image_count_value, 0),
    'is_upgraded', false,
    'effective_analysis_limit', analysis_limit,
    'effective_message_limit', message_limit,
    'effective_image_limit', image_limit,
    'risk_score', (risk ->> 'risk_score')::integer,
    'risk_level', level
  );
end;
$$;

create or replace function public.increment_guest_quota(
  p_fingerprint text,
  p_quota_type text,
  p_limit integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  analysis_count_value integer := 0;
  exploration_count_value integer := 0;
  image_count_value integer := 0;
  current_count integer := 0;
  effective_limit integer := p_limit;
  allowed boolean := false;
  risk jsonb;
  level text;
begin
  if p_quota_type not in ('analysis', 'exploration', 'image') then
    raise exception 'invalid quota_type';
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception 'p_limit must be non-negative';
  end if;

  insert into public.guest_usage (fingerprint_hash, is_upgraded)
  values (p_fingerprint, false)
  on conflict (fingerprint_hash) do nothing;

  select g.analysis_count, g.exploration_count, g.image_count
  into analysis_count_value, exploration_count_value, image_count_value
  from public.guest_usage g
  where g.fingerprint_hash = p_fingerprint
  for update;

  risk := public.get_guest_abuse_risk(p_fingerprint);
  level := coalesce(risk ->> 'risk_level', 'low');
  if p_quota_type in ('analysis', 'image') then
    effective_limit := case
      when level = 'high' then 0
      when level = 'elevated' then least(p_limit, 1)
      else p_limit
    end;
  end if;

  current_count := case p_quota_type
    when 'analysis' then analysis_count_value
    when 'exploration' then exploration_count_value
    else image_count_value
  end;
  allowed := current_count < effective_limit;

  if allowed then
    if p_quota_type = 'analysis' then
      update public.guest_usage
      set analysis_count = analysis_count + 1, last_seen_at = now(), is_upgraded = false
      where fingerprint_hash = p_fingerprint
      returning analysis_count into current_count;
    elsif p_quota_type = 'exploration' then
      update public.guest_usage
      set exploration_count = exploration_count + 1, last_seen_at = now(), is_upgraded = false
      where fingerprint_hash = p_fingerprint
      returning exploration_count into current_count;
    else
      update public.guest_usage
      set image_count = image_count + 1, last_seen_at = now(), is_upgraded = false
      where fingerprint_hash = p_fingerprint
      returning image_count into current_count;
    end if;
  end if;

  return jsonb_build_object(
    'allowed', allowed,
    'new_count', coalesce(current_count, 0),
    'limit', effective_limit,
    'is_upgraded', false,
    'risk_score', (risk ->> 'risk_score')::integer,
    'risk_level', level
  );
end;
$$;

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
  effective_limit integer := p_limit;
  risk jsonb;
  level text;
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

  insert into public.guest_usage (fingerprint_hash, is_upgraded)
  values (p_fingerprint, false)
  on conflict (fingerprint_hash) do nothing;

  select g.analysis_count
  into current_count
  from public.guest_usage g
  where g.fingerprint_hash = p_fingerprint
  for update;

  select exists (
    select 1
    from public.guest_analysis_quota_claims c
    where c.fingerprint_hash = p_fingerprint
      and c.analysis_request_id = p_analysis_request_id
  ) into already_claimed;

  risk := public.get_guest_abuse_risk(p_fingerprint);
  level := coalesce(risk ->> 'risk_level', 'low');
  effective_limit := case
    when level = 'high' then 0
    when level = 'elevated' then least(p_limit, 1)
    else p_limit
  end;

  if already_claimed then
    return jsonb_build_object(
      'allowed', true,
      'new_count', coalesce(current_count, 0),
      'limit', effective_limit,
      'is_upgraded', false,
      'claimed', false,
      'duplicate', true,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  if current_count >= effective_limit then
    return jsonb_build_object(
      'allowed', false,
      'new_count', coalesce(current_count, 0),
      'limit', effective_limit,
      'is_upgraded', false,
      'claimed', false,
      'duplicate', false,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  insert into public.guest_analysis_quota_claims (
    fingerprint_hash,
    analysis_request_id
  ) values (
    p_fingerprint,
    p_analysis_request_id
  );

  update public.guest_usage
  set analysis_count = analysis_count + 1, last_seen_at = now(), is_upgraded = false
  where fingerprint_hash = p_fingerprint
  returning analysis_count into current_count;

  return jsonb_build_object(
    'allowed', true,
    'new_count', current_count,
    'limit', effective_limit,
    'is_upgraded', false,
    'claimed', true,
    'duplicate', false,
    'risk_score', (risk ->> 'risk_score')::integer,
    'risk_level', level
  );
end;
$$;

create table if not exists public.guest_chat_quota_claims (
  fingerprint_hash text not null,
  dream_key text not null check (length(dream_key) between 1 and 128),
  request_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (fingerprint_hash, dream_key, request_id)
);

create index if not exists guest_chat_quota_claims_dream_idx
  on public.guest_chat_quota_claims (fingerprint_hash, dream_key, claimed_at);

alter table public.guest_chat_quota_claims enable row level security;
revoke all on table public.guest_chat_quota_claims from public, anon, authenticated;

create or replace function public.claim_guest_chat_message(
  p_fingerprint text,
  p_dream_key text,
  p_request_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer := 0;
  effective_limit integer := p_limit;
  already_claimed boolean := false;
  risk jsonb;
  level text;
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;
  if nullif(btrim(p_dream_key), '') is null or length(p_dream_key) > 128 then
    raise exception 'invalid p_dream_key';
  end if;
  if p_request_id is null then
    raise exception 'p_request_id is required';
  end if;
  if p_limit is null or p_limit < 0 then
    raise exception 'p_limit must be non-negative';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(format('guest_chat:%s:%s', p_fingerprint, p_dream_key), 0)
  );

  select exists (
    select 1
    from public.guest_chat_quota_claims c
    where c.fingerprint_hash = p_fingerprint
      and c.dream_key = p_dream_key
      and c.request_id = p_request_id
  ) into already_claimed;

  select count(*)::integer
  into current_count
  from public.guest_chat_quota_claims c
  where c.fingerprint_hash = p_fingerprint
    and c.dream_key = p_dream_key;

  risk := public.get_guest_abuse_risk(p_fingerprint);
  level := coalesce(risk ->> 'risk_level', 'low');
  effective_limit := case
    when level = 'high' then least(p_limit, 3)
    when level = 'elevated' then least(p_limit, 5)
    else p_limit
  end;

  if already_claimed then
    return jsonb_build_object(
      'allowed', true,
      'new_count', current_count,
      'limit', effective_limit,
      'claimed', false,
      'duplicate', true,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  if current_count >= effective_limit then
    return jsonb_build_object(
      'allowed', false,
      'new_count', current_count,
      'limit', effective_limit,
      'claimed', false,
      'duplicate', false,
      'risk_score', (risk ->> 'risk_score')::integer,
      'risk_level', level
    );
  end if;

  insert into public.guest_chat_quota_claims (
    fingerprint_hash,
    dream_key,
    request_id
  ) values (
    p_fingerprint,
    p_dream_key,
    p_request_id
  );

  current_count := current_count + 1;
  return jsonb_build_object(
    'allowed', true,
    'new_count', current_count,
    'limit', effective_limit,
    'claimed', true,
    'duplicate', false,
    'risk_score', (risk ->> 'risk_score')::integer,
    'risk_level', level
  );
end;
$$;

create or replace function public.get_guest_chat_message_count(
  p_fingerprint text,
  p_dream_key text
)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.guest_chat_quota_claims c
  where c.fingerprint_hash = p_fingerprint
    and c.dream_key = p_dream_key
$$;

-- Keep the legacy function callable by an older Edge Function during a
-- rolling deploy, but make it register a signal instead of a hard block.
create or replace function public.mark_fingerprint_upgraded(
  p_fingerprint text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.register_device_account_link(
    p_fingerprint,
    p_user_id,
    'unknown',
    false
  );
  return true;
end;
$$;

revoke all on function public.get_guest_abuse_risk(text)
  from public, anon, authenticated;
revoke all on function public.register_device_account_link(text, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.get_guest_quota_status(text)
  from public, anon, authenticated;
revoke all on function public.increment_guest_quota(text, text, integer)
  from public, anon, authenticated;
revoke all on function public.claim_guest_analysis_quota(text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.claim_guest_chat_message(text, text, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_guest_chat_message_count(text, text)
  from public, anon, authenticated;
revoke all on function public.mark_fingerprint_upgraded(text, uuid)
  from public, anon, authenticated;

grant execute on function public.get_guest_abuse_risk(text)
  to service_role;
grant execute on function public.register_device_account_link(text, uuid, text, boolean)
  to service_role;
grant execute on function public.get_guest_quota_status(text)
  to service_role;
grant execute on function public.increment_guest_quota(text, text, integer)
  to service_role;
grant execute on function public.claim_guest_analysis_quota(text, uuid, integer)
  to service_role;
grant execute on function public.claim_guest_chat_message(text, text, uuid, integer)
  to service_role;
grant execute on function public.get_guest_chat_message_count(text, text)
  to service_role;
grant execute on function public.mark_fingerprint_upgraded(text, uuid)
  to service_role;

comment on table public.device_account_links is
  'Server-only pseudonymous device/account links used as one signal in progressive abuse scoring.';
comment on table public.guest_chat_quota_claims is
  'Server-only idempotent guest chat safety claims, scoped to one interpreted dream.';
