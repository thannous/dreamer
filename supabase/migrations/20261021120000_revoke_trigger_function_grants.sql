-- Revokes only. Follow-up to 20261021110000_tighten_public_function_grants.sql.
-- These six functions only run as triggers on public.dreams. PostgreSQL checks
-- EXECUTE on a trigger function when the trigger is created, never when it
-- fires, and the Data API does not expose trigger functions, so the explicit
-- authenticated and service_role grants are not needed by anyone. After this
-- file only the owner (postgres) can execute them; PUBLIC and anon already
-- lost EXECUTE in 20261021110000.
revoke execute on function public.log_user_quota_event() from authenticated, service_role;
revoke execute on function public.enforce_quota_for_chat() from authenticated, service_role;
revoke execute on function public.enforce_authenticated_monthly_quota() from authenticated, service_role;
revoke execute on function public.project_dream_precise_theme() from authenticated, service_role;
revoke execute on function public.set_exploration_started_at_from_chat_history() from authenticated, service_role;
revoke execute on function public.touch_dream_revision() from authenticated, service_role;
