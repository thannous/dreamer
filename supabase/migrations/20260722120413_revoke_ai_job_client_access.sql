-- ai_jobs is a service-owned queue. RLS remains enabled with no client policy,
-- and explicit grants prevent inherited Data API privileges (including
-- TRUNCATE, which is outside row-level security) from widening that boundary.
revoke all on table public.ai_jobs
  from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.ai_jobs
  to service_role;
