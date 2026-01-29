import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import {
  mapPackage as mapPackagePure,
  mapStatus as mapStatusPure,
  type CustomerInfoLike,
} from '@/lib/revenuecat';
import { createScopedLogger } from '@/lib/logger';

import type { PurchasePackage, SubscriptionStatus } from '@/lib/types';

const log = createScopedLogger('[RevenueCat]');

type InternalPackage = {
  id: string;
  pkg: PurchasesPackage;
  mapped: PurchasePackage;
};

type GlobalPurchasesState = {
  configured: boolean;
  apiKey: string | null;
  userId: string | null;
};

const RC_GLOBAL_KEY = '__dreamerPurchases';
const globalAny = globalThis as typeof globalThis & { [RC_GLOBAL_KEY]?: GlobalPurchasesState };
if (!globalAny[RC_GLOBAL_KEY]) {
  // Persist across Fast Refresh to avoid duplicate configure warnings
  globalAny[RC_GLOBAL_KEY] = { configured: false, apiKey: null, userId: null };
}
const persistedState = globalAny[RC_GLOBAL_KEY]!;

let ensureConfiguredQueue: Promise<void> = Promise.resolve();
let cachedPackages: InternalPackage[] = [];
// Keep a live listener-driven cache up to date with RevenueCat (source of truth)
let customerInfoListener: ((info: CustomerInfo) => void) | null = null;

function isAnonymousAppUserId(appUserId: string | null | undefined): boolean {
  return typeof appUserId === 'string' && appUserId.startsWith('$RCAnonymousID:');
}

function resetCachedState(): void {
  cachedPackages = [];
}

function resolveApiKey(): string | null {
  const env = process.env;
  const extra = (Constants?.expoConfig as any)?.extra ?? {};

  if (Platform.OS === 'android') {
    if (__DEV__) {
      // En dev on ne veut pas retomber sur la clé extra (qui est celle du Play Store) si l'env est chargé.
      const key = env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? null;
      const masked = key ? `${key.slice(0, 6)}…${key.slice(-4)}` : null;
      log.debug('env android key', masked);
      if (!key) {
        log.warn('No env android key found, fallback to extra');
        const extraKey = extra.revenuecatAndroidKey as string | undefined;
        const extraMasked = extraKey ? `${extraKey.slice(0, 6)}…${extraKey.slice(-4)}` : null;
        log.debug('extra android key', extraMasked);
      }
      return key ?? extra.revenuecatAndroidKey ?? null;
    }
    return env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? extra.revenuecatAndroidKey ?? null;
  }
  if (Platform.OS === 'ios') {
    return env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? extra.revenuecatIosKey ?? null;
  }
  return env.EXPO_PUBLIC_REVENUECAT_WEB_KEY ?? extra.revenuecatWebKey ?? null;
}

async function ensureConfigured(userId?: string | null): Promise<void> {
  const normalizedUserId = userId ?? null;
  const run = ensureConfiguredQueue.then(() => ensureConfiguredImpl(normalizedUserId));
  ensureConfiguredQueue = run.catch(() => {});
  return run;
}

async function ensureConfiguredImpl(normalizedUserId: string | null): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    log.error('Missing API key for platform', Platform.OS);
    throw new Error('Missing RevenueCat API key');
  }

  const sameConfig = persistedState.configured && persistedState.apiKey === apiKey;

  // Best practice: start anonymous, then link authenticated users via logIn/logOut.
  // This prevents orphaning purchases that happened before sign-in and makes webhook `app_user_id` mapping reliable.
  if (!sameConfig) {
    Purchases.configure({ apiKey });

    // Subscribe once to live customer info updates so the app UI reflects
    // RevenueCat changes immediately (e.g., purchases on another device).
    if (!customerInfoListener) {
      customerInfoListener = (info: CustomerInfo) => {
        void mapStatus(info);
      };
      Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    }

    persistedState.configured = true;
    persistedState.apiKey = apiKey;
    persistedState.userId = null;
    resetCachedState();
  }

  if (normalizedUserId) {
    if (persistedState.userId !== normalizedUserId) {
      await Purchases.logIn(normalizedUserId);
      persistedState.userId = normalizedUserId;
      resetCachedState();
      if (__DEV__) {
        try {
          const appUserId = await Purchases.getAppUserID();
          const isAnonymous = await Purchases.isAnonymous();
          const customerInfo = await Purchases.getCustomerInfo();
          const status = mapStatus(customerInfo);
          log.debug('Logged in', {
            userId: normalizedUserId,
            platform: Platform.OS,
            appUserId,
            isAnonymous,
            subscription: {
              tier: status.tier,
              isActive: status.isActive,
              expiryDate: status.expiryDate,
              productId: status.productId,
            },
          });
        } catch {
          // ignore
        }
      }
    }
    return;
  }

  if (persistedState.userId !== null) {
    await Purchases.logOut();
    persistedState.userId = null;
    resetCachedState();
    if (__DEV__) {
      try {
        const appUserId = await Purchases.getAppUserID();
        const isAnonymous = await Purchases.isAnonymous();
        const customerInfo = await Purchases.getCustomerInfo();
        const status = mapStatus(customerInfo);
        log.debug('Logged out', {
          platform: Platform.OS,
          appUserId,
          isAnonymous,
          subscription: {
            tier: status.tier,
            isActive: status.isActive,
            expiryDate: status.expiryDate,
            productId: status.productId,
          },
        });
      } catch {
        // ignore
      }
    }
  }
}

