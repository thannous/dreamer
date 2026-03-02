import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockPurchases,
  mockRevenuecatUI,
  mockSubscriptionService,
} = ((factory: any) => factory())(() => {
  let mockMode = false;

  const mockPurchases = {
    getOfferings: jest.fn(),
  };

  const mockRevenuecatUI = {
    PAYWALL_RESULT: {
      NOT_PRESENTED: 'NOT_PRESENTED',
      PRESENTED: 'PRESENTED',
      CANCELLED: 'CANCELLED',
    },
    presentPaywall: jest.fn().mockResolvedValue('PRESENTED'),
    presentPaywallIfNeeded: jest.fn().mockResolvedValue('NOT_PRESENTED'),
    presentCustomerCenter: jest.fn().mockResolvedValue(undefined),
  };

  const mockSubscriptionService = {
    getSubscriptionStatus: jest.fn().mockResolvedValue({ tier: 'free', isActive: false }),
    initializeSubscription: jest.fn().mockResolvedValue(undefined),
    isSubscriptionInitialized: jest.fn().mockReturnValue(true),
    refreshSubscriptionStatus: jest.fn().mockResolvedValue({ tier: 'pro', isActive: true }),
  };

  return {
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockPurchases,
    mockRevenuecatUI,
    mockSubscriptionService,
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: mockPurchases,
}));

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: mockRevenuecatUI,
  PAYWALL_RESULT: mockRevenuecatUI.PAYWALL_RESULT,
}));

jest.mock('../subscriptionService', () => mockSubscriptionService);

describe('revenuecatUI', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSetMockMode(false);
    mockSubscriptionService.isSubscriptionInitialized.mockReturnValue(true);
  });

  it('given mock mode__when presenting paywall__then returns not presented with status', async () => {
    mockSetMockMode(true);
    mockSubscriptionService.getSubscriptionStatus.mockResolvedValue({ tier: 'free', isActive: false });

    const service = require('../revenuecatUI');
    const result = await service.presentRevenueCatPaywall();

    expect(result).toEqual({
      result: mockRevenuecatUI.PAYWALL_RESULT.NOT_PRESENTED,
      status: { tier: 'free', isActive: false },
    });
    expect(mockRevenuecatUI.presentPaywall).not.toHaveBeenCalled();
  });

  it('given missing offering__when presenting paywall__then throws error', async () => {
    mockSetMockMode(false);
    mockPurchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    const service = require('../revenuecatUI');

    await expect(service.presentRevenueCatPaywall({ offeringId: 'missing' })).rejects.toThrow(
      'Aucune offre RevenueCat configurée pour ce client.'
    );
  });

  it('given entitlement gating disabled__when presenting paywall__then uses standard paywall', async () => {
    mockSetMockMode(false);
    const offering = { identifier: 'main' };
    mockPurchases.getOfferings.mockResolvedValue({ all: { main: offering }, current: offering });

    const service = require('../revenuecatUI');
    await service.presentRevenueCatPaywall({ offeringId: 'main', requiredEntitlementId: null });

    expect(mockRevenuecatUI.presentPaywall).toHaveBeenCalledWith({ offering, displayCloseButton: true });
    expect(mockRevenuecatUI.presentPaywallIfNeeded).not.toHaveBeenCalled();
  });

  it('given entitlement gating enabled__when presenting paywall__then uses paywall if needed', async () => {
    mockSetMockMode(false);
    const offering = { identifier: 'main' };
    mockPurchases.getOfferings.mockResolvedValue({ all: { main: offering }, current: offering });

    const service = require('../revenuecatUI');
    await service.presentRevenueCatPaywall({ offeringId: 'main', requiredEntitlementId: 'entitlement' });

    expect(mockRevenuecatUI.presentPaywallIfNeeded).toHaveBeenCalledWith({
      requiredEntitlementIdentifier: 'entitlement',
      offering,
      displayCloseButton: true,
    });
    expect(mockRevenuecatUI.presentPaywall).not.toHaveBeenCalled();
  });

  it('given not initialized__when presenting customer center__then initializes subscription', async () => {
    mockSetMockMode(false);
    mockSubscriptionService.isSubscriptionInitialized.mockReturnValue(false);
    mockPurchases.getOfferings.mockResolvedValue({ all: {}, current: null });

    const service = require('../revenuecatUI');
    await service.presentRevenueCatCustomerCenter({ userId: 'user-1' });

    expect(mockSubscriptionService.initializeSubscription).toHaveBeenCalledWith('user-1');
    expect(mockRevenuecatUI.presentCustomerCenter).toHaveBeenCalled();
  });
});
