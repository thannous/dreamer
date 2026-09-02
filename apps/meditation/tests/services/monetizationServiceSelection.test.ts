import Purchases from 'react-native-purchases';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(),
    isConfigured: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    getProducts: jest.fn(),
    purchasePackage: jest.fn(),
    purchaseStoreProduct: jest.fn(),
    restorePurchases: jest.fn(),
  },
  LOG_LEVEL: { WARN: 'WARN' },
  PRODUCT_CATEGORY: { NON_SUBSCRIPTION: 'NON_SUBSCRIPTION' },
}));

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

describe('monetization service selection', () => {
  const originalMock = process.env.EXPO_PUBLIC_MOCK_MODE;
  const originalIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const originalAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  afterEach(() => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', originalMock);
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', originalIosKey);
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', originalAndroidKey);
    jest.resetModules();
  });

  /* eslint-disable @typescript-eslint/no-require-imports -- env flags are resolved when the module loads */
  const loadServices = () => ({
    subscriptions: require('@/services/subscriptionService') as typeof import('@/services/subscriptionService'),
    worlds: require('@/services/worldPurchaseService') as typeof import('@/services/worldPurchaseService'),
    worldPurchaseReal: require('@/services/worldPurchaseServiceReal') as typeof import('@/services/worldPurchaseServiceReal'),
    subscriptionMock: require('@/services/mocks/subscriptionServiceMock') as typeof import('@/services/mocks/subscriptionServiceMock'),
    purchases: require('react-native-purchases').default as typeof Purchases,
  });
  /* eslint-enable @typescript-eslint/no-require-imports */

  it('uses the mock store only when mock mode is enabled', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'true');
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', undefined);
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', undefined);
    jest.resetModules();

    const { subscriptions, worlds, subscriptionMock } = loadServices();
    subscriptionMock.__reset();

    const offers = await subscriptions.listOffers();
    expect(offers).toEqual([
      expect.objectContaining({ id: 'annual', priceLabel: '39,99 €', period: 'annual' }),
      expect.objectContaining({ id: 'monthly', priceLabel: '5,99 €', period: 'monthly' }),
    ]);
    await expect(subscriptions.currentTier()).resolves.toBe('free');
    await expect(subscriptions.purchase(offers[0])).resolves.toBe('plus');
    await expect(subscriptions.currentTier()).resolves.toBe('plus');

    const worldOffers = await worlds.listOffers();
    expect(worldOffers.map((offer) => offer.worldId)).toEqual(['tide', 'sanctuary', 'cloud']);
    await expect(worlds.currentOwnership()).resolves.toEqual([]);
    await expect(worlds.purchase(worldOffers[0])).resolves.toEqual(['tide']);
    expect(Purchases.getOfferings).not.toHaveBeenCalled();
    expect(Purchases.getProducts).not.toHaveBeenCalled();
  });

  it('never initialises RevenueCat for world purchases in mock mode, even with a Test Store key', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'true');
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_key');
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_mock_key');
    jest.resetModules();

    const { worlds, purchases } = loadServices();

    await worlds.configure();
    const worldOffers = await worlds.listOffers();
    expect(worldOffers.map((offer) => offer.worldId)).toEqual(['tide', 'sanctuary', 'cloud']);
    await expect(worlds.purchase(worldOffers[0])).resolves.toEqual(['tide']);
    await expect(worlds.currentOwnership()).resolves.toEqual(['tide']);

    expect(purchases.configure).not.toHaveBeenCalled();
    expect(purchases.setLogLevel).not.toHaveBeenCalled();
    expect(purchases.isConfigured).not.toHaveBeenCalled();
    expect(purchases.getProducts).not.toHaveBeenCalled();
    expect(purchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(purchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });

  it('keeps a leaked real world-purchase configure as a no-op in mock mode', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'true');
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_key');
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_mock_key');
    jest.resetModules();

    const { worldPurchaseReal, purchases } = loadServices();
    await worldPurchaseReal.configure();

    expect(purchases.configure).not.toHaveBeenCalled();
    expect(purchases.isConfigured).not.toHaveBeenCalled();
  });

  it('initialises RevenueCat for world purchases when mock mode is off and a key is present', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'false');
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'appl_live_key');
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'goog_live_key');
    jest.resetModules();

    const { worlds, purchases } = loadServices();
    jest.mocked(purchases.isConfigured).mockResolvedValue(false);

    await worlds.configure();

    expect(purchases.configure).toHaveBeenCalledTimes(1);
    expect(purchases.configure).toHaveBeenCalledWith({
      apiKey: expect.stringMatching(/^(appl|goog)_live_key$/),
    });
  });

  it('keeps the real store fail-closed when mock mode is off and no RevenueCat key is set', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'false');
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', undefined);
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', undefined);
    jest.resetModules();

    const { subscriptions, worlds, purchases } = loadServices();

    await expect(subscriptions.currentTier()).resolves.toBe('free');
    await expect(subscriptions.listOffers()).resolves.toEqual([]);
    await expect(worlds.currentOwnership()).resolves.toEqual([]);
    await expect(worlds.listOffers()).resolves.toEqual([]);
    await expect(worlds.restore()).resolves.toEqual([]);
    expect(purchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(purchases.getOfferings).not.toHaveBeenCalled();
    expect(purchases.getProducts).not.toHaveBeenCalled();
    expect(purchases.restorePurchases).not.toHaveBeenCalled();
  });
});
