-- The collection narrowed to nine families and six cards earned once (ledger version 2), with
-- up to five tiers. Version 1 stays valid so an older app keeps its own copy until a current
-- one converts it; a version 1 write never replaces a version 2 copy.
create or replace function public.valid_badge_ledger(p_ledger jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  section text; family text; value jsonb; item jsonb; families text[]; max_tiers integer;
  v1_families constant text[] := array['night-journal','gentle-rhythm','night-thread','moon-cycles',
    'ink-dreamer','night-voice','memory-keeper','dream-reader','time-traveler','treasure-keeper',
    'favorite-echoes','dream-weaver','dream-namer','night-cartographer','dream-seeker','path-finder',
    'symbol-explorer','night-scholar','observatory','dream-painter'];
  v2_families constant text[] := array['night-journal','moon-cycles','memory-keeper','dream-reader',
    'time-traveler','dream-weaver','symbol-explorer','night-scholar','night-echoes','night-voice',
    'dream-questions','treasure-keeper','dream-painter','dream-seeker','observatory'];
begin
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'object' or octet_length(p_ledger::text) > 524288
    or (p_ledger - array['version','keys','best','earned','revealed']) <> '{}'::jsonb then return false; end if;
  if p_ledger->'version' = '1'::jsonb then
    families := v1_families; max_tiers := 3;
  elsif p_ledger->'version' = '2'::jsonb then
    families := v2_families; max_tiers := 5;
  else
    return false;
  end if;
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
        if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > max_tiers then return false; end if;
        for item in select * from jsonb_array_elements(value) loop
          if jsonb_typeof(item) <> 'number' or (item::text)::numeric not between 0 and 9007199254740991 then return false; end if;
        end loop;
      else
        if jsonb_typeof(value) <> 'number' or (value::text)::numeric not between 0 and 9007199254740991
          or trunc((value::text)::numeric) <> (value::text)::numeric then return false; end if;
        if section = 'revealed' and (value::text)::numeric > max_tiers then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_badge_ledger(jsonb) from public, anon;
grant execute on function public.valid_badge_ledger(jsonb) to authenticated, service_role;

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
  -- An older app cannot read a converted copy, so it never takes it back to version 1.
  if p_revision is not null and p_revision = current_row.revision
    and not (p_ledger->'version' = '1'::jsonb and current_row.ledger->'version' = '2'::jsonb) then
    update public.badge_ledgers set ledger = p_ledger, revision = revision + 1, updated_at = now()
      where user_id = p_user_id returning * into current_row;
    accepted := true;
  end if;
  return jsonb_build_object('ledger', current_row.ledger, 'revision', current_row.revision, 'accepted', accepted);
end;
$$;
revoke all on function public.sync_badge_ledger(uuid,bigint,jsonb) from public, anon;
grant execute on function public.sync_badge_ledger(uuid,bigint,jsonb) to authenticated;
