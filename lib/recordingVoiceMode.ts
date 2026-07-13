import type { RecordingInputModePreference } from '@/lib/types';

export type VoiceFallbackReason =
  | 'permission_denied'
  | 'stt_unavailable'
  | 'language_pack_missing'
  | 'no_speech'
  | 'start_failed'
  | null;

export type VoiceCaptureFailure = Exclude<VoiceFallbackReason, null>;

export type VoiceCaptureFailureOutcome = {
  inputMode: Extract<RecordingInputModePreference, 'voice'>;
  preferenceToPersist: Extract<RecordingInputModePreference, 'voice'>;
  fallbackReason: VoiceCaptureFailure;
};

/**
 * A voice infrastructure failure must not be interpreted as a user preference
 * change. The UI stays on the voice control and the scoped preference remains
 * voice until the user explicitly selects text.
 */
export function preserveVoiceModeAfterFailure(
  failure: VoiceCaptureFailure
): VoiceCaptureFailureOutcome {
  return {
    inputMode: 'voice',
    preferenceToPersist: 'voice',
    fallbackReason: failure,
  };
}
