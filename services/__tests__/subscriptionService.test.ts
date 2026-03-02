import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockGetPlatformOS,
  mockSetPlatformOS,
  mockService,
  mockRealService,
} = ((factory: any) => factory())(() => {
  let mockMode = false;
  let platformOS = 'ios';

  const buildService = () => ({
    initialize: jest.fn(),
    isInitialized: jest.fn(),
    getStatus: jest.fn(),
    refreshStatus: jest.fn(),
    loadOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logOutUser: jest.fn(),
  });

  return {
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockGetPlatformOS: () => platformOS,
    mockSetPlatformOS: (value: string) => {
      platformOS = value;
    },
    mockService: buildService(),
    mockRealService: buildService(),
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockGetPlatformOS();
    },
    select: (spec: Record<string, unknown>) => (spec as any)[mockGetPlatformOS()] ?? spec.default,
  },
}));

jest.mock('../mocks/subscriptionServiceMock', () => mockService);
jest.mock('../subscriptionServiceReal', () => mockRealService);

describe('subscriptionService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockSetMockMode(false);
    mockSetPlatformOS('ios');
    delete (process.env as Record<string, string | undefined>).EXPO_PUBLIC_REVENUECAT_WEB_KEY;
    mockService.refreshStatus = jest.fn();
    mockRealService.refreshStatus = jest.fn();
  });

  it('given mock mode__when initializing subscription__then uses mock implementation', async () => {
    mockSetMockMode(true);

    const service = require('../subscriptionService');
    await service.initializeSubscription();

    expect(mockService.initialize).toHaveBeenCalled();
    expect(mockRealService.initialize).not.toHaveBeenCalled();
  });

  it('given web without key__when loading service__then uses mock implementation', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('web');

    const service = require('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(mockService.getStatus).toHaveBeenCalled();
    expect(mockRealService.getStatus).not.toHaveBeenCalled();
  });

  it('given web with key__when loading service__then uses real implementation', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('web');
    process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY = 'rc-web-key';

    const service = require('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(mockRealService.getStatus).toHaveBeenCalled();
    expect(mockService.getStatus).not.toHaveBeenCalled();
  });

  it('given native without mock__when loading service__then uses real implementation', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('ios');

    const service = require('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(mockRealService.getStatus).toHaveBeenCalled();
    expect(mockService.getStatus).not.toHaveBeenCalled();
  });

  it('given missing refreshStatus__when refreshing__then falls back to getStatus', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('ios');
    mockRealService.refreshStatus = undefined as unknown as typeof mockRealService.refreshStatus;

    const service = require('../subscriptionService');
    await service.refreshSubscriptionStatus();

    expect(mockRealService.getStatus).toHaveBeenCalled();
  });

  it('given mock mode__when logging out subscription user__then uses mock implementation', async () => {
    mockSetMockMode(true);

    const service = require('../subscriptionService');
    await service.logOutSubscriptionUser();

    expect(mockService.logOutUser).toHaveBeenCalled();
    expect(mockRealService.logOutUser).not.toHaveBeenCalled();
  });
});
