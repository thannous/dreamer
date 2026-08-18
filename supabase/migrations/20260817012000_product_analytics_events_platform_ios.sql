-- Consented first-party product analytics may now be ingested from iOS
-- as well as Android. Guest sessions remain Android-only (Play Integrity);
-- iOS ingest uses an authenticated Supabase bearer until App Attest exists.

alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_platform_check;

alter table public.product_analytics_events
  add constraint product_analytics_events_platform_check
  check (platform = any (array['android', 'ios']::text[]));
