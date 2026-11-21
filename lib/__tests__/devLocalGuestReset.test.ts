import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const calls: string[] = [];
let mockApiBaseUrl = 'http://192.168.1.9:31300/functions/v1/api';
let mockMockMode = false;
let mockPendingDreams = 0;
const mockFetchJSON = jest.fn(async (..._args: unknown[]) => { calls.push('server reset'); return { reset: true }; });

jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => mockApiBaseUrl }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => mockMockMode }));
jest.mock('@/lib/http', () => ({ fetchJSON: (...args: unknown[]) => mockFetchJSON(...args) }));
jest.mock('@/lib/guestSession', () => ({
  getGuestHeaders: async () => {
    calls.push('guest session');
    return { 'x-guest-token': 't', 'x-guest-fingerprint': 'f', 'x-guest-platform': 'ios' };
  },
}));
jest.mock('@/services/quotaService', () => ({
  quotaService: {
    invalidateAll: () => { calls.push('quota caches emptied'); },
    invalidate: (user: unknown) => { calls.push(`guest quota refetched (${String(user)})`); },
  },
}));
jest.mock('@/lib/guestQaLocalState', () => ({
  assertGuestQaLocalStateReady: async () => {
    calls.push('journal checked');
    if (mockPendingDreams) throw Object.assign(new Error('pending'), { code: 'QA_LOCAL_DREAMS_PENDING' });
  },
  prepareGuestQaLocalState: async () => { calls.push('device reset'); },
}));

const load = () => require('../devLocalGuestReset') as typeof import('../devLocalGuestReset');
const backend = () => require('../devLocalBackend') as typeof import('../devLocalBackend');
const globals = globalThis as { __DEV__?: boolean };

describe('« Nouvel invité » on the local development backend', () => {
  const previousDev = globals.__DEV__;
  beforeEach(() => {
    globals.__DEV__ = true;
    calls.length = 0;
    mockFetchJSON.mockClear();
    mockApiBaseUrl = 'http://192.168.1.9:31300/functions/v1/api';
    mockMockMode = false;
    mockPendingDreams = 0;
  });
  afterEach(() => { globals.__DEV__ = previousDev; });

  it('checks the journal, resets the device on the server, then on the phone', async () => {
    await load().startNewLocalGuest();
    // The spent quota is not kept in a cache, and the new guest opens its session before
    // its quota is fetched, as on a first launch.
    expect(calls).toEqual([
      'journal checked', 'guest session', 'server reset', 'device reset', 'quota caches emptied',
      'guest session', 'guest quota refetched (null)',
    ]);
    expect(mockFetchJSON).toHaveBeenCalledWith(
      'http://192.168.1.9:31300/functions/v1/api/dev-local/guest-reset',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-guest-token': 't', 'x-guest-fingerprint': 'f', 'x-guest-platform': 'ios' },
      })
    );
  });

  it('loses no guest dream: a journal that is not empty stops it before the server', async () => {
    mockPendingDreams = 2;
    await expect(load().startNewLocalGuest()).rejects.toMatchObject({ code: 'QA_LOCAL_DREAMS_PENDING' });
    expect(calls).toEqual(['journal checked']);
  });

  it.each([
    ['a release build', () => { globals.__DEV__ = false; }],
    ['the hosted API', () => { mockApiBaseUrl = 'https://abc.functions.supabase.co/api'; }],
    ['mock mode', () => { mockMockMode = true; mockApiBaseUrl = 'http://localhost:3000'; }],
  ])('is not offered and does nothing in %s', async (_case: string, arrange: () => void) => {
    arrange();
    expect(backend().isLocalDevelopmentBackend()).toBe(false);
    await expect(load().startNewLocalGuest()).rejects.toThrow('local development backend');
    expect(calls).toEqual([]);
  });
});
