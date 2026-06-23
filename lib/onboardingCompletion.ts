export type OnboardingCompletionIntent =
  | 'skip'
  | 'library'
  | 'freshCapture'
  | 'rememberedCapture';

export interface OnboardingCompletionFlags {
  firstLaunchCompleted: true;
  recordingOnboardingCompleted: boolean;
  rememberedDreamPromptDismissed: boolean;
}

export function getOnboardingCompletionFlags(
  intent: OnboardingCompletionIntent,
): OnboardingCompletionFlags {
  const entersCapture = intent === 'freshCapture' || intent === 'rememberedCapture';

  return {
    firstLaunchCompleted: true,
    recordingOnboardingCompleted: entersCapture,
    rememberedDreamPromptDismissed: entersCapture,
  };
}
