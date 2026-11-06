import { deepStrictEqual as equal, rejects } from 'node:assert';
import {
  applySubscriptionStateUpdate,
  buildSubscriptionSnapshotFromCustomer,
  buildSubscriptionSnapshotFromTier,
} from './subscriptionState.ts';
import { inferTierFromCustomer, isActiveEntitlementV2 } from './revenuecatSubscriber.ts';

const now = Date.parse('2026-11-06T12:00:00.000Z');

Deno.test('subscription V2 distinguishes active, expired, unknown and absent entitlements', () => {
  equal(isActiveEntitlementV2({ expires_at: null }, now), true);
  equal(isActiveEntitlementV2({ expires_at: now }, now), false);
  equal(isActiveEntitlementV2({ expires_at: Number.NaN }, now), false);
  equal(inferTierFromCustomer(null, now), null);
  equal(inferTierFromCustomer({ active_entitlements: { items: [] } }, now), 'free');
  equal(buildSubscriptionSnapshotFromCustomer({
    active_entitlements: { items: [{ entitlement_id: 'unrecognized', expires_at: now + 1 }] },
  }, now), null);
  equal(buildSubscriptionSnapshotFromCustomer({
    active_entitlements: { items: [{ entitlement_id: 'plus', expires_at: now }] },
  }, now)?.tier, 'free');
});

Deno.test('subscription snapshots preserve mapped entitlement and customer identity for API and webhook', () => {
  equal(buildSubscriptionSnapshotFromCustomer({
    id: ' customer ',
    active_entitlements: { items: [{ entitlement_id: 'ent_123', expires_at: now + 1, product_identifier: ' monthly ' }] },
  }, now, { ent_123: 'Noctalia Plus' }), {
    tier: 'plus', isActive: true, productId: 'monthly', entitlementId: 'Noctalia Plus', revenueCatCustomerId: 'customer',
  });
  equal(buildSubscriptionSnapshotFromCustomer(null, now), {
    tier: 'free', isActive: false, productId: null, entitlementId: null, revenueCatCustomerId: null,
  });
  equal(buildSubscriptionSnapshotFromTier({ tier: 'plus', isActive: false }).tier, 'free');
  equal(buildSubscriptionSnapshotFromTier({ tier: 'free', isActive: true }).isActive, false);
});

Deno.test('subscription state application forwards event identity and order and preserves a skipped RPC result', async () => {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const result = await applySubscriptionStateUpdate({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { ok: true, changed: false, skipped: true, tier: 'plus', isActive: true, version: 7, outcome: 'stale_event' }, error: null };
    },
  }, {
    userId: 'user', source: 'revenuecat_webhook', sourceEventId: ' event ',
    sourceUpdatedAt: '2026-11-06T11:00:00.000Z', tier: 'plus', isActive: true,
    productId: ' monthly ', entitlementId: ' plus ', revenueCatCustomerId: ' customer ',
    metadata: { eventType: 'RENEWAL' },
  });
  equal(calls, [{ name: 'apply_subscription_state_update', args: {
    p_user_id: 'user', p_tier: 'plus', p_is_active: true, p_product_id: 'monthly', p_entitlement_id: 'plus',
    p_source: 'revenuecat_webhook', p_source_event_id: 'event', p_source_updated_at: '2026-11-06T11:00:00.000Z',
    p_revenuecat_customer_id: 'customer', p_metadata: { eventType: 'RENEWAL' },
  } }]);
  equal(result, { ok: true, changed: false, skipped: true, tier: 'plus', isActive: true, version: 7, outcome: 'stale_event' });
});

Deno.test('subscription state application cannot report success on a failed or empty RPC', async () => {
  const input = { userId: 'user', source: 'app_launch', sourceUpdatedAt: '2026-11-06T11:00:00.000Z', tier: 'free' as const, isActive: false };
  await rejects(applySubscriptionStateUpdate({
    rpc: async () => ({ data: null, error: { message: 'database unavailable' } }),
  }, input), /database unavailable/);
  await rejects(applySubscriptionStateUpdate({
    rpc: async () => ({ data: null, error: null }),
  }, input), /Failed to apply subscription state update/);
});
