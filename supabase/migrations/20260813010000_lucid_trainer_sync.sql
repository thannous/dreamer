-- Local-first Lucid Trainer sync. This migration is additive and is not applied
-- by the client; production rollout remains an explicit release operation.

create table if not exists public.lucid_trainer_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'onboarding', 'preferences', 'progress', 'experiment', 'reality_check', 'weekly_review'
  )),
  entity_key text not null check (char_length(entity_key) between 1 and 256),
  revision bigint not null default 1 check (revision > 0),
  value jsonb,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_key),
  check ((deleted_at is null and value is not null) or (deleted_at is not null and value is null))
);

create index if not exists lucid_trainer_entities_user_updated_idx
  on public.lucid_trainer_entities (user_id, updated_at desc);

alter table public.lucid_trainer_entities enable row level security;
alter table public.lucid_trainer_entities force row level security;

drop policy if exists lucid_trainer_entities_select_own on public.lucid_trainer_entities;
create policy lucid_trainer_entities_select_own on public.lucid_trainer_entities
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.lucid_trainer_entities from public, anon;
grant select on public.lucid_trainer_entities to authenticated;
grant all on public.lucid_trainer_entities to service_role;

create table if not exists public.lucid_trainer_sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  mutation_id text not null check (char_length(mutation_id) between 1 and 256),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);

create index if not exists lucid_trainer_sync_receipts_created_idx
  on public.lucid_trainer_sync_receipts (created_at);

alter table public.lucid_trainer_sync_receipts enable row level security;
alter table public.lucid_trainer_sync_receipts force row level security;
revoke all on public.lucid_trainer_sync_receipts from public, anon, authenticated;
grant all on public.lucid_trainer_sync_receipts to service_role;

-- A reset generation is intentionally independent from entity revisions. It
-- survives recreation of onboarding/preferences and therefore prevents an
-- offline device from uploading pre-deletion data after another device has
-- requested a full Lucid Trainer deletion.
create table if not exists public.lucid_trainer_reset_fences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null check (generation > 0),
  deleted_at timestamptz not null
);

alter table public.lucid_trainer_reset_fences enable row level security;
alter table public.lucid_trainer_reset_fences force row level security;

drop policy if exists lucid_trainer_reset_fences_select_own
  on public.lucid_trainer_reset_fences;
create policy lucid_trainer_reset_fences_select_own
  on public.lucid_trainer_reset_fences
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.lucid_trainer_reset_fences from public, anon;
grant select on public.lucid_trainer_reset_fences to authenticated;
grant all on public.lucid_trainer_reset_fences to service_role;

