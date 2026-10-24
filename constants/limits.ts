/**
 * User tier types for quota management
 */
export type UserTier = 'guest' | 'free' | 'plus';

/** Lifetime local recording allowance before an account is required. */
export const GUEST_DREAM_RECORDING_LIMIT = 5;

/**
 * Longest dream text the journal syncs, against abuse (Thanh, 2026-10-21). The
 * sync function refuses more (migration 20261021171000); a longer dream stored
 * before stays editable as long as it does not grow.
 */
export const DREAM_TRANSCRIPT_MAX_CHARS = 20_000;

/**
 * Plus abuse prevention: new analyses, and new illustrations, per rolling 24 hours.
 * The server enforces it (PLUS_DAILY_LIMITS in supabase/functions/api/lib/plusDailyLimits.ts);
 * the app only names it when the server's answer omits it.
 */
export const PLUS_DAILY_LIMIT = 10;

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
    messagesPerDream: 100,
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
