-- Service-side text failures release only the reservation this invocation owns.
-- Client changes, deletion, cancellation, unknown codes and successes keep quota.
-- Successful results and active queued retries retain their authorization.
alter table public.guest_analysis_quota_claims
  add column reservation_id uuid not null default gen_random_uuid();

-- Closed service-only refund policy shared by jobs and synchronous release RPCs.
create function private.is_refundable_text_analysis_failure(p_error_code text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select coalesce(p_error_code in (
    'ANALYSIS_PROVIDER_UNAVAILABLE',
    'ANALYSIS_PROVIDER_OVERLOADED',
    'ANALYSIS_PROVIDER_REFUSED',
    'ANALYSIS_TIMEOUT',
    'ANALYSIS_SERVER_ERROR',
    'ANALYSIS_CONFIGURATION_ERROR',
    'ANALYSIS_INVALID_OUTPUT',
    'AI_JOB_LEASE_EXPIRED'
  ), false);
$$;
revoke all on function private.is_refundable_text_analysis_failure(text) from public, anon, authenticated;
grant execute on function private.is_refundable_text_analysis_failure(text) to postgres;

create function public.reserve_guest_text_analysis(
  p_fingerprint text, p_analysis_request_id uuid, p_limit integer, p_transcript_sha256 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; reservation uuid;
begin
  if coalesce(auth.jwt()->>'role', '') not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  result := public.claim_guest_analysis_quota(p_fingerprint, p_analysis_request_id, p_limit, p_transcript_sha256);
  if (result->>'claimed')::boolean then
    select c.reservation_id into reservation from public.guest_analysis_quota_claims c
    where c.fingerprint_hash = p_fingerprint and c.analysis_request_id = p_analysis_request_id;
    result := result || jsonb_build_object('reservation_id', reservation);
  end if;
  return result;
end;
$$;

create function public.release_guest_text_analysis(p_fingerprint text, p_reservation_id uuid, p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt()->>'role', '') not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if not private.is_refundable_text_analysis_failure(p_failure_code) then return false; end if;
  -- Same lock order as admission. A repeated refund cannot release a later retry.
  perform 1 from public.guest_usage where fingerprint_hash = p_fingerprint for update;
  delete from public.guest_analysis_quota_claims
    where fingerprint_hash = p_fingerprint and reservation_id = p_reservation_id;
  if not found then return false; end if;
  update public.guest_usage set analysis_count = greatest(analysis_count - 1, 0)
    where fingerprint_hash = p_fingerprint;
  return true;
end;
$$;

create function public.release_authenticated_text_analysis(p_user_id uuid, p_claim_id uuid, p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare receipt public.quota_usage%rowtype;
begin
  if coalesce(auth.jwt()->>'role', '') not in ('service_role', 'supabase_admin') then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if not private.is_refundable_text_analysis_failure(p_failure_code) then return false; end if;
  select * into receipt from public.quota_usage where id = p_claim_id and user_id = p_user_id
    and quota_type = 'analysis' and metadata->>'source' = 'api_pre_provider';
  if not found then return false; end if;
  -- Dream first, then account, matching reserve_authenticated_analysis_authorization.
  perform 1 from public.dreams where id = receipt.dream_id and user_id = p_user_id for update;
  perform pg_advisory_xact_lock(hashtextextended(format('quota:analysis:all:%s', p_user_id::text), 0));
  delete from public.quota_usage where id = p_claim_id and user_id = p_user_id
    and quota_type = 'analysis' and metadata->>'source' = 'api_pre_provider';
  return found;
end;
$$;

-- A queued retry still owns its receipt. A terminal service failure refunds it,
-- including service lease expiration; terminal client failures keep it consumed.
create function private.refund_failed_text_analysis_job()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.job_type = 'analyze_dream' and new.status = 'failed' and old.status in ('queued', 'running') then
    perform 1 from public.dreams where id = new.dream_id and user_id = new.user_id for update;
    -- A legacy worker can requeue after completion committed but its reply was lost.
    -- Under the dream lock, retain the receipt for this already-saved reading.
    if exists (select 1 from public.dreams where id = new.dream_id and user_id = new.user_id
      and analysis_request_id::text = new.client_request_id and analysis_status = 'done') then
      return new;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(format('quota:analysis:all:%s', new.user_id::text), 0));
    -- Close the old pending request before making its quota available again.
    -- A synchronous retry must not start between refund and the worker's later
    -- best-effort dream update. Preserve a newer request or completed reading.
    update public.dreams set analysis_status = 'failed', revision_id = gen_random_uuid(), updated_at = now()
      where id = new.dream_id and user_id = new.user_id
        and analysis_request_id::text = new.client_request_id and analysis_status = 'pending';
    if not private.is_refundable_text_analysis_failure(new.error_code) then return new; end if;
    delete from public.quota_usage where user_id = new.user_id and dream_id = new.dream_id
      and quota_type = 'analysis' and metadata->>'source' = 'analysis_job_admission'
      and metadata->>'analysis_request_id' = new.client_request_id;
  end if;
  return new;
end;
$$;
create trigger refund_failed_text_analysis_job after update of status on public.ai_jobs
  for each row execute function private.refund_failed_text_analysis_job();

revoke all on function public.reserve_guest_text_analysis(text, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.release_guest_text_analysis(text, uuid, text) from public, anon, authenticated;
revoke all on function public.release_authenticated_text_analysis(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.refund_failed_text_analysis_job() from public, anon, authenticated;
grant execute on function public.reserve_guest_text_analysis(text, uuid, integer, text) to service_role;
grant execute on function public.release_guest_text_analysis(text, uuid, text) to service_role;
grant execute on function public.release_authenticated_text_analysis(uuid, uuid, text) to service_role;
