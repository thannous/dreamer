import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const secureStoreData = new Map<string, string>();

const mockSecureStore = {
  getItemAsync: jest.fn(async (key: string) => secureStoreData.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreData.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    secureStoreData.delete(key);
  }),
  isAvailableAsync: jest.fn(async () => true),
};

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  getItemAsync: mockSecureStore.getItemAsync,
  setItemAsync: mockSecureStore.setItemAsync,
  deleteItemAsync: mockSecureStore.deleteItemAsync,
  isAvailableAsync: mockSecureStore.isAvailableAsync,
}));

const mockExchangeCodeForSession = jest.fn(async () => ({ data: { session: null }, error: null }));
const mockCreateClient = jest.fn((url: string, key: string, options: any) => ({
  __options: options,
  auth: { exchangeCodeForSession: mockExchangeCodeForSession },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('supabase client without configuration', () => {
  it('points at an unresolvable placeholder, never a guessed local port', () => {
    jest.resetModules();
    mockCreateClient.mockClear();
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { isSupabaseConfigured } = require('../supabase');
      expect(isSupabaseConfigured).toBe(false);
      const url = mockCreateClient.mock.calls[0]?.[0] as string;
      expect(url).toBe('http://supabase-not-configured.invalid');
      expect(url).not.toMatch(/localhost|127\.0\.0\.1|:5432\d/);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('supabase secure storage adapter', () => {
  beforeEach(() => {
    jest.resetModules();
    secureStoreData.clear();
    mockCreateClient.mockClear();
    mockExchangeCodeForSession.mockClear();
    Object.values(mockSecureStore).forEach((fn) => fn.mockClear());
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('stores small values directly', async () => {
    const { supabase, isSupabaseConfigured } = require('../supabase');

    expect(isSupabaseConfigured).toBe(true);

    const storage = (supabase as any).__options.auth.storage;
    await storage.setItem('session', 'small');

    expect(secureStoreData.get('session')).toBe('small');
    expect(await storage.getItem('session')).toBe('small');
  });

  it('chunks and reassembles large values', async () => {
    const { supabase } = require('../supabase');
    const storage = (supabase as any).__options.auth.storage;

    secureStoreData.set('session', '__dreamer_chunked_v1__:chunk-id:2');
    secureStoreData.set('session.__chunk_chunk-id_0', 'alpha');
    secureStoreData.set('session.__chunk_chunk-id_1', 'beta');

    await expect(storage.getItem('session')).resolves.toBe('alphabeta');
  });

  it('writes chunked values and clears on remove', async () => {
    const { supabase } = require('../supabase');
    const storage = (supabase as any).__options.auth.storage;

    const large = 'y'.repeat(2500);
    await storage.setItem('token', large);

    const chunkedWrites = mockSecureStore.setItemAsync.mock.calls.filter(
      ([key]: [unknown, ...unknown[]]) => typeof key === 'string' && key.startsWith('token.__chunk_')
    );
    expect(chunkedWrites.length).toBeGreaterThan(0);

    await storage.removeItem('token');
    expect(secureStoreData.has('token')).toBe(false);
  });

  it('uses explicit PKCE exchange on web and declines automatic URL sessions', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: { OS: 'web' },
    }));

    const { supabase } = require('../supabase');

    const auth = (supabase as any).__options.auth;
    expect(auth.flowType).toBe('pkce');
    expect(auth.detectSessionInUrl).toBe(false);
    expect(auth.storage).toBeUndefined();
  });

  const loadWebAt = (href: string) => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    const replaceState = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { href }, history: { state: null, replaceState } },
    });
    return { module: require('../supabase') as typeof import('../supabase'), replaceState };
  };

  it.each([
    'https://dream.noctalia.app/recording#access_token=attacker-access&refresh_token=attacker-refresh&token_type=bearer',
    'https://dream.noctalia.app/recording?access_token=attacker-access&refresh_token=attacker-refresh&token_type=bearer',
    'https://dream.noctalia.app/recording#provider_token=provider-secret',
  ])('quarantines an unbound bearer-token URL without making a session: %s', (href: string) => {
    const { module, replaceState } = loadWebAt(href);

    expect(module.getWebRecoveryLinkState()).toBe('none');
    expect(module.getPendingWebRecoveryTokens()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/recording');
    expect((module.supabase as any).__options.auth.detectSessionInUrl).toBe(false);
  });

  it('holds a native-initiated recovery link in memory while removing its URL credentials', () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?lang=fr#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery&expires_in=3600'
    );

    expect(module.getWebRecoveryLinkState()).toBe('pending');
    expect(module.getPendingWebRecoveryTokens()).toEqual({
      accessToken: 'recovery-access', refreshToken: 'recovery-refresh',
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password?lang=fr');
    module.clearPendingWebRecoveryTokens();
    expect(module.getPendingWebRecoveryTokens()).toBeNull();
  });

  it('rejects ambiguous recovery tokens without leaving them in the URL', () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?access_token=query&refresh_token=query-refresh#access_token=fragment&refresh_token=fragment-refresh&type=recovery'
    );

    expect(module.getWebRecoveryLinkState()).toBe('invalid');
    expect(module.getPendingWebRecoveryTokens()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password');
  });

  it('exchanges a code without SDK auto-detection or leaving it in the URL', async () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/recording?code=pkce-code&lang=fr'
    );

    await module.webAuthCallbackPromise;
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/recording?lang=fr');
    expect((module.supabase as any).__options.auth.detectSessionInUrl).toBe(false);
  });
});
