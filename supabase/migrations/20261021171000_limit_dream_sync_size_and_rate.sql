-- Anti-abuse limits on journal writes (Thanh, 2026-10-21): a dream holds at most
-- 20,000 characters and an account stores at most 50 new dreams per rolling
-- 24 hours. A longer dream already stored stays editable without growing.
-- sync_dream_mutations, the app's only write path, refuses with a failed result
-- and no receipt, so the same mutation passes later; everything else in it is
-- as of 20261015120000. A trigger holds a direct Data API write, which a script
-- could use, to the same limits.

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
  -- Anti-abuse limits (Thanh, 2026-10-21). The app enforces the same length.
  max_transcript_chars constant integer := 20000;
  max_new_dreams_per_day constant integer := 50;
  stored_transcript_chars integer;
  create_exists boolean;
  new_dreams_today integer;
  limit_error text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
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

      -- A dream holds at most 20,000 characters, and an account stores at most
      -- 50 new dreams per rolling 24 hours. A retried create of a stored dream
      -- is not new, and a longer stored dream may change without growing.
      -- These refusals keep no receipt: the same mutation passes once a place
      -- frees up, and the dream stays on the phone meanwhile.
      select char_length(d.transcript)
      into stored_transcript_chars
      from public.dreams d
      where d.user_id = current_user_id
        and d.client_request_id = create_client_request_id;
      create_exists := found;
      limit_error := null;

      if char_length(coalesce(payload->>'transcript', ''))
         > greatest(max_transcript_chars, coalesce(stored_transcript_chars, 0)) then
        limit_error := 'DREAM_TRANSCRIPT_TOO_LONG';
      elsif not create_exists then
        perform pg_advisory_xact_lock(hashtextextended('dreams:new-per-day:' || current_user_id::text, 0));
        select count(*)::integer
        into new_dreams_today
        from public.dreams d
        where d.user_id = current_user_id
          and d.created_at > now() - interval '24 hours';
        if new_dreams_today >= max_new_dreams_per_day then
          limit_error := 'DAILY_DREAM_LIMIT';
        end if;
      end if;

      if limit_error is not null then
        response := response || jsonb_build_array(jsonb_build_object(
          'mutation_id', mutation_id,
          'client_request_id', mutation_client_request_id,
          'operation', mutation_operation,
          'status', 'failed',
          'error', limit_error
        ));
        continue;
      end if;

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
        precise_theme,
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
        memory,
        analysis_details,
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
        nullif(payload->>'precise_theme', ''),
        coalesce(payload->>'dream_type', 'Symbolic Dream'),
        coalesce((payload->>'is_favorite')::boolean, false),
        coalesce((payload->>'image_generation_failed')::boolean, false),
        coalesce((payload->>'is_analyzed')::boolean, false),
        nullif(payload->>'analyzed_at', '')::timestamptz,
        coalesce(payload->>'analysis_status', 'none'),
        nullif(payload->>'analysis_request_id', '')::uuid,
        nullif(payload->>'exploration_started_at', '')::timestamptz,
        (payload->>'has_person')::boolean,
        (payload->>'has_animal')::boolean,
        coalesce(payload->'memory', '{}'::jsonb),
        payload->'analysis_details',
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
        -- A create retried by an app that does not send precise_theme keeps the stored one.
        precise_theme = case when payload ? 'precise_theme' then excluded.precise_theme else dreams.precise_theme end,
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
        memory = excluded.memory,
        analysis_details = excluded.analysis_details,
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
        elsif char_length(coalesce(payload->>'transcript', target_row.transcript, ''))
              > greatest(max_transcript_chars, char_length(coalesce(target_row.transcript, ''))) then
          response := response || jsonb_build_array(jsonb_build_object(
            'mutation_id', mutation_id,
            'client_request_id', mutation_client_request_id,
            'operation', mutation_operation,
            'status', 'failed',
            'remote_id', target_row.id,
            'error', 'DREAM_TRANSCRIPT_TOO_LONG'
          ));
          continue;
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
            precise_theme = case
              when payload ? 'precise_theme' then nullif(payload->>'precise_theme', '')
              else target_row.precise_theme
            end,
            dream_type = coalesce(payload->>'dream_type', target_row.dream_type),
            is_favorite = coalesce((payload->>'is_favorite')::boolean, target_row.is_favorite),
            image_generation_failed = coalesce((payload->>'image_generation_failed')::boolean, target_row.image_generation_failed),
            is_analyzed = coalesce((payload->>'is_analyzed')::boolean, target_row.is_analyzed),
            analyzed_at = coalesce(nullif(payload->>'analyzed_at', '')::timestamptz, target_row.analyzed_at),
            analysis_status = coalesce(payload->>'analysis_status', target_row.analysis_status),
            analysis_request_id = coalesce(nullif(payload->>'analysis_request_id', '')::uuid, target_row.analysis_request_id),
            exploration_started_at = coalesce(nullif(payload->>'exploration_started_at', '')::timestamptz, target_row.exploration_started_at),
            has_person = coalesce((payload->>'has_person')::boolean, target_row.has_person),
            has_animal = coalesce((payload->>'has_animal')::boolean, target_row.has_animal),
            memory = coalesce(payload->'memory', target_row.memory),
            analysis_details = coalesce(payload->'analysis_details', target_row.analysis_details),
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

revoke execute on function public.sync_dream_mutations(jsonb) from public, anon;
grant execute on function public.sync_dream_mutations(jsonb) to authenticated, service_role;

-- The same limits for every signed-in write, the Data API included. The service
-- role and database sessions are not held. The daily count reads created_at, so
-- for a signed-in caller the server sets it on insert and keeps it on update.
-- Length is checked after an insert (an upsert that updates a stored dream is
-- checked as an update) and before an update.
create or replace function public.guard_dream_size_and_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_transcript_chars constant integer := 20000;
  max_new_dreams_per_day constant integer := 50;
  new_dreams_today integer;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_when = 'BEFORE' then
    if tg_op = 'INSERT' then
      new.created_at := now();
    else
      new.created_at := old.created_at;
      if char_length(coalesce(new.transcript, ''))
         > greatest(max_transcript_chars, char_length(coalesce(old.transcript, ''))) then
        raise exception 'DREAM_TRANSCRIPT_TOO_LONG' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if char_length(coalesce(new.transcript, '')) > max_transcript_chars then
    raise exception 'DREAM_TRANSCRIPT_TOO_LONG' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dreams:new-per-day:' || new.user_id::text, 0));
  select count(*)::integer
  into new_dreams_today
  from public.dreams d
  where d.user_id = new.user_id
    and d.created_at > now() - interval '24 hours';
  if new_dreams_today > max_new_dreams_per_day then
    raise exception 'DAILY_DREAM_LIMIT' using errcode = '23514';
  end if;
  return null;
end;
$$;

-- Owner only, like the other trigger functions on dreams (20261021120000).
revoke execute on function public.guard_dream_size_and_rate() from public, anon, authenticated, service_role;

drop trigger if exists trg_guard_dream_limits_before on public.dreams;
create trigger trg_guard_dream_limits_before
before insert or update on public.dreams
for each row
execute function public.guard_dream_size_and_rate();

drop trigger if exists trg_guard_dream_limits_after on public.dreams;
create trigger trg_guard_dream_limits_after
after insert on public.dreams
for each row
execute function public.guard_dream_size_and_rate();
