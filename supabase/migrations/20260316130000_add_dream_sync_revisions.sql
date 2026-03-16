alter table public.dreams
  add column if not exists updated_at timestamptz,
  add column if not exists client_updated_at timestamptz,
  add column if not exists revision_id uuid;

update public.dreams
set
  updated_at = coalesce(updated_at, created_at, now()),
  client_updated_at = coalesce(client_updated_at, created_at, updated_at, now()),
  revision_id = coalesce(revision_id, gen_random_uuid())
where
  updated_at is null
  or client_updated_at is null
  or revision_id is null;

alter table public.dreams
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column revision_id set default gen_random_uuid(),
  alter column revision_id set not null;

create index if not exists dreams_user_revision_idx
  on public.dreams (user_id, revision_id);

create table if not exists public.dream_sync_receipts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  entity_type text not null default 'dream',
  entity_key text not null,
  operation text not null,
  mutation_status text not null,
  dream_id bigint,
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_request_id)
);

revoke all on table public.dream_sync_receipts from public;
revoke all on table public.dream_sync_receipts from anon, authenticated;

create or replace function public.touch_dream_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.revision_id := gen_random_uuid();
  new.client_updated_at := coalesce(new.client_updated_at, now());
  return new;
end;
$$;

drop trigger if exists trg_touch_dream_revision on public.dreams;

create trigger trg_touch_dream_revision
before update on public.dreams
for each row
execute function public.touch_dream_revision();

create or replace function public.serialize_dream_for_sync(dream_row public.dreams)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', dream_row.id,
    'created_at', dream_row.created_at,
    'updated_at', dream_row.updated_at,
    'client_updated_at', dream_row.client_updated_at,
    'revision_id', dream_row.revision_id,
    'user_id', dream_row.user_id,
    'transcript', dream_row.transcript,
    'title', dream_row.title,
    'interpretation', dream_row.interpretation,
    'shareable_quote', dream_row.shareable_quote,
    'image_url', dream_row.image_url,
    'chat_history', dream_row.chat_history,
    'theme', dream_row.theme,
    'dream_type', dream_row.dream_type,
    'is_favorite', dream_row.is_favorite,
    'image_generation_failed', dream_row.image_generation_failed,
    'is_analyzed', dream_row.is_analyzed,
    'analyzed_at', dream_row.analyzed_at,
    'analysis_status', dream_row.analysis_status,
    'analysis_request_id', dream_row.analysis_request_id,
    'exploration_started_at', dream_row.exploration_started_at,
    'client_request_id', dream_row.client_request_id,
    'has_person', dream_row.has_person,
    'has_animal', dream_row.has_animal
  );
$$;

