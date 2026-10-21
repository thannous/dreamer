import { isResumableAnalysisRequest } from '@/lib/analysisRequest';
import { isDreamAnalyzed } from '@/lib/dreamUsage';
import { getMonthlyQuotaPeriod } from '@/lib/quotaReset';
import type { DreamAnalysis, QuotaUsage, SubscriptionTier } from '@/lib/types';

/** The month's last days: the included analyses left then do not carry over. */
export const MONTH_END_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Never read, with nothing on its way or to resume: only such a dream needs a new analysis. */
const awaitsReading = (dream: DreamAnalysis): boolean =>
  Boolean(dream.transcript?.trim()) && !isDreamAnalyzed(dream) && !isResumableAnalysisRequest(dream);

export type MonthEndAnalyses = {
  remaining: number;
  /** The newest dream that has no reading yet nor one on its way. */
  dream: DreamAnalysis;
};

/**
 * In the month's last days, a free account that still has included analyses and a dream
 * that has never been read is told so, with that dream: the analyses end with the month.
 * Guests, Plus, an unknown or failing quota, used-up analyses or nothing to read get nothing.
 */
export function getMonthEndAnalyses({
  tier,
  signedIn,
  loading,
  error,
  usage,
  dreams,
  now,
}: {
  tier: SubscriptionTier;
  signedIn: boolean;
  loading: boolean;
  error?: Error | null;
  usage?: QuotaUsage | null;
  dreams: readonly DreamAnalysis[];
  now: number;
}): MonthEndAnalyses | null {
  if (!signedIn || tier !== 'free' || loading || error) return null;
  const metric = usage?.analysis;
  if (typeof metric?.limit !== 'number' || typeof metric.remaining !== 'number' || metric.remaining < 1) return null;
  const { periodEnd } = getMonthlyQuotaPeriod(new Date(now));
  if (periodEnd.getTime() - now > MONTH_END_DAYS * DAY_MS) return null;
  let dream: DreamAnalysis | null = null;
  for (const candidate of dreams) {
    if (Number.isFinite(candidate.id) && awaitsReading(candidate) && (!dream || candidate.id > dream.id)) dream = candidate;
  }
  if (!dream) return null;
  return { remaining: metric.remaining, dream };
}
