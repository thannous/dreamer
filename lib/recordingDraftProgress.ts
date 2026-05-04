import { RECORDING } from '@/constants/appConfig';

export type RecordingDraftProgressState = 'empty' | 'short' | 'ready' | 'full';

export type RecordingDraftProgress = {
  charCount: number;
  limit: number;
  remaining: number;
  ratio: number;
  state: RecordingDraftProgressState;
};

const READY_THRESHOLD_CHARS = 80;

export function getRecordingDraftProgress(
  value: string,
  limit: number = RECORDING.MAX_TRANSCRIPT_CHARS,
): RecordingDraftProgress {
  const safeLimit = Math.max(1, limit);
  const charCount = Math.min(value.length, safeLimit);
  const remaining = Math.max(0, safeLimit - charCount);
  const ratio = Math.min(1, charCount / safeLimit);

  let state: RecordingDraftProgressState = 'empty';
  if (charCount >= safeLimit) {
    state = 'full';
  } else if (value.trim().length >= READY_THRESHOLD_CHARS) {
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
