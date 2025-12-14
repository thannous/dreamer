/**
 * Pure utility functions for RevenueCat data mapping.
 * Extracted for testability without native module dependencies.
 */

import type { PurchasePackage, SubscriptionStatus, SubscriptionTier } from '@/lib/types';

/**
 * Entitlement interface matching RevenueCat's CustomerInfo structure.
 */
export interface Entitlement {
  productIdentifier?: string;
  expirationDate?: string | null;
}

/**
 * Minimal CustomerInfo interface for mapping functions.
 */
export interface CustomerInfoLike {
  entitlements?: {
    active?: Record<string, Entitlement>;
  };
}

/**
 * Minimal PurchasesPackage interface for mapping functions.
 */
export interface PurchasesPackageLike {
  identifier: string;
  packageType?: string;
  product: {
    price?: number;
    priceString?: string;
    currencyCode?: string;
    title?: string;
    description?: string;
  };
}

const PREMIUM_ENTITLEMENT_IDS = [
  'premium',
  'noctalia_premium',
  'noctalia-premium',
  'noctaliaPremium',
  'Noctalia Premium',
];

const PLUS_ENTITLEMENT_IDS = [
  'plus',
  'noctalia_plus',
  'noctalia-plus',
  'noctaliaPlus',
  'Noctalia Plus',
];

/**
 * Priority order for checking entitlements.
 * Premium takes precedence over Plus.
 */
const ENTITLEMENT_PRIORITY = [...PREMIUM_ENTITLEMENT_IDS, ...PLUS_ENTITLEMENT_IDS];

function tierFromEntitlementId(entitlementId: string): SubscriptionTier {
  if (PREMIUM_ENTITLEMENT_IDS.includes(entitlementId)) return 'premium';
  if (PLUS_ENTITLEMENT_IDS.includes(entitlementId)) return 'plus';
  // Default safe paid tier if an entitlement exists but isn't explicitly mapped.
  return 'plus';
}

/**
 * ✅ PHASE 3: Check if an entitlement has expired
 * Returns true if expiryDate is in the past, false if no expiryDate or future date
 */
export function isEntitlementExpired(expiryDate: string | null): boolean {
  if (!expiryDate) {
    // No expiration date = not expired
    return false;
  }
  const expiryTime = new Date(expiryDate).getTime();
  const now = Date.now();
  return expiryTime < now;
}

/**
 * Finds the active entitlement from CustomerInfo based on priority.
 * Returns the first matching entitlement or the first active one if none match priority.
 */
export function getActiveEntitlement(info: CustomerInfoLike | null): Entitlement | null {
  const active = (info?.entitlements?.active ?? {}) as Record<string, Entitlement>;

  for (const key of ENTITLEMENT_PRIORITY) {
    const entitlement = active[key];
    if (entitlement) {
      return entitlement;
    }
  }

  const firstKey = Object.keys(active)[0];
  return firstKey ? active[firstKey] : null;
}

export function getActiveEntitlementId(info: CustomerInfoLike | null): string | null {
  const active = (info?.entitlements?.active ?? {}) as Record<string, Entitlement>;

  for (const key of ENTITLEMENT_PRIORITY) {
    const entitlement = active[key];
    if (entitlement) {
      return key;
    }
  }

  const firstKey = Object.keys(active)[0];
  return firstKey ?? null;
}

/**
 * Maps CustomerInfo to a subscription tier.
 */
export function mapTierFromCustomerInfo(info: CustomerInfoLike | null): SubscriptionTier {
  const entitlementId = getActiveEntitlementId(info);
  return entitlementId ? tierFromEntitlementId(entitlementId) : 'free';
}

/**
 * Maps CustomerInfo to a complete SubscriptionStatus object.
 * ✅ PHASE 3: Validates expiration date - expired entitlements are treated as 'free' tier
 */
export function mapStatus(info: CustomerInfoLike | null): SubscriptionStatus {
  const activeEntitlement = getActiveEntitlement(info);
  const entitlementId = getActiveEntitlementId(info);
  const expiryDate = activeEntitlement?.expirationDate ?? null;

  // ✅ PHASE 3: Check if entitlement has expired
  const isExpired = isEntitlementExpired(expiryDate);
  const tier = (activeEntitlement && !isExpired && entitlementId) ? tierFromEntitlementId(entitlementId) : 'free';
  const active = tier === 'plus' || tier === 'premium';
  const productId = activeEntitlement?.productIdentifier ?? null;

  return {
    tier,
    isActive: active,
    expiryDate,
    productId,
  };
}

/**
 * Determines the billing interval from a package ID or package type.
 */
export function mapIntervalFromId(
  id: string,
  packageType?: string
): PurchasePackage['interval'] {
  if (packageType === 'ANNUAL') {
    return 'annual';
  }
  if (packageType === 'MONTHLY') {
    return 'monthly';
  }

  const lower = id.toLowerCase();
  if (lower.includes('year') || lower.includes('annual') || lower.includes('annuel')) {
    return 'annual';
  }
  return 'monthly';
}

/**
 * Maps a PurchasesPackage to our internal PurchasePackage format.
 */
export function mapPackage(pkg: PurchasesPackageLike): PurchasePackage {
  const id = pkg.identifier;
  const product = pkg.product;
  const interval = mapIntervalFromId(id, pkg.packageType);
  return {
    id,
    interval,
    price: product.price ?? 0,
    priceFormatted: product.priceString ?? '',
    currency: product.currencyCode ?? '',
    title: product.title ?? '',
    description: product.description ?? '',
  };
}
