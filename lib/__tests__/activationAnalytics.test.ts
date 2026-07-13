import {
  buildFirstValueProperties,
  getAnalyticsOnboardingPath,
  getHoursSinceOnboardingBucket,
} from '@/lib/activationAnalytics';
import { getDefaultOnboardingState } from '@/lib/onboardingState';

describe('activationAnalytics', () => {
  it('uses the terminal completion reason for the onboarding path', () => {
    expect(
      getAnalyticsOnboardingPath({ completionReason: 'skip', selectedPath: 'analyze' })
    ).toBe('skip');
  });

  it('buckets elapsed time from onboarding start', () => {
    const state = { startedAt: 1_000, completedAt: 2_000 };

    expect(getHoursSinceOnboardingBucket(state, 1_000 + 30 * 60 * 1000)).toBe('0_1h');
    expect(getHoursSinceOnboardingBucket(state, 1_000 + 2 * 60 * 60 * 1000)).toBe('1_24h');
    expect(getHoursSinceOnboardingBucket(state, 1_000 + 25 * 60 * 60 * 1000)).toBe('24h_plus');
  });

  it('returns unknown when there is no trustworthy timestamp', () => {
    expect(getHoursSinceOnboardingBucket({ startedAt: null, completedAt: null }, 10_000)).toBe(
      'unknown'
    );
    expect(getHoursSinceOnboardingBucket({ startedAt: 20_000, completedAt: null }, 10_000)).toBe(
      'unknown'
    );
    expect(getHoursSinceOnboardingBucket({ startedAt: null, completedAt: 5_000 }, 10_000)).toBe(
      'unknown'
    );
  });

  it('builds the allowlisted first-value payload without identifiers', () => {
    const state = {
      ...getDefaultOnboardingState(1_000),
      status: 'completed' as const,
      selectedPath: 'dictionary' as const,
      completionReason: 'dictionary' as const,
      startedAt: 1_000,
      completedAt: 2_000,
    };

    expect(buildFirstValueProperties(state, 'symbol_detail', 3_000)).toEqual({
      value: 'symbol_detail',
      onboarding_path: 'dictionary',
      hours_since_onboarding_bucket: '0_1h',
    });
  });
});
