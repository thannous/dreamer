-- ai_jobs remains the source of truth. Project only the user-facing failure code
-- onto dreams so a full journal refresh cannot erase the reason for failure.
alter table public.dreams add column if not exists image_generation_error_code text;

create or replace function public.project_image_job_failure_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.job_type <> 'generate_image' or new.user_id is null or new.dream_id is null then
    return new;
  end if;
  -- An older worker finishing late must not replace a more recent job's reason.
  if exists (
    select 1 from public.ai_jobs j
    where j.job_type = 'generate_image' and j.user_id = new.user_id and j.dream_id = new.dream_id
      and (j.created_at, j.id) > (new.created_at, new.id)
  ) then return new; end if;

  update public.dreams d set image_generation_error_code = case
    when new.status <> 'failed' or nullif(btrim(d.image_url), '') is not null then null
    when new.error_code in ('FREE_IMAGE_ANALYSIS_REQUIRED', 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING', 'HD_IMAGE_PLUS_REQUIRED') then new.error_code
    when new.attempt_count >= new.max_attempts then 'AI_JOB_ATTEMPTS_EXHAUSTED'
    else coalesce(new.error_code, 'IMAGE_JOB_FAILED')
  end
  where d.id = new.dream_id and d.user_id = new.user_id;
  return new;
end;
$$;
revoke execute on function public.project_image_job_failure_reason() from public, anon, authenticated;

drop trigger if exists project_image_job_failure_reason on public.ai_jobs;
create trigger project_image_job_failure_reason
  after insert or update of status, error_code, attempt_count on public.ai_jobs
  for each row execute function public.project_image_job_failure_reason();

-- Recover diagnostic information only. Never requeue jobs, change quotas,
-- restore prompts, grant entitlements or call the image provider.
with latest as (
  select distinct on (j.user_id, j.dream_id) j.*
  from public.ai_jobs j
  where j.job_type = 'generate_image' and j.user_id is not null and j.dream_id is not null
  order by j.user_id, j.dream_id, j.created_at desc, j.id desc
)
update public.dreams d set image_generation_error_code = case
  when j.error_code in ('FREE_IMAGE_ANALYSIS_REQUIRED', 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING', 'HD_IMAGE_PLUS_REQUIRED') then j.error_code
  when j.attempt_count >= j.max_attempts then 'AI_JOB_ATTEMPTS_EXHAUSTED'
  else coalesce(j.error_code, 'IMAGE_JOB_FAILED')
end
from latest j
where d.id = j.dream_id and d.user_id = j.user_id and j.status = 'failed'
  and nullif(btrim(d.image_url), '') is null;
