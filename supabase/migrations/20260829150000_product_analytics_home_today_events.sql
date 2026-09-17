-- Add two strictly allowlisted Accueil Aujourd'hui events so Home CTA
-- decisions can be evidence-based. Properties stay categorical:
-- state, reason, and CTA action. No dream text, identifiers, or
-- free-form values are accepted by the API.

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
    'journal_layout_preference_changed',
    'onboarding_choice_selected',
    'stats_screen_viewed',
    'stats_period_selected',
    'stats_shared',
    'stats_cta_clicked',
    'lucid_activation_completed',
    'lucid_training_completed',
    'lucid_retention_observed',
    'lucid_noctalia_handoff',
    'lucid_conversion',
    'paywall_plan_selected',
    'purchase_started',
    'purchase_completed',
    'purchase_failed',
    'restore_completed',
    'paywall_dismissed',
    'reminder_prompt_action',
    'home_today_viewed',
    'home_today_cta_clicked'
  ]::text[]));
