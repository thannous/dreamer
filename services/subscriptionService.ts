import { Platform } from 'react-native';

import * as mockService from './mocks/subscriptionServiceMock';
import * as realService from './subscriptionServiceReal';
import { isLucidTrainer } from '@/lib/appVariant';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';

type SubscriptionServicePlatform = 'ios' | 'android' | 'web' | string;

export type SubscriptionServiceSelectionInput = {
  isMockMode: boolean;
  isDev: boolean;
  isLucidTrainer: boolean;
  platform: SubscriptionServicePlatform;
  hasWebKey: boolean;
  hasAndroidKey: boolean;
  hasIosKey: boolean;
};

export function shouldUseMockSubscriptionService(
  input: SubscriptionServiceSelectionInput
): boolean {
  if (input.isMockMode) return true;

  const hasPlatformKey =
    input.platform === 'web'
      ? input.hasWebKey
      : input.platform === 'android'
        ? input.hasAndroidKey
        : input.platform === 'ios'
          ? input.hasIosKey
          : false;

  if (input.isLucidTrainer) {
    return false;
  }

  return (
    (input.platform === 'web' && !hasPlatformKey) ||
    (input.isDev && input.platform === 'android' && !input.hasAndroidKey) ||
    (input.isDev && input.platform === 'ios' && !input.hasIosKey)
  );
}

/**
 * A release build on a platform with no store key (the web app today) falls
 * back to the simulated store so the tier the server holds can still be read.
 * That store completes a purchase locally without any payment, so such a build
 * must never offer one.
 */
export function isSubscriptionStoreUnavailableFor(input: SubscriptionServiceSelectionInput): boolean {
  return !input.isMockMode && !input.isDev && shouldUseMockSubscriptionService(input);
}

const isMockMode = isMockModeEnabled();
const hasWebKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_WEB_KEY');
const hasAndroidKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
const hasIosKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
const selection: SubscriptionServiceSelectionInput = {
  isMockMode,
  isDev: typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production',
  isLucidTrainer,
  platform: Platform.OS,
  hasWebKey,
  hasAndroidKey,
  hasIosKey,
};
const shouldMock = shouldUseMockSubscriptionService(selection);
const service = shouldMock ? mockService : realService;

/** Nothing can be bought or restored here; the paywall says so instead of listing offers. */
export const isSubscriptionStoreUnavailable = isSubscriptionStoreUnavailableFor(selection);
// Worded like the store's own "item unavailable" so the hook shows the translated message.
const refuseStoreOperation = async (): Promise<never> => {
  throw new Error('ITEM_UNAVAILABLE');
};

// Includes keyless web/development fallbacks, not only the global mock profile.
export const isMockSubscriptionService = shouldMock;
export const initializeSubscription = service.initialize;
export const isSubscriptionInitialized = service.isInitialized;
export const getSubscriptionStoreMode = service.getStoreMode;
export const getSubscriptionStatus = service.getStatus;
export const refreshSubscriptionStatus = service.refreshStatus ?? service.getStatus;
export const syncSubscriptionPurchases = service.syncPurchases ?? (async () => {});
export const addSubscriptionStatusUpdateListener =
  service.addStatusUpdateListener ?? (() => () => {});
export const loadSubscriptionPackages: typeof service.loadOfferings = isSubscriptionStoreUnavailable
  ? async () => []
  : service.loadOfferings;
export const purchaseSubscriptionPackage: typeof service.purchasePackage = isSubscriptionStoreUnavailable
  ? refuseStoreOperation
  : service.purchasePackage;
export const restoreSubscriptionPurchases: typeof service.restorePurchases = isSubscriptionStoreUnavailable
  ? refuseStoreOperation
  : service.restorePurchases;
export const logOutSubscriptionUser = service.logOutUser ?? (async () => {});
export const manageSubscription = service.openManagement;
