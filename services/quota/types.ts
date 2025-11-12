import type { User } from '@supabase/supabase-js';
import type { QuotaStatus, DreamAnalysis } from '@/lib/types';

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
   * @param dreamId - Local dream ID (timestamp)
   */
  getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number>;

  /**
   * Check if user can perform a new analysis
   */
  canAnalyzeDream(user: User | null): Promise<boolean>;

  /**
   * Check if user can explore a specific dream (start/continue chat)
   * @param dreamId - Local dream ID
   */
  canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean>;

  /**
   * Check if user can send another chat message for a specific dream
   * @param dreamId - Local dream ID
   */
  canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean>;

  /**
   * Get complete quota status for user
   */
  getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus>;

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
