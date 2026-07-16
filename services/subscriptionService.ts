import { Platform } from 'react-native';

import * as mockService from './mocks/subscriptionServiceMock';
import * as realService from './subscriptionServiceReal';
import { getExpoPublicEnvValue, isMockModeEnabled } from '@/lib/env';

const isMockMode = isMockModeEnabled();
const hasWebKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_WEB_KEY');
const hasAndroidKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');
const hasIosKey = !!getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY');
// Sur web, on n'active le réel que si une clé web est fournie. Sinon, on mock.
// En dev local natif, utiliser le mock si la plateforme n'a pas de clé explicite :
// les simulateurs/émulateurs ne doivent pas afficher une RedBox RevenueCat.
const shouldMock =
  isMockMode ||
  (Platform.OS === 'web' && !hasWebKey) ||
  (__DEV__ && Platform.OS === 'android' && !hasAndroidKey) ||
  (__DEV__ && Platform.OS === 'ios' && !hasIosKey);
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
