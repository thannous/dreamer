-- Harden the guest quota release RPC and dream image storage privacy.
--
-- Security invariants:
-- - release_guest_quota_claim is an internal rollback path for service-role
--   workers only; anonymous clients must not be able to decrement counters.
-- - dream-images is private storage. Authenticated users can operate only on
--   objects under their own user-id prefix, and public bucket reads are removed.

revoke execute on function public.release_guest_quota_claim(text, text) from public;
revoke execute on function public.release_guest_quota_claim(text, text) from anon;
revoke execute on function public.release_guest_quota_claim(text, text) from authenticated;
grant execute on function public.release_guest_quota_claim(text, text) to service_role;

update storage.buckets
set public = false
where id = 'dream-images';

drop policy if exists "Public read access for dream-images" on storage.objects;
drop policy if exists "Authenticated read own dream-images" on storage.objects;

create policy "Authenticated read own dream-images"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'dream-images'
    and (select auth.uid())::text = split_part(name, '/', 1)
  );
