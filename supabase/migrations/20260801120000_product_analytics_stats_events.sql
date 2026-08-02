-- Widen the product_analytics_events event_name allowlist with the four
-- Statistics screen events (P1-13). The original constraint was declared inline
-- on the column in 20260712203356_product_analytics_events.sql, so Postgres
-- auto-named it product_analytics_events_event_name_check. Recreating it here
-- (drop-if-exists then add) keeps this migration safe to re-run.

alter table public.product_analytics_events
  drop constraint if exists product_analytics_events_event_name_check;

alter table public.product_analytics_events
  add constraint product_analytics_events_event_name_check
  check (event_name = any (array[
    'app_session_started',
    'onboarding_started',
    'onboarding_step_viewed',
    'onboarding_completed',
    'onboarding_destination_viewed',
    'dream_capture_started',
    'recording_started',
    'recording_saved',
    'recording_activation_insight_shown',
    'analysis_started',
    'analysis_completed',
    'analysis_offer_viewed',
    'first_dream_next_action_selected',
    'analysis_failed',
    'analysis_result_viewed',
    'symbol_detail_viewed',
    'first_value_viewed',
    'paywall_viewed',
    'empty_journal_remembered_cta_clicked',
    'onboarding_choice_selected',
    'stats_screen_viewed',
    'stats_period_selected',
    'stats_shared',
    'stats_cta_clicked'
  ]::text[]));
