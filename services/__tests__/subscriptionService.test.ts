import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockGetPlatformOS,
  mockSetPlatformOS,
  mockGetPublicEnv,
  mockSetPublicEnv,
  mockClearPublicEnv,
  mockService,
  mockRealService,
} = ((factory: any) => factory())(() => {
  let mockMode = false;
  let platformOS = 'ios';
  const publicEnv = new Map<string, string>();

  const buildService = () => ({
    initialize: jest.fn(),
    isInitialized: jest.fn(),
    getStoreMode: jest.fn(() => 'test-mode'),
    getStatus: jest.fn(),
    refreshStatus: jest.fn(),
    loadOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    syncPurchases: jest.fn(),
    addStatusUpdateListener: jest.fn(() => () => {}),
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
    mockGetPublicEnv: (key: string) => publicEnv.get(key),
    mockSetPublicEnv: (key: string, value: string) => publicEnv.set(key, value),
    mockClearPublicEnv: () => publicEnv.clear(),
    mockService: buildService(),
    mockRealService: buildService(),
  };
});

jest.mock('@/lib/env', () => ({
  getExpoPublicEnvValue: (key: string) => mockGetPublicEnv(key),
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
    mockClearPublicEnv();
    mockService.refreshStatus = jest.fn();
    mockRealService.refreshStatus = jest.fn();
    mockService.syncPurchases = jest.fn();
    mockRealService.syncPurchases = jest.fn();
    mockService.addStatusUpdateListener = jest.fn(() => () => {});
    mockRealService.addStatusUpdateListener = jest.fn(() => () => {});
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
    mockSetPublicEnv('EXPO_PUBLIC_REVENUECAT_WEB_KEY', 'rc-web-key');

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

  it('exposes the store mode from the selected implementation', () => {
    mockSetMockMode(false);
    mockSetPlatformOS('android');
    mockSetPublicEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_android_key');

    const service = require('../subscriptionService');

    expect(service.getSubscriptionStoreMode()).toBe('test-mode');
    expect(mockRealService.getStoreMode).toHaveBeenCalledTimes(1);
  });

  it('given android dev without explicit key__when loading service__then uses mock implementation', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('android');

    const service = require('../subscriptionService');
    await service.getSubscriptionStatus();

    expect(mockService.getStatus).toHaveBeenCalled();
    expect(mockRealService.getStatus).not.toHaveBeenCalled();
  });

  it('given android dev with explicit key__when loading service__then uses real implementation', async () => {
    mockSetMockMode(false);
    mockSetPlatformOS('android');
    mockSetPublicEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_android_key');

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