async function assertIdentifiedUser(): Promise<void> {
  if (!persistedState.configured) {
    throw new Error('Purchases not initialized');
  }
  if (!persistedState.userId) {
    throw new Error('Purchases user not identified');
  }
  const appUserId = await Purchases.getAppUserID();
  const isAnonymous = await Purchases.isAnonymous();
  if (isAnonymous || isAnonymousAppUserId(appUserId)) {
    throw new Error('Purchases user not identified');
  }
}

// Use pure functions from lib/revenuecat.ts for mapping
function mapStatus(info: CustomerInfo | null): SubscriptionStatus {
  return mapStatusPure(info as CustomerInfoLike);
}

function mapPackage(pkg: PurchasesPackage): InternalPackage {
  const mapped = mapPackagePure({
    identifier: pkg.identifier,
    packageType: pkg.packageType,
    product: pkg.product,
  });
  return { id: pkg.identifier, pkg, mapped };
}

async function fetchStatus(): Promise<SubscriptionStatus> {
  const info = await Purchases.getCustomerInfo();
  const status = mapStatus(info);
  return status;
}

async function fetchPackages(): Promise<InternalPackage[]> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current || !current.availablePackages?.length) {
    cachedPackages = [];
    return cachedPackages;
  }
  cachedPackages = current.availablePackages.map(mapPackage);
  return cachedPackages;
}

export async function initialize(userId?: string | null): Promise<SubscriptionStatus> {
  await ensureConfigured(userId);
  return fetchStatus();
}

export function isInitialized(): boolean {
  return persistedState.configured;
}

export async function refreshStatus(): Promise<SubscriptionStatus> {
  if (!persistedState.configured) {
    throw new Error('Purchases not initialized');
  }
  return fetchStatus();
}

export async function getStatus(): Promise<SubscriptionStatus | null> {
  if (!persistedState.configured) {
    return null;
  }

  // Always fetch from RevenueCat (source of truth) to avoid stale states.
  return fetchStatus();
}

export async function loadOfferings(): Promise<PurchasePackage[]> {
  if (!persistedState.configured) {
    return [];
  }
  if (!cachedPackages.length) {
    await fetchPackages();
  }
  return cachedPackages.map((item) => item.mapped);
}

function findInternalPackage(id: string): InternalPackage | undefined {
  return cachedPackages.find((item) => item.id === id);
}

export async function purchasePackage(id: string): Promise<SubscriptionStatus> {
  if (!persistedState.configured) {
    throw new Error('Purchases not initialized');
  }
  await assertIdentifiedUser();
  let internal = findInternalPackage(id);
  if (!internal) {
    await fetchPackages();
    internal = findInternalPackage(id);
  }
  if (!internal) {
    throw new Error('Package not found');
  }
  const { customerInfo } = await Purchases.purchasePackage(internal.pkg);
  const status = mapStatus(customerInfo);
  return status;
}

export async function restorePurchases(): Promise<SubscriptionStatus> {
  if (!persistedState.configured) {
    throw new Error('Purchases not initialized');
  }
  await assertIdentifiedUser();
  const info = await Purchases.restorePurchases();
  const status = mapStatus(info);
  return status;
}

export async function logOutUser(): Promise<void> {
  if (!persistedState.configured) {
    persistedState.userId = null;
    resetCachedState();
    return;
  }
  await Purchases.logOut();
  persistedState.userId = null;
  resetCachedState();
}
