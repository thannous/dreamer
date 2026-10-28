import { stampDreamAnalysisTranscript } from '@/lib/dreamAnalysisFreshness';
import type { DreamAnalysis } from '@/lib/types';
import type { AnalysisResult } from './geminiServiceReal';

/** Transport knowledge, kept separate from the persisted reading's status. */
export type AnalysisSubmission = 'direct' | 'submitting' | 'accepted' | 'terminal_failure';

export type AnalysisFailureDisposition =
  | { kind: 'restore'; invalidateQuota: boolean }
  | { kind: 'pending'; clearOutcome: boolean }
  | { kind: 'failed'; releaseRequest: boolean; persistence: 'journal' | 'client' };

type AnalysisFailure = {
  error: unknown;
  submission: AnalysisSubmission;
  consentWithdrawn: boolean;
  requestDispatched: boolean;
  resuming: boolean;
};

/** Decide what an error proves about admission, without network or storage effects. */
export function getAnalysisFailureDisposition({
  error, submission, consentWithdrawn, requestDispatched, resuming,
}: AnalysisFailure): AnalysisFailureDisposition {
  const accepted = submission === 'accepted' || submission === 'terminal_failure';
  if (consentWithdrawn) {
    // Withdrawal cannot cancel work already admitted or an ambiguous earlier attempt.
    return requestDispatched || accepted || resuming
      ? { kind: 'pending', clearOutcome: true }
      : { kind: 'restore', invalidateQuota: false };
  }

  const response = error && typeof error === 'object' ? error : null;
  const status = response && 'status' in response && typeof response.status === 'number'
    ? response.status : undefined;
  const body = response && 'body' in response && response.body && typeof response.body === 'object'
    ? response.body : null;
  const code = body && 'code' in body && typeof body.code === 'string' ? body.code : undefined;
  if (submission === 'submitting' && status === 409 && code === 'ANALYSIS_ALREADY_COMPLETE') {
    return { kind: 'restore', invalidateQuota: true };
  }

  const nonReusableRequest = status === 409 && code !== undefined && [
    'ANALYSIS_ALREADY_CLAIMED', 'ANALYSIS_TRANSCRIPT_MISMATCH', 'ANALYSIS_IDEMPOTENCY_KEY_REUSED',
  ].includes(code);
  const admissionCode = code !== undefined && (/^(AI_|ANALYSIS_)/.test(code)
    || ['QUOTA_EXCEEDED', 'DAILY_ANALYSIS_LIMIT', 'DREAM_NOT_FOUND', 'INVALID_INPUT'].includes(code));
  // Auth/gateway errors can follow a committed POST. Only the API's own admission
  // answer establishes that a new request may safely claim quota again.
  const rejected = submission === 'submitting' && (
    (status !== undefined && status >= 400 && status < 500
      && status !== 401 && status !== 408 && admissionCode)
    || (status === 503 && code === 'AI_GLOBAL_BACKLOG_LIMIT')
  );
  if ((submission === 'submitting' || submission === 'accepted') && !rejected) {
    return { kind: 'pending', clearOutcome: false };
  }
  if (submission === 'terminal_failure') {
    return { kind: 'failed', releaseRequest: true, persistence: 'client' };
  }
  return { kind: 'failed', releaseRequest: nonReusableRequest || rejected, persistence: 'journal' };
}

type ReadingResult = Omit<AnalysisResult, 'imagePrompt' | 'quotaUsed'> & { transcript?: string };

/** Merge a reading without letting generated content replace the dreamer's story. */
export function applyJournalAnalysisResult(
  latest: DreamAnalysis,
  result: ReadingResult,
  options: { authenticated: boolean; replaceImage: boolean; analyzedTranscript: string; now: number },
): DreamAnalysis {
  const { transcript: _ignoredTranscript, ...reading } = result;
  const next: DreamAnalysis = {
    ...latest,
    ...reading,
    title: latest.title?.trim() && (!options.authenticated || latest.theme) ? latest.title : reading.title,
    ...(latest.theme ? { theme: latest.theme, dreamType: latest.dreamType } : null),
    transcript: latest.transcript,
    analysisStatus: 'done',
    analyzedAt: options.now,
    isAnalyzed: true,
    ...(options.replaceImage ? {
      imageGenerationFailed: false,
      imageJobId: undefined,
      imageJobStatus: undefined,
      imageJobRequestId: undefined,
      imageJobErrorCode: undefined,
      imageJobErrorMessage: undefined,
    } : null),
  };
  // A later local edit remains the story, but must not make an older reading fresh.
  return stampDreamAnalysisTranscript(next, options.analyzedTranscript);
}
