import { isJournalSavedConfirmationParam } from '@/lib/journalSavedConfirmation';

export type JournalDreamRecallOfferInput = {
  dreamId: string | string[] | number | null | undefined;
  savedParam: string | string[] | undefined;
  previouslyEligibleDreamId: string | null;
};

export type JournalDreamRecallOfferResult = {
  offerEligible: boolean;
  eligibleDreamId: string | null;
};

export function normalizeJournalDreamRecallId(
  value: string | string[] | number | null | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

export function resolveJournalDreamRecallOfferEligible(
  input: JournalDreamRecallOfferInput
): JournalDreamRecallOfferResult {
  const currentId = normalizeJournalDreamRecallId(input.dreamId);
  if (!currentId) {
    return { offerEligible: false, eligibleDreamId: null };
  }

  if (isJournalSavedConfirmationParam(input.savedParam)) {
    return { offerEligible: true, eligibleDreamId: currentId };
  }

  if (input.previouslyEligibleDreamId === currentId) {
    return { offerEligible: true, eligibleDreamId: currentId };
  }

  return { offerEligible: false, eligibleDreamId: null };
}
