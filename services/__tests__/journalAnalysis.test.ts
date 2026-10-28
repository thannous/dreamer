import { describe, expect, it } from '@jest/globals';
import { getDreamAnalysisFreshness } from '@/lib/dreamAnalysisFreshness';
import type { DreamAnalysis } from '@/lib/types';
import { applyJournalAnalysisResult, getAnalysisFailureDisposition, type AnalysisSubmission } from '../journalAnalysis';

const failure = (submission: AnalysisSubmission, error: unknown) =>
  getAnalysisFailureDisposition({ submission, error, consentWithdrawn: false, requestDispatched: true, resuming: false });

describe('journal analysis admission recovery', () => {
  // These errors can follow a committed POST. The UI cannot safely reproduce a
  // lost acknowledgement or server refund; exercise the policy at that boundary.
  it.each([
    new Error('Reply lost'),
    { status: 404, body: { code: 'GATEWAY_NOT_FOUND' } },
    { status: 401, body: { code: 'ANALYSIS_UNAUTHORIZED' } },
    { status: 408, body: { code: 'ANALYSIS_TIMEOUT' } },
    { status: 503, body: { code: 'GATEWAY_UNAVAILABLE' } },
  ])('preserves an ambiguous submission for idempotent recovery: %j', (error: unknown) => {
    expect(failure('submitting', error)).toEqual({ kind: 'pending', clearOutcome: false });
  });

  it.each([
    { status: 429, body: { code: 'QUOTA_EXCEEDED' } },
    { status: 409, body: { code: 'ANALYSIS_TRANSCRIPT_MISMATCH' } },
    { status: 503, body: { code: 'AI_GLOBAL_BACKLOG_LIMIT' } },
  ])('releases a request only after a confirmed admission rejection: %j', (error: unknown) => {
    expect(failure('submitting', error)).toEqual({ kind: 'failed', releaseRequest: true, persistence: 'journal' });
  });

  it('keeps an accepted job pending during observation failure, but releases a terminal refunded job', () => {
    const error = new Error('Worker unavailable');
    expect(failure('accepted', error)).toMatchObject({ kind: 'pending' });
    expect(failure('terminal_failure', error)).toEqual({ kind: 'failed', releaseRequest: true, persistence: 'client' });
  });

  it('restores the previous reading when a new reanalysis is refused as already complete', () => {
    expect(failure('submitting', { status: 409, body: { code: 'ANALYSIS_ALREADY_COMPLETE' } }))
      .toEqual({ kind: 'restore', invalidateQuota: true });
  });

  it('restores the original state on consent withdrawal before transport, but preserves dispatched or resumed work', () => {
    const withdrawn = { error: new Error('Withdrawn'), submission: 'direct' as const,
      consentWithdrawn: true, requestDispatched: false, resuming: false };
    expect(getAnalysisFailureDisposition(withdrawn)).toEqual({ kind: 'restore', invalidateQuota: false });
    expect(getAnalysisFailureDisposition({ ...withdrawn, requestDispatched: true }))
      .toEqual({ kind: 'pending', clearOutcome: true });
    expect(getAnalysisFailureDisposition({ ...withdrawn, resuming: true }))
      .toEqual({ kind: 'pending', clearOutcome: true });
  });

  it('retains a direct retry key unless the API explicitly declares it unusable', () => {
    expect(failure('direct', new Error('Reply lost'))).toMatchObject({ kind: 'failed', releaseRequest: false });
    expect(failure('direct', { status: 409, body: { code: 'ANALYSIS_IDEMPOTENCY_KEY_REUSED' } }))
      .toMatchObject({ kind: 'failed', releaseRequest: true });
  });
});

describe('journal analysis result merge', () => {
  const dream: DreamAnalysis = { id: 1, transcript: 'A quiet lake', title: 'My lake',
    interpretation: '', shareableQuote: '', imageUrl: 'my-photo', chatHistory: [], dreamType: 'Everyday Dream',
    imageJobId: 'painting', imageJobStatus: 'running', imageJobRequestId: 'painting-request' };
  const reading = { title: 'A new name', interpretation: 'A reading', shareableQuote: 'A verse',
    theme: 'surreal' as const, dreamType: 'Symbolic Dream' as const, transcript: 'Generated rewrite' };
  const options = { authenticated: false, replaceImage: false, analyzedTranscript: dream.transcript, now: 100 };

  it('preserves the original story, sealed name and ongoing image when only text is requested', () => {
    const result = applyJournalAnalysisResult(dream, reading, options);
    expect(result).toMatchObject({ title: 'My lake', transcript: dream.transcript, interpretation: 'A reading',
      imageUrl: 'my-photo', imageJobId: 'painting', imageJobStatus: 'running', imageJobRequestId: 'painting-request' });
    expect(getDreamAnalysisFreshness(result)).toBe('fresh');
  });

  it('preserves an edit received during analysis and identifies the returned reading as stale', () => {
    const edited = { ...dream, transcript: 'A quiet lake and a red boat' };
    const result = applyJournalAnalysisResult(edited, reading, options);
    expect(result.transcript).toBe(edited.transcript);
    expect(result.interpretation).toBe(reading.interpretation);
    expect(getDreamAnalysisFreshness(result)).toBe('stale');
  });

  it('resets image job metadata only for an explicit replacement and keeps existing classification', () => {
    const result = applyJournalAnalysisResult({ ...dream, theme: 'calm' }, reading,
      { ...options, authenticated: true, replaceImage: true });
    expect(result).toMatchObject({ title: dream.title, theme: 'calm', dreamType: dream.dreamType,
      imageUrl: dream.imageUrl, imageGenerationFailed: false });
    expect(result.imageJobId).toBeUndefined();
    expect(result.imageJobStatus).toBeUndefined();
    expect(result.imageJobRequestId).toBeUndefined();
  });
});
