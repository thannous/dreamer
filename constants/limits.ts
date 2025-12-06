/**
 * User tier types for quota management
 */
export type UserTier = 'guest' | 'free' | 'premium';

/**
 * Quota limits by user tier
 * null = unlimited
 */
export interface TierQuotas {
  analysis: number | null; // Number of AI analyses allowed
  exploration: number | null; // Number of dreams that can be explored (chat started)
  messagesPerDream: number | null; // Max chat messages per dream
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
    analysis: 2, // 2 dream analyses
    exploration: 2, // Can explore 2 dreams
    messagesPerDream: 10, // 20 messages per dream
  },
  free: {
    analysis: 5, // 5 dream analyses total (includes guest analyses)
    exploration: 2, // 2 explorations total (includes guest explorations)
    messagesPerDream: 20, // 20 messages per dream
  },
  premium: {
    analysis: null, // Unlimited analyses
    exploration: null, // Unlimited explorations
    messagesPerDream: null, // Unlimited messages
  },
};

export const QUOTA_CONFIG: Record<UserTier, TierQuotaConfig> = {
  guest: {
    initial: QUOTAS.guest,
    monthly: QUOTAS.guest,
  },
  free: {
    initial: QUOTAS.free,
    monthly: {
      analysis: 2,
      exploration: 1,
      messagesPerDream: QUOTAS.free.messagesPerDream,
    },
  },
  premium: {
    initial: QUOTAS.premium,
    monthly: QUOTAS.premium,
  },
};

/**
 * @deprecated Use QUOTAS.guest.analysis instead
 * Kept for backward compatibility
 */
export const GUEST_DREAM_LIMIT = 3;
