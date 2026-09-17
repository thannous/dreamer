import { describe, expect, it } from '@jest/globals';

import {
  buildQuotaMetric,
  defaultImageMetricForTier,
  resolveCanGenerateImage,
} from '../quotaMetrics';

describe('quotaMetrics', () => {
  it('builds remaining from used and limit without going negative', () => {
    expect(buildQuotaMetric(1, 2)).toEqual({ used: 1, limit: 2, remaining: 1 });
    expect(buildQuotaMetric(4, 2)).toEqual({ used: 4, limit: 2, remaining: 0 });
    expect(buildQuotaMetric(3, null)).toEqual({ used: 3, limit: null, remaining: null });
  });

  it('uses the existing guest image pool and no free monthly illustration credit', () => {
    expect(defaultImageMetricForTier('guest')).toEqual({ used: 0, limit: 2, remaining: 2 });
    expect(defaultImageMetricForTier('free')).toEqual({ used: 0, limit: 0, remaining: 0 });
    expect(defaultImageMetricForTier('plus')).toEqual({ used: 0, limit: null, remaining: null });
  });

  it('keeps guest illustration permission independent of analysis remaining', () => {
    expect(resolveCanGenerateImage({
      tier: 'guest',
      image: { used: 1, limit: 2, remaining: 1 },
    })).toBe(true);
    expect(resolveCanGenerateImage({
      tier: 'guest',
      image: { used: 2, limit: 2, remaining: 0 },
    })).toBe(false);
  });

  it('models plus as unlimited and generic free as not a monthly illustration credit', () => {
    expect(resolveCanGenerateImage({ tier: 'plus' })).toBe(true);
    expect(resolveCanGenerateImage({ tier: 'free' })).toBe(false);
    expect(resolveCanGenerateImage({
      tier: 'free',
      image: { used: 0, limit: 3, remaining: 3 },
    })).toBe(false);
  });

  it('defaults missing older guest fields without blocking illustrations', () => {
    expect(resolveCanGenerateImage({ tier: 'guest' })).toBe(true);
  });
});
