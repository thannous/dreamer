import { afterEach, describe, expect, it, jest } from '@jest/globals';

type PlatformName = 'android' | 'ios' | 'web';

const loadGuestSessionModule = (platform: PlatformName) => {
  jest.resetModules();

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

  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  });

  it('starts ready on iOS and stays ready when initGuestSession is a no-op', async () => {
    const guestSession = loadGuestSessionModule('ios');

    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
    await expect(guestSession.initGuestSession()).resolves.toBe(false);
    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
  });

  it('starts degraded on web because guest AI is unsupported there', () => {
    const guestSession = loadGuestSessionModule('web');

    expect(guestSession.getGuestBootstrapState()).toMatchObject({
      status: 'degraded',
      reasonCode: 'guest_platform_unsupported',
    });
  });
});
