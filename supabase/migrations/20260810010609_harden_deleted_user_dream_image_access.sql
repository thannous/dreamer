-- Prevent a previously issued access token from recreating or reading dream
-- images after its Auth user has been hard-deleted. Supabase access JWTs can
-- remain cryptographically valid until expiry, while Storage has no foreign
-- key to auth.users.
--
-- Existing authenticated users keep the same bucket and path ownership rules.
-- The additional predicate only becomes false after the Auth row disappears.

create schema if not exists auth_guard_private;

revoke all on schema auth_guard_private from public, anon, authenticated;
grant usage on schema auth_guard_private to authenticated;

create or replace function auth_guard_private.current_auth_user_exists()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = (select auth.uid())
  );
$$;

revoke all on function auth_guard_private.current_auth_user_exists() from public, anon, authenticated;
grant execute on function auth_guard_private.current_auth_user_exists() to authenticated;

alter policy "Authenticated read own dream-images"
  on storage.objects
  using (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
    and (select auth_guard_private.current_auth_user_exists())
  );

alter policy "Authenticated upload to dream-images"
  on storage.objects
  with check (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
    and (select auth_guard_private.current_auth_user_exists())
  );

alter policy "Authenticated update dream-images"
  on storage.objects
  using (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
    and (select auth_guard_private.current_auth_user_exists())
  )
  with check (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
    and (select auth_guard_private.current_auth_user_exists())
  );

alter policy "Authenticated delete dream-images"
  on storage.objects
  using (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
    and (select auth_guard_private.current_auth_user_exists())
  );
