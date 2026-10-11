import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockConfigure,
  mockAddCustomerInfoUpdateListener,
  mockGetCustomerInfo,
  mockOpenURL,
  mockPlatform,
  mockShowManageSubscriptions,
  mockGetPublicEnvValue,
  mockSetPublicEnvValue,
  mockClearPublicEnv,
} = ((factory: any) => factory())(() => {
  const publicEnv = new Map<string, string>();

  return {
    mockConfigure: jest.fn(),
    mockAddCustomerInfoUpdateListener: jest.fn(),
    mockGetCustomerInfo: jest.fn(async () => ({
      activeSubscriptions: [],
      allExpirationDates: {},
      allPurchaseDates: {},
      allPurchasedProductIdentifiers: [],
      entitlements: { active: {}, all: {}, verification: 'NOT_REQUESTED' },
      firstSeen: '2026-01-01T00:00:00.000Z',
      latestExpirationDate: null,
      managementURL: null,
      nonSubscriptionTransactions: [],
      originalAppUserId: 'qa-user',
      originalApplicationVersion: null,
      originalPurchaseDate: null,
      requestDate: '2026-01-01T00:00:00.000Z',
    })),
    mockOpenURL: jest.fn(async () => true),
    mockPlatform: { OS: 'android' },
    mockShowManageSubscriptions: jest.fn(async () => undefined),
    mockGetPublicEnvValue: (key: string) => publicEnv.get(key),
    mockSetPublicEnvValue: (key: string, value: string) => publicEnv.set(key, value),
    mockClearPublicEnv: () => publicEnv.clear(),
  };
});

jest.mock('@/lib/env', () => ({
  getExpoPublicEnvValue: (key: string) => mockGetPublicEnvValue(key),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        revenuecatAndroidKey: 'goog_fallback_key',
      },
    },
  },
}));

jest.mock('react-native', () => ({
  Linking: { openURL: mockOpenURL },
  Platform: mockPlatform,
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    addCustomerInfoUpdateListener: mockAddCustomerInfoUpdateListener,
    configure: mockConfigure,
    getCustomerInfo: mockGetCustomerInfo,
    invalidateCustomerInfoCache: jest.fn(),
    showManageSubscriptions: mockShowManageSubscriptions,
  },
}));

describe('subscriptionServiceReal configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockClearPublicEnv();
    mockPlatform.OS = 'android';
    delete (globalThis as typeof globalThis & { __dreamerPurchases?: unknown })
      .__dreamerPurchases;
  });

  it('prefers the Expo-inlined Android key over the app config fallback', async () => {
    mockSetPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_bundle_key');
    const service = require('../subscriptionServiceReal');

    await service.initialize();

    expect(service.getStoreMode()).toBe('RevenueCat Test Store');
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'test_bundle_key' });
  });
});

describe('subscriptionServiceReal management', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockClearPublicEnv();
    mockSetPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_key');
    mockSetPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'appl_key');
    delete (globalThis as typeof globalThis & { __dreamerPurchases?: unknown })
      .__dreamerPurchases;
  });

  it('opens the Play subscriptions page on Android when RevenueCat has no management URL', async () => {
    mockPlatform.OS = 'android';
    const service = require('../subscriptionServiceReal');

    await service.openManagement();

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockOpenURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
    expect(mockShowManageSubscriptions).not.toHaveBeenCalled();
  });

  it('presents the App Store sheet on iOS', async () => {
    mockPlatform.OS = 'ios';
    const service = require('../subscriptionServiceReal');

    await service.openManagement();

    expect(mockShowManageSubscriptions).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});
