import { Platform } from 'react-native';

import * as mockService from './mocks/subscriptionServiceMock';
import * as realService from './subscriptionServiceReal';
import { isMockModeEnabled } from '@/lib/env';

const isMockMode = isMockModeEnabled();
const env = process?.env as Record<string, string | undefined> | undefined;
const hasWebKey = !!env?.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
const hasAndroidKey = !!env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
// Sur web, on n'active le réel que si une clé web est fournie. Sinon, on mock.
// Sur Android dev local, ne pas retomber sur la clé Play Store de app.json :
// les émulateurs standards n'ont pas Play Billing et affichent une RedBox RevenueCat.
const shouldMock =
  isMockMode ||
  (Platform.OS === 'web' && !hasWebKey) ||
  (__DEV__ && Platform.OS === 'android' && !hasAndroidKey);
const service = shouldMock ? mockService : realService;

export const initializeSubscription = service.initialize;
export const isSubscriptionInitialized = service.isInitialized;
export const getSubscriptionStatus = service.getStatus;
export const refreshSubscriptionStatus = service.refreshStatus ?? service.getStatus;
export const syncSubscriptionPurchases = service.syncPurchases ?? (async () => {});
export const addSubscriptionStatusUpdateListener =
  service.addStatusUpdateListener ?? (() => () => {});
export const loadSubscriptionPackages = service.loadOfferings;
export const purchaseSubscriptionPackage = service.purchasePackage;
export const restoreSubscriptionPurchases = service.restorePurchases;
export const logOutSubscriptionUser = service.logOutUser ?? (async () => {});
