import { formatLocaleDate } from '@/lib/dateUtils';

export interface QuotaPeriod {
  periodStart: Date;
  periodEnd: Date;
}

export function getMonthlyQuotaPeriod(now: Date = new Date()): QuotaPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart: start, periodEnd: end };
}

export function shouldResetQuota(lastResetAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastResetAt) return true;
  const last = new Date(lastResetAt);
  const { periodStart } = getMonthlyQuotaPeriod(now);
  return last < periodStart;
}

/**
 * The day the included analyses come back, as people write it. The period turns over at
 * midnight UTC on the 1st, so the day is read in UTC; French writes the first "1er",
 * which Intl does not.
 */
export function formatQuotaResetDate(
  locale: string,
  options: Pick<Intl.DateTimeFormatOptions, 'year'> = {},
  now: Date = new Date(),
): string {
  const { periodEnd } = getMonthlyQuotaPeriod(now);
  const text = formatLocaleDate(periodEnd, locale, { day: 'numeric', month: 'long', ...options, timeZone: 'UTC' });
  return locale.toLowerCase().startsWith('fr') ? text.replace(/^1(?=\s)/, '1er') : text;
}
