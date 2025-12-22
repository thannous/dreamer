import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuotaStatus } from '@/lib/types';

vi.mock('../../../lib/http', () => ({
  fetchJSON: vi.fn(),
}));

vi.mock('../../../lib/deviceFingerprint', () => ({
  getDeviceFingerprint: vi.fn().mockResolvedValue('fingerprint'),
}));

vi.mock('../../../lib/guestSession', () => ({
  getGuestHeaders: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../lib/config', () => ({
  getApiBaseUrl: () => 'https://example.com',
}));

vi.mock('../GuestAnalysisCounter', () => ({
  syncWithServerCount: vi.fn(),
}));

let mockFetchJSON: ReturnType<typeof vi.fn>;
let mockSyncWithServerCount: ReturnType<typeof vi.fn>;

const buildUsage = (analysisUsed: number) => ({
  analysis: { used: analysisUsed, limit: 2, remaining: Math.max(2 - analysisUsed, 0) },
  exploration: { used: 0, limit: 2, remaining: 2 },
  messages: { used: 0, limit: 20, remaining: 20 },
});

const createFallback = (initialAnalysisUsed: number) => {
  let analysisUsed = initialAnalysisUsed;

  const getQuotaStatus = vi.fn<() => Promise<QuotaStatus>>(() =>
    Promise.resolve({
      tier: 'guest',
      usage: buildUsage(analysisUsed),
      canAnalyze: analysisUsed < 2,
      canExplore: true,
    })
  );

  return {
    setAnalysisUsed(next: number) {
      analysisUsed = next;
    },
    getQuotaStatus,
    invalidate: vi.fn(),
  };
};

describe('RemoteGuestQuotaProvider', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { fetchJSON } = await import('../../../lib/http');
    mockFetchJSON = vi.mocked(fetchJSON);
    const { syncWithServerCount } = await import('../GuestAnalysisCounter');
    mockSyncWithServerCount = vi.mocked(syncWithServerCount);
    mockFetchJSON.mockReset();
    mockSyncWithServerCount.mockResolvedValue(undefined);
  });

  it('merges local guest usage when remote response does not track counts', async () => {
    // Given remote returns zero usage but fallback reports one analyzed dream
    const fallback = createFallback(1);
    mockFetchJSON.mockResolvedValue({
      tier: 'guest',
      usage: {
        analysis: { used: 0, limit: 2 },
        exploration: { used: 0, limit: 2 },
        messages: { used: 0, limit: 20 },
      },
      canAnalyze: true,
      canExplore: true,
    });

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);

    // When
    const status = await provider.getQuotaStatus(null, 'guest');

    // Then usage should reflect the fallback counts, not the remote zeros
    expect(status.usage.analysis.used).toBe(1);
    expect(status.canAnalyze).toBe(true);
    expect(fallback.getQuotaStatus).toHaveBeenCalled();
  });

  it('invalidates both remote and fallback caches', async () => {
    // Given fallback reports one analysis used initially
    const fallback = createFallback(1);
    mockFetchJSON.mockResolvedValue({
      tier: 'guest',
      usage: {
        analysis: { used: 0, limit: 2 },
        exploration: { used: 0, limit: 2 },
        messages: { used: 0, limit: 20 },
      },
    });

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const initial = await provider.getQuotaStatus(null, 'guest');
    expect(initial.usage.analysis.used).toBe(1);

    // When local usage drops and caches are invalidated
    fallback.setAnalysisUsed(0);
    provider.invalidate();
    const refreshed = await provider.getQuotaStatus(null, 'guest');

    // Then refreshed status reflects new fallback counts and calls fallback.invalidate
    expect(refreshed.usage.analysis.used).toBe(0);
    expect(fallback.invalidate).toHaveBeenCalled();
  }, 10_000);

  it('blocks guest access when remote marks fingerprint as upgraded', async () => {
    const fallback = createFallback(0);
    mockFetchJSON.mockResolvedValue({
      tier: 'guest',
      isUpgraded: true,
      usage: {
        analysis: { used: 1, limit: 2 },
        exploration: { used: 1, limit: 2 },
        messages: { used: 1, limit: 5 },
      },
    });

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const status = await provider.getQuotaStatus(null, 'guest');

    expect(status.isUpgraded).toBe(true);
    expect(status.canAnalyze).toBe(false);
    expect(status.canExplore).toBe(false);
    expect(status.reasons?.length).toBeGreaterThan(0);
  });

  it('respects remote flags and usage limits', async () => {
    const fallback = createFallback(0);
    mockFetchJSON.mockResolvedValue({
      tier: 'guest',
      canAnalyze: false,
      canExplore: false,
      usage: {
        analysis: { used: 2, limit: 2 },
        exploration: { used: 2, limit: 2 },
        messages: { used: 1, limit: 1 },
      },
    });

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const status = await provider.getQuotaStatus(null, 'guest');

    expect(status.canAnalyze).toBe(false);
    expect(status.canExplore).toBe(false);
    expect(status.usage.analysis.remaining).toBe(0);
  });

  it('avoids re-fetching when endpoint becomes unavailable', async () => {
    const fallback = createFallback(0);
    mockFetchJSON.mockRejectedValueOnce(new Error('HTTP 401'));

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const first = await provider.getQuotaStatus(null, 'guest');
    const second = await provider.getQuotaStatus(null, 'guest');

    expect(first.usage.analysis.used).toBe(0);
    expect(second.usage.analysis.used).toBe(0);
    expect(mockFetchJSON).toHaveBeenCalledTimes(1);
  });

  it('syncs server counts and allows unlimited messages', async () => {
    const fallback = createFallback(0);
    mockFetchJSON.mockResolvedValue({
      tier: 'guest',
      usage: {
        analysis: { used: 2, limit: 2 },
        exploration: { used: 1, limit: 2 },
        messages: { used: 4, limit: null },
      },
    });

    const { RemoteGuestQuotaProvider } = await import('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const canSend = await provider.canSendChatMessage(undefined, null, 'guest');

    expect(canSend).toBe(true);
    expect(mockSyncWithServerCount).toHaveBeenCalledWith(2, 'analysis');
    expect(mockSyncWithServerCount).toHaveBeenCalledWith(1, 'exploration');
  });
});
