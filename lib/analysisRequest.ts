import type { DreamAnalysis } from '@/lib/types';

const ANALYSIS_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isAnalysisRequestId = (value: unknown): value is string =>
  typeof value === 'string' && ANALYSIS_REQUEST_ID_PATTERN.test(value);

export const isResumableAnalysisRequest = (
  dream: Pick<DreamAnalysis, 'analysisRequestId' | 'analysisStatus'>
): dream is Pick<DreamAnalysis, 'analysisStatus'> & { analysisRequestId: string } =>
  (dream.analysisStatus === 'pending' || dream.analysisStatus === 'failed')
  && isAnalysisRequestId(dream.analysisRequestId);
