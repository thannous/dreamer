-- Placeholder migration representing remote schema state as of 2025-10-19.
-- Contents unknown; this file exists so local history matches the remote Supabase project.
-- Local bootstrap: create minimal tables/policies required by later migrations.

create extension if not exists pgcrypto;

create table if not exists public.dreams (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  transcript text not null default '',
  title text not null default '',
  interpretation text not null default '',
  shareable_quote text not null default '',
  image_url text,
  chat_history jsonb default '[]'::jsonb,
  theme text,
  dream_type text not null default 'Symbolic Dream',
  is_favorite boolean not null default false,
  image_generation_failed boolean not null default false,
  is_analyzed boolean not null default false,
  analyzed_at timestamptz,
  analysis_status text default 'none',
  analysis_request_id uuid,
  exploration_started_at timestamptz,
  client_request_id uuid,
  has_person boolean,
  has_animal boolean
);

alter table public.dreams enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dreams'
      and policyname = 'dreams select own'
  ) then
    create policy "dreams select own"
      on public.dreams
      for select
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dreams'
      and policyname = 'dreams insert own'
  ) then
    create policy "dreams insert own"
      on public.dreams
      for insert
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dreams'
      and policyname = 'dreams update own'
  ) then
    create policy "dreams update own"
      on public.dreams
      for update
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'dreams'
      and policyname = 'dreams delete own'
  ) then
    create policy "dreams delete own"
      on public.dreams
      for delete
      using ((select auth.uid()) = user_id);
  end if;
end
$$;

create table if not exists public.quota_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  dream_id bigint,
  quota_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb default null
);

create table if not exists public.waitlist_subscribers (
  id bigserial primary key,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.waitlist_subscribers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'waitlist_subscribers'
      and policyname = 'anon can insert waitlist'
  ) then
    create policy "anon can insert waitlist"
      on public.waitlist_subscribers
      for insert
      with check ((select auth.role()) = 'anon');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'waitlist_subscribers'
      and policyname = 'service can read waitlist'
  ) then
    create policy "service can read waitlist"
      on public.waitlist_subscribers
      for select
      using ((select auth.role()) = 'service_role');
  end if;
end
$$;
