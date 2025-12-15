import type { User } from '@supabase/supabase-js';
import type { QuotaStatus, DreamAnalysis } from '@/lib/types';
import type { UserTier } from '@/constants/limits';

export interface QuotaDreamTarget {
  dreamId?: number;
  dream?: DreamAnalysis;
}

/**
 * QuotaProvider interface - abstracts quota checking logic
 * Two implementations: GuestQuotaProvider (local) and SupabaseQuotaProvider (server)
 */
export interface QuotaProvider {
  /**
   * Get number of analyses performed by user
   */
  getUsedAnalysisCount(user: User | null): Promise<number>;

  /**
   * Get number of dreams explored (chat started) by user
   */
  getUsedExplorationCount(user: User | null): Promise<number>;

  /**
   * Get number of user messages sent for a specific dream
   * @param target - Dream target (dreamId or dream object)
   * @param user - Supabase user (null for guests)
   */
  getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number>;

  /**
   * Check if user can perform a new analysis
   * @param user - Supabase user (null for guests)
   * @param tier - User's subscription tier from RevenueCat (source of truth)
   */
  canAnalyzeDream(user: User | null, tier: UserTier): Promise<boolean>;

  /**
   * Check if user can explore a specific dream (start/continue chat)
   * @param target - Dream target (dreamId or dream object)
   * @param user - Supabase user (null for guests)
   * @param tier - User's subscription tier from RevenueCat (source of truth)
   */
  canExploreDream(target: QuotaDreamTarget | undefined, user: User | null, tier: UserTier): Promise<boolean>;

  /**
   * Check if user can send another chat message for a specific dream
   * @param target - Dream target (dreamId or dream object)
   * @param user - Supabase user (null for guests)
   * @param tier - User's subscription tier from RevenueCat (source of truth)
   */
  canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null, tier: UserTier): Promise<boolean>;

  /**
   * Get complete quota status for user
   * @param user - Supabase user (null for guests)
   * @param tier - User's subscription tier from RevenueCat (source of truth)
   * @param target - Optional dream target for chat-specific quota checks
   */
  getQuotaStatus(user: User | null, tier: UserTier, target?: QuotaDreamTarget): Promise<QuotaStatus>;

  /**
   * Invalidate cache (called after quota-consuming actions)
   */
  invalidate(): void;
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
