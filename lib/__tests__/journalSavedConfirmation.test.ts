import {
  buildJournalDetailHref,
  isJournalSavedConfirmationParam,
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

  it('treats only explicit saved flags as confirmation', () => {
    expect(isJournalSavedConfirmationParam('1')).toBe(true);
    expect(isJournalSavedConfirmationParam(['1'])).toBe(true);
    expect(isJournalSavedConfirmationParam('true')).toBe(true);
    expect(isJournalSavedConfirmationParam('0')).toBe(false);
    expect(isJournalSavedConfirmationParam(undefined)).toBe(false);
    expect(isJournalSavedConfirmationParam(['0'])).toBe(false);
  });
});
