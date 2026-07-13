import * as AppIntegrity from '@expo/app-integrity';
import { Platform } from 'react-native';

import { getAccessToken } from '@/lib/auth';
import { fetchJSON } from '@/lib/http';
import {
  fetchProductAnalyticsJSON,
  getProductAnalyticsAuthHeaders,
  resetProductAnalyticsGuestSessionForTesting,
} from '@/lib/productAnalyticsGuestSession';

jest.mock('@expo/app-integrity', () => ({
  prepareIntegrityTokenProviderAsync: jest.fn(),
  requestIntegrityCheckAsync: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  getAccessToken: jest.fn(),
}));

jest.mock('@/lib/http', () => ({
  fetchJSON: jest.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status = 500) {
      super(`HTTP ${status}`);
      this.status = status;
    }
  },
}));

jest.mock('@/lib/config', () => ({
  getApiBaseUrl: () => 'https://example.test/api',
}));

const mockAccessToken = jest.mocked(getAccessToken);
const mockFetch = jest.mocked(fetchJSON);

describe('product analytics guest session', () => {
  const originalPlatform = Platform.OS;
  const originalCloudProject = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;

  beforeEach(async () => {
    Platform.OS = 'android';
    process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER = '123456789';
    mockAccessToken.mockReset().mockResolvedValue(null);
    mockFetch.mockReset();
    jest.mocked(AppIntegrity.prepareIntegrityTokenProviderAsync).mockReset().mockResolvedValue();
    jest.mocked(AppIntegrity.requestIntegrityCheckAsync).mockReset().mockResolvedValue('integrity-proof-token');
    await resetProductAnalyticsGuestSessionForTesting();
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    if (originalCloudProject === undefined) {
      delete process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
    } else {
      process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER = originalCloudProject;
    }
  });

  it('uses the authenticated Supabase bearer without creating a guest session', async () => {
    mockAccessToken.mockResolvedValue('user-access-token');

    await expect(getProductAnalyticsAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer user-access-token',
    });
    expect(AppIntegrity.requestIntegrityCheckAsync).not.toHaveBeenCalled();
  });

  it('creates a dedicated Play Integrity session without quota fingerprint fields', async () => {
    mockFetch.mockResolvedValueOnce({
      token: 'analytics-session-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const headers = await getProductAnalyticsAuthHeaders();

    expect(headers).toEqual({ 'x-analytics-guest-token': 'analytics-session-token' });
    const sessionCall = mockFetch.mock.calls[0];
    if (!sessionCall) throw new Error('Expected analytics session request');
    const sessionOptions = sessionCall[1];
    if (!sessionOptions) throw new Error('Expected analytics session request options');
    expect(sessionOptions.body).toEqual(expect.objectContaining({
      integrityToken: 'integrity-proof-token',
      platform: 'android',
    }));
    expect(Object.keys(sessionOptions.body as Record<string, unknown>)).toEqual([
      'requestHash',
      'integrityToken',
      'platform',
    ]);
    expect(JSON.stringify(headers)).not.toMatch(/x-guest|fingerprint|device[_-]?id/i);
  });

  it('sends analytics with only the dedicated guest token header', async () => {
    mockFetch
      .mockResolvedValueOnce({
        token: 'analytics-session-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .mockResolvedValueOnce({ accepted_event_ids: [] });

    await fetchProductAnalyticsJSON('https://example.test/api/analytics/events', {
      method: 'POST',
      body: { events: [] },
    });

    const eventCall = mockFetch.mock.calls[1];
    if (!eventCall) throw new Error('Expected analytics event request');
    const eventOptions = eventCall[1];
    if (!eventOptions) throw new Error('Expected analytics event request options');
    const requestHeaders = eventOptions.headers;
    expect(requestHeaders).toEqual({ 'x-analytics-guest-token': 'analytics-session-token' });
    expect(JSON.stringify(requestHeaders)).not.toMatch(/x-guest|fingerprint|device[_-]?id/i);
  });
});
