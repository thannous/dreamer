import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isPasswordResetPath } from './authRoutes';

type WebRecoveryTokens = { accessToken: string; refreshToken: string };
type WebRecoveryLinkState = 'none' | 'pending' | 'invalid';
let webRecoveryTokens: WebRecoveryTokens | null = null;
let webRecoveryLinkState: WebRecoveryLinkState = 'none';
let webAuthCode: string | null = null;

const URL_AUTH_PARAMETERS = [
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'expires_in', 'expires_at', 'token_type', 'type',
];

/** Keep URL credentials out of auth-js and the browser address bar. */
function quarantineWebAuthCallback(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? new URLSearchParams(url.hash.slice(1)) : new URLSearchParams();
  const query = url.searchParams;
  const hasBearerToken = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token']
    .some((key) => query.has(key) || hash.has(key));
  const hasCode = query.has('code') || hash.has('code');
  if (!hasBearerToken && !hasCode) return;
  // Other product routes can use their own `code` parameter (for example
  // Lucid's callback). Only configured Supabase return paths own a PKCE code.
  const isSupabaseReturn = url.pathname === '/recording' || isPasswordResetPath(url.pathname);

  if (!hasBearerToken && hasCode && isSupabaseReturn) {
    // exchangeCodeForSession enforces the browser's stored PKCE verifier, but
    // unlike SDK auto-detection it does not sign out an existing user when a
    // malicious or expired code fails exchange.
    const source = query.has('code') ? query : hash;
    const other = source === query ? hash : query;
    if (source.getAll('code').length === 1 && !other.has('code')) {
      webAuthCode = source.get('code');
    }
    query.delete('code');
    hash.delete('code');
    url.hash = hash.toString();
    try {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // URL detection remains disabled below, so the SDK cannot use the code.
    }
    return;
  }
  if (!hasBearerToken) return;

  const isRecovery = isPasswordResetPath(url.pathname) &&
    (query.get('type') === 'recovery' || hash.get('type') === 'recovery');
  if (isPasswordResetPath(url.pathname)) {
    webRecoveryLinkState = 'invalid';
  }

  // A token pair must come from one URL component, without duplicate or
  // competing values. Only an explicit recovery link can be used later.
  const source = query.has('access_token') || query.has('refresh_token') ? query : hash;
  const other = source === query ? hash : query;
  if (isRecovery &&
    source.getAll('access_token').length === 1 &&
    source.getAll('refresh_token').length === 1 &&
    !other.has('access_token') && !other.has('refresh_token') &&
    source.get('access_token') && source.get('refresh_token')) {
    webRecoveryTokens = {
      accessToken: source.get('access_token')!,
      refreshToken: source.get('refresh_token')!,
    };
    webRecoveryLinkState = 'pending';
  }

  for (const key of URL_AUTH_PARAMETERS) {
    query.delete(key);
    hash.delete(key);
  }
  // A mixed code/bearer URL cannot be a Supabase PKCE callback. Preserve
  // unrelated product routes' own code parameters.
  if (isSupabaseReturn) {
    query.delete('code');
    hash.delete('code');
  }
  url.hash = hash.toString();
  try {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // The SDK still rejects the URL tokens if history is unavailable.
  }
}

export function getWebRecoveryLinkState(): WebRecoveryLinkState {
  return webRecoveryLinkState;
}

export function getPendingWebRecoveryTokens(): WebRecoveryTokens | null {
  return webRecoveryTokens;
}

export function rotatePendingWebRecoveryTokens(accessToken: string, refreshToken: string): void {
  if (webRecoveryTokens) {
    webRecoveryTokens = { accessToken, refreshToken };
  }
}

export function clearPendingWebRecoveryTokens(): void {
  webRecoveryTokens = null;
  webRecoveryLinkState = 'none';
}

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

/** Public project configuration only; never returns a session or privileged key. */
export function getSupabasePublicConfiguration(): { projectUrl: string; publicKey: string } | null {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? { projectUrl: SUPABASE_URL, publicKey: SUPABASE_ANON_KEY } : null;
}

if (!isSupabaseConfigured) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Auth will be disabled until configured.'
  );
}

// Unconfigured builds get an unresolvable placeholder (RFC 2606 .invalid), never a local
// port: local Supabase ports are assigned per project, and a guessed one could reach another project.
export const UNCONFIGURED_SUPABASE_URL = 'http://supabase-not-configured.invalid';

quarantineWebAuthCallback();

export const supabase = createClient(
  SUPABASE_URL ?? UNCONFIGURED_SUPABASE_URL,
  SUPABASE_ANON_KEY ?? 'anon-key-not-set',
  {
    auth: {
      // Use secure storage on native platforms, localStorage on web
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // URL callbacks are quarantined above; PKCE codes are exchanged below.
      // The SDK's auto callback path removes an existing session on a failed
      // code exchange, so do not let it process URL credentials directly.
      detectSessionInUrl: false,
      flowType: Platform.OS === 'web' ? 'pkce' : 'implicit',
    },
  }
);

export const webAuthCallbackPromise: Promise<void> = webAuthCode
  ? supabase.auth.exchangeCodeForSession(webAuthCode).then(() => undefined, () => undefined)
  : Promise.resolve();
