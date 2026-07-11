import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetAccessToken = jest.fn();
const mockGetGuestHeaders = jest.fn();
const mockInvalidateGuestSession = jest.fn();
const mockFetchJSON = jest.fn();

jest.mock('../auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

jest.mock('../guestSession', () => ({
  getGuestHeaders: (options: unknown) => mockGetGuestHeaders(options),
  invalidateGuestSession: () => mockInvalidateGuestSession(),
}));

jest.mock('../http', () => ({
  fetchJSON: (url: string, options: unknown) => mockFetchJSON(url, options),
}));

const { fetchJSONWithSession } = require('../apiSession') as typeof import('../apiSession');

const invalidGuestSession = () => Object.assign(new Error('HTTP 401 Unauthorized'), {
  status: 401,
  body: { error: 'Invalid guest session' },
});

describe('fetchJSONWithSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue(null);
    mockGetGuestHeaders.mockResolvedValue({
      'x-guest-token': 'guest-token',
      'x-guest-fingerprint': 'guest-fingerprint',
    });
    mockInvalidateGuestSession.mockResolvedValue(undefined);
    mockFetchJSON.mockResolvedValue({ ok: true });
  });

  it('prefers the signed-in user bearer without bootstrapping a guest session', async () => {
    mockGetAccessToken.mockResolvedValueOnce('user-token');

    await fetchJSONWithSession('https://api.example/transcribe', {
      method: 'POST',
      headers: { 'x-request-id': 'request-1' },
      body: { audio: 'base64' },
    });

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer user-token',
          'x-request-id': 'request-1',
        },
      })
    );
    expect(mockGetGuestHeaders).not.toHaveBeenCalled();
  });

  it('uses a verified guest session when no user is signed in', async () => {
    await fetchJSONWithSession('https://api.example/transcribe', { method: 'POST' });

    expect(mockGetGuestHeaders).toHaveBeenCalledWith({ requireSession: true });
    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({
        headers: {
          'x-guest-token': 'guest-token',
          'x-guest-fingerprint': 'guest-fingerprint',
        },
      })
    );
  });

  it('refreshes one expired guest session and retries once', async () => {
    mockGetGuestHeaders
      .mockResolvedValueOnce({ 'x-guest-token': 'stale-token' })
      .mockResolvedValueOnce({ 'x-guest-token': 'fresh-token' });
    mockFetchJSON
      .mockRejectedValueOnce(invalidGuestSession())
      .mockResolvedValueOnce({ transcript: 'recovered' });

    await expect(fetchJSONWithSession('https://api.example/transcribe', { method: 'POST' }))
      .resolves.toEqual({ transcript: 'recovered' });

    expect(mockInvalidateGuestSession).toHaveBeenCalledTimes(1);
    expect(mockFetchJSON).toHaveBeenLastCalledWith(
      'https://api.example/transcribe',
      expect.objectContaining({ headers: { 'x-guest-token': 'fresh-token' } })
    );
  });

  it('fails closed after a second invalid guest session', async () => {
    mockFetchJSON.mockRejectedValue(invalidGuestSession());

    await expect(fetchJSONWithSession('https://api.example/transcribe', { method: 'POST' }))
      .rejects.toMatchObject({
        name: 'GuestSessionError',
        code: 'guest_session_expired',
      });

    expect(mockFetchJSON).toHaveBeenCalledTimes(2);
  });
});
