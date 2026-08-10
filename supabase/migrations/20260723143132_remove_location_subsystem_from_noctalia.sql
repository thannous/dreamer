do $migration$
declare
  actual_count integer;
  dependency_found boolean;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);

  select count(*) into actual_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and c.relname = any (array['rental_dossiers','rental_dossier_activity','rental_dossier_comments','rental_dossier_documents','rental_dossier_notifications','rental_dossier_owners','user_location','user_location_sessions']);
  if actual_count <> 8 then raise exception 'Location removal aborted: expected 8 tables, found %', actual_count; end if;

  select count(*) into actual_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'public' and p.proname = any (array['document_add_by_token','document_delete_by_token','document_get_by_token','document_list_by_token','location_add_comment','location_add_document','location_add_notification','location_archive_dossier','location_create_dossier','location_delete_document','location_delete_dossier','location_get_document','location_get_dossier','location_list_documents','location_list_dossiers','location_list_notifications','location_login','location_rotate_dossier_links','location_update_dossier','notification_add_by_token','request_dossier_token','request_location_session','tenant_update_dossier_by_token']))
     or (n.nspname = 'private' and p.proname = any (array['can_access_rental_dossier','current_location_user_id','require_location_user_id','can_access_location_dossier']));
  if actual_count <> 27 then raise exception 'Location removal aborted: expected 27 functions, found %', actual_count; end if;

  select count(*) into actual_count
  from pg_policies
  where schemaname = 'public' and tablename = any (array['rental_dossiers','rental_dossier_activity','rental_dossier_comments','rental_dossier_documents','rental_dossier_notifications','rental_dossier_owners','user_location','user_location_sessions']);
  if actual_count <> 9 then raise exception 'Location removal aborted: expected 9 RLS policies, found %', actual_count; end if;

  if exists (
    with location_tables as (
      select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = any (array['rental_dossiers','rental_dossier_activity','rental_dossier_comments','rental_dossier_documents','rental_dossier_notifications','rental_dossier_owners','user_location','user_location_sessions'])
    )
    select 1 from pg_constraint con
    where con.contype = 'f' and con.confrelid in (select oid from location_tables) and con.conrelid not in (select oid from location_tables)
  ) then raise exception 'Location removal aborted: a non-Location table now references Location'; end if;

  if exists (
    select 1 from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = any (array['rental_dossiers','rental_dossier_activity','rental_dossier_comments','rental_dossier_documents','rental_dossier_notifications','rental_dossier_owners','user_location','user_location_sessions'])
  ) then raise exception 'Location removal aborted: a Location table is in a publication'; end if;

  if to_regclass('cron.job') is not null then
    execute $check$select exists (select 1 from cron.job where command ~ '(rental_dossier|user_location|location_session)')$check$ into dependency_found;
    if dependency_found then raise exception 'Location removal aborted: a cron job references Location'; end if;
  end if;

  if exists (select 1 from pg_stat_activity where pid <> pg_backend_pid() and state = 'active' and query ~ '(rental_dossier|user_location|location_session)')
  then raise exception 'Location removal aborted: an active query references Location'; end if;

  if exists (select 1 from public.user_location_sessions where expires_at > now())
  then raise exception 'Location removal aborted: at least one Location session is still active'; end if;

  if (select count(*) from public.rental_dossier_activity) <> 24 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossier_activity t) <> '688562644dea934a93cb9b5ed7fcef74' then raise exception 'Location removal aborted: rental_dossier_activity differs from backup'; end if;
  if (select count(*) from public.rental_dossier_comments) <> 1 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossier_comments t) <> '59271c72738b31fa2b3a5ad9510daa21' then raise exception 'Location removal aborted: rental_dossier_comments differs from backup'; end if;
  if (select count(*) from public.rental_dossier_documents) <> 2 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossier_documents t) <> 'c41014b87cc0a601c5f02626153d58b5' then raise exception 'Location removal aborted: rental_dossier_documents differs from backup'; end if;
  if (select count(*) from public.rental_dossier_notifications) <> 9 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossier_notifications t) <> 'a547375dd27217d62138c9523cfebb72' then raise exception 'Location removal aborted: rental_dossier_notifications differs from backup'; end if;
  if (select count(*) from public.rental_dossier_owners) <> 2 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossier_owners t) <> 'aa5e327d609b52adbea4fd01d0f513d5' then raise exception 'Location removal aborted: rental_dossier_owners differs from backup'; end if;
  if (select count(*) from public.rental_dossiers) <> 12 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.rental_dossiers t) <> '186778cf5532e7192cdc1fe17aa3b2de' then raise exception 'Location removal aborted: rental_dossiers differs from backup'; end if;
  if (select count(*) from public.user_location) <> 2 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.user_location t) <> 'ce1f4334938a95949f66eb1937ba6dd3' then raise exception 'Location removal aborted: user_location differs from backup'; end if;
  if (select count(*) from public.user_location_sessions) <> 89 or (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text, '[]')) from public.user_location_sessions t) <> '6709d71966e2d1530f0e27b64503afbc' then raise exception 'Location removal aborted: user_location_sessions differs from backup'; end if;

  execute 'drop policy rental_dossier_activity_insert_access on public.rental_dossier_activity';
  execute 'drop policy rental_dossier_activity_select_access on public.rental_dossier_activity';
  execute 'drop policy rental_dossier_comments_insert_access on public.rental_dossier_comments';
  execute 'drop policy rental_dossier_comments_select_access on public.rental_dossier_comments';
  execute 'drop policy rental_dossiers_authenticated_update on public.rental_dossiers';
  execute 'drop policy rental_dossiers_owner_insert on public.rental_dossiers';
  execute 'drop policy rental_dossiers_owner_select on public.rental_dossiers';
  execute 'drop policy rental_dossiers_select_by_token on public.rental_dossiers';
  execute 'drop policy rental_dossiers_update_by_write_token on public.rental_dossiers';

  execute 'drop function public.location_get_dossier(text) restrict';
  execute 'drop function public.document_add_by_token(text, text, text, text, integer, text, text) restrict';
  execute 'drop function public.document_delete_by_token(text, uuid) restrict';
  execute 'drop function public.document_get_by_token(text, uuid) restrict';
  execute 'drop function public.document_list_by_token(text) restrict';
  execute 'drop function public.location_add_comment(text, text) restrict';
  execute 'drop function public.location_add_document(text, text, text, text, integer, text, text) restrict';
  execute 'drop function public.location_add_notification(text, text, text, text, text, text, text, text, text) restrict';
  execute 'drop function public.location_archive_dossier(text, text) restrict';
  execute 'drop function public.location_create_dossier(text, text, text, text, text, jsonb) restrict';
  execute 'drop function public.location_delete_document(text, uuid) restrict';
  execute 'drop function public.location_delete_dossier(text) restrict';
  execute 'drop function public.location_get_document(text, uuid) restrict';
  execute 'drop function public.location_list_documents(text) restrict';
  execute 'drop function public.location_list_dossiers() restrict';
  execute 'drop function public.location_list_notifications(text) restrict';
  execute 'drop function public.location_login(text, text) restrict';
  execute 'drop function public.location_rotate_dossier_links(text, text, text, text) restrict';
  execute 'drop function public.location_update_dossier(text, text, jsonb) restrict';
  execute 'drop function public.notification_add_by_token(text, text, text, text, text, text, text, text, text) restrict';
  execute 'drop function public.tenant_update_dossier_by_token(text, jsonb) restrict';
  execute 'drop function private.can_access_location_dossier(text) restrict';
  execute 'drop function private.require_location_user_id() restrict';
  execute 'drop function private.current_location_user_id() restrict';
  execute 'drop function private.can_access_rental_dossier(text, boolean) restrict';
  execute 'drop function public.request_dossier_token() restrict';
  execute 'drop function public.request_location_session() restrict';

  execute 'drop table public.rental_dossier_activity, public.rental_dossier_comments, public.rental_dossier_documents, public.rental_dossier_notifications, public.rental_dossier_owners, public.user_location_sessions, public.rental_dossiers, public.user_location restrict';

  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any (array['rental_dossiers','rental_dossier_activity','rental_dossier_comments','rental_dossier_documents','rental_dossier_notifications','rental_dossier_owners','user_location','user_location_sessions'])) then raise exception 'Location removal aborted: at least one table remains'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where (n.nspname = 'public' and p.proname = any (array['document_add_by_token','document_delete_by_token','document_get_by_token','document_list_by_token','location_add_comment','location_add_document','location_add_notification','location_archive_dossier','location_create_dossier','location_delete_document','location_delete_dossier','location_get_document','location_get_dossier','location_list_documents','location_list_dossiers','location_list_notifications','location_login','location_rotate_dossier_links','location_update_dossier','notification_add_by_token','request_dossier_token','request_location_session','tenant_update_dossier_by_token'])) or (n.nspname = 'private' and p.proname = any (array['can_access_rental_dossier','current_location_user_id','require_location_user_id','can_access_location_dossier']))) then raise exception 'Location removal aborted: at least one function remains'; end if;
end;
$migration$;;
