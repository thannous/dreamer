import type { User } from '@supabase/supabase-js';

import { QUOTAS, type UserTier } from '@/constants/limits';
import { getApiBaseUrl } from '@/lib/config';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { GuestSessionError, GuestSessionErrorCode, isGuestSessionError } from '@/lib/errors';
import { getGuestBootstrapState, getGuestHeaders, invalidateGuestSession } from '@/lib/guestSession';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import type { QuotaStatus } from '@/lib/types';
import type { CacheEntry, QuotaDreamTarget, QuotaProvider } from './types';
import { GuestQuotaProvider } from './GuestQuotaProvider';
import { syncWithServerCount } from './GuestAnalysisCounter';

type RemoteQuotaUsage = {
  analysis?: { used?: number; limit?: number | null };
  exploration?: { used?: number; limit?: number | null };
  messages?: { used?: number; limit?: number | null };
};

type RemoteQuotaResponse = {
  tier?: 'guest' | 'free' | 'plus' | 'premium';
  usage?: RemoteQuotaUsage;
  canAnalyze?: boolean;
  canExplore?: boolean;
  isUpgraded?: boolean;
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

  private buildUsage(
    remote: RemoteQuotaUsage | undefined,
    fallback: QuotaStatus['usage'] | undefined,
    defaults = QUOTAS.guest
  ): QuotaStatus['usage'] {
    const fallbackAnalysisUsed = fallback?.analysis.used ?? 0;
    const fallbackExplorationUsed = fallback?.exploration.used ?? 0;
    const fallbackMessagesUsed = fallback?.messages.used ?? 0;

    const analysisUsed = Math.max(remote?.analysis?.used ?? 0, fallbackAnalysisUsed);
    const explorationUsed = Math.max(remote?.exploration?.used ?? 0, fallbackExplorationUsed);
    const messagesUsed = Math.max(remote?.messages?.used ?? 0, fallbackMessagesUsed);

    const analysisLimit = remote?.analysis?.limit ?? fallback?.analysis.limit ?? defaults.analysis ?? null;
    const explorationLimit =
      remote?.exploration?.limit ?? fallback?.exploration.limit ?? defaults.exploration ?? null;
    const messagesLimit =
      remote?.messages?.limit ?? fallback?.messages.limit ?? defaults.messagesPerDream ?? null;

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

  private mapResponseToStatus(remote: RemoteQuotaResponse, fallback: QuotaStatus): QuotaStatus {
    const usage = this.buildUsage(remote.usage, fallback.usage);
    const isUpgraded = remote.isUpgraded ?? false;

    // If fingerprint has been upgraded, block guest access completely
    if (isUpgraded) {
      return {
        tier: 'guest',
        usage,
        canAnalyze: false,
        canExplore: false,
        isUpgraded: true,
        reasons: remote.reasons ?? [
          'Vous avez déjà utilisé l\'application ! Connectez-vous pour retrouver vos rêves et analyses illimitées.'
        ],
      };
    }

    const canAnalyzeByLimit = usage.analysis.limit === null || usage.analysis.used < usage.analysis.limit;
    const canExploreByLimit =
      usage.exploration.limit === null || usage.exploration.used < usage.exploration.limit;

    // Respect stricter remote flags but never allow exceeding local limits/special-case allowances (e.g. already explored dream)
    const canAnalyze = (remote.canAnalyze ?? true) && (fallback.canAnalyze ?? canAnalyzeByLimit) && canAnalyzeByLimit;
    const fallbackCanExplore = fallback.canExplore ?? canExploreByLimit;
    const canExplore = (remote.canExplore ?? true) && (fallbackCanExplore || canExploreByLimit);

    return {
      tier: remote.tier ?? 'guest',
      usage,
      canAnalyze,
      canExplore,
      isUpgraded: false,
      reasons: remote.reasons ?? fallback.reasons,
    };
  }

  private async fetchRemoteQuota(dreamId: number | undefined): Promise<RemoteQuotaResponse> {
    const fingerprint = await getDeviceFingerprint();
    const requestWithHeaders = async (headers: Record<string, string>) =>
      fetchJSON<RemoteQuotaResponse>(`${getApiBaseUrl()}/quota/status`, {
        method: 'POST',
        body: {
          fingerprint,
          targetDreamId: dreamId ?? null,
        },
        headers,
        ...NETWORK_REQUEST_POLICIES.quotaStatus,
      });

    const initialHeaders = await getGuestHeaders({ requireSession: true });
    try {
      return await requestWithHeaders(initialHeaders);
    } catch (error) {
      if (error instanceof Error && isGuestSessionError(error)) {
        await invalidateGuestSession();
        const freshHeaders = await getGuestHeaders({ requireSession: true });
        try {
          return await requestWithHeaders(freshHeaders);
        } catch (retryError) {
          if (retryError instanceof Error && isGuestSessionError(retryError)) {
            throw new GuestSessionError(
              GuestSessionErrorCode.EXPIRED,
              'guest_session_expired'
            );
          }
          throw retryError;
        }
      }
      throw error;
    }
  }

  private buildDegradedStatus(
    fallback: QuotaStatus,
    reasonCode: GuestSessionErrorCode,
    defaults = QUOTAS.guest
  ): QuotaStatus {
    const usage = this.buildUsage(undefined, fallback.usage, defaults);
    const reasonsByCode: Record<GuestSessionErrorCode, string> = {
      [GuestSessionErrorCode.UNAVAILABLE]:
        'Guest AI is temporarily unavailable. You can still record dreams locally.',
      [GuestSessionErrorCode.EXPIRED]:
        'Guest access expired. Please try again in a moment.',
      [GuestSessionErrorCode.PLATFORM_UNSUPPORTED]:
        'Guest AI is not available on this platform right now. You can still record dreams locally.',
      [GuestSessionErrorCode.QUOTA_UNAVAILABLE]:
        'Guest quota is temporarily unavailable. You can still record dreams locally.',
    };

    return {
      tier: 'guest',
      usage,
      canAnalyze: false,
      canExplore: false,
      isUpgraded: fallback.isUpgraded ?? false,
      reasons: [reasonsByCode[reasonCode]],
      guestBootstrapStatus: 'degraded',
      guestBootstrapReasonCode: reasonCode,
    };
  }

  private getBootstrapReasonCode(): GuestSessionErrorCode | null {
    const state = getGuestBootstrapState();
    if (state.status === 'ready') {
      return null;
    }
    return state.reasonCode ?? GuestSessionErrorCode.UNAVAILABLE;
  }

  private async fetchQuota(target?: QuotaDreamTarget, tier: UserTier = 'guest'): Promise<QuotaStatus> {
    const dreamId = this.resolveDreamId(target);
    const cacheKey = dreamId ? `dream-${dreamId}` : 'global';
    const degradedReason = this.getBootstrapReasonCode();
    if (degradedReason) {
      const fallbackStatus = await this.fallback.getQuotaStatus(null, tier, target);
      const degraded = this.buildDegradedStatus(fallbackStatus, degradedReason);
      return degraded;
    }

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const fallbackStatus = await this.fallback.getQuotaStatus(null, tier, target);

    if (this.remoteUnavailable) {
      const degraded = this.buildDegradedStatus(fallbackStatus, GuestSessionErrorCode.QUOTA_UNAVAILABLE);
      this.cache.set(cacheKey, { value: degraded, expiresAt: Date.now() + this.CACHE_TTL });
      return degraded;
    }

    try {
      const response = await this.fetchRemoteQuota(dreamId);

      // Sync local counter with server (take max to prevent discrepancies)
      if (typeof response.usage?.analysis?.used === 'number') {
        await syncWithServerCount(response.usage.analysis.used, 'analysis').catch((err) => {
          if (__DEV__) console.warn('[Quota] Failed to sync analysis count:', err);
        });
      }
      if (typeof response.usage?.exploration?.used === 'number') {
        await syncWithServerCount(response.usage.exploration.used, 'exploration').catch((err) => {
          if (__DEV__) console.warn('[Quota] Failed to sync exploration count:', err);
        });
      }

      const status = this.mapResponseToStatus(response, fallbackStatus);
      this.cache.set(cacheKey, { value: status, expiresAt: Date.now() + this.CACHE_TTL });
      return status;
    } catch (error) {
      const reasonCode =
        error instanceof GuestSessionError
          ? error.code
          : this.isEndpointUnavailable(error)
            ? GuestSessionErrorCode.QUOTA_UNAVAILABLE
            : GuestSessionErrorCode.UNAVAILABLE;
      const endpointUnavailable = this.isEndpointUnavailable(error);
      const guestSessionError = error instanceof GuestSessionError;

      if (endpointUnavailable) {
        this.remoteUnavailable = true;
        if (__DEV__) {
          console.log('[Quota] Remote guest quota unavailable, entering degraded guest mode');
        }
      } else if (guestSessionError && __DEV__) {
        console.log('[Quota] Guest session unavailable, waiting for bootstrap recovery');
      } else if (__DEV__) {
        console.warn('[Quota] Remote guest quota failed, entering degraded guest mode', error);
      }

      const degraded = this.buildDegradedStatus(fallbackStatus, reasonCode);
      if (!guestSessionError) {
        this.cache.set(cacheKey, { value: degraded, expiresAt: Date.now() + this.CACHE_TTL });
      }
      return degraded;
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

  async canAnalyzeDream(user: User | null, tier: UserTier = 'guest'): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota(undefined, tier);
    return status.canAnalyze;
  }

  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null, tier: UserTier = 'guest'): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota(target, tier);
    return status.canExplore;
  }

  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null, tier: UserTier = 'guest'): Promise<boolean> {
    if (user) return true;
    const status = await this.fetchQuota(target, tier);
    if (status.guestBootstrapStatus && status.guestBootstrapStatus !== 'ready') {
      return false;
    }
    const { used, limit } = status.usage.messages;
    if (limit === null) return true;
    return used < limit;
  }

  async getQuotaStatus(user: User | null, tier: UserTier, target?: QuotaDreamTarget): Promise<QuotaStatus> {
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
    return this.fetchQuota(target, tier);
  }

  invalidate(): void {
    this.cache.clear();
    this.remoteUnavailable = false;
    this.fallback.invalidate();
  }
}
