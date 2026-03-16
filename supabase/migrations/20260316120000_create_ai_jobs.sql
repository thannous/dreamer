create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_fingerprint text,
  dream_id bigint references public.dreams(id) on delete cascade,
  job_type text not null check (job_type in ('generate_image')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  request_payload jsonb not null,
  result_payload jsonb,
  error_code text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  client_request_id text not null,
  quota_claimed boolean not null default false,
  quota_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint ai_jobs_actor_check check (
    (user_id is not null and guest_fingerprint is null)
    or (user_id is null and guest_fingerprint is not null)
  )
);

create unique index if not exists idx_ai_jobs_type_actor_request
  on public.ai_jobs (job_type, coalesce(user_id::text, guest_fingerprint), client_request_id);

create index if not exists idx_ai_jobs_status_created_at
  on public.ai_jobs (status, created_at);

create index if not exists idx_ai_jobs_actor_created_at
  on public.ai_jobs (coalesce(user_id::text, guest_fingerprint), created_at desc);

alter table public.ai_jobs enable row level security;

comment on table public.ai_jobs is
  'Durable AI job queue for async image generation. Access is only allowed via edge functions using the service role.';

comment on column public.ai_jobs.guest_fingerprint is
  'Guest ownership key used for idempotency and status reads when no authenticated user exists.';

comment on column public.ai_jobs.quota_claimed is
  'Tracks whether a quota-sensitive claim was committed before upstream work started.';

create or replace function public.release_guest_quota_claim(
  p_fingerprint text,
  p_quota_type text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_analysis_count integer := 0;
  v_exploration_count integer := 0;
  v_image_count integer := 0;
  v_current integer := 0;
begin
  if p_quota_type not in ('analysis', 'exploration', 'image') then
    raise exception 'Invalid quota_type: %. Must be analysis, exploration, or image', p_quota_type;
  end if;

  select analysis_count, exploration_count, image_count
  into v_analysis_count, v_exploration_count, v_image_count
  from public.guest_usage
  where fingerprint_hash = p_fingerprint
  for update;

  if p_quota_type = 'analysis' then
    update public.guest_usage
    set analysis_count = greatest(analysis_count - 1, 0),
        last_seen_at = now()
    where fingerprint_hash = p_fingerprint;
    v_current := greatest(v_analysis_count - 1, 0);
  elsif p_quota_type = 'exploration' then
    update public.guest_usage
    set exploration_count = greatest(exploration_count - 1, 0),
        last_seen_at = now()
    where fingerprint_hash = p_fingerprint;
    v_current := greatest(v_exploration_count - 1, 0);
  else
    update public.guest_usage
    set image_count = greatest(image_count - 1, 0),
        last_seen_at = now()
    where fingerprint_hash = p_fingerprint;
    v_current := greatest(v_image_count - 1, 0);
  end if;

  return json_build_object(
    'released', true,
    'new_count', coalesce(v_current, 0)
  );
end;
$$;
