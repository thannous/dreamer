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
  -- used: an analysis job took the reading. removed: its dream was deleted.
  status text not null default 'writing' check (status in ('writing', 'ready', 'used', 'removed')),
  lang text not null check (lang in ('en', 'fr', 'es', 'de', 'it', 'pt')),
  -- The transcript the reading was written from, so an edited dream is read again.
  transcript_sha256 text not null check (transcript_sha256 ~ '^[0-9a-f]{64}$'),
  reading jsonb,
  -- painting: the illustration is being painted. used: the image job took it.
  image_status text not null default 'none' check (image_status in ('none', 'painting', 'ready', 'used', 'failed')),
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

-- Deleting a dream deletes the reading prepared from it, as deleting a dream
-- withdraws it from the AI. The painting's objects stay, like a deleted
-- dream's illustration, until the account is deleted. Security definer, since
-- signed-in callers have no access to the previews.
create or replace function public.clear_analysis_preview_of_deleted_dream()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.analysis_previews p
  set status = 'removed', reading = null, updated_at = now()
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
