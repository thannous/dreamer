-- QA ONLY. Prepare/review against the approved QA project before applying.
-- Deliberately outside supabase/migrations: never deployed to production.
-- No service-role/admin key is needed by the runner.
create table public.qa_account_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_id uuid not null,
  acquired_at timestamptz not null default now()
);
alter table public.qa_account_leases enable row level security;
revoke all on public.qa_account_leases from public, anon, authenticated;
grant select, insert, delete on public.qa_account_leases to authenticated;
grant select on public.qa_account_leases to service_role; -- QA owner recovery / local proof only
create policy qa_account_lease_read on public.qa_account_leases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy qa_account_lease_claim on public.qa_account_leases
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy qa_account_lease_release on public.qa_account_leases
  for delete to authenticated using ((select auth.uid()) = user_id);
-- No expiry/takeover RPC or UPDATE grant. A crashed owner keeps its lock until
-- a human verifies that it stopped and recovers only that run's registered IDs.
notify pgrst, 'reload schema';
