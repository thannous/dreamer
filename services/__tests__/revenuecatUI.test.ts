import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getMockMode,
  setMockMode,
  purchases,
  revenuecatUI,
  subscriptionService,
} = vi.hoisted(() => {
  let mockMode = false;

  const purchases = {
    getOfferings: vi.fn(),
  };

  const revenuecatUI = {
    PAYWALL_RESULT: {
      NOT_PRESENTED: 'NOT_PRESENTED',
      PRESENTED: 'PRESENTED',
      CANCELLED: 'CANCELLED',
    },
    presentPaywall: vi.fn().mockResolvedValue('PRESENTED'),
    presentPaywallIfNeeded: vi.fn().mockResolvedValue('NOT_PRESENTED'),
    presentCustomerCenter: vi.fn().mockResolvedValue(undefined),
  };

  const subscriptionService = {
    getSubscriptionStatus: vi.fn().mockResolvedValue({ tier: 'free', isActive: false }),
    initializeSubscription: vi.fn().mockResolvedValue(undefined),
    isSubscriptionInitialized: vi.fn().mockReturnValue(true),
    refreshSubscriptionStatus: vi.fn().mockResolvedValue({ tier: 'pro', isActive: true }),
  };

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    purchases,
    revenuecatUI,
    subscriptionService,
  };
});

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('react-native-purchases', () => ({
  default: purchases,
}));

vi.mock('react-native-purchases-ui', () => ({
  default: revenuecatUI,
  PAYWALL_RESULT: revenuecatUI.PAYWALL_RESULT,
}));

vi.mock('../subscriptionService', () => subscriptionService);

describe('revenuecatUI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setMockMode(false);
    subscriptionService.isSubscriptionInitialized.mockReturnValue(true);
  });

  it('given mock mode__when presenting paywall__then returns not presented with status', async () => {
    setMockMode(true);
    subscriptionService.getSubscriptionStatus.mockResolvedValue({ tier: 'free', isActive: false });

    const service = await import('../revenuecatUI');
    const result = await service.presentRevenueCatPaywall();

    expect(result).toEqual({
      result: revenuecatUI.PAYWALL_RESULT.NOT_PRESENTED,
      status: { tier: 'free', isActive: false },
    });
    expect(revenuecatUI.presentPaywall).not.toHaveBeenCalled();
  });

  it('given missing offering__when presenting paywall__then throws error', async () => {
    setMockMode(false);
    purchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    const service = await import('../revenuecatUI');

    await expect(service.presentRevenueCatPaywall({ offeringId: 'missing' })).rejects.toThrow(
      'Aucune offre RevenueCat configurée pour ce client.'
    );
  });

  it('given entitlement gating disabled__when presenting paywall__then uses standard paywall', async () => {
    setMockMode(false);
    const offering = { identifier: 'main' };
    purchases.getOfferings.mockResolvedValue({ all: { main: offering }, current: offering });

    const service = await import('../revenuecatUI');
    await service.presentRevenueCatPaywall({ offeringId: 'main', requiredEntitlementId: null });

    expect(revenuecatUI.presentPaywall).toHaveBeenCalledWith({ offering, displayCloseButton: true });
    expect(revenuecatUI.presentPaywallIfNeeded).not.toHaveBeenCalled();
  });

  it('given entitlement gating enabled__when presenting paywall__then uses paywall if needed', async () => {
    setMockMode(false);
    const offering = { identifier: 'main' };
    purchases.getOfferings.mockResolvedValue({ all: { main: offering }, current: offering });

    const service = await import('../revenuecatUI');
    await service.presentRevenueCatPaywall({ offeringId: 'main', requiredEntitlementId: 'entitlement' });

    expect(revenuecatUI.presentPaywallIfNeeded).toHaveBeenCalledWith({
      requiredEntitlementIdentifier: 'entitlement',
      offering,
      displayCloseButton: true,
    });
    expect(revenuecatUI.presentPaywall).not.toHaveBeenCalled();
  });

  it('given not initialized__when presenting customer center__then initializes subscription', async () => {
    setMockMode(false);
    subscriptionService.isSubscriptionInitialized.mockReturnValue(false);
    purchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    const service = await import('../revenuecatUI');
    await service.presentRevenueCatCustomerCenter({ userId: 'user-1' });

    expect(subscriptionService.initializeSubscription).toHaveBeenCalledWith('user-1');
    expect(revenuecatUI.presentCustomerCenter).toHaveBeenCalled();
  });
});
