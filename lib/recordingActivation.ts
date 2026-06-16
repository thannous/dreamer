import type { DreamMemoryCreatedFrom } from '@/lib/types';

export type RecordingCaptureIntent = 'fresh' | 'remembered';
export type RememberedCaptureSource = Extract<DreamMemoryCreatedFrom, 'onboarding' | 'journal' | 'profile'>;

export type RecordingActivationPromptInput = {
  recordingOnboardingLoaded: boolean;
  inputModePreferenceLoaded: boolean;
  isInitialRecordingState: boolean;
  recordingOnboardingDismissed: boolean;
  rememberedDreamPromptLoaded: boolean;
  rememberedDreamPromptDismissed: boolean;
  captureIntent: RecordingCaptureIntent;
};

export type RecordingActivationPromptState = {
  showRememberedDreamPrompt: boolean;
  showRecordingOnboardingTour: boolean;
};

export function resolveRememberedCaptureSource(
  value: string | string[] | null | undefined
): RememberedCaptureSource {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'onboarding' || raw === 'profile' ? raw : 'journal';
}

export function getRecordingActivationPromptState(
  input: RecordingActivationPromptInput
): RecordingActivationPromptState {
  const isReadyForFirstRunPrompt = input.inputModePreferenceLoaded
    && input.isInitialRecordingState
    && input.captureIntent === 'fresh';

  const showRememberedDreamPrompt = isReadyForFirstRunPrompt
    && input.rememberedDreamPromptLoaded
    && !input.rememberedDreamPromptDismissed;

  return {
    showRememberedDreamPrompt,
    showRecordingOnboardingTour: isReadyForFirstRunPrompt
      && input.recordingOnboardingLoaded
      && !input.recordingOnboardingDismissed
      && !showRememberedDreamPrompt,
  };
}
