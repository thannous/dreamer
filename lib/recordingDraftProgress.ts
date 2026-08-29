import { RECORDING } from '@/constants/appConfig';

export type RecordingDraftProgressState = 'empty' | 'short' | 'ready';

export type RecordingDraftProgress = {
  charCount: number;
  limit: number;
  remaining: number;
  ratio: number;
  state: RecordingDraftProgressState;
};

// A remembered dream can be fragmentary: once there is a meaningful fragment,
// the save action should become available without an invisible long-form quota.
const READY_THRESHOLD_CHARS = 18;

export function isTranscriptSaveable(value: string): boolean {
  return value.trim().length > 0;
}

export function getRecordingDraftProgress(
  value: string,
  limit: number = RECORDING.TRANSCRIPT_PROGRESS_REFERENCE_CHARS,
): RecordingDraftProgress {
  const safeLimit = Math.max(1, limit);
  const charCount = value.length;
  const remaining = Math.max(0, safeLimit - charCount);
  const ratio = Math.min(1, charCount / safeLimit);

  let state: RecordingDraftProgressState = 'empty';
  if (value.trim().length >= READY_THRESHOLD_CHARS) {
    state = 'ready';
  } else if (value.trim().length > 0) {
    state = 'short';
  }

  return {
    charCount,
    limit: safeLimit,
    remaining,
    ratio,
    state,
  };
}