create or replace function public.sync_lucid_trainer_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  mutation jsonb;
  stored public.lucid_trainer_entities%rowtype;
  receipt jsonb;
  result jsonb;
  mutation_id text;
  request_id uuid;
  requested_type text;
  requested_key text;
  requested_operation text;
  requested_base_revision bigint;
  requested_reset_revision bigint;
  requested_updated_at timestamptz;
  requested_entity jsonb;
  next_revision bigint;
  active_reset_revision bigint;
  active_reset_at timestamptz;
  results jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  if jsonb_typeof(mutations) <> 'array' or jsonb_array_length(mutations) > 100 then
    raise exception 'Invalid Lucid Trainer mutation batch' using errcode = '22023';
  end if;

  for mutation in select value from jsonb_array_elements(mutations)
  loop
    begin
      mutation_id := mutation->>'mutation_id';
      request_id := (mutation->>'client_request_id')::uuid;
      requested_type := mutation->>'entity_type';
      requested_key := mutation->>'entity_key';
      requested_operation := mutation->>'operation';
      requested_updated_at := (mutation->>'client_updated_at')::timestamptz;
      requested_entity := mutation#>'{payload,entity}';
      requested_base_revision := case
        when mutation->>'base_revision' is null then null
        else (mutation->>'base_revision')::bigint
      end;
      requested_reset_revision := case
        when mutation->>'reset_revision' is null then null
        else (mutation->>'reset_revision')::bigint
      end;

      if mutation_id is null or char_length(mutation_id) not between 1 and 256
        or requested_type not in ('onboarding', 'preferences', 'progress', 'experiment', 'reality_check', 'weekly_review')
        or requested_key is null or char_length(requested_key) not between 1 and 256
        or requested_operation not in ('upsert', 'delete') then
        raise exception 'Invalid Lucid Trainer mutation';
      end if;

      select r.result into receipt
      from public.lucid_trainer_sync_receipts r
      where r.user_id = current_user_id and r.client_request_id = request_id;
      if receipt is not null then
        results := results || jsonb_build_array(receipt);
        continue;
      end if;

      -- The reset generation changes only when full Lucid data is deleted and
      -- remains available after singleton entities have been recreated.
      select f.generation, f.deleted_at
      into active_reset_revision, active_reset_at
      from public.lucid_trainer_reset_fences f
      where f.user_id = current_user_id;

      if active_reset_at is not null
        and requested_reset_revision is distinct from active_reset_revision then
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'conflict',
          'remote_revision', active_reset_revision::text,
          'error', 'remote_reset_required'
        );
        results := results || jsonb_build_array(result);
        continue;
      end if;

      select * into stored
      from public.lucid_trainer_entities e
      where e.user_id = current_user_id
        and e.entity_type = requested_type
        and e.entity_key = requested_key
      for update;

      if found and (
        requested_base_revision is null
        or requested_base_revision <> stored.revision
      ) then
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'conflict',
          'remote_revision', stored.revision::text,
          'error', 'revision_conflict'
        ) || case when stored.deleted_at is null then jsonb_build_object(
          'remote_entity', jsonb_build_object(
            'entityType', stored.entity_type,
            'entityKey', stored.entity_key,
            'value', stored.value
          )
        ) else '{}'::jsonb end;
      elsif requested_operation = 'upsert' then
        if requested_entity is null
          or requested_entity->>'entityType' <> requested_type
          or requested_entity->>'entityKey' <> requested_key
          or requested_entity->'value' is null then
          raise exception 'Invalid Lucid Trainer entity payload';
        end if;
        next_revision := case when stored.user_id is null then 1 else stored.revision + 1 end;
        insert into public.lucid_trainer_entities (
          user_id, entity_type, entity_key, revision, value, client_updated_at, deleted_at, updated_at
        ) values (
          current_user_id, requested_type, requested_key, next_revision,
          requested_entity->'value', requested_updated_at, null, now()
        )
        on conflict (user_id, entity_type, entity_key) do update set
          revision = excluded.revision,
          value = excluded.value,
          client_updated_at = excluded.client_updated_at,
          deleted_at = null,
          updated_at = now();
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'ack',
          'remote_revision', next_revision::text,
          'remote_entity', jsonb_build_object(
            'entityType', requested_type,
            'entityKey', requested_key,
            'value', requested_entity->'value'
          )
        );
      else
        next_revision := case when stored.user_id is null then 1 else stored.revision + 1 end;
        insert into public.lucid_trainer_entities (
          user_id, entity_type, entity_key, revision, value, client_updated_at, deleted_at, updated_at
        ) values (
          current_user_id, requested_type, requested_key, next_revision,
          null, requested_updated_at, requested_updated_at, now()
        )
        on conflict (user_id, entity_type, entity_key) do update set
          revision = excluded.revision,
          value = null,
          client_updated_at = excluded.client_updated_at,
          deleted_at = excluded.deleted_at,
          updated_at = now();
        result := jsonb_build_object(
          'mutation_id', mutation_id,
          'status', 'ack',
          'remote_revision', next_revision::text
        );
      end if;

      insert into public.lucid_trainer_sync_receipts (
        user_id, client_request_id, mutation_id, result
      ) values (current_user_id, request_id, mutation_id, result)
      on conflict (user_id, client_request_id) do nothing;
      results := results || jsonb_build_array(result);
    exception when others then
      result := jsonb_build_object(
        'mutation_id', coalesce(mutation_id, mutation->>'mutation_id', 'invalid'),
        'status', 'failed',
        'error', left(sqlerrm, 500)
      );
      results := results || jsonb_build_array(result);
    end;
  end loop;

  return results;
