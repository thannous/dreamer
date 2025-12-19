import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreData = new Map<string, string>();

const secureStore = {
  getItemAsync: vi.fn(async (key: string) => secureStoreData.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStoreData.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStoreData.delete(key);
  }),
  isAvailableAsync: vi.fn(async () => true),
};

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  ALWAYS: 'ALWAYS',
  ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
  getItemAsync: secureStore.getItemAsync,
  setItemAsync: secureStore.setItemAsync,
  deleteItemAsync: secureStore.deleteItemAsync,
  isAvailableAsync: secureStore.isAvailableAsync,
}));

const createClientMock = vi.fn((url: string, key: string, options: any) => ({
  __options: options,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('supabase secure storage adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    secureStoreData.clear();
    createClientMock.mockClear();
    Object.values(secureStore).forEach((fn) => fn.mockClear());
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('stores small values directly', async () => {
    const { supabase, isSupabaseConfigured } = await import('../supabase');

    expect(isSupabaseConfigured).toBe(true);

    const storage = (supabase as any).__options.auth.storage;
    await storage.setItem('session', 'small');

    expect(secureStoreData.get('session')).toBe('small');
    expect(await storage.getItem('session')).toBe('small');
  });

  it('chunks and reassembles large values', async () => {
    const { supabase } = await import('../supabase');
    const storage = (supabase as any).__options.auth.storage;

    secureStoreData.set('session', '__dreamer_chunked_v1__:chunk-id:2');
    secureStoreData.set('session.__chunk_chunk-id_0', 'alpha');
    secureStoreData.set('session.__chunk_chunk-id_1', 'beta');

    await expect(storage.getItem('session')).resolves.toBe('alphabeta');
  });

  it('writes chunked values and clears on remove', async () => {
    const { supabase } = await import('../supabase');
    const storage = (supabase as any).__options.auth.storage;

    const large = 'y'.repeat(2500);
    await storage.setItem('token', large);

    const chunkedWrites = secureStore.setItemAsync.mock.calls.filter(
      ([key]) => typeof key === 'string' && key.startsWith('token.__chunk_')
    );
    expect(chunkedWrites.length).toBeGreaterThan(0);

    await storage.removeItem('token');
    expect(secureStoreData.has('token')).toBe(false);
  });
});
