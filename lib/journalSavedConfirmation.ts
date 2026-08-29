import type { Href } from 'expo-router';

export const JOURNAL_SAVED_CONFIRMATION_PARAM = 'saved';
export const JOURNAL_SAVED_CONFIRMATION_VALUE = '1';

export function isJournalSavedConfirmationParam(
  value: string | string[] | undefined
): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === JOURNAL_SAVED_CONFIRMATION_VALUE || raw === 'true';
}

export function buildJournalDetailHref(
  dreamId: string | number,
  options?: { saved?: boolean }
): Href {
  const params: Record<string, string> = { id: String(dreamId) };
  if (options?.saved) {
    params[JOURNAL_SAVED_CONFIRMATION_PARAM] = JOURNAL_SAVED_CONFIRMATION_VALUE;
  }

  return {
    pathname: '/journal/[id]',
    params,
  } as Href;
}
