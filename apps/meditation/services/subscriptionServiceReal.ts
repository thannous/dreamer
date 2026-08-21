import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { getExpoPublicEnvValue } from '@/lib/env';
import type { SubscriptionTier } from '@/lib/entitlements';

/**
 * The entitlement this app sells. Deliberately its own, not the journal app's
 * `plus`: without accounts there is no identity to share a subscription across
 * two apps, so promising one would be a lie (spec §11).
 */
const ENTITLEMENT_ID = 'meditation_plus';

export type Offer = {
  id: string;
  /** Localised price, already formatted by the store. Never format it yourself. */
  priceLabel: string;
  period: 'annual' | 'monthly';
  raw: PurchasesPackage;
};

const apiKey = (): string | undefined =>
  Platform.OS === 'ios'
    ? getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_IOS_KEY')
    : getExpoPublicEnvValue('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY');

export const isConfigured = (): boolean => !!apiKey();

export async function configure(): Promise<void> {
  const key = apiKey();
  if (!key) return;

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
  // No appUserID: anonymous is correct while the app has no accounts.
  // "Restore" still recovers a purchase through the store account.
  await Purchases.configure({ apiKey: key });
}

export function tierFrom(info: CustomerInfo | null): SubscriptionTier {
  return info?.entitlements.active[ENTITLEMENT_ID] ? 'plus' : 'free';
}

export async function currentTier(): Promise<SubscriptionTier> {
  if (!isConfigured()) return 'free';
  return tierFrom(await Purchases.getCustomerInfo());
}

export async function listOffers(): Promise<Offer[]> {
  if (!isConfigured()) return [];

  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];

  return packages.map((pkg) => ({
    id: pkg.identifier,
    priceLabel: pkg.product.priceString,
    period: pkg.packageType === 'ANNUAL' ? 'annual' : 'monthly',
    raw: pkg,
  }));
}

export async function purchase(offer: Offer): Promise<SubscriptionTier> {
  const { customerInfo } = await Purchases.purchasePackage(offer.raw);
  return tierFrom(customerInfo);
}

export async function restore(): Promise<SubscriptionTier> {
  if (!isConfigured()) return 'free';
  return tierFrom(await Purchases.restorePurchases());
}
