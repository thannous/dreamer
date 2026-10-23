-- A bounded, private collection per account. The account deletion FK erases it.
create or replace function public.valid_badge_ledger(p_ledger jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  section text; family text; value jsonb; item jsonb;
  families constant text[] := array['night-journal','gentle-rhythm','night-thread','moon-cycles',
    'ink-dreamer','night-voice','memory-keeper','dream-reader','time-traveler','treasure-keeper',
    'favorite-echoes','dream-weaver','dream-namer','night-cartographer','dream-seeker','path-finder',
    'symbol-explorer','night-scholar','observatory','dream-painter'];
begin
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'object' or octet_length(p_ledger::text) > 524288
    or p_ledger->'version' is distinct from '1'::jsonb
    or (p_ledger - array['version','keys','best','earned','revealed']) <> '{}'::jsonb then return false; end if;
  foreach section in array array['keys','best','earned','revealed'] loop
    if jsonb_typeof(p_ledger->section) is distinct from 'object' then return false; end if;
    for family, value in select key, val from jsonb_each(p_ledger->section) as entries(key,val) loop
      if not family = any(families) then return false; end if;
      if section = 'keys' then
        if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > 100 then return false; end if;
        for item in select * from jsonb_array_elements(value) loop
          if jsonb_typeof(item) <> 'string' or length(item #>> '{}') not between 1 and 512
            or (item #>> '{}') !~ '^[A-Za-z0-9_:|.-]+$' then return false; end if;
        end loop;
      elsif section = 'earned' then
        if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > 3 then return false; end if;
        for item in select * from jsonb_array_elements(value) loop
          if jsonb_typeof(item) <> 'number' or (item::text)::numeric not between 0 and 9007199254740991 then return false; end if;
        end loop;
      else
        if jsonb_typeof(value) <> 'number' or (value::text)::numeric not between 0 and 9007199254740991
          or trunc((value::text)::numeric) <> (value::text)::numeric then return false; end if;
        if section = 'revealed' and (value::text)::numeric > 3 then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_badge_ledger(jsonb) from public, anon;
grant execute on function public.valid_badge_ledger(jsonb) to authenticated, service_role;

create table public.badge_ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ledger jsonb not null default '{"version":1,"keys":{},"best":{},"earned":{},"revealed":{}}'::jsonb
    check (public.valid_badge_ledger(ledger)),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.badge_ledgers enable row level security;
revoke all on table public.badge_ledgers from public, anon, authenticated;
grant select, insert, update on table public.badge_ledgers to authenticated;
grant all on table public.badge_ledgers to service_role;
create policy badge_ledger_read on public.badge_ledgers for select to authenticated using ((select auth.uid()) = user_id);
create policy badge_ledger_create on public.badge_ledgers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy badge_ledger_update on public.badge_ledgers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Collections belong to Dreamer, even when another product uses the same account.
create policy app_product_scope on public.badge_ledgers
  as restrictive for all to authenticated
  using ((select public.current_app_product()) in ('legacy', 'journal'))
  with check ((select public.current_app_product()) in ('legacy', 'journal'));

-- SECURITY INVOKER preserves RLS. Expected account also prevents a session-switch race:
-- an in-flight A worker must not send its facts using B's newly refreshed auth token.
create or replace function public.sync_badge_ledger(p_user_id uuid, p_revision bigint default null, p_ledger jsonb default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.badge_ledgers%rowtype; accepted boolean := false;
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'Badge account mismatch' using errcode = '42501';
  end if;
  if public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow badge collection access' using errcode = '42501';
  end if;
  if (p_revision is null) <> (p_ledger is null) then
    raise exception 'Badge revision and ledger must be provided together' using errcode = '22023';
  end if;
  if p_ledger is not null and not public.valid_badge_ledger(p_ledger) then
    raise exception 'Invalid badge ledger' using errcode = '22023';
  end if;
  insert into public.badge_ledgers (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into current_row from public.badge_ledgers where user_id = p_user_id for update;
  if p_revision is not null and p_revision = current_row.revision then
    update public.badge_ledgers set ledger = p_ledger, revision = revision + 1, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    accepted := true;
  end if;
  return jsonb_build_object('ledger', current_row.ledger, 'revision', current_row.revision, 'accepted', accepted);
end;
$$;
revoke all on function public.sync_badge_ledger(uuid,bigint,jsonb) from public, anon;
grant execute on function public.sync_badge_ledger(uuid,bigint,jsonb) to authenticated;
