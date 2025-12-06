import type { User } from '@supabase/supabase-js';

import { QUOTAS, type UserTier } from '@/constants/limits';
import { getUserChatMessageCount, isDreamExplored } from '@/lib/dreamUsage';
import type { DreamAnalysis, QuotaStatus } from '@/lib/types';
import { getSavedDreams } from '@/services/storageService';
import {
  getMockAnalysisCount,
  getMockExplorationCount,
  isDreamExploredMock,
  invalidateMockQuotaCache,
} from './MockQuotaEventStore';

import type { CacheEntry, QuotaProvider, QuotaDreamTarget } from './types';

const CACHE_KEY = 'mock_dreams';

export class MockQuotaProvider implements QuotaProvider {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 15000; // 15 seconds

  private async getDreams(): Promise<DreamAnalysis[]> {
    const cached = this.cache.get(CACHE_KEY);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as DreamAnalysis[];
    }

    const dreams = await getSavedDreams();
    this.cache.set(CACHE_KEY, {
      value: dreams,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return dreams;
  }

  private getTier(user: User | null): UserTier {
    if (!user) return 'guest';
    const tier = user.user_metadata?.tier as UserTier | undefined;
    if (tier === 'premium') return 'premium';
    if (tier === 'guest') return 'guest';
    return 'free';
  }

  async getUsedAnalysisCount(_user: User | null): Promise<number> {
    return getMockAnalysisCount();
  }

  async getUsedExplorationCount(_user: User | null): Promise<number> {
    return getMockExplorationCount();
  }

  async getUsedMessagesCount(target: QuotaDreamTarget | undefined, _user: User | null): Promise<number> {
    const dreams = await this.getDreams();
    const dreamId = target?.dream?.id ?? target?.dreamId;
    const dream = dreamId ? dreams.find((item) => item.id === dreamId) : undefined;
    return getUserChatMessageCount(dream);
  }

  async canAnalyzeDream(user: User | null): Promise<boolean> {
    const tier = this.getTier(user);
    const limit = QUOTAS[tier].analysis;
    if (limit === null) return true;
    const used = await this.getUsedAnalysisCount(user);
    return used < limit;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    const tier = this.getTier(user);
    const limit = QUOTAS[tier].exploration;
    if (limit === null) return true;

    // If this specific dream is already explored (event store), always allow continuing the chat
    if (target) {
      const dreams = await this.getDreams();
      const dreamId = target?.dream?.id ?? target?.dreamId;
      const dream = dreamId ? dreams.find((d) => d.id === dreamId) : undefined;
      if (await isDreamExploredMock(dreamId) || isDreamExplored(dream)) {
        return true;
      }
    }

    const used = await this.getUsedExplorationCount(user);
    return used < limit;
  }

  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    const tier = this.getTier(user);
    const limit = QUOTAS[tier].messagesPerDream;
    if (limit === null) return true;
    const used = await this.getUsedMessagesCount(target, user);
    return used < limit;
  }

  async getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus> {
    const tier = this.getTier(user);
    const limits = QUOTAS[tier];

    const [analysisUsed, explorationUsed, messagesUsed] = await Promise.all([
      this.getUsedAnalysisCount(user),
      this.getUsedExplorationCount(user),
      target ? this.getUsedMessagesCount(target, user) : Promise.resolve(0),
    ]);

    const canAnalyze = await this.canAnalyzeDream(user);
    const canExplore = target ? await this.canExploreDream(target, user) : limits.exploration === null || explorationUsed < (limits.exploration ?? 0);

    const reasons: string[] = [];
    if (!canAnalyze && limits.analysis !== null) {
      reasons.push(`Analysis limit reached (${analysisUsed}/${limits.analysis}).`);
    }
    if (!canExplore && target && limits.exploration !== null) {
      reasons.push(`Exploration limit reached (${explorationUsed}/${limits.exploration}).`);
    }

    return {
      tier,
      usage: {
        analysis: {
          used: analysisUsed,
          limit: limits.analysis,
          remaining: limits.analysis === null ? null : Math.max(limits.analysis - analysisUsed, 0),
        },
        exploration: {
          used: explorationUsed,
          limit: limits.exploration,
          remaining: limits.exploration === null ? null : Math.max(limits.exploration - explorationUsed, 0),
        },
        messages: {
          used: messagesUsed,
          limit: limits.messagesPerDream,
          remaining: limits.messagesPerDream === null ? null : Math.max(limits.messagesPerDream - messagesUsed, 0),
        },
      },
      canAnalyze,
      canExplore,
      reasons: reasons.length > 0 ? reasons : undefined,
    };
  }

  invalidate(): void {
    this.cache.clear();
    invalidateMockQuotaCache();
  }
}
