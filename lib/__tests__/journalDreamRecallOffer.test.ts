
import { resolveJournalDreamRecallOfferEligible } from '../journalDreamRecallOffer';

describe('resolveJournalDreamRecallOfferEligible', () => {
  it('keeps saved=1 eligibility after the param is cleared on the same id', () => {
    const initial = resolveJournalDreamRecallOfferEligible({
      dreamId: '42',
      savedParam: '1',
      previouslyEligibleDreamId: null,
    });

    expect(initial).toEqual({ offerEligible: true, eligibleDreamId: '42' });
    expect(
      resolveJournalDreamRecallOfferEligible({
        dreamId: '42',
        savedParam: undefined,
        previouslyEligibleDreamId: initial.eligibleDreamId,
      })
    ).toEqual({ offerEligible: true, eligibleDreamId: '42' });
  });

  it('does not reuse an old offer when the route id changes', () => {
    const initial = resolveJournalDreamRecallOfferEligible({
      dreamId: '42',
      savedParam: '1',
      previouslyEligibleDreamId: null,
    });

    expect(
      resolveJournalDreamRecallOfferEligible({
        dreamId: '43',
        savedParam: undefined,
        previouslyEligibleDreamId: initial.eligibleDreamId,
      })
    ).toEqual({ offerEligible: false, eligibleDreamId: null });
  });

  it('is not eligible without a saved confirmation', () => {
    expect(
      resolveJournalDreamRecallOfferEligible({
        dreamId: '42',
        savedParam: undefined,
        previouslyEligibleDreamId: null,
      }).offerEligible
    ).toBe(false);
    expect(
      resolveJournalDreamRecallOfferEligible({
        dreamId: '42',
        savedParam: '0',
        previouslyEligibleDreamId: null,
      }).offerEligible
    ).toBe(false);
  });

  it('treats the same confirmation flags as isJournalSavedConfirmationParam', () => {
    expect(
      resolveJournalDreamRecallOfferEligible({
        dreamId: ['42'],
        savedParam: ['true'],
        previouslyEligibleDreamId: null,
      })
    ).toEqual({ offerEligible: true, eligibleDreamId: '42' });
  });
});

// Rendered zone order (with and without illustration) is covered by
// tests/app-routes/journalDetailSavedConfirmation.test.tsx.
