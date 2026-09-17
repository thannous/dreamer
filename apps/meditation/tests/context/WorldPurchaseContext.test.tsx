import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import Purchases from 'react-native-purchases';

import { WorldPurchaseProvider, useWorldPurchases } from '@/context/WorldPurchaseContext';
import { StorageKey } from '@/services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

describe('WorldPurchaseProvider', () => {
  const originalMock = process.env.EXPO_PUBLIC_MOCK_MODE;
  const originalIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  const originalAndroidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  afterEach(() => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', originalMock);
    setEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', originalIosKey);
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', originalAndroidKey);
  });

  it('loads mock world offers without touching RevenueCat', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'true');
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_mock_key');

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <WorldPurchaseProvider>{children}</WorldPurchaseProvider>
    );
    const { result } = renderHook(() => useWorldPurchases(), { wrapper });

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.offers.map((offer) => offer.worldId)).toEqual([
      'tide',
      'sanctuary',
      'cloud',
    ]);
    expect(result.current.isWorldOwned('constellation')).toBe(true);
    expect(result.current.isWorldOwned('tide')).toBe(false);
    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.getProducts).not.toHaveBeenCalled();
  });

  it('purchases a world through the mock store only', async () => {
    setEnv('EXPO_PUBLIC_MOCK_MODE', 'true');
    setEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'test_mock_key');

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <WorldPurchaseProvider>{children}</WorldPurchaseProvider>
    );
    const { result } = renderHook(() => useWorldPurchases(), { wrapper });
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await expect(result.current.purchaseWorld('tide')).resolves.toBe(true);
    });

    expect(result.current.isWorldOwned('tide')).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(StorageKey.purchasedWorlds)) ?? '[]')).toEqual([
      'tide',
    ]);
    expect(Purchases.configure).not.toHaveBeenCalled();
    expect(Purchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });
});
