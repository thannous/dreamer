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
  willRenew?: boolean;
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
    subscriptionPeriod?: string | null;
    /** iOS / StoreKit introductory offer (free trial when price is 0). */
    introPrice?: {
      price?: number;
      periodUnit?: string;
      periodNumberOfUnits?: number;
      cycles?: number;
    } | null;
    /** Google Play default subscription option (base plan + eligible offer). */
    defaultOption?: {
      freePhase?: {
        billingPeriod?: { unit?: string; value?: number; iso8601?: string } | null;
        billingCycleCount?: number | null;
      } | null;
    } | null;
  };
}

const PERIOD_UNIT_DAYS: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

/**
 * Days of free trial the store currently offers for this package, or null.
 * Google Play exposes it as the free pricing phase of the default option; iOS
 * as an introductory price of 0. Only free phases count — discounted intro
 * prices are not a trial.
 */
export function getFreeTrialDays(product: PurchasesPackageLike['product']): number | null {
  const freePhase = product.defaultOption?.freePhase;
  if (freePhase?.billingPeriod?.unit && typeof freePhase.billingPeriod.value === 'number') {
    const unitDays = PERIOD_UNIT_DAYS[String(freePhase.billingPeriod.unit).toUpperCase()];
    const cycles = freePhase.billingCycleCount && freePhase.billingCycleCount > 0 ? freePhase.billingCycleCount : 1;
    if (unitDays) return unitDays * freePhase.billingPeriod.value * cycles;
  }
  const intro = product.introPrice;
  if (intro && (intro.price ?? 1) === 0 && intro.periodUnit && typeof intro.periodNumberOfUnits === 'number') {
    const unitDays = PERIOD_UNIT_DAYS[String(intro.periodUnit).toUpperCase()];
    const cycles = intro.cycles && intro.cycles > 0 ? intro.cycles : 1;
    if (unitDays) return unitDays * intro.periodNumberOfUnits * cycles;
  }
  return null;
}

const LEGACY_PLUS_ENTITLEMENT_IDS = [
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
 * Legacy "premium" entitlement ids are aliases for the single Noctalia Plus plan.
 */
const ENTITLEMENT_PRIORITY = [...LEGACY_PLUS_ENTITLEMENT_IDS, ...PLUS_ENTITLEMENT_IDS];

function tierFromEntitlementId(entitlementId: string): SubscriptionTier {
  if (LEGACY_PLUS_ENTITLEMENT_IDS.includes(entitlementId)) return 'plus';
  if (PLUS_ENTITLEMENT_IDS.includes(entitlementId)) return 'plus';
  return 'free';
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
 * Finds the active Noctalia Plus entitlement from CustomerInfo based on priority.
 * Unknown entitlements belong to another product or experiment and must never
 * unlock Noctalia Plus.
 */
export function getActiveEntitlement(info: CustomerInfoLike | null): Entitlement | null {
  const active = (info?.entitlements?.active ?? {}) as Record<string, Entitlement>;

  for (const key of ENTITLEMENT_PRIORITY) {
    const entitlement = active[key];
    if (entitlement) {
      return entitlement;
    }
  }

  return null;
}

export function getActiveEntitlementId(info: CustomerInfoLike | null): string | null {
  const active = (info?.entitlements?.active ?? {}) as Record<string, Entitlement>;

  for (const key of ENTITLEMENT_PRIORITY) {
    const entitlement = active[key];
    if (entitlement) {
      return key;
    }
  }

  return null;
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
  const willRenew = activeEntitlement?.willRenew ?? undefined;

  // ✅ PHASE 3: Check if entitlement has expired
  const isExpired = isEntitlementExpired(expiryDate);
  const tier = (activeEntitlement && !isExpired && entitlementId) ? tierFromEntitlementId(entitlementId) : 'free';
  const active = tier === 'plus';
  const productId = activeEntitlement?.productIdentifier ?? null;

  return {
    tier,
    isActive: active,
    expiryDate,
    productId,
    willRenew,
  };
}

/**
 * Determines the billing interval from a package ID or package type.
 */
export function mapIntervalFromId(
  id: string,
  packageType?: string,
  subscriptionPeriod?: string | null
): PurchasePackage['interval'] {
  if (subscriptionPeriod === 'P1Y') {
    return 'annual';
  }
  if (subscriptionPeriod === 'P1M') {
    return 'monthly';
  }

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
  const interval = mapIntervalFromId(id, pkg.packageType, product.subscriptionPeriod);
  return {
    id,
    interval,
    price: product.price ?? 0,
    priceFormatted: product.priceString ?? '',
    currency: product.currencyCode ?? '',
    title: product.title ?? '',
    description: product.description ?? '',
    freeTrialDays: getFreeTrialDays(product),
  };
}
