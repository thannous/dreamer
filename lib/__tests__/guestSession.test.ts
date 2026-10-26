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
    isSupported: true,
    generateKeyAsync: jest.fn(async () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),
    attestKeyAsync: jest.fn(async () => 'apple-attestation'),
    generateAssertionAsync: jest.fn(async () => 'apple-assertion'),
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
    getExistingDeviceFingerprint: jest.fn().mockResolvedValue('fingerprint'),
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
    jest.restoreAllMocks();
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

  it('resolves guest media ownership locally without bootstrapping a session', async () => {
    const guestSession = loadGuestSessionModule('android');
    const secureStore = require('expo-secure-store');
    secureStore.getItemAsync.mockResolvedValue(null);
    await expect(guestSession.getGuestMediaOwner()).resolves.toBe('guest_fingerprint');
    expect(require('@/lib/http').fetchJSON).not.toHaveBeenCalled();
    expect(require('@/lib/deviceFingerprint').getDeviceFingerprint).not.toHaveBeenCalled();
    secureStore.getItemAsync.mockRejectedValueOnce(new Error('unavailable'));
    await expect(guestSession.getGuestMediaOwner()).resolves.toBe('guest_fingerprint');
  });

  it('does not create a fingerprint or session when local media identity is absent', async () => {
    const guestSession = loadGuestSessionModule('android');
    const device = require('@/lib/deviceFingerprint');
    device.getExistingDeviceFingerprint.mockResolvedValue(null);
    await expect(guestSession.getGuestMediaOwner()).resolves.toBeNull();
    expect(device.getDeviceFingerprint).not.toHaveBeenCalled();
    expect(require('@/lib/http').fetchJSON).not.toHaveBeenCalled();
  });

  it('uses the locally stored QA ownership only for the current fingerprint', async () => {
    const guestSession = loadGuestSessionModule('android');
    const secureStore = require('expo-secure-store');
    const quotaSubject = 'qa:11111111-1111-4111-8111-111111111111';
    const record = { fingerprint: 'fingerprint', expiresAt: new Date(0).toISOString(), token: `h.${btoa(JSON.stringify({ quotaSubject }))}.s` };
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify(record));
    await expect(guestSession.getGuestMediaOwner()).resolves.toBe(`guest_${quotaSubject}`);
    secureStore.getItemAsync.mockResolvedValue(JSON.stringify({ ...record, fingerprint: 'other' }));
    await expect(guestSession.getGuestMediaOwner()).resolves.toBe('guest_fingerprint');
    expect(require('@/lib/http').fetchJSON).not.toHaveBeenCalled();
  });

  it('starts ready on supported iOS and prepares App Attest', async () => {
    const guestSession = loadGuestSessionModule('ios');

    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
    await expect(guestSession.initGuestSession()).resolves.toBe(true);
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

  it('attests an iOS key before requesting a guest session', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const secureStore = require('expo-secure-store');
    const preAttestToken = JSON.stringify({
      fingerprint: 'fingerprint',
      token: 'legacy-ios-guest-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    secureStore.getItemAsync.mockImplementation(async (key: string) =>
      key === 'guest-session-v1' ? preAttestToken : null
    );
    fetchJSON.mockResolvedValueOnce({
      challengeId: '11111111-1111-4111-8111-111111111111',
      challenge: 'fresh-server-challenge',
      kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      token: 'ios-guest-token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const headers = await guestSession.getGuestHeaders({ requireSession: true });

    expect(headers).toEqual({
      'x-guest-token': 'ios-guest-token',
      'x-guest-fingerprint': 'fingerprint',
      'x-guest-platform': 'ios',
    });
    expect(secureStore.getItemAsync).toHaveBeenCalledWith('guest-session-v3');
    expect(secureStore.getItemAsync).not.toHaveBeenCalledWith('guest-session-v2');
    expect(secureStore.getItemAsync).not.toHaveBeenCalledWith('guest-session-v1');
    expect(fetchJSON).toHaveBeenNthCalledWith(1,
      'https://example.com/guest/session/challenge',
      expect.objectContaining({
        method: 'POST',
        body: { fingerprint: 'fingerprint', keyId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
      })
    );
    expect(require('@expo/app-integrity').attestKeyAsync).toHaveBeenCalledWith(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'fresh-server-challenge'
    );
    expect(fetchJSON).toHaveBeenNthCalledWith(2,
      'https://example.com/guest/session',
      expect.objectContaining({
        method: 'POST',
        body: {
          fingerprint: 'fingerprint',
          platform: 'ios',
          keyId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          challengeId: '11111111-1111-4111-8111-111111111111',
          attestationObject: 'apple-attestation',
        },
      })
    );
    const sessionBody = fetchJSON.mock.calls[1]?.[1]?.body as Record<string, unknown>;
    expect(sessionBody).not.toHaveProperty('integrityToken');
    expect(sessionBody).not.toHaveProperty('requestHash');
    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
  });

  it('uses an assertion for a previously attested iOS key', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const secureStore = require('expo-secure-store');
    secureStore.getItemAsync.mockImplementation(async (key: string) =>
      key === 'guest-app-attest-key-v1' ? 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' : null
    );
    fetchJSON.mockResolvedValueOnce({
      challengeId: '22222222-2222-4222-8222-222222222222',
      challenge: 'fresh-assertion-challenge',
      kind: 'assertion',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      token: 'ios-guest-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'ios-guest-token',
    });
    expect(require('@expo/app-integrity').generateAssertionAsync).toHaveBeenCalledWith(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'fresh-assertion-challenge'
    );
    const body = fetchJSON.mock.calls[1]?.[1]?.body as Record<string, unknown>;
    expect(body).toMatchObject({
      platform: 'ios', assertionObject: 'apple-assertion',
      challengeId: '22222222-2222-4222-8222-222222222222',
    });
    expect(body).not.toHaveProperty('attestationObject');
  });

  it('retries an unavailable Apple attestation with the same key and challenge', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>();
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    const challenge = {
      challengeId: 'signed-challenge',
      challenge: 'stable-client-data',
      kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    };
    fetchJSON.mockResolvedValueOnce(challenge).mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    integrity.attestKeyAsync.mockRejectedValueOnce(Object.assign(
      new Error('Apple server temporarily unavailable'),
      { code: 'ERR_APP_INTEGRITY_SERVER_UNAVAILABLE' }
    ));

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalledWith('guest-app-attest-key-v1');

    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(fetchJSON).toHaveBeenCalledTimes(2);
    expect(fetchJSON.mock.calls[1]?.[0]).toBe('https://example.com/guest/session');
    expect(integrity.generateKeyAsync).toHaveBeenCalledTimes(1);
    expect(integrity.attestKeyAsync).toHaveBeenCalledTimes(2);
    expect(integrity.attestKeyAsync.mock.calls[0]).toEqual(integrity.attestKeyAsync.mock.calls[1]);
    expect(fetchJSON.mock.calls[1]?.[1]?.body).toMatchObject({
      keyId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      challengeId: 'signed-challenge',
      attestationObject: 'apple-attestation',
    });
  });

  it('restores the same attestation challenge after an app restart within its validity window', async () => {
    const values = new Map<string, string>();
    const configureStore = () => {
      const secureStore = require('expo-secure-store');
      secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
      secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
      secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    };
    const first = loadGuestSessionModule('ios');
    configureStore();
    const firstHttp = require('@/lib/http');
    const firstIntegrity = require('@expo/app-integrity');
    firstHttp.fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'stable-client-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });
    firstIntegrity.attestKeyAsync.mockRejectedValueOnce(Object.assign(
      new Error('Apple server temporarily unavailable'),
      { code: 'ERR_APP_INTEGRITY_SERVER_UNAVAILABLE' }
    ));
    await expect(first.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(values.has('guest-app-attest-retry-v1')).toBe(true);

    const restored = loadGuestSessionModule('ios');
    configureStore();
    const restoredHttp = require('@/lib/http');
    const restoredIntegrity = require('@expo/app-integrity');
    restoredHttp.fetchJSON.mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(restored.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(restoredIntegrity.generateKeyAsync).not.toHaveBeenCalled();
    expect(restoredIntegrity.attestKeyAsync).toHaveBeenCalledWith(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', 'stable-client-data'
    );
    expect(restoredHttp.fetchJSON).toHaveBeenCalledTimes(1);
    expect(restoredHttp.fetchJSON.mock.calls[0]?.[0]).toBe('https://example.com/guest/session');
    expect(values.has('guest-app-attest-retry-v1')).toBe(false);
  });

  it('replays the same attestation object after an ambiguous session POST failure', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>();
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'stable-client-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockRejectedValueOnce(new Error('Connection lost after submit')).mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(values.has('guest-app-attest-retry-v1')).toBe(true);
    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(integrity.attestKeyAsync).toHaveBeenCalledTimes(1);
    expect(fetchJSON.mock.calls.map(([url]: [string]) => url)).toEqual([
      'https://example.com/guest/session/challenge',
      'https://example.com/guest/session',
      'https://example.com/guest/session',
    ]);
    expect(fetchJSON.mock.calls[1]?.[1]?.body).toEqual(fetchJSON.mock.calls[2]?.[1]?.body);
    expect(fetchJSON.mock.calls[1]?.[1]?.retries).toBe(0);
    expect(fetchJSON.mock.calls[2]?.[1]?.retries).toBe(0);
    expect(values.has('guest-app-attest-retry-v1')).toBe(false);
  });

  it('rotates an attestation key after the server definitively rejects its proof', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const secureStore = require('expo-secure-store');
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'client-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockRejectedValueOnce(Object.assign(new Error('HTTP 401'), { status: 401 }));

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('guest-app-attest-key-v1');
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('guest-app-attest-retry-v1');
    expect(fetchJSON).toHaveBeenCalledTimes(2);
  });

  it('waits before attesting a new key after a server refusal, then resumes', async () => {
    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>();
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    const attestationChallenge = () => ({
      challengeId: 'signed-challenge', challenge: 'client-data', kind: 'attestation',
      expiresAt: new Date(now + 180_000).toISOString(),
    });
    const refusal = () => Object.assign(new Error('HTTP 401'), { status: 401 });
    const pause = () => JSON.parse(values.get('guest-app-attest-pause-v1') ?? 'null');

    fetchJSON.mockResolvedValueOnce(attestationChallenge()).mockRejectedValueOnce(refusal());
    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(pause()).toEqual({ until: now + 60 * 60_000, delayMs: 60 * 60_000 });

    // Inside the pause, no new key, no Apple call, no request.
    now += 30 * 60_000;
    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(integrity.generateKeyAsync).toHaveBeenCalledTimes(1);
    expect(integrity.attestKeyAsync).toHaveBeenCalledTimes(1);
    expect(fetchJSON).toHaveBeenCalledTimes(2);

    // A second refusal doubles the pause.
    now += 31 * 60_000;
    fetchJSON.mockResolvedValueOnce(attestationChallenge()).mockRejectedValueOnce(refusal());
    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(pause()).toEqual({ until: now + 2 * 60 * 60_000, delayMs: 2 * 60 * 60_000 });

    // After it, an accepted attestation clears the pause.
    now += 2 * 60 * 60_000 + 1;
    fetchJSON.mockResolvedValueOnce(attestationChallenge()).mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(now + 60_000).toISOString(),
    });
    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(integrity.generateKeyAsync).toHaveBeenCalledTimes(3);
    expect(values.has('guest-app-attest-pause-v1')).toBe(false);
  });

  it('keeps asserting with an attested key while new attestations are paused', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>([
      ['guest-app-attest-key-v1', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='],
      ['guest-app-attest-pause-v1', JSON.stringify({ until: Date.now() + 60_000, delayMs: 60 * 60_000 })],
    ]);
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'assertion-data', kind: 'assertion',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      token: 'asserted-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'asserted-token',
    });
  });

  it('starts over once with a new key when the stored key was lost by a reinstall or restore', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>([['guest-app-attest-key-v1', 'restored-key']]);
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    integrity.generateAssertionAsync.mockRejectedValueOnce(Object.assign(
      new Error('Invalid key provided'), { code: 'ERR_APP_INTEGRITY_INVALID_KEY' }
    ));
    integrity.generateKeyAsync.mockResolvedValueOnce('new-key');
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'assertion-challenge', challenge: 'assertion-data', kind: 'assertion',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      challengeId: 'attestation-challenge', challenge: 'attestation-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(integrity.attestKeyAsync).toHaveBeenCalledWith('new-key', 'attestation-data');
    expect(fetchJSON.mock.calls.map(([url, options]: [string, { body: { keyId?: string } }]) =>
      [url, options.body.keyId])).toEqual([
      ['https://example.com/guest/session/challenge', 'restored-key'],
      ['https://example.com/guest/session/challenge', 'new-key'],
      ['https://example.com/guest/session', 'new-key'],
    ]);
    expect(values.get('guest-app-attest-key-v1')).toBe('new-key');
    expect(guestSession.getGuestBootstrapState().status).toBe('ready');
  });

  it('starts over only once per bootstrap after an invalid key', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const invalidKey = () => Object.assign(
      new Error('Invalid key provided'), { code: 'ERR_APP_INTEGRITY_INVALID_KEY' }
    );
    integrity.attestKeyAsync.mockRejectedValueOnce(invalidKey()).mockRejectedValueOnce(invalidKey());
    fetchJSON.mockResolvedValue({
      challengeId: 'signed-challenge', challenge: 'client-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(integrity.attestKeyAsync).toHaveBeenCalledTimes(2);
    expect(fetchJSON).toHaveBeenCalledTimes(2);
  });

  it('discards the key after a non-retryable Apple attestation error', async () => {
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'client-data', kind: 'attestation',
      expiresAt: new Date(Date.now() + 180_000).toISOString(),
    });
    integrity.attestKeyAsync.mockRejectedValueOnce(Object.assign(
      new Error('Invalid input'), { code: 'ERR_APP_INTEGRITY_INVALID_INPUT' }
    ));

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('guest-app-attest-key-v1');
    expect(secureStore.setItemAsync).not.toHaveBeenCalledWith(
      'guest-app-attest-retry-v1', expect.anything()
    );
  });

  it('discards an expired retry instead of submitting it or changing the hash on the same key', async () => {
    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    const values = new Map<string, string>();
    secureStore.getItemAsync.mockImplementation(async (key: string) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key: string) => { values.delete(key); });
    integrity.generateKeyAsync.mockResolvedValueOnce('first-key').mockResolvedValueOnce('second-key');
    integrity.attestKeyAsync.mockRejectedValueOnce(Object.assign(
      new Error('Apple server temporarily unavailable'),
      { code: 'ERR_APP_INTEGRITY_SERVER_UNAVAILABLE' }
    ));
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'first-signed-challenge', challenge: 'first-hash-input', kind: 'attestation',
      expiresAt: new Date(now + 180_000).toISOString(),
    }).mockResolvedValueOnce({
      challengeId: 'second-signed-challenge', challenge: 'second-hash-input', kind: 'attestation',
      expiresAt: new Date(now + 330_000).toISOString(),
    }).mockResolvedValueOnce({
      token: 'attested-token', expiresAt: new Date(now + 300_000).toISOString(),
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(values.has('guest-app-attest-retry-v1')).toBe(true);
    now += 130_000;
    await expect(guestSession.getGuestHeaders({ requireSession: true })).resolves.toMatchObject({
      'x-guest-token': 'attested-token',
    });
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('guest-app-attest-key-v1');
    expect(integrity.generateKeyAsync).toHaveBeenCalledTimes(2);
    expect(integrity.attestKeyAsync.mock.calls).toEqual([
      ['first-key', 'first-hash-input'], ['second-key', 'second-hash-input'],
    ]);
    expect(fetchJSON.mock.calls.map(([url]: [string]) => url)).toEqual([
      'https://example.com/guest/session/challenge',
      'https://example.com/guest/session/challenge',
      'https://example.com/guest/session',
    ]);
    expect(values.has('guest-app-attest-retry-v1')).toBe(false);
  });

  it('does not submit an attestation when its signed challenge expires during the Apple call', async () => {
    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const guestSession = loadGuestSessionModule('ios');
    const { fetchJSON } = require('@/lib/http') as { fetchJSON: jest.Mock };
    const integrity = require('@expo/app-integrity');
    const secureStore = require('expo-secure-store');
    fetchJSON.mockResolvedValueOnce({
      challengeId: 'signed-challenge', challenge: 'client-data', kind: 'attestation',
      expiresAt: new Date(now + 180_000).toISOString(),
    });
    integrity.attestKeyAsync.mockImplementationOnce(async () => {
      now += 125_000;
      return 'late-attestation';
    });

    await expect(guestSession.getGuestHeaders({ requireSession: true })).rejects.toMatchObject({
      code: 'guest_session_unavailable',
    });
    expect(fetchJSON).toHaveBeenCalledTimes(1);
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('guest-app-attest-key-v1');
  });
});
