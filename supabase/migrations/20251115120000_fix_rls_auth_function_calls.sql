-- Avoid per-row re-evaluation of auth functions in RLS policies

alter policy "dreams select own" on public.dreams
  using ((select auth.uid()) = user_id);

alter policy "dreams insert own" on public.dreams
  with check ((select auth.uid()) = user_id);

alter policy "dreams update own" on public.dreams
  using ((select auth.uid()) = user_id);

alter policy "dreams delete own" on public.dreams
  using ((select auth.uid()) = user_id);

alter policy "anon can insert waitlist" on public.waitlist_subscribers
  with check ((select auth.role()) = 'anon');

alter policy "service can read waitlist" on public.waitlist_subscribers
  using ((select auth.role()) = 'service_role');