create or replace function public.sync_dream_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  mutation jsonb;
  payload jsonb;
  response jsonb := '[]'::jsonb;
  result_entry jsonb;
  existing_receipt jsonb;
  target_row public.dreams%rowtype;
  saved_row public.dreams%rowtype;
  mutation_id text;
  mutation_operation text;
  mutation_client_request_id uuid;
  mutation_entity_key text;
  mutation_base_revision text;
  target_remote_id bigint;
  create_client_request_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = 'P0001';
  end if;

  if jsonb_typeof(mutations) is distinct from 'array' then
    raise exception 'mutations must be a json array' using errcode = 'P0001';
  end if;

  for mutation in
    select value
    from jsonb_array_elements(mutations)
  loop
    mutation_id := coalesce(mutation->>'mutation_id', '');
    mutation_operation := coalesce(mutation->>'operation', '');
    mutation_entity_key := coalesce(mutation->>'entity_key', '');
    mutation_base_revision := nullif(mutation->>'base_revision', '');
    payload := coalesce(mutation->'payload', '{}'::jsonb);

    begin
      mutation_client_request_id := (mutation->>'client_request_id')::uuid;
    exception when others then
      mutation_client_request_id := null;
    end;

    if mutation_id = '' or mutation_client_request_id is null or mutation_operation = '' then
      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', coalesce(mutation->>'client_request_id', ''),
        'operation', mutation_operation,
        'status', 'failed',
        'error', 'Malformed sync mutation payload'
      );
      response := response || jsonb_build_array(result_entry);
      continue;
    end if;

    select receipt.response
    into existing_receipt
    from public.dream_sync_receipts as receipt
    where receipt.user_id = current_user_id
      and receipt.client_request_id = mutation_client_request_id;

    if existing_receipt is not null then
      response := response || jsonb_build_array(existing_receipt);
      continue;
    end if;

    result_entry := null;

    if mutation_operation = 'create' then
      create_client_request_id := coalesce(
        nullif(payload->>'client_request_id', '')::uuid,
        mutation_client_request_id
      );

      insert into public.dreams (
        user_id,
        client_request_id,
        transcript,
        title,
        interpretation,
        shareable_quote,
        image_url,
        chat_history,
        theme,
        dream_type,
        is_favorite,
        image_generation_failed,
        is_analyzed,
        analyzed_at,
        analysis_status,
        analysis_request_id,
        exploration_started_at,
        has_person,
        has_animal,
        client_updated_at
      )
      values (
        current_user_id,
        create_client_request_id,
        coalesce(payload->>'transcript', ''),
        coalesce(payload->>'title', ''),
        coalesce(payload->>'interpretation', ''),
        coalesce(payload->>'shareable_quote', ''),
        nullif(payload->>'image_url', ''),
        coalesce(payload->'chat_history', '[]'::jsonb),
        nullif(payload->>'theme', ''),
        coalesce(payload->>'dream_type', 'Symbolic Dream'),
        coalesce((payload->>'is_favorite')::boolean, false),
        coalesce((payload->>'image_generation_failed')::boolean, false),
        coalesce((payload->>'is_analyzed')::boolean, false),
        nullif(payload->>'analyzed_at', '')::timestamptz,
        coalesce(payload->>'analysis_status', 'none'),
        nullif(payload->>'analysis_request_id', ''),
        nullif(payload->>'exploration_started_at', '')::timestamptz,
        (payload->>'has_person')::boolean,
        (payload->>'has_animal')::boolean,
        coalesce(nullif(payload->>'client_updated_at', '')::timestamptz, now())
      )
      on conflict (user_id, client_request_id)
      do update set
        transcript = excluded.transcript,
        title = excluded.title,
        interpretation = excluded.interpretation,
        shareable_quote = excluded.shareable_quote,
        image_url = excluded.image_url,
        chat_history = excluded.chat_history,
        theme = excluded.theme,
        dream_type = excluded.dream_type,
        is_favorite = excluded.is_favorite,
        image_generation_failed = excluded.image_generation_failed,
        is_analyzed = excluded.is_analyzed,
        analyzed_at = excluded.analyzed_at,
        analysis_status = excluded.analysis_status,
        analysis_request_id = excluded.analysis_request_id,
        exploration_started_at = excluded.exploration_started_at,
        has_person = excluded.has_person,
        has_animal = excluded.has_animal,
        client_updated_at = excluded.client_updated_at
      returning * into saved_row;

      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', mutation_client_request_id,
        'operation', mutation_operation,
        'status', 'ack',
        'dream', public.serialize_dream_for_sync(saved_row),
        'remote_id', saved_row.id
      );
    elsif mutation_operation = 'update' then
      target_remote_id := nullif(payload->>'remote_id', '')::bigint;

      if target_remote_id is null then
        result_entry := jsonb_build_object(
          'mutation_id', mutation_id,
          'client_request_id', mutation_client_request_id,
          'operation', mutation_operation,
          'status', 'failed',
          'error', 'Missing remote dream id for update'
        );
      else
        select *
        into target_row
        from public.dreams
        where id = target_remote_id
          and user_id = current_user_id;

        if not found then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'failed',
            'remote_id', target_remote_id,
            'error', 'Dream not found'
          );
        elsif mutation_base_revision is not null and target_row.revision_id::text <> mutation_base_revision then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'conflict',
            'remote_id', target_row.id,
            'dream', public.serialize_dream_for_sync(target_row),
            'error', 'Dream revision conflict'
          );
        else
          update public.dreams
          set
            transcript = coalesce(payload->>'transcript', target_row.transcript),
            title = coalesce(payload->>'title', target_row.title),
            interpretation = coalesce(payload->>'interpretation', target_row.interpretation),
            shareable_quote = coalesce(payload->>'shareable_quote', target_row.shareable_quote),
            image_url = nullif(coalesce(payload->>'image_url', target_row.image_url), ''),
            chat_history = coalesce(payload->'chat_history', target_row.chat_history),
            theme = nullif(coalesce(payload->>'theme', target_row.theme), ''),
            dream_type = coalesce(payload->>'dream_type', target_row.dream_type),
            is_favorite = coalesce((payload->>'is_favorite')::boolean, target_row.is_favorite),
            image_generation_failed = coalesce((payload->>'image_generation_failed')::boolean, target_row.image_generation_failed),
            is_analyzed = coalesce((payload->>'is_analyzed')::boolean, target_row.is_analyzed),
            analyzed_at = coalesce(nullif(payload->>'analyzed_at', '')::timestamptz, target_row.analyzed_at),
            analysis_status = coalesce(payload->>'analysis_status', target_row.analysis_status),
            analysis_request_id = coalesce(nullif(payload->>'analysis_request_id', ''), target_row.analysis_request_id),
            exploration_started_at = coalesce(nullif(payload->>'exploration_started_at', '')::timestamptz, target_row.exploration_started_at),
            has_person = coalesce((payload->>'has_person')::boolean, target_row.has_person),
            has_animal = coalesce((payload->>'has_animal')::boolean, target_row.has_animal),
            client_updated_at = coalesce(nullif(payload->>'client_updated_at', '')::timestamptz, now())
          where id = target_remote_id
            and user_id = current_user_id
          returning * into saved_row;

          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'dream', public.serialize_dream_for_sync(saved_row),
            'remote_id', saved_row.id
          );
        end if;
      end if;
    elsif mutation_operation = 'delete' then
      target_remote_id := nullif(payload->>'remote_id', '')::bigint;

      if target_remote_id is null then
        result_entry := jsonb_build_object(
          'mutation_id', mutation_id,
          'client_request_id', mutation_client_request_id,
          'operation', mutation_operation,
          'status', 'failed',
          'error', 'Missing remote dream id for delete'
        );
      else
        select *
        into target_row
        from public.dreams
        where id = target_remote_id
          and user_id = current_user_id;

        if not found then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'remote_id', target_remote_id
          );
        elsif mutation_base_revision is not null and target_row.revision_id::text <> mutation_base_revision then
          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'conflict',
            'remote_id', target_row.id,
            'dream', public.serialize_dream_for_sync(target_row),
            'error', 'Dream revision conflict'
          );
        else
          delete from public.dreams
          where id = target_remote_id
            and user_id = current_user_id;

          result_entry := jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'ack',
            'remote_id', target_remote_id
          );
        end if;
      end if;
    else
      result_entry := jsonb_build_object(
        'mutation_id', mutation_id,
        'client_request_id', mutation_client_request_id,
        'operation', mutation_operation,
        'status', 'failed',
        'error', 'Unsupported mutation operation'
      );
    end if;

    insert into public.dream_sync_receipts (
      user_id,
      client_request_id,
      entity_type,
      entity_key,
      operation,
      mutation_status,
      dream_id,
      response
    )
    values (
      current_user_id,
      mutation_client_request_id,
      'dream',
      mutation_entity_key,
      mutation_operation,
      coalesce(result_entry->>'status', 'failed'),
      coalesce((result_entry->>'remote_id')::bigint, null),
      result_entry
    )
    on conflict (user_id, client_request_id) do nothing;

    response := response || jsonb_build_array(result_entry);
  end loop;

  return response;
end;
$$;

revoke execute on function public.sync_dream_mutations(jsonb) from public;
grant execute on function public.sync_dream_mutations(jsonb) to authenticated;
