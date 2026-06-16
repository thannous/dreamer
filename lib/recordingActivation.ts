export type RecordingCaptureIntent = 'fresh' | 'remembered';

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
