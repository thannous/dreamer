import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncSubscriptionFromServer } from './subscriptionSyncService';

const { mockFetchJSON } = vi.hoisted(() => ({
  mockFetchJSON: vi.fn(),
}));

vi.mock('../lib/config', () => ({
  getApiBaseUrl: () => 'https://api.dreamer.test',
}));

vi.mock('../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));


describe('subscriptionSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the subscription sync endpoint with POST', async () => {
    mockFetchJSON.mockResolvedValue({ ok: true, tier: 'free' });

    const result = await syncSubscriptionFromServer('app_launch');

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.dreamer.test/subscription/sync',
      expect.objectContaining({
        method: 'POST',
        body: { source: 'app_launch' },
        timeoutMs: 10000,
        retries: 1,
      })
    );
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('free');
  });
});
