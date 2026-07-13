import type { OnboardingState } from '@/lib/onboardingState';

export type FirstValueKind = 'analysis_result' | 'recording_insight' | 'symbol_detail';
export type AnalyticsOnboardingPath =
  | 'analyze'
  | 'memory'
  | 'dictionary'
  | 'skip'
  | 'unknown';
export type HoursSinceOnboardingBucket =
  | '0_1h'
  | '1_24h'
  | '24h_plus'
  | 'unknown';

export type FirstValueProperties = {
  value: FirstValueKind;
  onboarding_path: AnalyticsOnboardingPath;
  hours_since_onboarding_bucket: HoursSinceOnboardingBucket;
};

export function getAnalyticsOnboardingPath(
  state: Pick<OnboardingState, 'completionReason' | 'selectedPath'>
): AnalyticsOnboardingPath {
  const path = state.completionReason ?? state.selectedPath;
  return path === 'analyze' ||
    path === 'memory' ||
    path === 'dictionary' ||
    path === 'skip'
    ? path
    : 'unknown';
}

export function getHoursSinceOnboardingBucket(
  state: Pick<OnboardingState, 'startedAt' | 'completedAt'>,
  now = Date.now()
): HoursSinceOnboardingBucket {
  // Legacy terminal states may only have a synthetic completedAt created by
  // migration. They must stay outside the v2 24-hour activation cohort.
  const reference = state.startedAt;
  if (reference === null || !Number.isFinite(reference) || now < reference) {
    return 'unknown';
  }

  const elapsedMs = now - reference;
  if (elapsedMs <= 60 * 60 * 1000) return '0_1h';
  if (elapsedMs <= 24 * 60 * 60 * 1000) return '1_24h';
  return '24h_plus';
}

export function buildFirstValueProperties(
  state: Pick<
    OnboardingState,
    'completionReason' | 'selectedPath' | 'startedAt' | 'completedAt'
  >,
  value: FirstValueKind,
  now = Date.now()
): FirstValueProperties {
  return {
    value,
    onboarding_path: getAnalyticsOnboardingPath(state),
    hours_since_onboarding_bucket: getHoursSinceOnboardingBucket(state, now),
  };
}
