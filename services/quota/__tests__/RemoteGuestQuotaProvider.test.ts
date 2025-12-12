import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteGuestQuotaProvider } from '../RemoteGuestQuotaProvider';
import type { QuotaStatus } from '@/lib/types';

vi.mock('@/lib/http', () => ({
  fetchJSON: vi.fn(),
}));

vi.mock('@/lib/deviceFingerprint', () => ({
  getDeviceFingerprint: vi.fn().mockResolvedValue('fingerprint'),
}));

vi.mock('@/lib/config', () => ({
  getApiBaseUrl: () => 'https://example.com',
}));

const { fetchJSON } = await import('@/lib/http');
const mockFetchJSON = vi.mocked(fetchJSON);

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
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchJSON.mockReset();
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

    const provider = new RemoteGuestQuotaProvider(fallback as any);

    // When
    const status = await provider.getQuotaStatus(null);

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

    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const initial = await provider.getQuotaStatus(null);
    expect(initial.usage.analysis.used).toBe(1);

    // When local usage drops and caches are invalidated
    fallback.setAnalysisUsed(0);
    provider.invalidate();
    const refreshed = await provider.getQuotaStatus(null);

    // Then refreshed status reflects new fallback counts and calls fallback.invalidate
    expect(refreshed.usage.analysis.used).toBe(0);
    expect(fallback.invalidate).toHaveBeenCalled();
  });
});
