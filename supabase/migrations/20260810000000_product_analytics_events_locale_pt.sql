-- Allow 'pt' (Brazilian Portuguese) in product analytics events.
-- The Edge Function accepts 'pt' since the app shipped the pt-BR launch; without
-- this, every analytics insert from a pt device violates the CHECK constraint.

alter table public.product_analytics_events
  drop constraint product_analytics_events_locale_check;

alter table public.product_analytics_events
  add constraint product_analytics_events_locale_check
  check (locale = any (array['fr', 'en', 'es', 'de', 'it', 'pt']::text[]));
