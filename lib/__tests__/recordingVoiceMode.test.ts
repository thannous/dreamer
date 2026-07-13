import { describe, expect, it } from '@jest/globals';

import {
  preserveVoiceModeAfterFailure,
  type VoiceCaptureFailure,
} from '@/lib/recordingVoiceMode';

describe('recording voice mode', () => {
  const failures: VoiceCaptureFailure[] = [
    'permission_denied',
    'stt_unavailable',
    'language_pack_missing',
    'no_speech',
    'start_failed',
  ];

  it.each(failures)('keeps voice UI and preference after %s', (failure: VoiceCaptureFailure) => {
    expect(preserveVoiceModeAfterFailure(failure)).toEqual({
      inputMode: 'voice',
      preferenceToPersist: 'voice',
      fallbackReason: failure,
    });
  });
});
