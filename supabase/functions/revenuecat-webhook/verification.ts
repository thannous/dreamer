/**
 * Whether an event can be applied with what the webhook managed to confirm.
 *
 * RevenueCat sends an event again when the answer is not a success. Answering
 * 200 for an event that could not be applied drops it for good, and acting on
 * the event alone, when its customer could not be read, can take Plus away
 * from someone who still holds another active product. In both cases the
 * right answer is "send it again".
 */
export type EventVerification = {
  /** The tier inferred for the account, or null when none could be inferred. */
  tier: 'free' | 'plus' | 'guest' | null;
  /** The customer was read from RevenueCat, so the tier reflects every product. */
  customerVerified: boolean;
  /** The project's entitlement table was read, so entitlement ids can be named. */
  entitlementLookupLoaded: boolean;
};

export function shouldAskRevenueCatToRetry({ tier, customerVerified, entitlementLookupLoaded }: EventVerification): boolean {
  // Nothing could be inferred because a lookup failed: another delivery may succeed.
  if (tier === null) return !customerVerified || !entitlementLookupLoaded;
  // A grant read from the event itself is safe to apply. A loss of access is
  // not: only the customer record says whether another entitlement is active.
  return !customerVerified && tier !== 'plus';
}
