import { QUOTAS, QUOTA_CONFIG, type UserTier } from '@/constants/limits';
import { getUserChatMessageCount } from '@/lib/dreamUsage';
import { getMonthlyQuotaPeriod } from '@/lib/quotaReset';
import { supabase } from '@/lib/supabase';
import type { QuotaStatus } from '@/lib/types';
import { getCachedRemoteDreams } from '@/services/storageService';
import type { User } from '@supabase/supabase-js';
import type { CacheEntry, QuotaDreamTarget, QuotaProvider } from './types';

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
   * Safe fallback when a quota count query fails.
   * Fail closed for limited tiers to avoid quota bypass if the events table is missing.
   */
  private getErrorFallback(user: User | null, quotaType: 'analysis' | 'exploration'): number {
    if (!user) return 0;
    const limit = QUOTAS[this.getUserTier(user)][quotaType];
    return limit === null ? 0 : limit;
  }

  private getMonthlyErrorFallback(user: User, quotaType: 'analysis' | 'exploration'): number {
    const limit = QUOTA_CONFIG[this.getUserTier(user)].monthly[quotaType];
    return limit === null ? 0 : limit;
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

  private getMonthlyCacheKey(prefix: string, user: User): string {
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;
    return `${prefix}_${user.id}_${monthKey}`;
  }

  private async getMonthlyAnalysisCount(user: User): Promise<number> {
    const cacheKey = this.getMonthlyCacheKey('analysis_monthly_count', user);

    return this.getOrCache(cacheKey, async () => {
      const { periodStart, periodEnd } = getMonthlyQuotaPeriod();
      const periodStartIso = periodStart.toISOString();
      const periodEndIso = periodEnd.toISOString();

      const { count, error } = await supabase
        .from('user_quota_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('quota_type', 'analysis')
        .gte('occurred_at', periodStartIso)
        .lt('occurred_at', periodEndIso);

      if (error) {
        console.error('Error counting monthly analyses:', error);
        return this.getMonthlyErrorFallback(user, 'analysis');
      }

      const eventCount = count ?? 0;

      // Defensive: if triggers are missing/misconfigured, events may not be logged.
      // Fall back to counting analyzed dreams in the current month, then take the max
      // to preserve the anti-deletion property when events are present.
      try {
        const { count: dreamCount, error: dreamError } = await supabase
          .from('dreams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_analyzed', true)
          .gte('analyzed_at', periodStartIso)
          .lt('analyzed_at', periodEndIso);

        if (dreamError) {
          console.error('Error counting monthly analyzed dreams:', dreamError);
          return eventCount;
        }

        return Math.max(eventCount, dreamCount ?? 0);
      } catch (fallbackError) {
        console.error('Error counting monthly analyzed dreams (fallback):', fallbackError);
        return eventCount;
      }
    });
  }

  private async getMonthlyExplorationCount(user: User): Promise<number> {
    const cacheKey = this.getMonthlyCacheKey('exploration_monthly_count', user);

    return this.getOrCache(cacheKey, async () => {
      const { periodStart, periodEnd } = getMonthlyQuotaPeriod();
      const periodStartIso = periodStart.toISOString();
      const periodEndIso = periodEnd.toISOString();

      const { count, error } = await supabase
        .from('user_quota_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('quota_type', 'exploration')
        .gte('occurred_at', periodStartIso)
        .lt('occurred_at', periodEndIso);

      if (error) {
        console.error('Error counting monthly explorations:', error);
        return this.getMonthlyErrorFallback(user, 'exploration');
      }

      const eventCount = count ?? 0;

      // Defensive: if triggers are missing/misconfigured, events may not be logged.
      // Fall back to counting explored dreams in the current month, then take the max
      // to preserve the anti-deletion property when events are present.
      try {
        const { count: dreamCount, error: dreamError } = await supabase
          .from('dreams')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('exploration_started_at', 'is', null)
          .gte('exploration_started_at', periodStartIso)
          .lt('exploration_started_at', periodEndIso);

        if (dreamError) {
          console.error('Error counting monthly explored dreams:', dreamError);
          return eventCount;
        }

        return Math.max(eventCount, dreamCount ?? 0);
      } catch (fallbackError) {
        console.error('Error counting monthly explored dreams (fallback):', fallbackError);
        return eventCount;
      }
    });
  }

  async getUsedAnalysisCount(user: User | null): Promise<number> {
    if (!user) return 0; // Guest, not handled here

    const cacheKey = `analysis_count_${user.id}`;

    return this.getOrCache(cacheKey, async () => {
      const { count, error } = await supabase
        .from('user_quota_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('quota_type', 'analysis');

      if (error) {
        console.error('Error counting analysis usage events:', error);
        return this.getErrorFallback(user, 'analysis');
      }

      return count ?? 0;
    });
  }

  async getUsedExplorationCount(user: User | null): Promise<number> {
    if (!user) return 0;

    const cacheKey = `exploration_count_${user.id}`;

    return this.getOrCache(cacheKey, async () => {
      const { count, error } = await supabase
        .from('user_quota_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('quota_type', 'exploration');

      if (error) {
        console.error('Error counting exploration usage events:', error);
        return this.getErrorFallback(user, 'exploration');
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

      return getUserChatMessageCount(dream);
    });
  }

  async canAnalyzeDream(user: User | null): Promise<boolean> {
    if (!user) return false;

    const tier = this.getUserTier(user);
    const limits = QUOTAS[tier];

    if (limits.analysis === null) return true;

    if (tier !== 'free') {
      const used = await this.getUsedAnalysisCount(user);
      return used < (limits.analysis ?? 0);
    }

    const monthlyLimit = QUOTA_CONFIG.free.monthly.analysis;
    if (monthlyLimit === null) return true;
    const monthlyUsed = await this.getMonthlyAnalysisCount(user);
    return monthlyUsed < monthlyLimit;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (!user) return false;

    const tier = this.getUserTier(user);
    const limits = QUOTAS[tier];

    if (limits.exploration === null) return true;

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

    if (tier !== 'free') {
      const used = await this.getUsedExplorationCount(user);
      return used < (limits.exploration ?? 0);
    }

    const monthlyLimit = QUOTA_CONFIG.free.monthly.exploration;
    if (monthlyLimit === null) return true;

    const monthlyUsed = await this.getMonthlyExplorationCount(user);
    return monthlyUsed < monthlyLimit;
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
    const messagesUsed = target ? await this.getUsedMessagesCount(target, user) : 0;

    const messagesLimit = QUOTAS[tier].messagesPerDream;

    const [analysisUsed, explorationUsed] = await Promise.all(
      tier === 'free'
        ? [this.getMonthlyAnalysisCount(user), this.getMonthlyExplorationCount(user)]
        : [this.getUsedAnalysisCount(user), this.getUsedExplorationCount(user)]
    );

    const analysisLimit = tier === 'free' ? QUOTA_CONFIG.free.monthly.analysis : QUOTAS[tier].analysis;
    const explorationLimit = tier === 'free' ? QUOTA_CONFIG.free.monthly.exploration : QUOTAS[tier].exploration;

    const canAnalyze = await this.canAnalyzeDream(user);
    const canExplore = await this.canExploreDream(target, user);

    const reasons: string[] = [];
    if (!canAnalyze) {
      if (tier === 'free') {
        reasons.push('You have reached your free monthly analysis limit. Upgrade to premium for unlimited analyses!');
      }
    }
    if (!canExplore && target) {
      if (tier === 'free') {
        reasons.push('You have reached your free monthly exploration limit. Upgrade to premium for unlimited exploration!');
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
