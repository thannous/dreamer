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
const mockRecoveryExchangeCodeForSession = jest.fn();
const mockRecoveryUpdateUser = jest.fn();
const mockSignOut = jest.fn(async () => ({ error: null }));
const mockCreateClient = jest.fn((url: string, key: string, options: any) => options.auth.storageKey?.startsWith('noctalia-recovery-pkce-')
  ? { __options: options, auth: {
    exchangeCodeForSession: mockRecoveryExchangeCodeForSession,
    updateUser: mockRecoveryUpdateUser,
  } }
  : { __options: options, auth: {
    exchangeCodeForSession: mockExchangeCodeForSession,
    signOut: mockSignOut,
  } });

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
    mockRecoveryExchangeCodeForSession.mockReset();
    mockRecoveryUpdateUser.mockReset();
    mockSignOut.mockClear();
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

  const loadWebAt = (href: string, verifier: string | null = null) => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    const replaceState = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: { href },
        history: { state: null, replaceState },
        localStorage: { getItem: jest.fn(() => verifier), removeItem: jest.fn() },
      },
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
    expect(module.getPendingWebRecoveryTokenHash()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/recording');
    expect((module.supabase as any).__options.auth.detectSessionInUrl).toBe(false);
  });

  it('rejects a recovery URL that supplies a login session instead of GoTrue recovery proof', () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?lang=fr#access_token=recovery-access&refresh_token=recovery-refresh&type=recovery&expires_in=3600'
    );

    expect(module.getWebRecoveryLinkState()).toBe('invalid');
    expect(module.getPendingWebRecoveryTokenHash()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password?lang=fr');
  });

  it('rejects ambiguous recovery tokens without leaving them in the URL', () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?access_token=query&refresh_token=query-refresh#access_token=fragment&refresh_token=fragment-refresh&type=recovery'
    );

    expect(module.getWebRecoveryLinkState()).toBe('invalid');
    expect(module.getPendingWebRecoveryTokenHash()).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password');
  });

  it.each([
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof&type=recovery&lang=fr',
    'https://dream.noctalia.app/auth/reset-password?lang=fr#token_hash=recovery-proof&type=recovery',
  ])('holds a GoTrue recovery token hash while removing it from the URL: %s', (href: string) => {
    const { module, replaceState } = loadWebAt(href);

    expect(module.getWebRecoveryLinkState()).toBe('pending');
    expect(module.getPendingWebRecoveryTokenHash()).toBe('recovery-proof');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password?lang=fr');
    module.clearPendingWebRecoveryTokenHash();
    expect(module.getPendingWebRecoveryTokenHash()).toBeNull();
  });

  it.each([
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof&type=email',
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof&type=recovery&type=recovery',
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof&type=recovery#access_token=attacker&refresh_token=attacker',
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof&type=recovery&code=oauth-code',
    'https://dream.noctalia.app/auth/reset-password?token_hash=recovery-proof#type=recovery',
  ])('rejects mixed or non-recovery token hashes without exchanging them: %s', async (href: string) => {
    const { module, replaceState } = loadWebAt(href);

    await module.webAuthCallbackPromise;
    expect(module.getWebRecoveryLinkState()).toBe('invalid');
    expect(module.getPendingWebRecoveryTokenHash()).toBeNull();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password');
  });

  it('keeps the same-browser PKCE recovery code path available', async () => {
    mockRecoveryExchangeCodeForSession.mockResolvedValueOnce({ data: {
      user: { id: 'user-1', email: 'user@example.com' },
      session: { user: { id: 'user-1' } },
      redirectType: 'PASSWORD_RECOVERY',
    }, error: null });
    mockRecoveryUpdateUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?code=recovery-code&lang=fr',
      'browser-verifier/PASSWORD_RECOVERY'
    );

    await module.webAuthCallbackPromise;
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockRecoveryExchangeCodeForSession).toHaveBeenCalledWith('recovery-code');
    expect(module.getWebRecoveryLinkState()).toBe('pending');
    expect(module.hasPendingWebRecoveryPkce()).toBe(true);
    await module.updatePasswordFromPendingWebRecoveryPkce('user@example.com', 'new-secret');
    expect(mockRecoveryUpdateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(module.hasPendingWebRecoveryPkce()).toBe(false);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/reset-password?lang=fr');
  });

  it('does not exchange an OAuth code on the reset route without a recovery PKCE verifier', async () => {
    const { module, replaceState } = loadWebAt(
      'https://dream.noctalia.app/auth/reset-password?code=oauth-code',
      'browser-verifier'
    );

    await module.webAuthCallbackPromise;
    expect(module.getWebRecoveryLinkState()).toBe('invalid');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockRecoveryExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
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
