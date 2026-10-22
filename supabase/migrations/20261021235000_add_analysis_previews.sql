-- The prepared analysis (free accounts past their monthly analyses): once a
-- week, the api function still writes the reading of a dream, paints its
-- illustration and gives the account the reading's first sentence, its
-- symbols' names and a band of the painting. The rest stays here and under
-- the previews/ prefix of the dream-images bucket, out of the account's reach,
-- until the account opens it with Plus or with a later free analysis: the
-- analysis and image jobs then take what was prepared instead of asking the
-- models again.

create table if not exists public.analysis_previews (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- No foreign key: a deleted dream keeps its row, emptied, so the week's
  -- preview stays counted.
  dream_id bigint not null,
  -- writing: a request holds the preview while the model writes it.
  -- used: its dream was analyzed, with this reading or not. removed: its dream was deleted.
  status text not null default 'writing' check (status in ('writing', 'ready', 'used', 'removed')),
  lang text not null check (lang in ('en', 'fr', 'es', 'de', 'it', 'pt')),
  -- The transcript the reading was written from, so an edited dream is read again.
  transcript_sha256 text not null check (transcript_sha256 ~ '^[0-9a-f]{64}$'),
  reading jsonb,
  -- painting: the illustration is being painted. used: the image job took it.
  -- removed: its dream was deleted.
  image_status text not null default 'none' check (image_status in ('none', 'painting', 'ready', 'used', 'failed', 'removed')),
  -- The reading's image prompt: the image job takes the painting only for this prompt.
  image_prompt text,
  -- Object keys in dream-images under previews/<user id>/, which signed-in
  -- accounts cannot read; band_url is the signed link to the band alone.
  image_path text,
  band_path text,
  band_url text,
  image_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, dream_id),
  constraint analysis_previews_ready_has_reading check (status <> 'ready' or reading is not null),
  constraint analysis_previews_spent_has_no_reading check (status not in ('used', 'removed') or reading is null),
  constraint analysis_previews_painted_has_image check (
    image_status <> 'ready' or (image_prompt is not null and image_path is not null and band_path is not null and band_url is not null)
  )
);

create index if not exists analysis_previews_user_created_idx
  on public.analysis_previews (user_id, created_at desc);

comment on table public.analysis_previews is
  'One prepared analysis per account and dream, at most one new per week. Service role only: the account sees its opening through the api function.';

alter table public.analysis_previews enable row level security;

revoke all on table public.analysis_previews from anon;
revoke all on table public.analysis_previews from authenticated;
grant select, insert, update, delete on table public.analysis_previews to service_role;