end;
$$;

create or replace function public.get_lucid_trainer_entities()
returns jsonb
language sql
security invoker
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'entities', coalesce((
      select jsonb_agg(rows.payload order by rows.entity_type, rows.entity_key)
      from (
        select
          e.entity_type,
          e.entity_key,
          case when e.deleted_at is null then jsonb_build_object(
            'entity_type', e.entity_type,
            'entity_key', e.entity_key,
            'revision', e.revision::text,
            'client_updated_at', e.client_updated_at,
            'entity', jsonb_build_object(
              'entityType', e.entity_type,
              'entityKey', e.entity_key,
              'value', e.value
            )
          ) else jsonb_build_object(
            'entity_type', e.entity_type,
            'entity_key', e.entity_key,
            'revision', e.revision::text,
            'client_updated_at', e.client_updated_at,
            'deleted_at', e.deleted_at
          ) end as payload
        from public.lucid_trainer_entities e
        where e.user_id = (select auth.uid())
      ) as rows
    ), '[]'::jsonb)
  ) || coalesce((
    select jsonb_build_object(
      'reset_revision', f.generation::text,
      'reset_at', f.deleted_at
    )
    from public.lucid_trainer_reset_fences f
    where f.user_id = (select auth.uid())
  ), '{}'::jsonb);
$$;

create or replace function public.delete_lucid_trainer_data()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deletion_timestamp timestamptz := clock_timestamp();
  reset_generation bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  delete from public.lucid_trainer_sync_receipts where user_id = current_user_id;

  insert into public.lucid_trainer_reset_fences (user_id, generation, deleted_at)
  values (current_user_id, 1, deletion_timestamp)
  on conflict (user_id) do update set
    generation = public.lucid_trainer_reset_fences.generation + 1,
    deleted_at = excluded.deleted_at
  returning generation into reset_generation;

  update public.lucid_trainer_entities
  set
    revision = revision + 1,
    value = null,
    client_updated_at = deletion_timestamp,
    deleted_at = deletion_timestamp,
    updated_at = deletion_timestamp
  where user_id = current_user_id;

  -- Singleton tombstones reset local state immediately. The separate reset
  -- fence remains durable if these rows are later recreated.
  insert into public.lucid_trainer_entities (
    user_id,
    entity_type,
    entity_key,
    revision,
    value,
    client_updated_at,
    deleted_at,
    updated_at
  ) values
    (
      current_user_id,
      'onboarding',
      'onboarding',
      reset_generation,
      null,
      deletion_timestamp,
      deletion_timestamp,
      deletion_timestamp
    ),
    (
      current_user_id,
      'preferences',
      'preferences',
      reset_generation,
      null,
      deletion_timestamp,
      deletion_timestamp,
      deletion_timestamp
    )
  on conflict (user_id, entity_type, entity_key) do nothing;
  return true;
end;
$$;

revoke all on function public.sync_lucid_trainer_mutations(jsonb) from public, anon;
revoke all on function public.get_lucid_trainer_entities() from public, anon;
revoke all on function public.delete_lucid_trainer_data() from public, anon;
grant execute on function public.sync_lucid_trainer_mutations(jsonb) to authenticated;
grant execute on function public.get_lucid_trainer_entities() to authenticated;
grant execute on function public.delete_lucid_trainer_data() to authenticated;

comment on table public.lucid_trainer_entities is
  'Versioned, user-owned Lucid Trainer entities. Text notes stay inside the private account row.';
comment on table public.lucid_trainer_reset_fences is
  'Durable full-deletion generations used to reject stale offline Lucid Trainer uploads.';
