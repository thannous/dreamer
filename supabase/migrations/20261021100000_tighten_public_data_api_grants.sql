-- Tighten the Data API privileges of public tables to what a real client call
-- needs. Most of them came from Supabase's auto-expose default (all privileges
-- for anon and authenticated) and were made explicit, unchanged, by
-- 20261021090000_explicit_public_data_api_grants.sql.
--
-- Clients reach these tables only through:
--   - authenticated PostgREST reads and writes on dreams (own rows, RLS), and
--     authenticated reads of quota_limits, quota_usage (own rows) and
--     subscription_state (own row); the SECURITY INVOKER trigger
--     enforce_authenticated_monthly_quota also reads quota_limits and
--     quota_usage as the signed-in user;
--   - SECURITY DEFINER functions (sync_dream_mutations, guest quota and
--     subscription functions, Lucid sync), which run as their owner;
--   - Edge Functions with the service_role client.
-- service_role keeps every privilege it has. `revoke all` also removes
-- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN, which PostgREST never needs and
-- RLS does not cover.

-- Unused key-value table (no client or Edge Function reference); RLS with no policy.
revoke all on table public.kv_store_6e8fb8b0 from anon, authenticated;

-- Waitlist: only the anonymous signup insert its RLS policy allows is kept.
revoke all on table public.waitlist_subscribers from anon, authenticated;
grant insert on table public.waitlist_subscribers to anon;

-- Quota configuration: read by the signed-in app and its quota trigger; edited with service_role.
revoke all on table public.quota_limits from anon, authenticated;
grant select on table public.quota_limits to authenticated;

-- Quota ledger: own rows read by the signed-in app and its quota trigger;
-- written by SECURITY DEFINER functions and service_role.
revoke all on table public.quota_usage from anon, authenticated;
grant select on table public.quota_usage to authenticated;

-- Subscription state: own row readable (RLS); written by apply_subscription_state_update.
revoke all on table public.subscription_state from anon, authenticated;
grant select on table public.subscription_state to authenticated;

-- Subscription audit log: service_role and SECURITY DEFINER functions only; RLS with no policy.
revoke all on table public.subscription_events from anon, authenticated;

-- Guest quota: SECURITY DEFINER functions called by service_role only; RLS denies every client.
revoke all on table public.guest_usage from anon, authenticated;

-- Journal: signed-in owners keep their row-level DML; anonymous clients have no policy.
revoke all on table public.dreams from anon, authenticated;
grant select, insert, update, delete on table public.dreams to authenticated;

-- Lucid trainer: owner reads through get_lucid_trainer_entities (SECURITY INVOKER);
-- writes go through SECURITY DEFINER functions, as the Lucid spec states.
revoke all on table public.lucid_trainer_entities from authenticated;
grant select on table public.lucid_trainer_entities to authenticated;
revoke all on table public.lucid_trainer_reset_fences from authenticated;
grant select on table public.lucid_trainer_reset_fences to authenticated;

-- Identity sequences: nextval for an identity column needs no sequence
-- privilege, and UPDATE would let any client setval them.
revoke all on sequence public.dreams_id_seq1 from anon, authenticated;
revoke all on sequence public.dream_sync_receipts_id_seq from anon, authenticated;
