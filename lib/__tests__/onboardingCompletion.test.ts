import { describe, expect, it } from '@jest/globals';

import { getOnboardingCompletionFlags } from '@/lib/onboardingCompletion';

describe('getOnboardingCompletionFlags', () => {
  it('keeps capture education and remembered prompt available when onboarding is skipped', () => {
    expect(getOnboardingCompletionFlags('skip')).toEqual({
      firstLaunchCompleted: true,
      recordingOnboardingCompleted: false,
      rememberedDreamPromptDismissed: false,
    });
  });

  it('keeps capture education and remembered prompt available when opening the library', () => {
    expect(getOnboardingCompletionFlags('library')).toEqual({
      firstLaunchCompleted: true,
      recordingOnboardingCompleted: false,
      rememberedDreamPromptDismissed: false,
    });
  });

  it('keeps the remembered dream prompt recoverable after a fresh dream capture path', () => {
    expect(getOnboardingCompletionFlags('freshCapture')).toEqual({
      firstLaunchCompleted: true,
      recordingOnboardingCompleted: true,
      rememberedDreamPromptDismissed: false,
    });
  });

  it('dismisses first-run capture prompts after the remembered capture path', () => {
    expect(getOnboardingCompletionFlags('rememberedCapture')).toEqual({
      firstLaunchCompleted: true,
      recordingOnboardingCompleted: true,
      rememberedDreamPromptDismissed: true,
    });
  });
});
