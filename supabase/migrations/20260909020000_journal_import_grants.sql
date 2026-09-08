-- Opt-in transport contract only; no client feature or OAuth rollout enabled.
create table app_authorization_private.journal_import_grants (
  id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null references auth.users(id) on delete cascade,
  source_client_id text not null,
  destination_client_id text not null,
  selected_ids bigint[],
  watermark bigint not null,
  expires_at timestamptz not null default (clock_timestamp() + interval '15 minutes'),
  revoked_at timestamptz
);
create table app_authorization_private.journal_import_cursors (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references app_authorization_private.journal_import_grants(id) on delete cascade,
  last_id bigint not null default 0,
  end_id bigint,
  selected_row_ids bigint[] check (cardinality(selected_row_ids) <= 200),
  next_cursor uuid,
  processed boolean not null default false
);
revoke all on app_authorization_private.journal_import_grants,
  app_authorization_private.journal_import_cursors from public, anon, authenticated;

create or replace function public.create_journal_import_grant(
  p_destination_client_id text,
  p_selected_ids bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  source_id text := auth.jwt() ->> 'client_id';
  grant_id uuid;
  cursor_id uuid;
  upper_id bigint;
  expiry timestamptz;
  selected_count integer;
begin
  if owner_id is null or public.current_app_product() <> 'journal' then
    raise exception 'Journal scoped authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from app_authorization_private.oauth_clients
                 where client_id = p_destination_client_id and product = 'lucid') then
    raise exception 'Registered Lucid destination required' using errcode = '22023';
  end if;
  if p_selected_ids is not null then
    if cardinality(p_selected_ids) = 0 or cardinality(p_selected_ids) > 10000
       or array_position(p_selected_ids, null) is not null then
      raise exception 'Select between 1 and 10000 dream IDs' using errcode = '22023';
    end if;
    select count(distinct id) into selected_count from unnest(p_selected_ids) as selected(id);
    if selected_count <> cardinality(p_selected_ids) or selected_count <>
       (select count(*) from public.dreams where user_id = owner_id and id = any(p_selected_ids)) then
      raise exception 'Selection unavailable' using errcode = '42501';
    end if;
  end if;
  select coalesce(max(id), 0) into upper_id from public.dreams where user_id = owner_id;
  insert into app_authorization_private.journal_import_grants
    (owner_uid, source_client_id, destination_client_id, selected_ids, watermark)
    values (owner_id, source_id, p_destination_client_id, p_selected_ids, upper_id)
    returning id, expires_at into grant_id, expiry;
  insert into app_authorization_private.journal_import_cursors (grant_id)
    values (grant_id) returning id into cursor_id;
  return jsonb_build_object('grantId', grant_id, 'cursor', cursor_id,
    'expiresAt', expiry, 'scope', case when p_selected_ids is null then 'all' else 'selected' end);
end;
$$;

create or replace function public.read_journal_import_page(p_cursor uuid, p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  client_id text := auth.jwt() ->> 'client_id';
  grant_row app_authorization_private.journal_import_grants%rowtype;
  cursor_row app_authorization_private.journal_import_cursors%rowtype;
  items jsonb;
  last_seen bigint;
  page_ids bigint[];
  v_next_cursor uuid;
  has_more boolean;
  result jsonb;
begin
  if owner_id is null or public.current_app_product() <> 'lucid' then
    raise exception 'Lucid scoped authentication required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'Page limit must be between 1 and 200' using errcode = '22023';
  end if;
  -- Grant lock prevents revocation from completing midway through this page.
  select g.* into grant_row from app_authorization_private.journal_import_grants g
    join app_authorization_private.journal_import_cursors c on c.grant_id = g.id
    where c.id = p_cursor and g.owner_uid = owner_id and g.destination_client_id = client_id
    for share of g;
  if not found or grant_row.revoked_at is not null or grant_row.expires_at <= clock_timestamp()
     or not exists (select 1 from app_authorization_private.oauth_clients
                    where oauth_clients.client_id = grant_row.source_client_id and product = 'journal') then
    raise exception 'Import grant unavailable' using errcode = '42501';
  end if;
  select * into cursor_row from app_authorization_private.journal_import_cursors
    where id = p_cursor and grant_id = grant_row.id for update;
  if grant_row.expires_at <= clock_timestamp() then
    raise exception 'Import grant unavailable' using errcode = '42501';
  end if;
  if not cursor_row.processed then
    select max(page.id), coalesce(array_agg(page.id order by page.id), '{}'::bigint[])
      into last_seen, page_ids from (
      select id from public.dreams
      where user_id = owner_id and id > cursor_row.last_id and id <= grant_row.watermark
        and (grant_row.selected_ids is null or id = any(grant_row.selected_ids))
      order by id limit p_limit
    ) page;
    last_seen := coalesce(last_seen, cursor_row.last_id);
    select exists(select 1 from public.dreams where user_id = owner_id
      and id > last_seen and id <= grant_row.watermark
      and (grant_row.selected_ids is null or id = any(grant_row.selected_ids))) into has_more;
    if has_more then
      insert into app_authorization_private.journal_import_cursors (grant_id, last_id)
        values (grant_row.id, last_seen) returning id into v_next_cursor;
    end if;
    update app_authorization_private.journal_import_cursors
      set end_id = last_seen, selected_row_ids = page_ids, next_cursor = v_next_cursor, processed = true
      where id = p_cursor;
  else
    last_seen := cursor_row.end_id;
    page_ids := cursor_row.selected_row_ids;
    v_next_cursor := cursor_row.next_cursor;
  end if;
  -- Persist only bounded IDs, never copied transcript payloads. Replays cannot
  -- admit rows inserted into earlier sequence gaps or transactions committed later.
  if grant_row.expires_at <= clock_timestamp() then
    raise exception 'Import grant unavailable' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id::text, 'clientRequestId', d.client_request_id,
      'revision', d.revision_id::text, 'createdAt', d.created_at,
      'transcript', d.transcript) order by d.id), '[]'::jsonb)
    into items from public.dreams d
    where d.user_id = owner_id and d.id = any(page_ids)
      and (grant_row.selected_ids is null or d.id = any(grant_row.selected_ids));
  result := jsonb_build_object('grantId', grant_row.id, 'items', items,
    'nextCursor', v_next_cursor, 'done', v_next_cursor is null);
  return result;
end;
$$;

create or replace function public.revoke_journal_import_grant(p_grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_product() <> 'journal' then
    raise exception 'Journal scoped authentication required' using errcode = '42501';
  end if;
  update app_authorization_private.journal_import_grants
    set revoked_at = coalesce(revoked_at, clock_timestamp())
    where id = p_grant_id and owner_uid = auth.uid()
      and source_client_id = auth.jwt() ->> 'client_id';
  if not found then
    raise exception 'Import grant unavailable' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function public.create_journal_import_grant(text, bigint[]),
  public.read_journal_import_page(uuid, integer), public.revoke_journal_import_grant(uuid)
  from public, anon;
grant execute on function public.create_journal_import_grant(text, bigint[]),
  public.read_journal_import_page(uuid, integer), public.revoke_journal_import_grant(uuid)
  to authenticated;
