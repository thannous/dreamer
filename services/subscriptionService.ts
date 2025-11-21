import * as mockService from './mocks/subscriptionServiceMock';
import * as realService from './subscriptionServiceReal';

const isMockMode = ((process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_MOCK_MODE ?? '') === 'true';
const service = isMockMode ? mockService : realService;

export const initializeSubscription = service.initialize;
export const isSubscriptionInitialized = service.isInitialized;
export const getSubscriptionStatus = service.getStatus;
export const refreshSubscriptionStatus = service.refreshStatus ?? service.getStatus;
export const loadSubscriptionPackages = service.loadOfferings;
export const purchaseSubscriptionPackage = service.purchasePackage;
export const restoreSubscriptionPurchases = service.restorePurchases;
