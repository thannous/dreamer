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
--
-- Production differs from a local replay on two names (read-only check of
-- production, 2026-10-21): kv_store_6e8fb8b0 does not exist there, and the
-- sequence behind dreams.id is dreams_id_seq (dreams_id_seq1 locally). Those
-- two statements are therefore conditional, so the file applies on both.

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
-- Unused key-value table: present in a local replay, absent in production.
do $$
begin
  if to_regclass('public.kv_store_6e8fb8b0') is not null then
    grant select, insert, update, delete on table public.kv_store_6e8fb8b0 to anon, authenticated, service_role;
  end if;
end $$;
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
-- The sequence behind dreams.id, whatever its name (dreams_id_seq in production).
do $$
declare
  dreams_id_sequence text := pg_get_serial_sequence('public.dreams', 'id');
begin
  if dreams_id_sequence is not null then
    execute format('grant select, usage on sequence %s to anon, authenticated, service_role', dreams_id_sequence);
  end if;
end $$;

-- Functions.
grant execute on function public.begin_authenticated_chat_turn(bigint, uuid, jsonb) to service_role;
grant execute on function public.complete_authenticated_chat_turn(bigint, uuid, integer, jsonb) to service_role;
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
grant execute on function public.serialize_dream_for_sync(public.dreams) to anon, authenticated, service_role;
grant execute on function public.set_exploration_started_at_from_chat_history() to anon, authenticated, service_role;
grant execute on function public.sync_dream_mutations(jsonb) to anon, service_role;
grant execute on function public.sync_lucid_trainer_mutations(jsonb) to service_role;
grant execute on function public.touch_dream_revision() to anon, authenticated, service_role;

-- Journal import functions come from 20260909020000_journal_import_grants,
-- which production has not applied: grant only where they exist.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_journal_import_grant(text, bigint[])',
    'public.read_journal_import_page(uuid, integer)',
    'public.revoke_journal_import_grant(uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('grant execute on function %s to service_role', to_regprocedure(fn));
    end if;
  end loop;
end $$;
