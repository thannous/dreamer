import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { REVENUECAT_ENTITLEMENT_ID } from '@/constants/subscription';

import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

type InternalPackage = {
  id: string;
  pkg: PurchasesPackage;
  mapped: PurchasePackage;
};

let initialized = false;
let lastUserId: string | null = null;
let cachedStatus: SubscriptionStatus | null = null;
let cachedPackages: InternalPackage[] = [];

const ENTITLEMENT_PRIORITY = [
  REVENUECAT_ENTITLEMENT_ID,
  'noctalia_plus',
  'noctalia-plus',
  'noctaliaPlus',
];
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
  if (!initialized) {
    Purchases.configure({ apiKey, appUserID: normalizedUserId ?? undefined });
    initialized = true;
    lastUserId = normalizedUserId;
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

function getActiveEntitlement(info: CustomerInfo | null) {
  const active = (info?.entitlements?.active ?? {}) as Record<string, { productIdentifier?: string; expirationDate?: string | null }>;
  for (const key of ENTITLEMENT_PRIORITY) {
    const entitlement = active[key];
    if (entitlement) {
      return entitlement;
    }
  }

  const firstKey = Object.keys(active)[0];
  return firstKey ? active[firstKey] : null;
}

function mapTierFromCustomerInfo(info: CustomerInfo | null): SubscriptionTier {
  return getActiveEntitlement(info) ? 'premium' : 'free';
}

function mapStatus(info: CustomerInfo | null): SubscriptionStatus {
  const tier = mapTierFromCustomerInfo(info);
  const activeEntitlement = getActiveEntitlement(info);
  const active = tier === 'premium';
  const productId = activeEntitlement?.productIdentifier ?? null;
  const expiryDate = activeEntitlement?.expirationDate ?? null;
  return {
    tier,
    isActive: active,
    expiryDate,
    productId,
  };
}

function mapIntervalFromId(id: string, pkg?: PurchasesPackage): PurchasePackage['interval'] {
  if (pkg?.packageType === 'ANNUAL') {
    return 'annual';
  }
  if (pkg?.packageType === 'MONTHLY') {
    return 'monthly';
  }

  const lower = id.toLowerCase();
  if (lower.includes('year') || lower.includes('annual') || lower.includes('annuel')) {
    return 'annual';
  }
  return 'monthly';
}

function mapPackage(pkg: PurchasesPackage): InternalPackage {
  const id = pkg.identifier;
  const product = pkg.product;
  const interval = mapIntervalFromId(id, pkg);
  const mapped: PurchasePackage = {
    id,
    interval,
    priceFormatted: product.priceString ?? '',
    currency: product.currencyCode ?? '',
    title: product.title ?? '',
    description: product.description ?? '',
  };
  return { id, pkg, mapped };
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
  if (cachedStatus) {
    return cachedStatus;
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
