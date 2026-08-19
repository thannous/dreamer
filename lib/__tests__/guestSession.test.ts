import { afterEach, describe, expect, it, jest } from '@jest/globals';

type PlatformName = 'android' | 'ios' | 'web';

let mockTurnstileSiteKey: string | null = null;
const mockGetTurnstileToken = jest.fn(async (): Promise<string | null> => null);

const loadGuestSessionModule = (platform: PlatformName) => {
  jest.resetModules();

  jest.doMock('@/lib/turnstileWeb', () => ({
    isWebGuestSessionAvailable: () => platform === 'web' && mockTurnstileSiteKey !== null,
    getTurnstileToken: () => mockGetTurnstileToken(),
  }));

  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
  }));
  jest.doMock('@expo/app-integrity', () => ({
    prepareIntegrityTokenProviderAsync: jest.fn(),
    requestIntegrityCheckAsync: jest.fn(),
  }));
  jest.doMock('@/lib/http', () => ({
    fetchJSON: jest.fn(),
  }));
  jest.doMock('@/lib/config', () => ({
    getApiBaseUrl: () => 'https://example.com',
  }));
  jest.doMock('@/lib/deviceFingerprint', () => ({
    getDeviceFingerprint: jest.fn().mockResolvedValue('fingerprint'),
  }));
  jest.doMock('@/lib/auth', () => ({
    getAccessToken: jest.fn().mockResolvedValue(null),
  }));
  jest.doMock('@/lib/env', () => ({
    getExpoPublicEnvValue: jest.fn(),
  }));
  jest.doMock('@/lib/logger', () => ({
    logger: {
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }));

  return require('../guestSession') as typeof import('../guestSession');
};

describe('guestSession bootstrap state', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('react-native');
    jest.unmock('@expo/app-integrity');
    jest.unmock('@/lib/http');
    jest.unmock('@/lib/config');
    jest.unmock('@/lib/deviceFingerprint');
    jest.unmock('@/lib/auth');
    jest.unmock('@/lib/env');
    jest.unmock('@/lib/logger');
    jest.unmock('@/lib/turnstileWeb');
    mockTurnstileSiteKey = null;
    mockGetTurnstileToken.mockReset();
  });

  it('starts ready on iOS and stays ready when initGuestSession is a no-op', async () => {
    const guestSession = loadGuestSessionModule('ios');

    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
    await expect(guestSession.initGuestSession()).resolves.toBe(false);
    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
  });

  it('starts degraded on web when no Turnstile site key is configured', () => {
    const guestSession = loadGuestSessionModule('web');

    expect(guestSession.getGuestBootstrapState()).toMatchObject({
      status: 'degraded',
      reasonCode: 'guest_platform_unsupported',
    });
  });

  it('requests a web guest session with a Turnstile token when configured', async () => {
    mockTurnstileSiteKey = 'site-key';
    mockGetTurnstileToken.mockResolvedValue('turnstile-token');
    const guestSession = loadGuestSessionModule('web');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    fetchJSON.mockResolvedValue({
      token: 'web-guest-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
    const headers = await guestSession.getGuestHeaders({ requireSession: true });

    expect(headers).toEqual({
      'x-guest-token': 'web-guest-token',
      'x-guest-fingerprint': 'fingerprint',
      'x-guest-platform': 'web',
    });
    expect(fetchJSON).toHaveBeenCalledWith(
      'https://example.com/guest/session',
      expect.objectContaining({
        method: 'POST',
        body: { fingerprint: 'fingerprint', platform: 'web', turnstileToken: 'turnstile-token' },
      })
    );
  });

  it('degrades on web when the Turnstile challenge yields no token', async () => {
    mockTurnstileSiteKey = 'site-key';
    mockGetTurnstileToken.mockResolvedValue(null);
    const guestSession = loadGuestSessionModule('web');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });

    expect(fetchJSON).not.toHaveBeenCalled();
    expect(guestSession.getGuestBootstrapState()).toMatchObject({ status: 'degraded', reasonCode: 'guest_session_unavailable' });
  });

  it('requests an iOS guest session without an integrity token and succeeds', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    fetchJSON.mockResolvedValue({
      token: 'ios-guest-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const headers = await guestSession.getGuestHeaders({ requireSession: true });

    expect(headers).toEqual({
      'x-guest-token': 'ios-guest-token',
      'x-guest-fingerprint': 'fingerprint',
      'x-guest-platform': 'ios',
    });
    expect(fetchJSON).toHaveBeenCalledWith(
      'https://example.com/guest/session',
      expect.objectContaining({
        method: 'POST',
        body: {
          fingerprint: 'fingerprint',
          platform: 'ios',
        },
      })
    );
    const sessionBody = fetchJSON.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    expect(sessionBody).not.toHaveProperty('integrityToken');
    expect(sessionBody).not.toHaveProperty('requestHash');
    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
  });
});
