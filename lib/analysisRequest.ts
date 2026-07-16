import type { DreamAnalysis } from '@/lib/types';

const ANALYSIS_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// analyzeDream can take up to ~91 seconds with its configured retry. Leave a
// little margin before offering recovery so an active request is not duplicated.
export const PENDING_ANALYSIS_RECOVERY_DELAY_MS = 2 * 60 * 1000;

export const isAnalysisRequestId = (value: unknown): value is string =>
  typeof value === 'string' && ANALYSIS_REQUEST_ID_PATTERN.test(value);

export const isResumableAnalysisRequest = (
  dream: Pick<DreamAnalysis, 'analysisRequestId' | 'analysisStatus'>
): dream is Pick<DreamAnalysis, 'analysisStatus'> & { analysisRequestId: string } =>
  (dream.analysisStatus === 'pending' || dream.analysisStatus === 'failed')
  && isAnalysisRequestId(dream.analysisRequestId);

export const isRecoverablePendingAnalysis = (
  dream: Pick<DreamAnalysis, 'analysisStatus' | 'updatedAt' | 'clientUpdatedAt' | 'id'> | null | undefined,
  now = Date.now(),
  recoveryDelayMs = PENDING_ANALYSIS_RECOVERY_DELAY_MS
): boolean => {
  if (dream?.analysisStatus !== 'pending') return false;

  const timestamps = [dream.updatedAt, dream.clientUpdatedAt, dream.id].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
  );
  const pendingSince = timestamps.length > 0 ? Math.max(...timestamps) : null;

  return pendingSince == null || now - pendingSince >= recoveryDelayMs;
};
