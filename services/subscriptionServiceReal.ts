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
// ✅ PHASE 3: Add TTL to cache to prevent infinite stale data (expiration never detected)
let cacheTimestamp: number | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function resetCachedState(): void {
  cachedStatus = null;
  cachedPackages = [];
  cacheTimestamp = null;  // ✅ PHASE 3: Clear cache timestamp on reset
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

  if (!initialized) {
    const sameConfig = globalState.configured && globalState.apiKey === apiKey;
    if (!sameConfig) {
      Purchases.configure({ apiKey, appUserID: normalizedUserId ?? undefined });
      globalState.configured = true;
      globalState.apiKey = apiKey;
      globalState.userId = normalizedUserId;
    } else if (globalState.userId !== normalizedUserId) {
      // Sync app user without re-configuring the SDK (avoids duplicate configure warning)
      if (normalizedUserId) {
        await Purchases.logIn(normalizedUserId);
      } else {
        await Purchases.logOut();
      }
      globalState.userId = normalizedUserId;
    }
    initialized = true;
    lastUserId = normalizedUserId;
    resetCachedState();
    return;
  }
  if (!normalizedUserId) {
    if (lastUserId !== null) {
      await Purchases.logOut();
    }
    lastUserId = null;
    resetCachedState();
    return;
  }
  if (normalizedUserId !== lastUserId) {
    await Purchases.logIn(normalizedUserId);
    lastUserId = normalizedUserId;
    resetCachedState();
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
  // ✅ PHASE 3: Record when cache was populated to implement TTL
  cacheTimestamp = Date.now();
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

  // ✅ PHASE 3: Check if cached status is still fresh (within TTL)
  if (cachedStatus && cacheTimestamp) {
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    if (cacheAge < CACHE_TTL_MS) {
      // Cache is still fresh, return it
      return cachedStatus;
    }
    // Cache expired, fall through to fetchStatus()
  }

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
