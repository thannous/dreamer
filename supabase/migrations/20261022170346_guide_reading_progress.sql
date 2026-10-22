-- A bookmark is scoped to one account; completing a guide is an explicit, permanent action.
create table public.guide_reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide_id text not null check (guide_id in ('understand-dreams','remember-dreams','dream-journal','lucid-dreaming','most-common-dream-symbols','scary-dream-symbols','animal-dream-symbols','water-dream-symbols')),
  section integer not null check (section between 0 and 100),
  updated_at_ms bigint not null check (updated_at_ms between 1 and 9007199254740991),
  completed_at_ms bigint check (completed_at_ms between 1 and 9007199254740991),
  primary key (user_id, guide_id)
);
alter table public.guide_reading_progress enable row level security;
revoke all on table public.guide_reading_progress from public, anon, authenticated;
grant select, insert, update on table public.guide_reading_progress to authenticated;
grant all on table public.guide_reading_progress to service_role;
create policy app_product_scope on public.guide_reading_progress
  as restrictive for all to authenticated
  using ((select public.current_app_product()) in ('legacy', 'journal'))
  with check ((select public.current_app_product()) in ('legacy', 'journal'));
create policy guide_reading_select on public.guide_reading_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy guide_reading_insert on public.guide_reading_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy guide_reading_update on public.guide_reading_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.merge_guide_reading_progress(p_user_id uuid, p_guide_id text, p_section integer, p_updated_at_ms bigint, p_completed_at_ms bigint default null)
returns setof public.guide_reading_progress
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'Guide reading account mismatch' using errcode = '42501';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and public.current_app_product() not in ('legacy', 'journal') then
    raise exception 'Application scope does not allow journal access' using errcode = '42501';
  end if;
  return query
  insert into public.guide_reading_progress as current (user_id, guide_id, section, updated_at_ms, completed_at_ms)
  values (p_user_id, p_guide_id, p_section, p_updated_at_ms, p_completed_at_ms)
  on conflict (user_id, guide_id) do update set
    -- Section zero records a visit, not an intentional bookmark reset. A fresh device
    -- can open a guide before its cloud read returns, so its newer visit must not win.
    section = case
      when current.section > 0 and excluded.section = 0 then current.section
      when current.section = 0 and excluded.section > 0 then excluded.section
      when excluded.updated_at_ms >= current.updated_at_ms then excluded.section else current.section end,
    updated_at_ms = case
      when current.section > 0 and excluded.section = 0 then current.updated_at_ms
      when current.section = 0 and excluded.section > 0 then excluded.updated_at_ms
      else greatest(current.updated_at_ms, excluded.updated_at_ms) end,
    completed_at_ms = least(current.completed_at_ms, excluded.completed_at_ms)
  returning current.*;
end;
$$;
revoke all on function public.merge_guide_reading_progress(uuid, text, integer, bigint, bigint) from public, anon;
grant execute on function public.merge_guide_reading_progress(uuid, text, integer, bigint, bigint) to authenticated, service_role;
