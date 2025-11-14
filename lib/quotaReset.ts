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
