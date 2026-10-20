-- Apple provider credentials must never be part of client-visible Auth metadata.
begin;

-- Serialize the backfill with Auth writes; legacy API instances are protected by
-- the trigger as soon as this transaction commits.
lock table auth.users in share row exclusive mode;

create schema apple_auth_private;
revoke all on schema apple_auth_private from public, anon, authenticated, service_role;

create table apple_auth_private.refresh_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade
    deferrable initially deferred,
  refresh_token text not null check (length(btrim(refresh_token)) > 0),
  updated_at timestamptz not null default statement_timestamp()
);
-- The deferred FK permits the BEFORE INSERT Auth trigger to protect a newly
-- created user before that user's row exists. It is checked at transaction end.
alter table apple_auth_private.refresh_tokens enable row level security;
revoke all on table apple_auth_private.refresh_tokens from public, anon, authenticated, service_role;

create function apple_auth_private.capture_legacy_refresh_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'apple_refresh_token' then
    if jsonb_typeof(new.raw_app_meta_data -> 'apple_refresh_token') = 'string'
       and length(btrim(new.raw_app_meta_data ->> 'apple_refresh_token')) > 0 then
      insert into apple_auth_private.refresh_tokens (user_id, refresh_token)
      values (new.id, new.raw_app_meta_data ->> 'apple_refresh_token')
      on conflict (user_id) do update
        set refresh_token = excluded.refresh_token, updated_at = statement_timestamp();
    end if;
    -- Also strip null, empty and malformed values. Database reads and SQL
    -- RETURNING see the sanitized row, even after writes from an older API.
    new.raw_app_meta_data := new.raw_app_meta_data - 'apple_refresh_token';
  end if;
  return new;
end;
$$;
revoke all on function apple_auth_private.capture_legacy_refresh_token() from public, anon, authenticated, service_role;

create trigger protect_apple_refresh_token_metadata
before insert or update of raw_app_meta_data on auth.users
for each row execute function apple_auth_private.capture_legacy_refresh_token();

insert into apple_auth_private.refresh_tokens (user_id, refresh_token)
select id, raw_app_meta_data ->> 'apple_refresh_token'
from auth.users
where jsonb_typeof(raw_app_meta_data -> 'apple_refresh_token') = 'string'
  and length(btrim(raw_app_meta_data ->> 'apple_refresh_token')) > 0;

update auth.users
set raw_app_meta_data = raw_app_meta_data - 'apple_refresh_token'
where raw_app_meta_data ? 'apple_refresh_token';

-- Only the Edge Function service client can call these RPCs. The private schema
-- is not exposed to PostgREST and clients have neither table nor schema access.
create function public.store_apple_refresh_token(p_user_id uuid, p_refresh_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  insert into apple_auth_private.refresh_tokens (user_id, refresh_token)
  values (p_user_id, p_refresh_token)
  on conflict (user_id) do update
    set refresh_token = excluded.refresh_token, updated_at = statement_timestamp();
end;
$$;
revoke all on function public.store_apple_refresh_token(uuid, text) from public, anon, authenticated;
grant execute on function public.store_apple_refresh_token(uuid, text) to service_role;

create function public.read_apple_refresh_token(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  return (select refresh_token from apple_auth_private.refresh_tokens where user_id = p_user_id);
end;
$$;
revoke all on function public.read_apple_refresh_token(uuid) from public, anon, authenticated;
grant execute on function public.read_apple_refresh_token(uuid) to service_role;

commit;
