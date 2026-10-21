-- Explicit Data API grants for the public objects that so far relied on
-- Supabase's default privileges for new entities ("auto-expose").
--
-- From 2026-10-30, Supabase stops granting anon, authenticated and service_role
-- anything on new objects in public, and supabase/config.toml now sets
-- [api] auto_expose_new_tables = false so the local stack does the same. A
-- fresh database (local reset, preview branch, new project) replaying the
-- migrations would then miss the privileges below.
--
-- This list is the exact difference between a native local reset with
-- auto-expose on and one with it off, so it changes nothing on a database
-- created with auto-expose (production): every statement grants a privilege
-- that is already there. It keeps the current privileges as they are; it does
-- not review them.

-- Tables.
grant select, insert, update, delete on table public.ai_rate_limit_buckets to service_role;
grant select, insert, update, delete on table public.device_account_links to service_role;
grant select, insert, update, delete on table public.dream_chat_messages to service_role;
grant select, insert, update, delete on table public.dream_chat_turns to service_role;
grant select, insert, update, delete on table public.dream_sync_receipts to service_role;
grant select, insert, update, delete on table public.dreams to anon;
grant select, insert, update, delete on table public.guest_analysis_quota_claims to service_role;
grant select, insert, update, delete on table public.guest_chat_quota_claims to service_role;
grant select, insert, update, delete on table public.guest_usage to anon, authenticated, service_role;
grant select, insert, update, delete on table public.kv_store_6e8fb8b0 to anon, authenticated, service_role;
grant insert, update, delete on table public.lucid_trainer_entities to authenticated;
grant insert, update, delete on table public.lucid_trainer_reset_fences to authenticated;
grant update on table public.product_analytics_events to service_role;
grant select, insert, update, delete on table public.quota_limits to anon, authenticated, service_role;
grant select, insert, update, delete on table public.quota_usage to anon, authenticated, service_role;
grant select, insert, update, delete on table public.subscription_events to anon, authenticated, service_role;
grant select, insert, update, delete on table public.subscription_state to anon, authenticated, service_role;
grant insert, update, delete on table public.waitlist_subscribers to service_role;
grant select, insert, update, delete on table public.waitlist_subscribers to authenticated;
grant select, update, delete on table public.waitlist_subscribers to anon;

-- Sequences.
grant select, usage on sequence public.dream_sync_receipts_id_seq to anon, authenticated, service_role;
grant select, usage on sequence public.dreams_id_seq1 to anon, authenticated, service_role;

-- Functions.
grant execute on function public.begin_authenticated_chat_turn(bigint, uuid, jsonb) to service_role;
grant execute on function public.complete_authenticated_chat_turn(bigint, uuid, integer, jsonb) to service_role;
grant execute on function public.create_journal_import_grant(text, bigint[]) to service_role;
grant execute on function public.delete_lucid_trainer_data() to service_role;
grant execute on function public.enforce_authenticated_monthly_quota() to anon, authenticated, service_role;
grant execute on function public.enforce_quota_for_chat() to anon, authenticated, service_role;
grant execute on function public.fail_authenticated_chat_turn(bigint, uuid, integer, text) to service_role;
grant execute on function public.get_hd_image_quota() to service_role;
grant execute on function public.get_lucid_trainer_entities() to service_role;
grant execute on function public.legacy_dream_theme(text) to anon, authenticated, service_role;
grant execute on function public.log_user_quota_event() to anon, authenticated, service_role;
grant execute on function public.project_dream_precise_theme() to anon, authenticated, service_role;
grant execute on function public.project_image_job_failure_reason() to service_role;
grant execute on function public.read_journal_import_page(uuid, integer) to service_role;
grant execute on function public.revoke_journal_import_grant(uuid) to service_role;
grant execute on function public.serialize_dream_for_sync(public.dreams) to anon, authenticated, service_role;
grant execute on function public.set_exploration_started_at_from_chat_history() to anon, authenticated, service_role;
grant execute on function public.sync_dream_mutations(jsonb) to anon, service_role;
grant execute on function public.sync_lucid_trainer_mutations(jsonb) to service_role;
grant execute on function public.touch_dream_revision() to anon, authenticated, service_role;
