import {
  buildJournalDetailHref,
  isJournalSavedConfirmationParam,
  shouldOfferSavedDreamAnalysis,
} from '@/lib/journalSavedConfirmation';

describe('journalSavedConfirmation', () => {
  it('builds a detail href without a confirmation param by default', () => {
    expect(buildJournalDetailHref(42)).toEqual({
      pathname: '/journal/[id]',
      params: { id: '42' },
    });
  });

  it('adds a one-shot saved confirmation param after a successful save', () => {
    expect(buildJournalDetailHref(42, { saved: true })).toEqual({
      pathname: '/journal/[id]',
      params: { id: '42', saved: '1' },
    });
  });

  it('marks a newly saved dream for one automatic guest demo', () => {
    expect(buildJournalDetailHref(42, { saved: true, autoAnalyze: true })).toEqual({
      pathname: '/journal/[id]', params: { id: '42', saved: '1', autoAnalyze: '1' },
    });
  });

  it('routes an explicit recall continuation with its saved dream', () => {
    expect(buildJournalDetailHref(42, { saved: true, recall: true })).toEqual({
      pathname: '/journal/[id]', params: { id: '42', saved: '1', recall: '1' },
    });
  });

  it('treats only explicit saved flags as confirmation', () => {
    expect(isJournalSavedConfirmationParam('1')).toBe(true);
    expect(isJournalSavedConfirmationParam(['1'])).toBe(true);
    expect(isJournalSavedConfirmationParam('true')).toBe(true);
    expect(isJournalSavedConfirmationParam('0')).toBe(false);
    expect(isJournalSavedConfirmationParam(undefined)).toBe(false);
    expect(isJournalSavedConfirmationParam(['0'])).toBe(false);
  });

  it('restores the saved-analysis offer from a matching pending confirmation', () => {
    expect(
      shouldOfferSavedDreamAnalysis({
        savedParam: undefined,
        pendingPhase: 'analysis_confirmation',
        pendingSavedDreamId: 42,
        dreamId: '42',
      })
    ).toBe(true);
    expect(
      shouldOfferSavedDreamAnalysis({
        savedParam: '1',
        pendingPhase: null,
        dreamId: '42',
      })
    ).toBe(true);
  });

  it('does not reopen the offer for recall, a different dream, or a later phase', () => {
    expect(
      shouldOfferSavedDreamAnalysis({
        savedParam: '1',
        recallRequested: true,
        pendingPhase: 'analysis_confirmation',
        pendingSavedDreamId: 42,
        dreamId: '42',
      })
    ).toBe(false);
    expect(
      shouldOfferSavedDreamAnalysis({
        pendingPhase: 'analysis_confirmation',
        pendingSavedDreamId: 41,
        dreamId: '42',
      })
    ).toBe(false);
    expect(
      shouldOfferSavedDreamAnalysis({
        pendingPhase: 'analysis_requested',
        pendingSavedDreamId: 42,
        dreamId: '42',
      })
    ).toBe(false);
    expect(
      shouldOfferSavedDreamAnalysis({
        dreamId: '42',
      })
    ).toBe(false);
  });
});
