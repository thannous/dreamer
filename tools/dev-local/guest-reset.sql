-- Local development backend only (tools/dev-local/dev-local.mjs installs it at
-- every start). Never a migration: the hosted database has no such function.
-- Forgets what one guest device used, so the next guest run starts fresh.
-- `db query` runs one command at a time: statements are split on the marker lines.
create or replace function public.dev_local_reset_guest(p_fingerprint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_hash text;
  v_usage integer;
  v_analysis_claims integer;
  v_chat_claims integer;
  v_rate_buckets integer;
  v_admissions integer;
begin
  if nullif(btrim(p_fingerprint), '') is null then
    raise exception 'p_fingerprint is required';
  end if;
  -- The API's AI admission key for a guest (hashAiActor('guest:' || fingerprint)).
  v_actor_hash := encode(sha256(convert_to('guest:' || p_fingerprint, 'UTF8')), 'hex');
  delete from public.guest_usage where fingerprint_hash = p_fingerprint;
  get diagnostics v_usage = row_count;
  delete from public.guest_analysis_quota_claims where fingerprint_hash = p_fingerprint;
  get diagnostics v_analysis_claims = row_count;
  delete from public.guest_chat_quota_claims where fingerprint_hash = p_fingerprint;
  get diagnostics v_chat_claims = row_count;
  delete from public.ai_rate_limit_buckets where actor_hash = v_actor_hash;
  get diagnostics v_rate_buckets = row_count;
  delete from private.ai_analysis_admissions where actor_hash = v_actor_hash;
  get diagnostics v_admissions = row_count;
  return jsonb_build_object(
    'guestUsage', v_usage,
    'analysisClaims', v_analysis_claims,
    'chatClaims', v_chat_claims,
    'rateLimitBuckets', v_rate_buckets,
    'analysisAdmissions', v_admissions
  );
end;
$$;
-- statement
revoke all on function public.dev_local_reset_guest(text) from public, anon, authenticated;
-- statement
grant execute on function public.dev_local_reset_guest(text) to service_role;
