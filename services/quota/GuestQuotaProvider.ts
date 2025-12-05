import type { User } from '@supabase/supabase-js';
import type { QuotaProvider, CacheEntry, QuotaDreamTarget } from './types';
import type { QuotaStatus, DreamAnalysis } from '@/lib/types';
import { QUOTAS } from '@/constants/limits';
import { getUserChatMessageCount, isDreamExplored } from '@/lib/dreamUsage';
import { getSavedDreams } from '@/services/storageServiceReal';
import { getLocalAnalysisCount, getLocalExplorationCount } from './GuestAnalysisCounter';

/**
 * Guest quota provider - counts quotas from local AsyncStorage
 * Used for non-authenticated users
 */
export class GuestQuotaProvider implements QuotaProvider {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Get all guest dreams from local storage
   */
  private async getGuestDreams(): Promise<DreamAnalysis[]> {
    const cacheKey = 'guest_dreams';
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const dreams = await getSavedDreams();
    this.cache.set(cacheKey, {
      value: dreams,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return dreams;
  }

  async getUsedAnalysisCount(user: User | null): Promise<number> {
    if (user) return 0; // Not a guest

    // Use persistent counter instead of counting current dreams
    // This prevents quota bypass by deleting dreams
    return getLocalAnalysisCount();
  }

  async getUsedExplorationCount(user: User | null): Promise<number> {
    if (user) return 0; // Not a guest

    // Use persistent counter instead of counting current dreams
    return getLocalExplorationCount();
  }

  private resolveDreamId(target: QuotaDreamTarget | undefined): number | undefined {
    return target?.dream?.id ?? target?.dreamId;
  }

  async getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number> {
    if (user) return 0; // Not a guest

    const dreamId = this.resolveDreamId(target);
    if (!dreamId) return 0;

    const dreams = await this.getGuestDreams();
    const dream = dreams.find((d) => d.id === dreamId);

    return getUserChatMessageCount(dream);
  }

  async canAnalyzeDream(user: User | null): Promise<boolean> {
    if (user) return true; // Not a guest, handled by SupabaseQuotaProvider

    const used = await this.getUsedAnalysisCount(null);
    const limit = QUOTAS.guest.analysis;

    if (limit === null) return true; // Unlimited
    return used < limit;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (user) return true; // Not a guest

    const dreamId = this.resolveDreamId(target);
    if (!dreamId) return true;

    const dreams = await this.getGuestDreams();
    const dream = dreams.find((d) => d.id === dreamId);

    // If this dream is already explored, allow continued exploration
    if (dream && isDreamExplored(dream)) {
      return true;
    }

    // Check if user can start exploring a new dream
    const used = await this.getUsedExplorationCount(null);
    const limit = QUOTAS.guest.exploration;

    if (limit === null) return true;
    return used < limit;
  }

  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (user) return true; // Not a guest

    const used = await this.getUsedMessagesCount(target, null);
    const limit = QUOTAS.guest.messagesPerDream;

    if (limit === null) return true;
    return used < limit;
  }

  async getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus> {
    if (user) {
      // Not a guest, return placeholder
      return {
        tier: 'free',
        usage: {
          analysis: { used: 0, limit: null, remaining: null },
          exploration: { used: 0, limit: null, remaining: null },
          messages: { used: 0, limit: null, remaining: null },
        },
        canAnalyze: true,
        canExplore: true,
      };
    }

    const analysisUsed = await this.getUsedAnalysisCount(null);
    const explorationUsed = await this.getUsedExplorationCount(null);
    const messagesUsed = target ? await this.getUsedMessagesCount(target, null) : 0;

    const analysisLimit = QUOTAS.guest.analysis!;
    const explorationLimit = QUOTAS.guest.exploration!;
    const messagesLimit = QUOTAS.guest.messagesPerDream!;

    const canAnalyze = await this.canAnalyzeDream(null);
    const canExplore = target ? await this.canExploreDream(target, null) : explorationUsed < explorationLimit;

    const reasons: string[] = [];
    if (!canAnalyze) {
      reasons.push('Guest analysis limit reached (2/2). Create a free account to get 3 more!');
    }
    if (!canExplore && target) {
      reasons.push('Guest exploration limit reached (2/2). Create a free account to continue!');
    }

    return {
      tier: 'guest',
      usage: {
        analysis: {
          used: analysisUsed,
          limit: analysisLimit,
          remaining: analysisLimit - analysisUsed,
        },
        exploration: {
          used: explorationUsed,
          limit: explorationLimit,
          remaining: explorationLimit - explorationUsed,
        },
        messages: {
          used: messagesUsed,
          limit: messagesLimit,
          remaining: messagesLimit - messagesUsed,
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
