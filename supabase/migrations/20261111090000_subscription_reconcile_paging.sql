-- The daily RevenueCat reconcile (20251223000000) listed accounts by asking the
-- Data API for auth.users. That schema is not exposed, so the request was
-- refused, and the job answered "ok" with nothing processed. It also started
-- again from the first account on every run, so accounts past the first batch
-- would never have been reached.
--
-- This gives the job a service-role function to page through accounts, and a
-- place to remember where it stopped.

create table public.subscription_reconcile_cursor (
  id boolean primary key default true check (id),
  last_user_id uuid,
  updated_at timestamptz not null default now()
);

alter table public.subscription_reconcile_cursor enable row level security;

-- Written and read by the reconcile route alone, through the service role.
revoke all on table public.subscription_reconcile_cursor from anon;
revoke all on table public.subscription_reconcile_cursor from authenticated;
grant select, insert, update on table public.subscription_reconcile_cursor to service_role;

create or replace function public.list_subscription_reconcile_users(
  p_after uuid,
  p_limit integer
)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users as u
  where p_after is null or u.id > p_after
  order by u.id
  limit least(greatest(coalesce(p_limit, 150), 1), 300);
$$;

revoke all on function public.list_subscription_reconcile_users(uuid, integer) from public;
revoke all on function public.list_subscription_reconcile_users(uuid, integer) from anon;
revoke all on function public.list_subscription_reconcile_users(uuid, integer) from authenticated;
grant execute on function public.list_subscription_reconcile_users(uuid, integer) to service_role;
