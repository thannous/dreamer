// @ts-nocheck
import {
  inferTierFromCustomer,
  isActiveEntitlementV2,
  mapEntitlementKeys,
  type RevenueCatEntitlementLookupById,
  type RevenueCatV2ActiveEntitlement,
  type RevenueCatV2CustomerResponse,
} from './revenuecatSubscriber.ts';

export type SubscriptionTier = 'free' | 'plus';

export type SubscriptionSnapshot = {
  tier: SubscriptionTier;
  isActive: boolean;
  productId: string | null;
  entitlementId: string | null;
  revenueCatCustomerId: string | null;
};

export type ApplySubscriptionStateUpdateArgs = {
  userId: string;
  source: string;
  sourceEventId?: string | null;
  sourceUpdatedAt: string;
  tier: SubscriptionTier;
  isActive: boolean;
  productId?: string | null;
  entitlementId?: string | null;
  revenueCatCustomerId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ApplySubscriptionStateUpdateResult = {
  ok: boolean;
  skipped?: boolean;
  updated?: boolean;
  changed: boolean;
  outcome?: string;
  tier: SubscriptionTier;
  isActive: boolean;
  version: number;
  sourceUpdatedAt?: string | null;
};

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: ApplySubscriptionStateUpdateResult | null; error: { message: string } | null }>;
};

type RevenueCatEntitlementWithProduct = RevenueCatV2ActiveEntitlement & {
  product_identifier?: string | null;
  product_id?: string | null;
};

function normalizeTier(value: unknown): SubscriptionTier {
  return value === 'plus' || value === 'premium' ? 'plus' : 'free';
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getFirstActiveEntitlement(
  customer: RevenueCatV2CustomerResponse | null,
  nowMs: number
): RevenueCatEntitlementWithProduct | null {
  const items = Array.isArray(customer?.active_entitlements?.items)
    ? (customer?.active_entitlements?.items as RevenueCatEntitlementWithProduct[])
    : [];

  for (const item of items) {
    if (isActiveEntitlementV2(item, nowMs)) {
      return item;
    }
  }

  return null;
}

export function buildSubscriptionSnapshotFromCustomer(
  customer: RevenueCatV2CustomerResponse | null,
  nowMs: number = Date.now(),
  entitlementLookupById?: RevenueCatEntitlementLookupById
): SubscriptionSnapshot {
  const inferredTier = inferTierFromCustomer(customer, nowMs, entitlementLookupById);
  const activeEntitlement = getFirstActiveEntitlement(customer, nowMs);
  const mappedEntitlementId = activeEntitlement?.entitlement_id
    ? mapEntitlementKeys([activeEntitlement.entitlement_id], entitlementLookupById)[0] ?? activeEntitlement.entitlement_id
    : null;

  return {
    tier: inferredTier === 'plus' ? 'plus' : 'free',
    isActive: inferredTier === 'plus',
    productId: normalizeText(activeEntitlement?.product_identifier ?? activeEntitlement?.product_id ?? null),
    entitlementId: normalizeText(mappedEntitlementId),
    revenueCatCustomerId: normalizeText(customer?.id),
  };
}

export function buildSubscriptionSnapshotFromTier(input: {
  tier: SubscriptionTier;
  isActive?: boolean;
  productId?: string | null;
  entitlementId?: string | null;
  revenueCatCustomerId?: string | null;
}): SubscriptionSnapshot {
  const tier = normalizeTier(input.tier);
  const isActive = input.isActive === true && tier === 'plus';

  return {
    tier: isActive ? tier : 'free',
    isActive,
    productId: normalizeText(input.productId),
    entitlementId: normalizeText(input.entitlementId),
    revenueCatCustomerId: normalizeText(input.revenueCatCustomerId),
  };
}

export async function applySubscriptionStateUpdate(
  adminClient: RpcClient,
  args: ApplySubscriptionStateUpdateArgs
): Promise<ApplySubscriptionStateUpdateResult> {
  const { data, error } = await adminClient.rpc('apply_subscription_state_update', {
    p_user_id: args.userId,
    p_tier: normalizeTier(args.tier),
    p_is_active: args.isActive,
    p_product_id: normalizeText(args.productId),
    p_entitlement_id: normalizeText(args.entitlementId),
    p_source: args.source,
    p_source_event_id: normalizeText(args.sourceEventId),
    p_source_updated_at: args.sourceUpdatedAt,
    p_revenuecat_customer_id: normalizeText(args.revenueCatCustomerId),
    p_metadata: args.metadata ?? {},
  });

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to apply subscription state update');
  }

  return {
    ...data,
    tier: normalizeTier(data.tier),
  };
}