-- The api function holds a dream's preview here before the model writes it.
-- Under a lock per account, one call checks the dream and the week and takes
-- the row, so two dreams asked at once cannot both get the week's preview.
-- The windows match ANALYSIS_PREVIEW_WINDOW_MS and WRITING_TIMEOUT_MS in the
-- api function. The previous painting's object keys come back for removal.
create or replace function public.hold_analysis_preview(
  p_user_id uuid,
  p_dream_id bigint,
  p_lang text,
  p_transcript_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dream_row record;
  current_row public.analysis_previews%rowtype;
  last_created_at timestamptz;
begin
  if p_user_id is null or p_dream_id is null then
    raise exception 'preview identifiers are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('analysis_preview:' || p_user_id::text, 0));

  -- For share: a delete or an analysis of the dream waits for this hold, so
  -- its trigger finds the held row.
  select d.is_analyzed, d.analysis_status into dream_row
  from public.dreams d
  where d.id = p_dream_id and d.user_id = p_user_id
  for share;
  if not found then
    return jsonb_build_object('state', 'gone');
  end if;
  if dream_row.is_analyzed is true then
    return jsonb_build_object('state', 'analyzed');
  end if;
  if dream_row.analysis_status = 'pending' then
    return jsonb_build_object('state', 'pending');
  end if;

  select * into current_row
  from public.analysis_previews p
  where p.user_id = p_user_id and p.dream_id = p_dream_id
  for update;
  if found and current_row.status = 'writing' and current_row.updated_at > now() - interval '3 minutes' then
    return jsonb_build_object('state', 'writing');
  end if;

  -- The week's preview counts, spent or deleted; a writing that failed gave nothing.
  select max(p.created_at) into last_created_at
  from public.analysis_previews p
  where p.user_id = p_user_id
    and p.created_at > now() - interval '7 days'
    and (p.status <> 'writing' or p.updated_at > now() - interval '3 minutes');
  if last_created_at is not null then
    return jsonb_build_object('state', 'weekly_limit', 'retry_at', last_created_at + interval '7 days');
  end if;

  if current_row.user_id is not null then
    -- An older preview of another text or language, or a failed writing: this week's starts now.
    update public.analysis_previews p
    set status = 'writing', lang = p_lang, transcript_sha256 = p_transcript_sha256, reading = null,
      image_status = 'none', image_prompt = null, image_path = null, band_path = null, band_url = null,
      image_updated_at = null, created_at = now(), updated_at = now()
    where p.user_id = p_user_id and p.dream_id = p_dream_id;
  else
    insert into public.analysis_previews (user_id, dream_id, status, lang, transcript_sha256, created_at, updated_at)
    values (p_user_id, p_dream_id, 'writing', p_lang, p_transcript_sha256, now(), now());
  end if;
  return jsonb_build_object(
    'state', 'held',
    'held_at', now(),
    'previous_image_path', current_row.image_path,
    'previous_band_path', current_row.band_path
  );
end;
$$;

revoke execute on function public.hold_analysis_preview(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.hold_analysis_preview(uuid, bigint, text, text) to service_role;

-- Deleting a dream deletes the reading prepared from it, as deleting a dream
-- withdraws it from the AI, and its band's link. The painting's objects stay,
-- like a deleted dream's illustration, until the account is deleted. Security
-- definer, since signed-in callers have no access to the previews.
create or replace function public.clear_analysis_preview_of_deleted_dream()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analysis_previews p
  set status = 'removed', reading = null, image_prompt = null, band_url = null,
    image_status = case when p.image_status in ('painting', 'ready') then 'removed' else p.image_status end,
    updated_at = now()
  where p.user_id = old.user_id
    and p.dream_id = old.id
    and p.status <> 'removed';
  return null;
end;
$$;

-- Owner only, like the other trigger functions on dreams (20261021120000).
revoke execute on function public.clear_analysis_preview_of_deleted_dream() from public, anon, authenticated, service_role;
grant execute on function public.clear_analysis_preview_of_deleted_dream() to postgres;

drop trigger if exists trg_clear_analysis_preview_of_deleted_dream on public.dreams;
create trigger trg_clear_analysis_preview_of_deleted_dream
after delete on public.dreams
for each row
execute function public.clear_analysis_preview_of_deleted_dream();

-- An analyzed dream spends its prepared reading, whichever way it was
-- analyzed: the analysis job took it, or the dream was analyzed without it.
-- The painting stays for the image job, which takes it by its prompt.
create or replace function public.spend_analysis_preview_of_analyzed_dream()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analysis_previews p
  set status = 'used', reading = null, updated_at = now()
  where p.user_id = new.user_id
    and p.dream_id = new.id
    and p.status in ('writing', 'ready');
  return null;
end;
$$;

revoke execute on function public.spend_analysis_preview_of_analyzed_dream() from public, anon, authenticated, service_role;
grant execute on function public.spend_analysis_preview_of_analyzed_dream() to postgres;

drop trigger if exists trg_spend_analysis_preview_of_analyzed_dream on public.dreams;
create trigger trg_spend_analysis_preview_of_analyzed_dream
after update of is_analyzed on public.dreams
for each row
when (new.is_analyzed is true and old.is_analyzed is distinct from true)
execute function public.spend_analysis_preview_of_analyzed_dream();
