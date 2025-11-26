import type { User } from '@supabase/supabase-js';

import { QUOTAS } from '@/constants/limits';
import { getApiBaseUrl } from '@/lib/config';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { fetchJSON } from '@/lib/http';
import type { QuotaStatus } from '@/lib/types';
import type { CacheEntry, QuotaDreamTarget, QuotaProvider } from './types';
import { GuestQuotaProvider } from './GuestQuotaProvider';

type RemoteQuotaUsage = {
  analysis?: { used?: number; limit?: number | null };
  exploration?: { used?: number; limit?: number | null };
  messages?: { used?: number; limit?: number | null };
};

type RemoteQuotaResponse = {
  tier?: 'guest' | 'free' | 'premium';
  usage?: RemoteQuotaUsage;
  canAnalyze?: boolean;
  canExplore?: boolean;
  reasons?: string[];
};

/**
 * Remote guest quota provider.
 * - Calls backend quota endpoint with a pseudonymous device fingerprint.
 * - Falls back to local GuestQuotaProvider if offline or endpoint fails.
 * - Only meant to be instantiated in non-mock mode (real backend).
 */
export class RemoteGuestQuotaProvider implements QuotaProvider {
  private cache: Map<string, CacheEntry<QuotaStatus>> = new Map();
  private readonly CACHE_TTL = 20000; // 20 seconds
  private remoteUnavailable = false;

  constructor(private readonly fallback: GuestQuotaProvider) {}

  private resolveDreamId(target: QuotaDreamTarget | undefined): number | undefined {
    return target?.dream?.id ?? target?.dreamId;
  }

  private isEndpointUnavailable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('HTTP 401') ||
      message.includes('Unauthorized') ||
      message.includes('HTTP 403') ||
      message.includes('HTTP 404')
    );
  }

  private async getFallbackStatus(
    cacheKey: string,
    target: QuotaDreamTarget | undefined
  ): Promise<QuotaStatus> {
    const fallbackStatus = await this.fallback.getQuotaStatus(null, target);
    this.cache.set(cacheKey, { value: fallbackStatus, expiresAt: Date.now() + this.CACHE_TTL });
    return fallbackStatus;
  }

  private buildUsage(
    remote: RemoteQuotaUsage | undefined,
    defaults = QUOTAS.guest
  ): QuotaStatus['usage'] {
    const analysisUsed = remote?.analysis?.used ?? 0;
    const explorationUsed = remote?.exploration?.used ?? 0;
    const messagesUsed = remote?.messages?.used ?? 0;

    const analysisLimit = remote?.analysis?.limit ?? defaults.analysis ?? null;
    const explorationLimit = remote?.exploration?.limit ?? defaults.exploration ?? null;
    const messagesLimit = remote?.messages?.limit ?? defaults.messagesPerDream ?? null;

    return {
      analysis: {
        used: analysisUsed,
        limit: analysisLimit,
        remaining: analysisLimit === null ? null : Math.max(analysisLimit - analysisUsed, 0),
      },
      exploration: {
        used: explorationUsed,
        limit: explorationLimit,
        remaining: explorationLimit === null ? null : Math.max(explorationLimit - explorationUsed, 0),
      },
      messages: {
        used: messagesUsed,
        limit: messagesLimit,
        remaining: messagesLimit === null ? null : Math.max(messagesLimit - messagesUsed, 0),
      },
    };
  }

  private mapResponseToStatus(remote: RemoteQuotaResponse): QuotaStatus {
    const usage = this.buildUsage(remote.usage);
    const canAnalyze =
      typeof remote.canAnalyze === 'boolean'
        ? remote.canAnalyze
        : usage.analysis.limit === null || usage.analysis.used < usage.analysis.limit;
    const canExplore =
      typeof remote.canExplore === 'boolean'
        ? remote.canExplore
        : usage.exploration.limit === null || usage.exploration.used < usage.exploration.limit;

    return {
      tier: remote.tier ?? 'guest',
      usage,
      canAnalyze,
      canExplore,
      reasons: remote.reasons,
    };
  }

  private async fetchQuota(target?: QuotaDreamTarget): Promise<QuotaStatus> {
    const dreamId = this.resolveDreamId(target);
    const cacheKey = dreamId ? `dream-${dreamId}` : 'global';
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (this.remoteUnavailable) {
      return this.getFallbackStatus(cacheKey, target);
    }

    try {
      const fingerprint = await getDeviceFingerprint();
      const response = await fetchJSON<RemoteQuotaResponse>(`${getApiBaseUrl()}/quota/status`, {
        method: 'POST',
        body: {
          fingerprint,
          targetDreamId: dreamId ?? null,
        },
        retries: 1,
        timeoutMs: 10000,
      });
      const status = this.mapResponseToStatus(response);
      this.cache.set(cacheKey, { value: status, expiresAt: Date.now() + this.CACHE_TTL });
      return status;
    } catch (error) {
      if (this.isEndpointUnavailable(error)) {
        this.remoteUnavailable = true;
        if (__DEV__) {
          console.log('[Quota] Remote guest quota endpoint unavailable, using local store');
        }
      } else if (__DEV__) {
        console.warn('[Quota] Remote guest quota failed, falling back to local store', error);
      }
      return this.getFallbackStatus(cacheKey, target);
    }
  }

  async getUsedAnalysisCount(user: User | null): Promise<number> {
    if (user) return 0;
    const status = await this.fetchQuota();
    return status.usage.analysis.used;
  }

  async getUsedExplorationCount(user: User | null): Promise<number> {
    if (user) return 0;
    const status = await this.fetchQuota();
    return status.usage.exploration.used;
  }

  async getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number> {
    if (user) return 0;
    const status = await this.fetchQuota(target);
    return status.usage.messages.used;
  }

  async canAnalyzeDream(user: User | null): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota();
    return status.canAnalyze;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota(target);
    return status.canExplore;
  }

  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota(target);
    const { used, limit } = status.usage.messages;
    if (limit === null) return true;
    return used < limit;
  }

  async getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus> {
    if (user) {
      return {
        tier: 'guest',
        usage: {
          analysis: { used: 0, limit: null, remaining: null },
          exploration: { used: 0, limit: null, remaining: null },
          messages: { used: 0, limit: null, remaining: null },
        },
        canAnalyze: true,
        canExplore: true,
      };
    }
    return this.fetchQuota(target);
  }

  invalidate(): void {
    this.cache.clear();
    this.remoteUnavailable = false;
  }
}
