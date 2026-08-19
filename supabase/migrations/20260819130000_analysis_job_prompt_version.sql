-- Store the analysis prompt version alongside symbols/emotions/reflection
-- questions in dreams.analysis_details for authenticated analysis jobs. The
-- function body is otherwise identical to 20260722133000.

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
  replace_existing_image boolean := true;
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
     or theme_value not in ('surreal', 'mystical', 'calm', 'noir')
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
    theme = theme_value,
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
    true
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
