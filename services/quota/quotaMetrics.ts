import { QUOTAS, type UserTier } from '@/constants/limits';
import type { QuotaMetric } from '@/lib/types';

export const UNLIMITED_QUOTA_METRIC: QuotaMetric = {
  used: 0,
  limit: null,
  remaining: null,
};

export function buildQuotaMetric(used: number, limit: number | null): QuotaMetric {
  const safeUsed = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
  if (limit === null) {
    return { used: safeUsed, limit: null, remaining: null };
  }
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(safeLimit - safeUsed, 0),
  };
}

export function isQuotaMetricAvailable(metric: QuotaMetric | undefined): boolean {
  if (!metric) return false;
  if (metric.limit === null) return true;
  return metric.used < metric.limit;
}

export function defaultImageMetricForTier(tier: UserTier, used = 0): QuotaMetric {
  return buildQuotaMetric(used, QUOTAS[tier].image);
}

/**
 * Generic illustration permission for quota status.
 * Plus is unlimited. Authenticated free generic status never claims a monthly
 * illustration credit. Guest follows the image pool, not analysis remaining.
 * Missing older fields default without blocking guest illustrations.
 */
export function resolveCanGenerateImage(input: {
  tier: UserTier;
  canGenerateImage?: boolean;
  image?: QuotaMetric;
}): boolean {
  if (input.tier === 'plus') return true;
  if (typeof input.canGenerateImage === 'boolean') return input.canGenerateImage;
  if (input.tier === 'free') return false;
  if (input.image) return isQuotaMetricAvailable(input.image);
  return true;
}

export function authenticatedGenericImageUsage(tier: UserTier): QuotaMetric {
  if (tier === 'plus') return UNLIMITED_QUOTA_METRIC;
  return buildQuotaMetric(0, 0);
}
