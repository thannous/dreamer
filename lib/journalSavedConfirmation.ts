import type { Href } from 'expo-router';

export const JOURNAL_SAVED_CONFIRMATION_PARAM = 'saved';
export const JOURNAL_SAVED_CONFIRMATION_VALUE = '1';

export function isJournalSavedConfirmationParam(
  value: string | string[] | undefined
): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === JOURNAL_SAVED_CONFIRMATION_VALUE || raw === 'true';
}

function normalizeJournalRouteId(
  value: string | string[] | number | null | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

export function shouldOfferSavedDreamAnalysis(input: {
  savedParam?: string | string[];
  recallRequested?: boolean;
  pendingPhase?: string | null;
  pendingSavedDreamId?: number | string | null;
  dreamId?: string | string[] | number | null;
}): boolean {
  if (input.recallRequested) return false;
  if (isJournalSavedConfirmationParam(input.savedParam)) return true;
  if (input.pendingPhase !== 'analysis_confirmation' || input.pendingSavedDreamId == null) {
    return false;
  }
  const dreamId = normalizeJournalRouteId(input.dreamId);
  return dreamId != null && dreamId === String(input.pendingSavedDreamId).trim();
}

export function buildJournalDetailHref(
  dreamId: string | number,
  options?: { saved?: boolean; recall?: boolean }
): Href {
  const params: Record<string, string> = { id: String(dreamId) };
  if (options?.saved) {
    params[JOURNAL_SAVED_CONFIRMATION_PARAM] = JOURNAL_SAVED_CONFIRMATION_VALUE;
  }
  if (options?.recall) params.recall = '1';

  return {
    pathname: '/journal/[id]',
    params,
  } as Href;
}
