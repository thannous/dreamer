-- The full moon letter (Noctalia Plus): once per lunar cycle, a reading of the
-- dreams noted since the previous full moon. Written once by the api function,
-- kept for its reader. Free accounts receive only its first sentence, so the
-- table is never exposed to the Data API: the api function reads and writes it
-- with the service role and decides what each account may see.

create table if not exists public.moon_letters (
  user_id uuid not null references auth.users(id) on delete cascade,
  full_moon_at timestamptz not null,
  -- writing: a request holds the letter while the model writes it.
  status text not null default 'writing' check (status in ('writing', 'ready')),
  lang text not null check (lang in ('en', 'fr', 'es', 'de', 'it', 'pt')),
  opening text check (opening is null or char_length(opening) between 1 and 400),
  body text check (body is null or char_length(body) between 1 and 4000),
  dream_count integer not null default 0 check (dream_count >= 0),
  -- The window of dreams the letter reads, by their created_at.
  dreams_from timestamptz not null,
  dreams_until timestamptz not null check (dreams_until > dreams_from),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, full_moon_at),
  constraint moon_letters_ready_has_text check (status <> 'ready' or (opening is not null and body is not null))
);

comment on table public.moon_letters is
  'One full moon letter per account and lunar cycle. Service role only: free accounts see only the opening, through the api function.';

alter table public.moon_letters enable row level security;

revoke all on table public.moon_letters from anon;
revoke all on table public.moon_letters from authenticated;
grant select, insert, update, delete on table public.moon_letters to service_role;

-- A letter may quote the dreams it read: deleting one of them deletes the
-- letter too, as deleting a dream withdraws it from the AI. Security definer,
-- since signed-in callers have no access to the letters.
create or replace function public.delete_moon_letters_of_deleted_dream()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.moon_letters l
  where l.user_id = old.user_id
    and old.created_at >= l.dreams_from
    and old.created_at < l.dreams_until;
  return null;
end;
$$;

-- Owner only, like the other trigger functions on dreams (20261021120000).
revoke execute on function public.delete_moon_letters_of_deleted_dream() from public, anon, authenticated, service_role;
grant execute on function public.delete_moon_letters_of_deleted_dream() to postgres;

drop trigger if exists trg_delete_moon_letters_of_deleted_dream on public.dreams;
create trigger trg_delete_moon_letters_of_deleted_dream
after delete on public.dreams
for each row
execute function public.delete_moon_letters_of_deleted_dream();
