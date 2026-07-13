import * as AppIntegrity from '@expo/app-integrity';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON, HttpError, type HttpOptions } from '@/lib/http';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('[ProductAnalyticsSession]');
const STORAGE_KEY = 'product-analytics-guest-session-v1';
const EXPIRY_SAFETY_MS = 30_000;

type AnalyticsGuestSessionResponse = {
  token: string;
  expiresAt: string;
};

type AnalyticsGuestSessionRecord = {
  token: string;
  expiresAt: number;
};

let cached: AnalyticsGuestSessionRecord | null = null;
let preparePromise: Promise<boolean> | null = null;
let sessionPromise: Promise<AnalyticsGuestSessionRecord> | null = null;

function decodeStored(raw: string | null): AnalyticsGuestSessionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsGuestSessionResponse>;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') return null;
    const expiresAt = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAt)) return null;
    return { token: parsed.token, expiresAt };
  } catch {
    return null;
  }
}

function isValid(record: AnalyticsGuestSessionRecord | null): record is AnalyticsGuestSessionRecord {
  return !!record && record.expiresAt - EXPIRY_SAFETY_MS > Date.now();
}

async function prepareIntegrity(): Promise<boolean> {
  if (preparePromise) return preparePromise;
  preparePromise = (async () => {
    if (Platform.OS !== 'android') return false;
    const cloudProjectNumber = process.env.EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER;
    if (!cloudProjectNumber) return false;
    try {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber);
      return true;
    } catch (error) {
      log.warn('Play Integrity preparation failed', error);
      return false;
    }
  })();
  const prepared = await preparePromise;
  if (!prepared) preparePromise = null;
  return prepared;
}

async function createAnalyticsGuestSession(): Promise<AnalyticsGuestSessionRecord> {
  if (!(await prepareIntegrity())) {
    throw new Error('Product analytics guest session unavailable');
  }

  const requestHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${Date.now()}:${Crypto.randomUUID()}`
  );
  const integrityToken = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
  const response = await fetchJSON<AnalyticsGuestSessionResponse>(
    `${getApiBaseUrl()}/analytics/session`,
    {
      method: 'POST',
      body: {
        requestHash,
        integrityToken,
        platform: 'android',
      },
      timeoutMs: 10_000,
    }
  );
  const expiresAt = Date.parse(response.expiresAt);
  if (!response.token || !Number.isFinite(expiresAt)) {
    throw new Error('Invalid product analytics guest session');
  }
  const record = { token: response.token, expiresAt };
  cached = record;
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ token: record.token, expiresAt: response.expiresAt })
    );
  } catch {
    // The in-memory token remains usable for this process.
  }
  return record;
}

async function ensureAnalyticsGuestSession(): Promise<AnalyticsGuestSessionRecord> {
  if (isValid(cached)) return cached;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    let stored: AnalyticsGuestSessionRecord | null = null;
    try {
      stored = decodeStored(await SecureStore.getItemAsync(STORAGE_KEY));
    } catch {
      stored = null;
    }
    if (isValid(stored)) {
      cached = stored;
      return stored;
    }
    return createAnalyticsGuestSession();
  })();

  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

export async function invalidateProductAnalyticsGuestSession(): Promise<void> {
  cached = null;
  sessionPromise = null;
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // The session is still invalidated in memory.
  }
}

export async function getProductAnalyticsAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  if (accessToken) return { Authorization: `Bearer ${accessToken}` };
  if (Platform.OS !== 'android') {
    throw new Error('Product analytics guest sessions are Android-only');
  }
  const session = await ensureAnalyticsGuestSession();
  return { 'x-analytics-guest-token': session.token };
}

export async function fetchProductAnalyticsJSON<T>(
  url: string,
  options: HttpOptions,
  retryGuestSession = true
): Promise<T> {
  const accessToken = await getAccessToken();
  if (accessToken) {
    return fetchJSON<T>(url, {
      ...options,
      headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
    });
  }

  const headers = await getProductAnalyticsAuthHeaders();
  try {
    return await fetchJSON<T>(url, { ...options, headers: { ...headers, ...options.headers } });
  } catch (error) {
    if (retryGuestSession && error instanceof HttpError && error.status === 401) {
      await invalidateProductAnalyticsGuestSession();
      return fetchProductAnalyticsJSON<T>(url, options, false);
    }
    throw error;
  }
}

export async function resetProductAnalyticsGuestSessionForTesting(): Promise<void> {
  cached = null;
  preparePromise = null;
  sessionPromise = null;
}
