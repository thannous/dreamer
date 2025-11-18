import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

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

function resetCachedState(): void {
  cachedStatus = null;
  cachedPackages = [];
}

function resolveApiKey(): string | null {
  const env = process?.env as Record<string, string> | undefined;
  if (Platform.OS === 'android') {
    return env?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? null;
  }
  if (Platform.OS === 'ios') {
    return env?.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? null;
  }
  return env?.EXPO_PUBLIC_REVENUECAT_WEB_KEY ?? null;
}

async function ensureConfigured(userId?: string | null): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
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

function mapTierFromCustomerInfo(info: CustomerInfo | null): SubscriptionTier {
  const active = info?.entitlements?.active ?? {};
  const hasActive = Object.keys(active).length > 0;
  return hasActive ? 'premium' : 'free';
}

function mapStatus(info: CustomerInfo | null): SubscriptionStatus {
  const tier = mapTierFromCustomerInfo(info);
  const active = tier === 'premium';
  const activeEntitlements = (info?.entitlements?.active ?? {}) as Record<string, { productIdentifier?: string }>;
  const firstEntitlement = Object.values(activeEntitlements)[0];
  const productId = firstEntitlement?.productIdentifier ?? null;
  return {
    tier,
    isActive: active,
    expiryDate: null,
    productId,
  };
}

function mapIntervalFromId(id: string): PurchasePackage['interval'] {
  const lower = id.toLowerCase();
  if (lower.includes('year') || lower.includes('annual') || lower.includes('annuel')) {
    return 'annual';
  }
  return 'monthly';
}

function mapPackage(pkg: PurchasesPackage): InternalPackage {
  const id = pkg.identifier;
  const product = pkg.product;
  const interval = mapIntervalFromId(id);
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
