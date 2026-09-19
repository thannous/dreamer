import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

describe('journal detail recall offer wiring', () => {
  const source = readFileSync(join(__dirname, '../../app/journal/[id].tsx'), 'utf8');
  const optionalRecall = source.slice(
    source.indexOf('{!recallRequested ? ('),
    source.indexOf('{renderIllustrationSection()}')
  );

  it('mounts the optional recall offer after the original transcript', () => {
    expect(source).toContain(
      "import { DreamRecallAssistantCard } from '@/components/journal/DreamRecallAssistantCard'"
    );
    expect(source).toContain('resolveJournalDreamRecallOfferEligible');
    expect(source.indexOf('<Reveal index={2}>')).toBeLessThan(
      source.indexOf('<DreamRecallAssistantCard', source.indexOf('<Reveal index={3}>'))
    );
    expect(optionalRecall).toContain('<DreamRecallAssistantCard');
    expect(optionalRecall).toContain('dreamId={getDreamRecallStorageId(dream, user?.id ?? null)}');
    expect(optionalRecall).toContain('originalTranscript={dream.transcript}');
    expect(optionalRecall).toContain(
      'originalPersistedSegmentId={dream.clientRequestId ?? (dream.remoteId != null ? getDreamIdentityKey(dream) : String(dream.id))}'
    );
    expect(optionalRecall).toContain('offerEligible={recallOffer.offerEligible}');
  });

  // The rendered order is exercised in journalDetailSavedConfirmation.test.tsx.

});

// Rendered zone order (with and without illustration) is covered by
// tests/app-routes/journalDetailSavedConfirmation.test.tsx.
