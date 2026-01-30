import * as AppIntegrity from '@expo/app-integrity';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { fetchJSON } from '@/lib/http';
import { getApiBaseUrl } from '@/lib/config';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { getAccessToken } from '@/lib/auth';
import { getExpoPublicEnvValue } from '@/lib/env';
import { logger } from '@/lib/logger';

type GuestSessionResponse = {
  token: string;
  expiresAt: string;
};

type GuestSessionRecord = {
  token: string;
  expiresAt: number;
  fingerprint: string;
};

const STORAGE_KEY = 'guest-session-v1';
const EXPIRY_SAFETY_MS = 30_000;

let cached: GuestSessionRecord | null = null;
let preparePromise: Promise<boolean> | null = null;
let sessionPromise: Promise<GuestSessionRecord | null> | null = null;
let sessionEpoch = 0;

const decodeStored = (raw: string | null): GuestSessionRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestSessionResponse & { fingerprint?: string };
    if (!parsed.token || !parsed.expiresAt || !parsed.fingerprint) return null;
    const expiresAt = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAt)) return null;
    return { token: parsed.token, expiresAt, fingerprint: parsed.fingerprint };
  } catch {
    return null;
  }
};

const isSessionValid = (session: GuestSessionRecord | null): session is GuestSessionRecord => {
  if (!session) return false;
  return session.expiresAt - EXPIRY_SAFETY_MS > Date.now();
};

const isProviderInvalidError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('ERR_APP_INTEGRITY_PROVIDER_INVALID') ||
    message.includes('prepareIntegrityTokenProviderAsync')
  );
};

export async function initGuestSession(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (preparePromise) return preparePromise;

  preparePromise = (async () => {
    const cloudProjectNumber = getExpoPublicEnvValue('EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER');
    if (!cloudProjectNumber) {
      logger.warn('[guestSession] Missing EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER');
      return false;
    }
    try {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber);
      logger.debug('[guestSession] Play Integrity provider ready');
      return true;
    } catch (error) {
      logger.warn('[guestSession] Failed to prepare Play Integrity provider', error);
      return false;
    }
  })();

  const prepared = await preparePromise;
  if (!prepared) {
    preparePromise = null;
  }
  return prepared;
}

const createRequestHash = async (fingerprint: string): Promise<string> => {
  const seed = `${fingerprint}:${Date.now()}:${Crypto.randomUUID()}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
};

const fetchGuestSession = async (fingerprint: string): Promise<GuestSessionRecord | null> => {
  const base = getApiBaseUrl();
  const requestHash = await createRequestHash(fingerprint);
  let integrityToken: string | null = null;

  if (Platform.OS === 'android') {
    const prepared = await initGuestSession();
    if (!prepared) {
      logger.warn('[guestSession] Play Integrity provider not ready');
      return null;
    }
    try {
      integrityToken = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
    } catch (error) {
      if (isProviderInvalidError(error)) {
        preparePromise = null;
        const retried = await initGuestSession();
        if (!retried) {
          logger.warn('[guestSession] Play Integrity provider unavailable after retry', error);
          return null;
        }
        try {
          integrityToken = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
        } catch (retryError) {
          logger.warn('[guestSession] Play Integrity request failed after retry', retryError);
          return null;
        }
      } else {
        logger.warn('[guestSession] Play Integrity request failed', error);
        return null;
      }
    }
  }

  const response = await fetchJSON<GuestSessionResponse>(`${base}/guest/session`, {
    method: 'POST',
    body: {
      fingerprint,
      requestHash,
      integrityToken,
      platform: Platform.OS,
    },
    timeoutMs: 10000,
  });

  const expiresAt = Date.parse(response.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  return {
    token: response.token,
    expiresAt,
    fingerprint,
  };
};

const ensureGuestSession = async (): Promise<GuestSessionRecord | null> => {
  if (cached && isSessionValid(cached)) {
    return cached;
  }

  if (Platform.OS === 'web') {
    return null;
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    return null;
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  const startEpoch = sessionEpoch;
  const inFlight = (async () => {
    let stored: GuestSessionRecord | null = null;
    try {
      stored = decodeStored(await SecureStore.getItemAsync(STORAGE_KEY));
    } catch {
      stored = null;
    }
    if (stored && isSessionValid(stored)) {
      if (sessionEpoch !== startEpoch) return null;
      cached = stored;
      return stored;
    }

    const fingerprint = await getDeviceFingerprint();
    const fresh = await fetchGuestSession(fingerprint);
    if (!fresh) {
      return null;
    }
    if (sessionEpoch !== startEpoch) return null;

    cached = fresh;
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEY,
        JSON.stringify({ token: fresh.token, expiresAt: new Date(fresh.expiresAt).toISOString(), fingerprint })
      );
    } catch {
      // Ignore storage failures; session will remain in memory.
    }
    return fresh;
  })();
  sessionPromise = inFlight;

  try {
    return await inFlight;
  } finally {
    if (sessionPromise === inFlight) {
      // Ensure stale inflight sessions don't get reused after invalidation.
      sessionPromise = null;
    }
  }
};

export async function getGuestHeaders(): Promise<Record<string, string>> {
  try {
    const session = await ensureGuestSession();
    if (!session) return {};
    return {
      'x-guest-token': session.token,
      'x-guest-fingerprint': session.fingerprint,
      'x-guest-platform': Platform.OS,
    };
  } catch (error) {
    logger.warn('[guestSession] Failed to resolve guest session', error);
    return {};
  }
}

export async function invalidateGuestSession(): Promise<void> {
  sessionEpoch += 1;
  cached = null;
  preparePromise = null;
  sessionPromise = null;
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Ignore storage failures; session will remain cleared in memory.
  }
}
