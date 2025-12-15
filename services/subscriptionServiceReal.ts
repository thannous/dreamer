import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { REVENUECAT_ENTITLEMENT_ID } from '@/constants/subscription';
import {
  getActiveEntitlement as getActiveEntitlementPure,
  mapPackage as mapPackagePure,
  mapStatus as mapStatusPure,
  type CustomerInfoLike,
} from '@/lib/revenuecat';

import type { PurchasePackage, SubscriptionStatus } from '@/lib/types';

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

let initialized = false;
let lastUserId: string | null = null;
let cachedStatus: SubscriptionStatus | null = null;
let cachedPackages: InternalPackage[] = [];
// Keep a live listener-driven cache up to date with RevenueCat (source of truth)
let customerInfoListener: ((info: CustomerInfo) => void) | null = null;

function resetCachedState(): void {
  cachedStatus = null;
  cachedPackages = [];
}

function resolveApiKey(): string | null {
  const env = process.env;
  const extra = (Constants?.expoConfig as any)?.extra ?? {};

  if (Platform.OS === 'android') {
    if (__DEV__) {
      // En dev on ne veut pas retomber sur la clé extra (qui est celle du Play Store) si l'env est chargé.
      const key = env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? null;
      console.log('[RC DEBUG] env android key', key);
      if (!key) {
        console.warn('[RC DEBUG] No env android key found, fallback to extra');
        console.log('[RC DEBUG] extra android key', extra.revenuecatAndroidKey);
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
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.error('[RevenueCat] Missing API key for platform:', Platform.OS);
    throw new Error('Missing RevenueCat API key');
  }
  const normalizedUserId = userId ?? null;
  const globalState = globalAny[RC_GLOBAL_KEY]!;

  const sameConfig = globalState.configured && globalState.apiKey === apiKey;

  // Best practice: start anonymous, then link authenticated users via logIn/logOut.
  // This prevents orphaning purchases that happened before sign-in and makes webhook `app_user_id` mapping reliable.
  if (!initialized || !sameConfig) {
    Purchases.configure({ apiKey });

    // Subscribe once to live customer info updates so the app UI reflects
    // RevenueCat changes immediately (e.g., purchases on another device).
    if (!customerInfoListener) {
      customerInfoListener = (info: CustomerInfo) => {
        cachedStatus = mapStatus(info);
      };
      Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    }

    globalState.configured = true;
    globalState.apiKey = apiKey;
    globalState.userId = null;
    initialized = true;
    lastUserId = null;
    resetCachedState();
  }

  if (normalizedUserId) {
    if (lastUserId !== normalizedUserId) {
      await Purchases.logIn(normalizedUserId);
      lastUserId = normalizedUserId;
      globalState.userId = normalizedUserId;
      resetCachedState();
      if (__DEV__) {
        try {
          const appUserId = await Purchases.getAppUserID();
          const isAnonymous = await Purchases.isAnonymous();
          const customerInfo = await Purchases.getCustomerInfo();
          const status = mapStatus(customerInfo);
          console.log('[RevenueCat] Logged in', {
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

  if (lastUserId !== null) {
    await Purchases.logOut();
    lastUserId = null;
    globalState.userId = null;
    resetCachedState();
    if (__DEV__) {
      try {
        const appUserId = await Purchases.getAppUserID();
        const isAnonymous = await Purchases.isAnonymous();
        const customerInfo = await Purchases.getCustomerInfo();
        const status = mapStatus(customerInfo);
        console.log('[RevenueCat] Logged out', {
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
  cachedStatus = status;
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
  return initialized;
}

export async function refreshStatus(): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  return fetchStatus();
}

export async function getStatus(): Promise<SubscriptionStatus | null> {
  if (!initialized) {
    return null;
  }

  // Always fetch from RevenueCat (source of truth) to avoid stale states.
  return fetchStatus();
}

export async function loadOfferings(): Promise<PurchasePackage[]> {
  if (!initialized) {
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
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
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
  cachedStatus = status;
  return status;
}

export async function restorePurchases(): Promise<SubscriptionStatus> {
  if (!initialized) {
    throw new Error('Purchases not initialized');
  }
  const info = await Purchases.restorePurchases();
  const status = mapStatus(info);
  cachedStatus = status;
  return status;
}
