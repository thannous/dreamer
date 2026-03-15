import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { QuotaStatus } from '@/lib/types';

jest.mock('../../../lib/http', () => ({
  fetchJSON: jest.fn(),
}));

jest.mock('../../../lib/deviceFingerprint', () => ({
  getDeviceFingerprint: jest.fn().mockResolvedValue('fingerprint'),
}));

jest.mock('../../../lib/guestSession', () => ({
  getGuestHeaders: jest.fn().mockResolvedValue({}),
  invalidateGuestSession: jest.fn().mockResolvedValue(undefined),
  getGuestBootstrapState: jest.fn().mockReturnValue({ status: 'ready', updatedAt: 0 }),
}));

jest.mock('../../../lib/errors', () => ({
  isGuestSessionError: jest.fn().mockReturnValue(false),
}));

jest.mock('../../../lib/config', () => ({
  getApiBaseUrl: () => 'https://example.com',
}));

jest.mock('../GuestAnalysisCounter', () => ({
  syncWithServerCount: jest.fn(),
}));

let mockFetchJSON: ReturnType<typeof jest.fn>;
let mockSyncWithServerCount: ReturnType<typeof jest.fn>;
let mockGetGuestHeaders: ReturnType<typeof jest.fn>;
let mockInvalidateGuestSession: ReturnType<typeof jest.fn>;
let mockIsGuestSessionError: ReturnType<typeof jest.fn>;
let mockGetGuestBootstrapState: ReturnType<typeof jest.fn>;

const buildUsage = (analysisUsed: number) => ({
  analysis: { used: analysisUsed, limit: 2, remaining: Math.max(2 - analysisUsed, 0) },
  exploration: { used: 0, limit: 2, remaining: 2 },
  messages: { used: 0, limit: 20, remaining: 20 },
});

const createFallback = (initialAnalysisUsed: number) => {
  let analysisUsed = initialAnalysisUsed;

  const getQuotaStatus = jest.fn<() => Promise<QuotaStatus>>(() =>
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
    invalidate: jest.fn(),
  };
};

describe('RemoteGuestQuotaProvider', () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    const { fetchJSON } = require('../../../lib/http');
    mockFetchJSON = jest.mocked(fetchJSON);
    const { syncWithServerCount } = require('../GuestAnalysisCounter');
    mockSyncWithServerCount = jest.mocked(syncWithServerCount);
    const { getGuestHeaders, invalidateGuestSession } = require('../../../lib/guestSession');
    mockGetGuestHeaders = jest.mocked(getGuestHeaders);
    mockInvalidateGuestSession = jest.mocked(invalidateGuestSession);
    mockGetGuestBootstrapState = jest.mocked(require('../../../lib/guestSession').getGuestBootstrapState);
    const { isGuestSessionError } = require('../../../lib/errors');
    mockIsGuestSessionError = jest.mocked(isGuestSessionError);
    mockFetchJSON.mockReset();
    mockSyncWithServerCount.mockResolvedValue(undefined);
    mockGetGuestHeaders.mockReset();
    mockGetGuestHeaders.mockResolvedValue({});
    mockInvalidateGuestSession.mockReset();
    mockInvalidateGuestSession.mockResolvedValue(undefined);
    mockGetGuestBootstrapState.mockReset();
    mockGetGuestBootstrapState.mockReturnValue({ status: 'ready', updatedAt: 0 });
    mockIsGuestSessionError.mockReset();
    mockIsGuestSessionError.mockReturnValue(false);
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

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
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

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
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

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
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

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const status = await provider.getQuotaStatus(null, 'guest');

    expect(status.canAnalyze).toBe(false);
    expect(status.canExplore).toBe(false);
    expect(status.usage.analysis.remaining).toBe(0);
  });

  it('enters degraded mode when endpoint becomes unavailable', async () => {
    const fallback = createFallback(0);
    mockFetchJSON.mockRejectedValueOnce(new Error('HTTP 401'));

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const first = await provider.getQuotaStatus(null, 'guest');
    const second = await provider.getQuotaStatus(null, 'guest');

    expect(first.usage.analysis.used).toBe(0);
    expect(first.canAnalyze).toBe(false);
    expect(first.guestBootstrapStatus).toBe('degraded');
    expect(second.canAnalyze).toBe(false);
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

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const canSend = await provider.canSendChatMessage(undefined, null, 'guest');

    expect(canSend).toBe(true);
    expect(mockSyncWithServerCount).toHaveBeenCalledWith(2, 'analysis');
    expect(mockSyncWithServerCount).toHaveBeenCalledWith(1, 'exploration');
  });

  it('retries once with fresh guest session when guest token is expired', async () => {
    const fallback = createFallback(0);
    const guestSessionError = Object.assign(new Error('HTTP 401 Unauthorized'), {
      status: 401,
      body: {
        error: {
          message: 'missing integrity token',
        },
      },
    });

    mockIsGuestSessionError.mockReturnValue(true);
    mockGetGuestHeaders
      .mockResolvedValueOnce({ 'x-guest-token': 'stale-token' })
      .mockResolvedValueOnce({ 'x-guest-token': 'fresh-token' });
    mockFetchJSON
      .mockRejectedValueOnce(guestSessionError)
      .mockResolvedValueOnce({
        tier: 'guest',
        usage: {
          analysis: { used: 1, limit: 2 },
          exploration: { used: 0, limit: 2 },
          messages: { used: 0, limit: 20 },
        },
        canAnalyze: true,
        canExplore: true,
      });

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const status = await provider.getQuotaStatus(null, 'guest');

    expect(status.usage.analysis.used).toBe(1);
    expect(mockFetchJSON).toHaveBeenCalledTimes(2);
    expect(mockInvalidateGuestSession).toHaveBeenCalledTimes(1);
    expect(mockFetchJSON).toHaveBeenLastCalledWith(
      'https://example.com/quota/status',
      expect.objectContaining({
        headers: { 'x-guest-token': 'fresh-token' },
      })
    );
  });

  it('fails closed when guest bootstrap is already degraded', async () => {
    const fallback = createFallback(1);
    mockGetGuestBootstrapState.mockReturnValue({
      status: 'degraded',
      reasonCode: 'guest_platform_unsupported',
      updatedAt: Date.now(),
    });

    const { RemoteGuestQuotaProvider } = require('../RemoteGuestQuotaProvider');
    const provider = new RemoteGuestQuotaProvider(fallback as any);
    const status = await provider.getQuotaStatus(null, 'guest');

    expect(status.canAnalyze).toBe(false);
    expect(status.canExplore).toBe(false);
    expect(status.guestBootstrapStatus).toBe('degraded');
    expect(status.guestBootstrapReasonCode).toBe('guest_platform_unsupported');
    expect(mockFetchJSON).not.toHaveBeenCalled();
  });
});
