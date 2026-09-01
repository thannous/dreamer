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
  const reveal3 = source.slice(
    source.indexOf('<Reveal index={3}>'),
    source.indexOf('<Reveal index={4}>')
  );

  it('mounts DreamRecallAssistantCard with exact props after the original transcript', () => {
    expect(source).toContain(
      "import { DreamRecallAssistantCard } from '@/components/journal/DreamRecallAssistantCard'"
    );
    expect(source).toContain('resolveJournalDreamRecallOfferEligible');
    expect(source.indexOf('<Reveal index={2}>')).toBeLessThan(
      source.indexOf('<DreamRecallAssistantCard')
    );
    expect(reveal3).toContain('<DreamRecallAssistantCard');
    expect(reveal3).toContain('dreamId={String(dream.id)}');
    expect(reveal3).toContain('originalTranscript={dream.transcript}');
    expect(reveal3).toContain(
      'originalPersistedSegmentId={dream.clientRequestId ?? String(dream.id)}'
    );
    expect(reveal3).toContain('offerEligible={recallOffer.offerEligible}');
  });

  it('places the card before analysis, interpretation, and the detail CTA', () => {
    expect(reveal3.indexOf('<DreamRecallAssistantCard')).toBeGreaterThan(-1);
    expect(reveal3.indexOf('<DreamRecallAssistantCard')).toBeLessThan(
      reveal3.indexOf('{renderDetailActionCard()}')
    );
    expect(reveal3.indexOf('<DreamRecallAssistantCard')).toBeLessThan(
      reveal3.indexOf('dream.interpretation')
    );
    expect(reveal3.indexOf('<DreamRecallAssistantCard')).toBeLessThan(
      reveal3.indexOf('showCompletedReading')
    );
  });
});
