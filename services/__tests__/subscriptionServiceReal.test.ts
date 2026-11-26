import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockConfigure,
  mockSetLogHandler,
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
    mockSetLogHandler: jest.fn(),
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

const mockStoreIdentity = {
  isAnonymous: jest.fn(async (..._args: unknown[]) => true),
  getAppUserID: jest.fn(async (..._args: unknown[]) => '$RCAnonymousID:device'),
  logIn: jest.fn(async (..._args: unknown[]) => ({})),
  logOut: jest.fn(async (..._args: unknown[]) => ({})),
  getOfferings: jest.fn(async (..._args: unknown[]) => ({
    current: { availablePackages: [{ identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'noctalia_plus_monthly', price: 4.99, priceString: '4,99 €', currencyCode: 'EUR', title: 'Monthly', description: '' } }] },
  })),
  purchasePackage: jest.fn(async (..._args: unknown[]) => ({ customerInfo: null })),
  restorePurchases: jest.fn(async (..._args: unknown[]) => null),
};

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
  LOG_LEVEL: { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' },
  default: {
    addCustomerInfoUpdateListener: mockAddCustomerInfoUpdateListener,
    configure: mockConfigure,
    getCustomerInfo: mockGetCustomerInfo,
    invalidateCustomerInfoCache: jest.fn(),
    isAnonymous: (...args: unknown[]) => mockStoreIdentity.isAnonymous(...args),
    getAppUserID: (...args: unknown[]) => mockStoreIdentity.getAppUserID(...args),
    logIn: (...args: unknown[]) => mockStoreIdentity.logIn(...args),
    logOut: (...args: unknown[]) => mockStoreIdentity.logOut(...args),
    getOfferings: (...args: unknown[]) => mockStoreIdentity.getOfferings(...args),
    purchasePackage: (...args: unknown[]) => mockStoreIdentity.purchasePackage(...args),
    restorePurchases: (...args: unknown[]) => mockStoreIdentity.restorePurchases(...args),
    setLogHandler: mockSetLogHandler,
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

  it('reports a refresh kept on cache as a warning and any other SDK failure as an error', async () => {
    mockSetPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_bundle_key');
    const service = require('../subscriptionServiceReal');
    await service.initialize();
    const forward = mockSetLogHandler.mock.calls[0]?.[0] as (level: string, message: string) => void;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const timedOut = '😿‼️ Remote config refresh failed. Keeping cached configuration. '
      + 'Error: A network error has occurred. La requête a expiré.';
    const misconfigured = 'There is an issue with your configuration. Check the underlying error for more details.';
    // A purchase or restore that fails offline has no cache behind it.
    const purchaseOffline = 'Purchase failed. Error: A network error has occurred.';

    try {
      forward('ERROR', timedOut);
      forward('ERROR', misconfigured);
      forward('ERROR', purchaseOffline);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('[RevenueCat]', timedOut);
      expect(error).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledWith('[RevenueCat]', misconfigured);
      expect(error).toHaveBeenCalledWith('[RevenueCat]', purchaseOffline);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
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

  it('opens the owning store on iOS when the subscription was bought on Google Play', async () => {
    mockPlatform.OS = 'ios';
    const playUrl = 'https://play.google.com/store/account/subscriptions?package=com.tanuki75.noctalia';
    mockGetCustomerInfo.mockImplementationOnce(async () => ({ managementURL: playUrl }));
    mockGetCustomerInfo.mockImplementationOnce(async () => ({ managementURL: playUrl }));
    const service = require('../subscriptionServiceReal');

    await service.openManagement();

    expect(mockOpenURL).toHaveBeenCalledWith(playUrl);
    expect(mockShowManageSubscriptions).not.toHaveBeenCalled();
  });
});

// App Review 5.1.1(v): a guest buys and restores on the store's anonymous customer.
describe('subscriptionServiceReal guest store operations', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockClearPublicEnv();
    mockPlatform.OS = 'ios';
    mockSetPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'appl_key');
    mockStoreIdentity.isAnonymous.mockResolvedValue(true);
    delete (globalThis as typeof globalThis & { __dreamerPurchases?: unknown })
      .__dreamerPurchases;
  });

  it('refuses a purchase or a restore without an account unless the guest path asks for it', async () => {
    const service = require('../subscriptionServiceReal');
    await service.initialize(null);

    await expect(service.purchasePackage('$rc_monthly')).rejects.toThrow('Purchases user not identified');
    await expect(service.restorePurchases()).rejects.toThrow('Purchases user not identified');
    expect(mockStoreIdentity.purchasePackage).not.toHaveBeenCalled();
    expect(mockStoreIdentity.restorePurchases).not.toHaveBeenCalled();
  });

  it('lets a guest buy and restore on the anonymous customer', async () => {
    const service = require('../subscriptionServiceReal');
    await service.initialize(null);

    await service.purchasePackage('$rc_monthly', { allowAnonymous: true });
    await service.restorePurchases({ allowAnonymous: true });

    expect(mockStoreIdentity.purchasePackage).toHaveBeenCalledTimes(1);
    expect(mockStoreIdentity.restorePurchases).toHaveBeenCalledTimes(1);
    expect(mockStoreIdentity.logOut).not.toHaveBeenCalled();
  });

  it('leaves an account the store still remembers before a guest buys', async () => {
    // A lost session: no account in the app, the SDK still on that account's customer.
    mockStoreIdentity.isAnonymous.mockResolvedValue(false);
    const service = require('../subscriptionServiceReal');
    await service.initialize(null);

    await service.purchasePackage('$rc_monthly', { allowAnonymous: true });

    expect(mockStoreIdentity.logOut).toHaveBeenCalledTimes(1);
    expect(mockStoreIdentity.logOut.mock.invocationCallOrder[0])
      .toBeLessThan(mockStoreIdentity.purchasePackage.mock.invocationCallOrder[0]);
  });
});
