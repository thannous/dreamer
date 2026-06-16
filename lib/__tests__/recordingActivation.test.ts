import {
  getRecordingActivationPromptState,
  resolveRememberedCaptureSource,
} from '@/lib/recordingActivation';

const baseInput = {
  recordingOnboardingLoaded: true,
  inputModePreferenceLoaded: true,
  isInitialRecordingState: true,
  recordingOnboardingDismissed: false,
  rememberedDreamPromptLoaded: true,
  rememberedDreamPromptDismissed: false,
  captureIntent: 'fresh' as const,
};

describe('getRecordingActivationPromptState', () => {
  it('shows the remembered dream prompt before the technical onboarding tour', () => {
    expect(getRecordingActivationPromptState(baseInput)).toEqual({
      showRememberedDreamPrompt: true,
      showRecordingOnboardingTour: false,
    });
  });

  it('shows the onboarding tour after the remembered dream prompt is dismissed', () => {
    expect(
      getRecordingActivationPromptState({
        ...baseInput,
        rememberedDreamPromptDismissed: true,
      })
    ).toEqual({
      showRememberedDreamPrompt: false,
      showRecordingOnboardingTour: true,
    });
  });

  it('keeps capture focused after the user starts a remembered dream', () => {
    expect(
      getRecordingActivationPromptState({
        ...baseInput,
        rememberedDreamPromptDismissed: true,
        captureIntent: 'remembered',
      })
    ).toEqual({
      showRememberedDreamPrompt: false,
      showRecordingOnboardingTour: false,
    });
  });

  it('does not show first-run prompts after the first dream flow has moved on', () => {
    expect(
      getRecordingActivationPromptState({
        ...baseInput,
        isInitialRecordingState: false,
      })
    ).toEqual({
      showRememberedDreamPrompt: false,
      showRecordingOnboardingTour: false,
    });
  });
});

describe('resolveRememberedCaptureSource', () => {
  it('defaults remembered route captures to journal instead of onboarding', () => {
    expect(resolveRememberedCaptureSource(undefined)).toBe('journal');
    expect(resolveRememberedCaptureSource('')).toBe('journal');
    expect(resolveRememberedCaptureSource('unknown')).toBe('journal');
  });

  it('accepts explicit profile and onboarding sources', () => {
    expect(resolveRememberedCaptureSource('profile')).toBe('profile');
    expect(resolveRememberedCaptureSource('onboarding')).toBe('onboarding');
    expect(resolveRememberedCaptureSource(['profile'])).toBe('profile');
  });
});
