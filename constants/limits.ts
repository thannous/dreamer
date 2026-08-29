/**
 * User tier types for quota management
 */
export type UserTier = 'guest' | 'free' | 'plus';

/**
 * Quota limits by user tier
 * null = unlimited
 */
export interface TierQuotas {
  analysis: number | null; // Number of interpreted dreams included
  exploration: number | null; // Compatibility metric; no longer a product entitlement
  messagesPerDream: number | null; // Safety ceiling for chat within one interpreted dream
  /**
   * Illustration allowance.
   * guest: existing device image_count pool (2).
   * free: 0 — no standalone monthly credits; server still bundles one image
   *   with a valid analysis request.
   * plus: null (unlimited).
   */
  image: number | null;
}

export interface TierQuotaConfig {
  initial: TierQuotas;
  monthly: TierQuotas;
}

/**
 * Quota configuration by tier
 */
export const QUOTAS: Record<UserTier, TierQuotas> = {
  guest: {
    analysis: 2,
    exploration: null,
    messagesPerDream: 10,
    image: 2,
  },
  free: {
    analysis: 3,
    exploration: null,
    messagesPerDream: 10,
    image: 0,
  },
  plus: {
    analysis: null,
    exploration: null,
    messagesPerDream: 20,
    image: null,
  },
};

export const QUOTA_CONFIG: Record<UserTier, TierQuotaConfig> = {
  guest: {
    initial: QUOTAS.guest,
    monthly: QUOTAS.guest,
  },
  free: {
    initial: QUOTAS.free,
    monthly: QUOTAS.free,
  },
  plus: {
    initial: QUOTAS.plus,
    monthly: QUOTAS.plus,
  },
};

/**
 * @deprecated Guest dream recording limit (UI only).
 * Kept for backward compatibility with older components.
 */
export const GUEST_DREAM_LIMIT = 2;
