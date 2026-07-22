-- This timestamp already exists in the remote migration history. The original
-- project schema was partly created through the Dashboard before migrations
-- became the source of truth, so a fresh local database also needs the
-- idempotent baseline below before replaying later ALTER statements.
--
-- Keep the original KV migration and the recovered baseline in the same
-- version: Supabase compares migration timestamps, so an already-deployed
-- project will not rerun this file, while a new/local project becomes fully
-- reproducible from the tracked migration history.

create table if not exists public.kv_store_6e8fb8b0 (
  key text primary key,
  value jsonb not null
);

alter table public.kv_store_6e8fb8b0 enable row level security;

create index if not exists kv_store_6e8fb8b0_key_idx
  on public.kv_store_6e8fb8b0 (key text_pattern_ops);

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
      to authenticated
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
      to authenticated
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
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
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
      to authenticated
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
      to anon
      with check (true);
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
      to service_role
      using (true);
  end if;
end
$$;

-- Explicit Data API privileges keep fresh projects compatible with the 2026
-- Supabase default that no longer auto-exposes newly created public tables.
grant select, insert, update, delete on table public.dreams to authenticated;
grant usage, select on sequence public.dreams_id_seq to authenticated;
grant insert on table public.waitlist_subscribers to anon;
grant select on table public.waitlist_subscribers to service_role;
