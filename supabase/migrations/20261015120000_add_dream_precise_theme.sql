-- Apps installed before the luminous and nostalgic themes read dreams.theme directly
-- (PostgREST and sync) and know only surreal, mystical, calm and noir. dreams.theme
-- therefore stays one of those four, and the full theme moves to dreams.precise_theme:
-- luminous is shown as mystical and nostalgic as calm by those apps.
-- A trigger owns the projection, so every writer (sync RPC, direct PostgREST writes,
-- the analysis worker) keeps the two columns consistent:
-- - precise_theme set: theme is its legacy projection;
-- - theme changed while precise_theme did not: an app that does not know precise_theme
--   made the edit, so precise_theme is cleared and theme is what that app chose;
-- - theme given a newer value with no precise_theme (an app that predates this
--   column but knows the newer themes): the value moves to precise_theme.
-- serialize_dream_for_sync and sync_dream_mutations are recreated from their latest
-- definitions (20260721120000 and 20260909010000) with precise_theme added; the
-- analysis completion (20261014183000) writes the six-value theme to precise_theme.

create or replace function public.legacy_dream_theme(p_theme text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_theme
    when 'luminous' then 'mystical'
    when 'nostalgic' then 'calm'
    else p_theme
  end;
$$;

comment on function public.legacy_dream_theme(text) is
  'The theme an app that knows only surreal, mystical, calm and noir shows for a dream theme.';

alter table public.dreams
  add column if not exists precise_theme text;

alter table public.dreams
  drop constraint if exists dreams_precise_theme_check;
alter table public.dreams
  add constraint dreams_precise_theme_check
  check (precise_theme is null or precise_theme in ('surreal', 'mystical', 'calm', 'noir', 'luminous', 'nostalgic'));

comment on column public.dreams.precise_theme is
  'The full theme (six values). dreams.theme holds its four-value projection for older apps.';

create or replace function public.project_dream_precise_theme()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.precise_theme is not distinct from old.precise_theme
     and new.theme is distinct from old.theme then
    new.precise_theme := null;
  end if;
  if new.precise_theme is null and new.theme in ('luminous', 'nostalgic') then
    new.precise_theme := new.theme;
  end if;
  if new.precise_theme is not null then
    new.theme := public.legacy_dream_theme(new.precise_theme);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_05_project_dream_precise_theme on public.dreams;
create trigger trg_05_project_dream_precise_theme
  before insert or update on public.dreams
  for each row
  execute function public.project_dream_precise_theme();

-- Dreams already given a newer theme keep it in precise_theme; their theme becomes
-- the projection, and the revision bump makes older apps pull it again.
update public.dreams
set precise_theme = theme
where theme in ('luminous', 'nostalgic');

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
    'precise_theme', dream_row.precise_theme,
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
    'has_animal', dream_row.has_animal,
    'memory', coalesce(dream_row.memory, '{}'::jsonb),
    'analysis_details', dream_row.analysis_details
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

create or replace function public.complete_authenticated_analysis_job(
  p_job_id uuid,
  p_analysis_result jsonb,
  p_image_job_id uuid,
  p_image_max_attempts integer,
  p_image_max_active_per_actor integer,
  p_image_window_seconds integer,
  p_image_max_created_in_window integer,
  p_max_global_active integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := coalesce((select auth.jwt() ->> 'role'), '');
  initial_job public.ai_jobs%rowtype;
  analysis_job public.ai_jobs%rowtype;
  completed_job public.ai_jobs%rowtype;
  dream_row public.dreams%rowtype;
  image_admission jsonb;
  image_job jsonb;
  image_error_code text;
  replace_existing_image boolean := false;
  title_value text;
  interpretation_value text;
  quote_value text;
  theme_value text;
  dream_type_value text;
  image_prompt_value text;
  analysis_details_value jsonb;
begin
  if caller_role not in ('service_role', 'supabase_admin') then
    raise exception 'insufficient_privilege'
      using errcode = '42501', message = 'complete_authenticated_analysis_job requires service role access';
  end if;

  if p_job_id is null or p_image_job_id is null then
    raise exception 'job identifiers are required';
  end if;
  if p_analysis_result is null
     or jsonb_typeof(p_analysis_result) <> 'object'
     or pg_column_size(p_analysis_result) > 65536 then
    raise exception 'invalid analysis result';
  end if;

  select *
  into initial_job
  from public.ai_jobs j
  where j.id = p_job_id
    and j.job_type = 'analyze_dream';

  if not found then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_JOB_NOT_FOUND');
  end if;

  -- Keep completion lock order compatible with every admission path before
  -- touching the job or dream rows.
  perform pg_advisory_xact_lock(hashtext('ai_jobs:admission:global'));
  perform pg_advisory_xact_lock(
    hashtext('ai_jobs:admission:user:' || initial_job.user_id::text)
  );

  select *
  into analysis_job
  from public.ai_jobs j
  where j.id = p_job_id
    and j.job_type = 'analyze_dream'
  for update;

  if analysis_job.status = 'succeeded' then
    return jsonb_build_object(
      'completed', true,
      'duplicate', true,
      'job', to_jsonb(analysis_job),
      'image_job', analysis_job.result_payload -> 'imageJob'
    );
  end if;
  if analysis_job.status <> 'running' then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_JOB_NOT_RUNNING');
  end if;

  select *
  into dream_row
  from public.dreams d
  where d.id = analysis_job.dream_id
    and d.user_id = analysis_job.user_id
  for update;

  if not found then
    return jsonb_build_object('completed', false, 'code', 'DREAM_NOT_FOUND');
  end if;
  if dream_row.analysis_request_id::text is distinct from analysis_job.client_request_id then
    return jsonb_build_object('completed', false, 'code', 'ANALYSIS_REQUEST_STALE');
  end if;

  title_value := btrim(coalesce(p_analysis_result ->> 'title', ''));
  interpretation_value := btrim(coalesce(p_analysis_result ->> 'interpretation', ''));
  quote_value := btrim(coalesce(p_analysis_result ->> 'shareableQuote', ''));
  theme_value := btrim(coalesce(p_analysis_result ->> 'theme', 'surreal'));
  dream_type_value := btrim(coalesce(p_analysis_result ->> 'dreamType', 'Symbolic Dream'));
  image_prompt_value := btrim(coalesce(p_analysis_result ->> 'imagePrompt', ''));

  if title_value = '' or length(title_value) > 500
     or interpretation_value = '' or length(interpretation_value) > 20000
     or length(quote_value) > 2000
     or theme_value not in ('surreal', 'mystical', 'calm', 'noir', 'luminous', 'nostalgic')
     or length(dream_type_value) > 200
     or image_prompt_value = '' or length(image_prompt_value) > 1000 then
    raise exception 'analysis result fields are invalid';
  end if;

  analysis_details_value := jsonb_build_object(
    'symbols', case
      when jsonb_typeof(p_analysis_result -> 'symbols') = 'array'
        then p_analysis_result -> 'symbols'
      else '[]'::jsonb
    end,
    'emotions', case
      when jsonb_typeof(p_analysis_result -> 'emotions') = 'array'
        then p_analysis_result -> 'emotions'
      else '[]'::jsonb
    end,
    'reflectionQuestions', case
      when jsonb_typeof(p_analysis_result -> 'reflectionQuestions') = 'array'
        then p_analysis_result -> 'reflectionQuestions'
      else '[]'::jsonb
    end
  );
  -- Prompt/schema version stamped by the API (services/dreamAnalysis.ts) so a
  -- quality regression can be attributed to a prompt change. Short, categorical.
  if jsonb_typeof(p_analysis_result -> 'promptVersion') = 'string'
     and length(p_analysis_result ->> 'promptVersion') between 1 and 64 then
    analysis_details_value := analysis_details_value
      || jsonb_build_object('promptVersion', p_analysis_result ->> 'promptVersion');
  end if;
  if pg_column_size(analysis_details_value) > 32768 then
    raise exception 'analysis details are too large';
  end if;

  update public.dreams
  set
    title = title_value,
    interpretation = interpretation_value,
    shareable_quote = quote_value,
    precise_theme = theme_value,
    theme = public.legacy_dream_theme(theme_value),
    dream_type = dream_type_value,
    analysis_details = analysis_details_value,
    is_analyzed = true,
    analyzed_at = now(),
    analysis_status = 'done',
    revision_id = gen_random_uuid(),
    updated_at = now()
  where id = dream_row.id
    and user_id = dream_row.user_id;

  replace_existing_image := coalesce(
    (analysis_job.request_payload ->> 'replaceExistingImage')::boolean,
    false
  );

  if replace_existing_image then
    image_admission := public.admit_ai_job(
      p_image_job_id,
      analysis_job.user_id,
      null,
      analysis_job.dream_id,
      'generate_image',
      jsonb_build_object(
        'prompt', image_prompt_value,
        'transcript', null,
        'previousImageUrl', nullif(dream_row.image_url, '')
      ),
      analysis_job.client_request_id,
      p_image_max_attempts,
      p_image_max_active_per_actor,
      p_image_window_seconds,
      p_image_max_created_in_window,
      p_max_global_active
    );

    if coalesce((image_admission ->> 'allowed')::boolean, false) then
      image_job := image_admission -> 'job';
    else
      image_error_code := coalesce(image_admission ->> 'code', 'IMAGE_JOB_ADMISSION_DENIED');
    end if;
  end if;

  update public.ai_jobs
  set
    status = 'succeeded',
    result_payload = jsonb_strip_nulls(jsonb_build_object(
      'dreamId', analysis_job.dream_id,
      'imageJob', image_job,
      'imageJobErrorCode', image_error_code
    )),
    error_code = null,
    error_message = null,
    finished_at = now()
  where id = analysis_job.id
  returning * into completed_job;

  return jsonb_build_object(
    'completed', true,
    'duplicate', false,
    'job', to_jsonb(completed_job),
    'image_job', image_job,
    'image_error_code', image_error_code
  );
end;
$$;

revoke execute on function public.sync_dream_mutations(jsonb) from public;
grant execute on function public.sync_dream_mutations(jsonb) to authenticated;
