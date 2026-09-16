-- HD credits are independent of analysis and standard illustration allowances.
-- A calendar month is measured in UTC. Reservations count towards the limit so
-- concurrent jobs on different devices cannot overspend it.
create table public.hd_image_credits (
  job_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  state text not null check (state in ('reserved', 'completed', 'released')),
  created_at timestamptz not null default now()
);
create index hd_image_credits_month on public.hd_image_credits(user_id, period_start);
alter table public.hd_image_credits enable row level security;
revoke all on public.hd_image_credits from public, anon, authenticated;
grant all on public.hd_image_credits to service_role;

create or replace function public.reserve_hd_image_credit(p_user_id uuid, p_job_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  month_start date := date_trunc('month', now() at time zone 'UTC')::date;
  existing public.hd_image_credits%rowtype;
  used_count integer;
begin
  if p_user_id is null or p_job_id is null or not exists (
    select 1 from public.ai_jobs where id = p_job_id and user_id = p_user_id
      and job_type = 'generate_image' and status = 'running'
      and request_payload ->> 'imageSize' in ('2K', '4K')
  ) then return jsonb_build_object('allowed', false, 'code', 'HD_IMAGE_INVALID_JOB'); end if;
  if public.get_effective_subscription_tier(p_user_id) is distinct from 'plus' then
    return jsonb_build_object('allowed', false, 'code', 'HD_IMAGE_PLUS_REQUIRED');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('hd-image:' || p_user_id::text, 0));
  -- Recover refunds if a worker stopped after marking its job failed.
  update public.hd_image_credits c set state = 'released'
    where c.user_id = p_user_id and c.state = 'reserved'
      and exists (select 1 from public.ai_jobs j where j.id = c.job_id and j.status = 'failed');
  select * into existing from public.hd_image_credits where job_id = p_job_id;
  if found then
    if existing.user_id <> p_user_id then
      return jsonb_build_object('allowed', false, 'code', 'HD_IMAGE_INVALID_JOB');
    end if;
    if existing.state in ('reserved', 'completed') then
      return jsonb_build_object('allowed', true, 'duplicate', true);
    end if;
  end if;
  select count(*) into used_count from public.hd_image_credits
    where user_id = p_user_id and period_start = month_start and state <> 'released';
  if used_count >= 15 then
    return jsonb_build_object('allowed', false, 'code', 'HD_IMAGE_QUOTA_EXCEEDED', 'limit', 15);
  end if;
  insert into public.hd_image_credits(job_id, user_id, period_start, state)
    values (p_job_id, p_user_id, month_start, 'reserved')
    on conflict (job_id) do update set period_start = excluded.period_start, state = 'reserved';
  return jsonb_build_object('allowed', true, 'remaining', 14 - used_count);
end;
$$;

create or replace function public.finish_hd_image_credit(p_job_id uuid, p_success boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Completion never refunds a delivered image; a failed attempt only releases
  -- a reservation after the persisted job has reached its terminal failed state.
  update public.hd_image_credits c set state = case when p_success then 'completed' else 'released' end
    where c.job_id = p_job_id and c.state = 'reserved' and exists (
      select 1 from public.ai_jobs j where j.id = p_job_id and j.user_id = c.user_id
        and j.status = case when p_success then 'succeeded' else 'failed' end
    );
end;
$$;

create or replace function public.get_hd_image_quota()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  owner uuid := auth.uid();
  month_start date := date_trunc('month', now() at time zone 'UTC')::date;
  used_count integer;
  allowance integer;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hd-image:' || owner::text, 0));
  update public.hd_image_credits c set state = 'released'
    where c.user_id = owner and c.state = 'reserved'
      and exists (select 1 from public.ai_jobs j where j.id = c.job_id and j.status = 'failed');
  allowance := case when public.get_effective_subscription_tier(owner) = 'plus' then 15 else 0 end;
  select count(*) into used_count from public.hd_image_credits
    where user_id = owner and period_start = month_start and state <> 'released';
  return jsonb_build_object('used', used_count, 'limit', allowance,
    'remaining', greatest(0, allowance - used_count),
    'resetsAt', (month_start + interval '1 month') at time zone 'UTC');
end;
$$;

revoke all on function public.reserve_hd_image_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_hd_image_credit(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_hd_image_quota() from public, anon;
grant execute on function public.reserve_hd_image_credit(uuid, uuid) to service_role;
grant execute on function public.finish_hd_image_credit(uuid, boolean) to service_role;
grant execute on function public.get_hd_image_quota() to authenticated;
