-- Guest chat: add a ceiling per device across dream keys.
--
-- claim_guest_chat_message counted messages per (device, dream key) only, and
-- the dream key comes from the app. Same signature and same result shape as
-- before, so the deployed API keeps working unchanged.

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
  device_count integer := 0;
  device_limit integer;
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

  -- One lock per device, not per dream: the device ceiling below is counted
  -- across every dream key, so two dreams must not be claimed side by side.
  perform pg_advisory_xact_lock(
    hashtextextended(format('guest_chat:%s', p_fingerprint), 0)
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

  -- The dream key is chosen by the app and cannot be checked against a guest
  -- journal that only exists on the device. Without a ceiling across keys, a
  -- new key per message would lift the per-dream limit entirely. A guest gets
  -- two interpretations, so three dreams' worth of messages a day is never
  -- reached in normal use.
  device_limit := effective_limit * 3;
  select count(*)::integer
  into device_count
  from public.guest_chat_quota_claims c
  where c.fingerprint_hash = p_fingerprint
    and c.claimed_at > now() - interval '24 hours';

  if current_count >= effective_limit or device_count >= device_limit then
    return jsonb_build_object(
      'allowed', false,
      'device_limit_reached', current_count < effective_limit,
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

revoke all on function public.claim_guest_chat_message(text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_guest_chat_message(text, text, uuid, integer)
  to service_role;
