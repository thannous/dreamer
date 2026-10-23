import 'react-native-url-polyfill/auto';
import { createClient, type User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isPasswordResetPath } from './authRoutes';

type WebRecoveryLinkState = 'none' | 'checking' | 'pending' | 'invalid';
let webRecoveryTokenHash: string | null = null;
let webRecoveryLinkState: WebRecoveryLinkState = 'none';
let webAuthCode: string | null = null;
let webAuthCodeIsRecovery = false;
function createIsolatedPkceRecoveryClient(projectUrl: string, publicKey: string, verifier: string) {
  // A distinct key also prevents auth-js BroadcastChannel notifications from
  // reaching another recovery tab or the app's primary auth client.
  const storageKey = `noctalia-recovery-pkce-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const values = new Map<string, string>([[`${storageKey}-code-verifier`, verifier]]);
  const client = createClient(projectUrl, publicKey, {
    auth: {
      storageKey,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: (key) => { values.delete(key); },
      },
      // auth-js needs persistSession to use the supplied storage. This adapter
      // is private to the client and never writes a browser or native store.
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return { client, clear: () => values.clear() };
}

let webRecoveryPkce: {
  client: ReturnType<typeof createIsolatedPkceRecoveryClient>['client'];
  clear: () => void;
  user: User;
} | null = null;

const URL_AUTH_PARAMETERS = [
  'access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
  'expires_in', 'expires_at', 'token_type', 'type', 'token_hash',
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
  const hasTokenHash = query.has('token_hash') || hash.has('token_hash');
  if (!hasBearerToken && !hasCode && !hasTokenHash) return;
  // Other product routes can use their own `code` parameter (for example
  // Lucid's callback). Only configured Supabase return paths own a PKCE code.
  const isSupabaseReturn = url.pathname === '/recording' || isPasswordResetPath(url.pathname);

  if (!hasBearerToken && !hasTokenHash && hasCode && isSupabaseReturn) {
    // exchangeCodeForSession enforces the browser's stored PKCE verifier, but
    // unlike SDK auto-detection it does not sign out an existing user when a
    // malicious or expired code fails exchange.
    const source = query.has('code') ? query : hash;
    const other = source === query ? hash : query;
    if (source.getAll('code').length === 1 && !other.has('code')) {
      webAuthCode = source.get('code');
      webAuthCodeIsRecovery = isPasswordResetPath(url.pathname);
    }
    if (isPasswordResetPath(url.pathname)) {
      webRecoveryLinkState = webAuthCode ? 'checking' : 'invalid';
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
  if (!hasBearerToken && !hasTokenHash) return;

  if (isPasswordResetPath(url.pathname)) {
    webRecoveryLinkState = 'invalid';
  }

  // A recovery token hash must come from one URL component together with its
  // GoTrue type. Access/refresh pairs are ordinary login sessions, even when
  // an attacker appends `type=recovery`; they cannot prove a reset request.
  const source = query.has('token_hash') ? query : hash;
  const other = source === query ? hash : query;
  if (isPasswordResetPath(url.pathname) && hasTokenHash && !hasBearerToken && !hasCode &&
    source.getAll('token_hash').length === 1 && source.getAll('type').length === 1 &&
    source.get('type') === 'recovery' && !other.has('token_hash') && !other.has('type') &&
    source.get('token_hash')) {
    webRecoveryTokenHash = source.get('token_hash');
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

export function getPendingWebRecoveryTokenHash(): string | null {
  return webRecoveryTokenHash;
}

export function clearPendingWebRecoveryTokenHash(): void {
  webRecoveryTokenHash = null;
  webRecoveryLinkState = 'none';
}

export function hasPendingWebRecoveryPkce(): boolean {
  return webRecoveryPkce !== null;
}

export async function updatePasswordFromPendingWebRecoveryPkce(email: string, newPassword: string): Promise<User> {
  const recovery = webRecoveryPkce;
  if (!recovery) throw new Error('Password recovery link is unavailable.');
  if (!recovery.user.email || recovery.user.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('recovery_email_mismatch');
  }
  const { data, error } = await recovery.client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  if (!data.user || data.user.id !== recovery.user.id) {
    recovery.clear();
    webRecoveryPkce = null;
    webRecoveryLinkState = 'invalid';
    throw new Error('Password recovery account changed.');
  }
  recovery.clear();
  webRecoveryPkce = null;
  webRecoveryLinkState = 'none';
  return data.user;
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

// Expo replaces direct property accesses when bundling a native Release.
// Optional chaining or an alias of process.env silently keeps the fallback.
const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const envAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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
// Match the installed supabase-js default key so existing browser sessions and
// its password-recovery PKCE verifier remain readable across this update.
const WEB_AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL ?? UNCONFIGURED_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

quarantineWebAuthCallback();

export const supabase = createClient(
  SUPABASE_URL ?? UNCONFIGURED_SUPABASE_URL,
  SUPABASE_ANON_KEY ?? 'anon-key-not-set',
  {
    auth: {
      // Use secure storage on native platforms, localStorage on web
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      storageKey: WEB_AUTH_STORAGE_KEY,
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
  ? (async () => {
    if (webAuthCodeIsRecovery) {
      // In auth-js 2.89.0, resetPasswordForEmail stores the PKCE verifier with
      // this marker; exchangeCodeForSession installs a session before returning.
      // Reject an OAuth/sign-in verifier before that side effect can occur.
      let verifier: string | null = null;
      const configuration = getSupabasePublicConfiguration();
      try {
        verifier = window.localStorage.getItem(`${WEB_AUTH_STORAGE_KEY}-code-verifier`);
      } catch {
        // A missing/unreadable verifier cannot prove the browser requested reset.
      }
      if (!configuration || !verifier?.endsWith('/PASSWORD_RECOVERY')) {
        webRecoveryLinkState = 'invalid';
        return;
      }

      // The marker and its verifier are transferred only to a distinct
      // memory-backed client. A recovery code never reaches the app client.
      let isolated: ReturnType<typeof createIsolatedPkceRecoveryClient> | null = null;
      try {
        window.localStorage.removeItem(`${WEB_AUTH_STORAGE_KEY}-code-verifier`);
        isolated = createIsolatedPkceRecoveryClient(
          configuration.projectUrl, configuration.publicKey, verifier
        );
        const { data, error } = await isolated.client.auth.exchangeCodeForSession(webAuthCode!);
        if (error || !('redirectType' in data) || data.redirectType !== 'PASSWORD_RECOVERY' ||
          !data.user?.email || !data.session || data.session.user.id !== data.user.id) {
          isolated.clear();
          webRecoveryLinkState = 'invalid';
          return;
        }
        webRecoveryPkce = { client: isolated.client, clear: isolated.clear, user: data.user };
        webRecoveryLinkState = 'pending';
      } catch {
        isolated?.clear();
        webRecoveryLinkState = 'invalid';
      }
      return;
    }

    try {
      await supabase.auth.exchangeCodeForSession(webAuthCode!);
    } catch {
      // A failed sign-in code leaves any existing app session unchanged.
    }
  })()
  : Promise.resolve();
