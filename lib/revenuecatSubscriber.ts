export type Tier = 'free' | 'plus';
export type InferredTier = Tier | null;

export type RevenueCatV1Entitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
};

export type RevenueCatV1SubscriberResponse = {
  subscriber?: {
    original_app_user_id?: string | null;
    aliases?: string[] | null;
    entitlements?: Record<string, RevenueCatV1Entitlement>;
  };
};

const PREMIUM_ENTITLEMENT_KEYS = [
  'premium',
  'noctalia_premium',
  'noctalia-premium',
  'noctaliaPremium',
  'Noctalia Premium',
];

const PLUS_ENTITLEMENT_KEYS = [
  'plus',
  'noctalia_plus',
  'noctalia-plus',
  'noctaliaPlus',
  'Noctalia Plus',
];

function tierFromEntitlementKey(key: string): InferredTier {
  const normalized = key.trim();
  if (PREMIUM_ENTITLEMENT_KEYS.includes(normalized)) return 'plus';
  if (PLUS_ENTITLEMENT_KEYS.includes(normalized)) return 'plus';
  return null;
}

export function inferTierFromEntitlementKeys(keys: string[]): InferredTier {
  for (const key of keys) {
    const mapped = tierFromEntitlementKey(key);
    if (mapped) return mapped;
  }

  return keys.length > 0 ? null : 'free';
}

export function isActiveEntitlement(ent: RevenueCatV1Entitlement, nowMs: number = Date.now()): boolean {
  const grace = ent.grace_period_expires_date;
  if (typeof grace === 'string' && grace.trim()) {
    const graceMs = new Date(grace).getTime();
    if (Number.isFinite(graceMs) && graceMs > nowMs) return true;
  }

  const expires = ent.expires_date;
  if (expires === null || expires === undefined) {
    return true;
  }

  if (typeof expires === 'string' && expires.trim()) {
    const expiresMs = new Date(expires).getTime();
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  }

  return false;
}

export function inferTierFromSubscriber(
  subscriber: RevenueCatV1SubscriberResponse | null,
  nowMs: number = Date.now()
): InferredTier {
  if (!subscriber) return null;
  const entitlements = subscriber.subscriber?.entitlements ?? {};
  const activeEntitlementKeys = Object.entries(entitlements)
    .filter(([_, ent]) => isActiveEntitlement(ent, nowMs))
    .map(([key]) => key);

  return inferTierFromEntitlementKeys(activeEntitlementKeys);
}
