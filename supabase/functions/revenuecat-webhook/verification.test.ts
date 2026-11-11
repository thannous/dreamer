import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldAskRevenueCatToRetry } from './verification.ts';

Deno.test('a verified customer is applied whatever the tier', () => {
  for (const tier of ['plus', 'free'] as const) {
    assertEquals(shouldAskRevenueCatToRetry({ tier, customerVerified: true, entitlementLookupLoaded: true }), false);
    assertEquals(shouldAskRevenueCatToRetry({ tier, customerVerified: true, entitlementLookupLoaded: false }), false);
  }
});

Deno.test('a downgrade is never applied from the event alone', () => {
  // EXPIRATION of one product while RevenueCat could not be reached: the
  // account may still hold another active product.
  assertEquals(shouldAskRevenueCatToRetry({ tier: 'free', customerVerified: false, entitlementLookupLoaded: true }), true);
  assertEquals(shouldAskRevenueCatToRetry({ tier: 'free', customerVerified: false, entitlementLookupLoaded: false }), true);
});

Deno.test('a purchase named by the event is applied even when the customer could not be read', () => {
  assertEquals(shouldAskRevenueCatToRetry({ tier: 'plus', customerVerified: false, entitlementLookupLoaded: true }), false);
});

Deno.test('an event nothing could be inferred from is sent again only when a lookup failed', () => {
  assertEquals(shouldAskRevenueCatToRetry({ tier: null, customerVerified: false, entitlementLookupLoaded: true }), true);
  assertEquals(shouldAskRevenueCatToRetry({ tier: null, customerVerified: true, entitlementLookupLoaded: false }), true);
  // Both lookups answered and still no tier: a new delivery would change nothing.
  assertEquals(shouldAskRevenueCatToRetry({ tier: null, customerVerified: true, entitlementLookupLoaded: true }), false);
});
