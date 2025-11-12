import type { User } from '@supabase/supabase-js';
import type { QuotaProvider, CacheEntry, QuotaDreamTarget } from './types';
import type { QuotaStatus } from '@/lib/types';
import { QUOTAS, type UserTier } from '@/constants/limits';
import { supabase } from '@/lib/supabase';
import { getCachedRemoteDreams } from '@/services/storageService';

/**
 * Supabase quota provider - counts quotas from Supabase database
 * Used for authenticated users with optimized COUNT queries
 */
export class SupabaseQuotaProvider implements QuotaProvider {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  private async resolveDream(target: QuotaDreamTarget | undefined) {
    if (!target) return undefined;
    if (target.dream) return target.dream;
    if (!target.dreamId) return undefined;
    const cached = await getCachedRemoteDreams();
    return cached.find((dream) => dream.id === target.dreamId);
  }

  /**
   * Get user tier from metadata
   */
  private getUserTier(user: User | null): UserTier {
    if (!user) return 'guest';
    return (user.user_metadata?.tier as UserTier) || 'free';
  }

  /**
   * Get cached value or compute new one
   */
  private async getOrCache<T>(
    key: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const value = await compute();
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return value;
  }

  async getUsedAnalysisCount(user: User | null): Promise<number> {
    if (!user) return 0; // Guest, not handled here

    const cacheKey = `analysis_count_${user.id}`;

    return this.getOrCache(cacheKey, async () => {
      // Count dreams where is_analyzed = true
      // NOTE: This assumes the is_analyzed column will be added via migration
      // For backward compatibility, we count all dreams if column doesn't exist
      const { count, error } = await supabase
        .from('dreams')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_analyzed', true);

      if (error) {
        // Fallback: if is_analyzed column doesn't exist yet, count all dreams
        console.warn('is_analyzed column not found, counting all dreams:', error);
        const { count: fallbackCount } = await supabase
          .from('dreams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return fallbackCount ?? 0;
      }

      return count ?? 0;
    });
  }

  async getUsedExplorationCount(user: User | null): Promise<number> {
    if (!user) return 0;

    const cacheKey = `exploration_count_${user.id}`;

    return this.getOrCache(cacheKey, async () => {
      // Count dreams where exploration_started_at is not null
      const { count, error } = await supabase
        .from('dreams')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('exploration_started_at', 'is', null);

      if (error) {
        console.error('Error counting explorations:', error);
        return 0;
      }

      return count ?? 0;
    });
  }

  async getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number> {
    if (!user || !target) return 0;

    const dream = await this.resolveDream(target);
    const cacheKey = `messages_count_${user.id}_${dream?.remoteId ?? dream?.id ?? target.dreamId}`;

    return this.getOrCache(cacheKey, async () => {
      if (dream?.remoteId) {
        const { data, error } = await supabase
          .from('dreams')
          .select('chat_history')
          .eq('user_id', user.id)
          .eq('id', dream.remoteId)
          .single();

        if (!error && data && Array.isArray(data.chat_history)) {
          return (data.chat_history as Array<{ role: string }>).filter((msg) => msg.role === 'user').length;
        }
      }

      if (dream?.chatHistory?.length) {
        return dream.chatHistory.filter((msg) => msg.role === 'user').length;
      }

      return 0;
    });
  }

  async canAnalyzeDream(user: User | null): Promise<boolean> {
    if (!user) return false; // Guest handled by GuestQuotaProvider

    const tier = this.getUserTier(user);
    const limit = QUOTAS[tier].analysis;

    if (limit === null) return true; // Unlimited

    const used = await this.getUsedAnalysisCount(user);
    return used < limit;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (!user) return false;

    const tier = this.getUserTier(user);
    const limit = QUOTAS[tier].exploration;

    if (limit === null) return true; // Unlimited

    const dream = await this.resolveDream(target);

    if (dream?.explorationStartedAt) {
      return true;
    }

    if (dream?.remoteId) {
      const { data, error } = await supabase
        .from('dreams')
        .select('exploration_started_at')
        .eq('user_id', user.id)
        .eq('id', dream.remoteId)
        .single();

      if (error) {
        console.error('Error checking exploration status:', error);
        return false;
      }

      if (data?.exploration_started_at !== null) {
        return true;
      }
    }

    // Check if user can start exploring a new dream
    const used = await this.getUsedExplorationCount(user);
    return used < limit;
  }

  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (!user) return false;

    const tier = this.getUserTier(user);
    const limit = QUOTAS[tier].messagesPerDream;

    if (limit === null) return true; // Unlimited

    const used = await this.getUsedMessagesCount(target, user);
    return used < limit;
  }

  async getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus> {
    if (!user) {
      // Guest, not handled here - return placeholder
      return {
        tier: 'guest',
        usage: {
          analysis: { used: 0, limit: null, remaining: null },
          exploration: { used: 0, limit: null, remaining: null },
          messages: { used: 0, limit: null, remaining: null },
        },
        canAnalyze: false,
        canExplore: false,
      };
    }

    const tier = this.getUserTier(user);
    const analysisUsed = await this.getUsedAnalysisCount(user);
    const explorationUsed = await this.getUsedExplorationCount(user);
    const messagesUsed = target ? await this.getUsedMessagesCount(target, user) : 0;

    const analysisLimit = QUOTAS[tier].analysis;
    const explorationLimit = QUOTAS[tier].exploration;
    const messagesLimit = QUOTAS[tier].messagesPerDream;

    const canAnalyze = await this.canAnalyzeDream(user);
    const canExplore = target ? await this.canExploreDream(target, user) : true;

    const reasons: string[] = [];
    if (!canAnalyze) {
      if (tier === 'free') {
        reasons.push('You have used all 5 free analyses. Upgrade to premium for unlimited analyses!');
      }
    }
    if (!canExplore && target) {
      if (tier === 'free') {
        reasons.push('You have reached the exploration limit. Upgrade to premium for unlimited exploration!');
      }
    }

    return {
      tier,
      usage: {
        analysis: {
          used: analysisUsed,
          limit: analysisLimit,
          remaining: analysisLimit !== null ? analysisLimit - analysisUsed : null,
        },
        exploration: {
          used: explorationUsed,
          limit: explorationLimit,
          remaining: explorationLimit !== null ? explorationLimit - explorationUsed : null,
        },
        messages: {
          used: messagesUsed,
          limit: messagesLimit,
          remaining: messagesLimit !== null ? messagesLimit - messagesUsed : null,
        },
      },
      canAnalyze,
      canExplore,
      reasons: reasons.length > 0 ? reasons : undefined,
    };
  }

  invalidate(): void {
    this.cache.clear();
  }
}
