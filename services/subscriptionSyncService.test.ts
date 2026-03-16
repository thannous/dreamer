import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const { mockFetchJSON } = ((factory: any) => factory())(() => ({
  mockFetchJSON: jest.fn(),
}));

jest.mock('../lib/config', () => ({
  getApiBaseUrl: () => 'https://api.dreamer.test',
}));

jest.mock('../lib/http', () => ({
  fetchJSON: mockFetchJSON,
}));

const { syncSubscriptionFromServer } = require('./subscriptionSyncService');


describe('subscriptionSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the subscription sync endpoint with POST', async () => {
    mockFetchJSON.mockResolvedValue({ ok: true, tier: 'free', isActive: false, version: 3, changed: false });

    const result = await syncSubscriptionFromServer('app_launch');

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.dreamer.test/subscription/refresh',
      expect.objectContaining({
        method: 'POST',
        body: { source: 'app_launch' },
        timeoutMs: 10000,
        retries: 1,
      })
    );
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('free');
    expect(result.version).toBe(3);
  });
});
