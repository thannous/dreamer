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

const isMockMode = isMockModeEnabled();
const hasWebKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_WEB_KEY');
const hasAndroidKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
const hasIosKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
const shouldMock = shouldUseMockSubscriptionService({
  isMockMode,
  isDev: typeof __DEV__ === 'boolean' ? __DEV__ : process.env.NODE_ENV !== 'production',
  isLucidTrainer,
  platform: Platform.OS,
  hasWebKey,
  hasAndroidKey,
  hasIosKey,
});
const service = shouldMock ? mockService : realService;

export const initializeSubscription = service.initialize;
export const isSubscriptionInitialized = service.isInitialized;
export const getSubscriptionStoreMode = service.getStoreMode;
export const getSubscriptionStatus = service.getStatus;
export const refreshSubscriptionStatus = service.refreshStatus ?? service.getStatus;
export const syncSubscriptionPurchases = service.syncPurchases ?? (async () => {});
export const addSubscriptionStatusUpdateListener =
  service.addStatusUpdateListener ?? (() => () => {});
export const loadSubscriptionPackages = service.loadOfferings;
export const purchaseSubscriptionPackage = service.purchasePackage;
export const restoreSubscriptionPurchases = service.restorePurchases;
export const logOutSubscriptionUser = service.logOutUser ?? (async () => {});
