import { Platform } from 'react-native';

import * as mockService from './mocks/subscriptionServiceMock';
import * as realService from './subscriptionServiceReal';
import { isMockModeEnabled } from '@/lib/env';

const isMockMode = isMockModeEnabled();
const hasWebKey = !!(process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
// Sur web, on n'active le réel que si une clé web est fournie. Sinon, on mock.
const shouldMock = isMockMode || (Platform.OS === 'web' && !hasWebKey);
const service = shouldMock ? mockService : realService;

export const initializeSubscription = service.initialize;
export const isSubscriptionInitialized = service.isInitialized;
export const getSubscriptionStatus = service.getStatus;
export const refreshSubscriptionStatus = service.refreshStatus ?? service.getStatus;
export const loadSubscriptionPackages = service.loadOfferings;
export const purchaseSubscriptionPackage = service.purchasePackage;
export const restoreSubscriptionPurchases = service.restorePurchases;
