-- Add quota-related fields to dreams table
-- Supports separation of dream recording from analysis and tracks exploration status

-- Add fields for analysis tracking
alter table if exists public.dreams
add column if not exists is_analyzed boolean default false;
alter table if exists public.dreams
add column if not exists analyzed_at timestamptz;
alter table if exists public.dreams
add column if not exists analysis_status text default 'none';
alter table if exists public.dreams
add column if not exists analysis_request_id uuid;
-- Add field for exploration tracking
alter table if exists public.dreams
add column if not exists exploration_started_at timestamptz;
-- Add constraint to ensure valid analysis_status values
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dreams_analysis_status_check'
  ) then
    alter table public.dreams
    add constraint dreams_analysis_status_check
    check (analysis_status in ('none', 'pending', 'done', 'failed'));
  end if;
end
$$;
-- Create indexes for performance (COUNT queries will use these)
create index if not exists idx_dreams_user_analyzed
  on public.dreams(user_id, is_analyzed);
create index if not exists idx_dreams_user_exploration
  on public.dreams(user_id, exploration_started_at);
create index if not exists idx_dreams_analysis_request_id
  on public.dreams(analysis_request_id);
-- Add comment explaining the fields
comment on column public.dreams.is_analyzed is
  'Whether AI analysis has been performed (separates recording from analysis)';
comment on column public.dreams.analyzed_at is
  'Timestamp when analysis was completed';
comment on column public.dreams.analysis_status is
  'Current status of analysis: none, pending, done, failed';
comment on column public.dreams.analysis_request_id is
  'UUID for server-side idempotence (prevents duplicate analysis)';
comment on column public.dreams.exploration_started_at is
  'Timestamp when first chat message was sent (marks dream as "explored")';
