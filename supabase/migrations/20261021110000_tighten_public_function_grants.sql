-- Revokes only. Follow-up to 20261021100000_tighten_public_data_api_grants.sql.
-- Evidence (client call sites, RLS and function situation, before/after
-- privilege tables) is in the PR that adds this file.

-- 1. The waitlist has no caller: the site's "Join the Waitlist" links to /,
--    /waitlist redirects to /en/, and no app code or edge function writes it.
--    Anon INSERT was only a spam vector. Anon and authenticated now hold no
--    privilege on the table; service_role keeps its grants.
revoke insert on table public.waitlist_subscribers from anon;

-- 2. sync_dream_mutations is SECURITY DEFINER and only the signed-in client
--    calls it (services/journalMutationTransport.ts). It already refuses a
--    null auth.uid(); anon loses the explicit grant. authenticated and
--    service_role keep theirs.
revoke execute on function public.sync_dream_mutations(jsonb) from anon;

-- 3. No client reads subscription_state. The tier reaches clients through the
--    SECURITY DEFINER RPCs get_effective_subscription_tier and
--    get_authenticated_quota_snapshot; edge functions read it as service_role.
revoke select on table public.subscription_state from authenticated;

-- 4 and 5. Trigger functions cannot be called through the Data API, and
--    PostgreSQL checks EXECUTE on a trigger function only at CREATE TRIGGER,
--    never when the trigger fires. PUBLIC and anon lose EXECUTE. The two
--    SECURITY DEFINER ones (log_user_quota_event, enforce_quota_for_chat) were
--    the only public SECURITY DEFINER functions PUBLIC could still execute
--    besides sync_dream_mutations. authenticated and service_role keep the
--    explicit grants they already had, so nothing needs re-granting.
revoke execute on function public.log_user_quota_event() from public, anon;
revoke execute on function public.enforce_quota_for_chat() from public, anon;
revoke execute on function public.enforce_authenticated_monthly_quota() from public, anon;
revoke execute on function public.project_dream_precise_theme() from public, anon;
revoke execute on function public.set_exploration_started_at_from_chat_history() from public, anon;
revoke execute on function public.touch_dream_revision() from public, anon;
