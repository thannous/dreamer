import type { SubscriptionTier } from '@/lib/entitlements';

/**
 * A store that always works, for development and E2E.
 *
 * It is also what runs when no RevenueCat key is configured, so the paywall can
 * be walked end to end without a native build — the alternative being a screen
 * nobody can look at until the day it ships.
 */
export type Offer = {
  id: string;
  priceLabel: string;
  period: 'annual' | 'monthly';
  raw: null;
};

let tier: SubscriptionTier = 'free';

export const isConfigured = (): boolean => true;

export async function configure(): Promise<void> {}

export async function currentTier(): Promise<SubscriptionTier> {
  return tier;
}

export async function listOffers(): Promise<Offer[]> {
  return [
    { id: 'annual', priceLabel: '39,99 €', period: 'annual', raw: null },
    { id: 'monthly', priceLabel: '5,99 €', period: 'monthly', raw: null },
  ];
}

export async function purchase(_offer: Offer): Promise<SubscriptionTier> {
  tier = 'plus';
  return tier;
}

export async function restore(): Promise<SubscriptionTier> {
  return tier;
}

/** Test seam: resets the fake store between runs. */
export const __reset = (): void => {
  tier = 'free';
};
