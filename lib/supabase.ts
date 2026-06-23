import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Secure storage adapter for native platforms (iOS/Android)
// Stay comfortably under the ~2KB native limit (and leave room for any platform overhead).
const SECURESTORE_SAFE_CHUNK_SIZE = 1800;
const SECURESTORE_CHUNKED_PREFIX = '__dreamer_chunked_v1__:';

type SecureStoreChunkHeader = {
  id: string;
  count: number;
};

function formatChunkHeader(header: SecureStoreChunkHeader): string {
  return `${SECURESTORE_CHUNKED_PREFIX}${header.id}:${header.count}`;
}

function parseChunkHeader(value: string | null): SecureStoreChunkHeader | null {
  if (!value?.startsWith(SECURESTORE_CHUNKED_PREFIX)) {
    return null;
  }

  const payload = value.slice(SECURESTORE_CHUNKED_PREFIX.length);
  const [id, countStr] = payload.split(':');
  const count = Number.parseInt(countStr ?? '', 10);
  if (!id || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  return { id, count };
}

function createChunkId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function chunkKey(baseKey: string, header: SecureStoreChunkHeader, index: number): string {
  return `${baseKey}.__chunk_${header.id}_${index}`;
}

async function cleanupChunkedValue(baseKey: string, header?: SecureStoreChunkHeader | null): Promise<void> {
  const resolvedHeader = header ?? parseChunkHeader(await SecureStore.getItemAsync(baseKey));
  if (!resolvedHeader) {
    return;
  }

  await Promise.all(
    Array.from({ length: resolvedHeader.count }, (_, idx) =>
      SecureStore.deleteItemAsync(chunkKey(baseKey, resolvedHeader, idx))
    )
  );
}

async function readChunkedValue(baseKey: string, header: SecureStoreChunkHeader): Promise<string | null> {
  const parts = await Promise.all(
    Array.from({ length: header.count }, (_, idx) => SecureStore.getItemAsync(chunkKey(baseKey, header, idx)))
  );
  if (parts.some((part) => typeof part !== 'string')) {
    return null;
  }
  return parts.join('');
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    const value = await SecureStore.getItemAsync(key);
    if (!value) {
      return value;
    }
    const header = parseChunkHeader(value);
    if (!header) {
      return value;
    }
    return readChunkedValue(key, header);
  },
  setItem: async (key: string, value: string) => {
    const existingHeader = parseChunkHeader(await SecureStore.getItemAsync(key));

    // Most values are small enough to store directly.
    if (value.length <= SECURESTORE_SAFE_CHUNK_SIZE) {
      await cleanupChunkedValue(key, existingHeader);
      return SecureStore.setItemAsync(key, value);
    }

    // Chunk large values to avoid SecureStore's ~2KB limit (warns today, may throw in future SDKs).
    // We store a small header in the base key and the content across numbered chunk keys.
    const chunkSize = SECURESTORE_SAFE_CHUNK_SIZE;
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += chunkSize) {
      chunks.push(value.slice(i, i + chunkSize));
    }

    const nextHeader: SecureStoreChunkHeader = { id: createChunkId(), count: chunks.length };
    await Promise.all(chunks.map((chunk, idx) => SecureStore.setItemAsync(chunkKey(key, nextHeader, idx), chunk)));
    await SecureStore.setItemAsync(key, formatChunkHeader(nextHeader));
    await cleanupChunkedValue(key, existingHeader);
  },
  removeItem: async (key: string) => {
    await cleanupChunkedValue(key);
    await SecureStore.deleteItemAsync(key);
  },
};

const envUrl = (process?.env as any)?.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const envAnon = (process?.env as any)?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const extra = (Constants?.expoConfig as any)?.extra ?? {};
const extraUrl = (extra?.supabaseUrl as string | undefined) ?? undefined;
const extraAnon = (extra?.supabaseAnonKey as string | undefined) ?? undefined;

const SUPABASE_URL = envUrl || extraUrl;
const SUPABASE_ANON_KEY = envAnon || extraAnon;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

type WebSessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type WebCryptoSource = {
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

type WebOAuthStateRecord = {
  value: string;
  expiresAt: number;
};

const WEB_OAUTH_STATE_STORAGE_KEY = 'noctalia-web-oauth-state-v1';
const WEB_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getWebSessionStorage(): WebSessionStorage | null {
  if (Platform.OS !== 'web') return null;
  try {
    const storage = (globalThis as typeof globalThis & { sessionStorage?: WebSessionStorage }).sessionStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function createRandomOAuthState(): string {
  const bytes = new Uint8Array(24);
  const cryptoSource = (globalThis as typeof globalThis & { crypto?: WebCryptoSource }).crypto;
  if (cryptoSource?.getRandomValues) {
    cryptoSource.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createWebOAuthState(): string | null {
  const storage = getWebSessionStorage();
  if (!storage) return null;

  const value = createRandomOAuthState();
  const record: WebOAuthStateRecord = {
    value,
    expiresAt: Date.now() + WEB_OAUTH_STATE_TTL_MS,
  };
  try {
    storage.setItem(WEB_OAUTH_STATE_STORAGE_KEY, JSON.stringify(record));
    return value;
  } catch {
    return null;
  }
}

function consumeWebOAuthState(state: string | undefined): boolean {
  const incoming = state?.trim();
  const storage = getWebSessionStorage();
  if (!incoming || !storage) return false;

  let record: WebOAuthStateRecord | null = null;
  try {
    const raw = storage.getItem(WEB_OAUTH_STATE_STORAGE_KEY);
    record = raw ? (JSON.parse(raw) as WebOAuthStateRecord) : null;
  } catch {
    record = null;
  }

  if (!record?.value || !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now()) {
    try {
      storage.removeItem(WEB_OAUTH_STATE_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures; the session still fails closed.
    }
    return false;
  }

  if (record.value !== incoming) {
    return false;
  }

  try {
    storage.removeItem(WEB_OAUTH_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; the one-time check has already succeeded.
  }
  return true;
}

export function shouldDetectWebAuthSessionInUrl(_url: URL, params: { [parameter: string]: string }): boolean {
  return consumeWebOAuthState(params.state);
}

if (!isSupabaseConfigured) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Auth will be disabled until configured.'
  );
}

export const supabase = createClient(
  SUPABASE_URL ?? 'http://localhost:54321',
  SUPABASE_ANON_KEY ?? 'anon-key-not-set',
  {
    auth: {
      // Use secure storage on native platforms, localStorage on web
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web' ? shouldDetectWebAuthSessionInUrl : false,
    },
  }
);
