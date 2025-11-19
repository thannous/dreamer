import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('subscriptionServiceMock', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes as free and upgrades on purchase', async () => {
    const service = await import('./subscriptionServiceMock');

    const initial = await service.initialize();
    expect(initial.tier).toBe('free');
    expect(initial.isActive).toBe(false);

    const purchased = await service.purchasePackage('mock_annual');
    expect(purchased.tier).toBe('premium');
    expect(purchased.isActive).toBe(true);
    expect(purchased.productId).toBe('mock_annual');

    const restored = await service.restorePurchases();
    expect(restored.tier).toBe('premium');
    expect(restored.productId).toBe('mock_annual');
  });

  it('returns default mock offerings after initialization', async () => {
    const service = await import('./subscriptionServiceMock');

    await service.initialize();
    const offerings = await service.loadOfferings();

    const ids = offerings.map((item) => item.id);
    expect(ids).toContain('mock_monthly');
    expect(ids).toContain('mock_annual');
    expect(offerings.find((o) => o.id === 'mock_annual')?.interval).toBe('annual');
  });
});
