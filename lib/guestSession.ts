import * as AppIntegrity from '@expo/app-integrity';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { fetchJSON } from '@/lib/http';
import { getApiBaseUrl } from '@/lib/config';
import { getDeviceFingerprint } from '@/lib/deviceFingerprint';
import { getAccessToken } from '@/lib/auth';
import { GuestSessionError, GuestSessionErrorCode } from '@/lib/errors';
import { getExpoPublicEnvValue } from '@/lib/env';
import { logger } from '@/lib/logger';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

type GuestSessionResponse = {
  token: string;
  expiresAt: string;
};

type GuestSessionRecord = {
  token: string;
  expiresAt: number;
  fingerprint: string;
};

export type GuestBootstrapStatus = 'ready' | 'degraded' | 'disabled';

export type GuestBootstrapState = {
  status: GuestBootstrapStatus;
  reasonCode?: GuestSessionErrorCode;
  updatedAt: number;
};

const STORAGE_KEY = 'guest-session-v1';
const EXPIRY_SAFETY_MS = 30_000;

let cached: GuestSessionRecord | null = null;
let preparePromise: Promise<boolean> | null = null;
let sessionPromise: Promise<GuestSessionRecord | null> | null = null;
let sessionEpoch = 0;
let guestBootstrapState: GuestBootstrapState = {
  status: 'degraded',
  reasonCode: GuestSessionErrorCode.UNAVAILABLE,
  updatedAt: Date.now(),
};
const guestBootstrapListeners = new Set<() => void>();

const updateGuestBootstrapState = (
  status: GuestBootstrapStatus,
  reasonCode?: GuestSessionErrorCode
) => {
  const nextReason = status === 'ready' ? undefined : reasonCode;
  const previous = guestBootstrapState;
  if (previous.status === status && previous.reasonCode === nextReason) {
    return;
  }
  guestBootstrapState = {
    status,
    reasonCode: nextReason,
    updatedAt: Date.now(),
  };
  guestBootstrapListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logger.warn('[guestSession] Failed to notify bootstrap listener', error);
    }
  });
};

export function getGuestBootstrapState(): GuestBootstrapState {
  return guestBootstrapState;
}

export function subscribeGuestBootstrapState(listener: () => void): () => void {
  guestBootstrapListeners.add(listener);
  return () => {
    guestBootstrapListeners.delete(listener);
  };
}

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
  if (Platform.OS !== 'android') {
    if (Platform.OS === 'web') {
      updateGuestBootstrapState('degraded', GuestSessionErrorCode.PLATFORM_UNSUPPORTED);
    }
    return false;
  }
  if (preparePromise) return preparePromise;

  preparePromise = (async () => {
    const cloudProjectNumber = getExpoPublicEnvValue('EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER');
    if (!cloudProjectNumber) {
      logger.warn('[guestSession] Missing EXPO_PUBLIC_PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER');
      updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
      return false;
    }
    try {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(cloudProjectNumber);
      logger.debug('[guestSession] Play Integrity provider ready');
      return true;
    } catch (error) {
      logger.warn('[guestSession] Failed to prepare Play Integrity provider', error);
      updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
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

const mapGuestSessionFailure = (error: unknown): GuestSessionErrorCode => {
  const status = typeof (error as { status?: unknown })?.status === 'number'
    ? Number((error as { status: number }).status)
    : null;
  const body = (error as { body?: unknown })?.body;
  const bodyError = (() => {
    if (typeof body === 'object' && body !== null) {
      const topLevel = (body as { error?: unknown }).error;
      if (typeof topLevel === 'string') return topLevel.toLowerCase();
      if (typeof topLevel === 'object' && topLevel && typeof (topLevel as { message?: unknown }).message === 'string') {
        return ((topLevel as { message: string }).message).toLowerCase();
      }
    }
    return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  })();

  if (
    status === 401 &&
    (bodyError.includes('disabled for this platform') || bodyError.includes('unsupported'))
  ) {
    return GuestSessionErrorCode.PLATFORM_UNSUPPORTED;
  }
  return GuestSessionErrorCode.UNAVAILABLE;
};

const fetchGuestSession = async (fingerprint: string): Promise<GuestSessionRecord | null> => {
  const base = getApiBaseUrl();
  const requestHash = await createRequestHash(fingerprint);
  let integrityToken: string | null = null;

  if (Platform.OS === 'android') {
    const prepared = await initGuestSession();
    if (!prepared) {
      logger.warn('[guestSession] Play Integrity provider not ready');
      updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
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
          updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
          return null;
        }
        try {
          integrityToken = await AppIntegrity.requestIntegrityCheckAsync(requestHash);
        } catch (retryError) {
          logger.warn('[guestSession] Play Integrity request failed after retry', retryError);
          updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
          return null;
        }
      } else {
        logger.warn('[guestSession] Play Integrity request failed', error);
        updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
        return null;
      }
    }
  }

  let response: GuestSessionResponse;
  try {
    response = await fetchJSON<GuestSessionResponse>(`${base}/guest/session`, {
      method: 'POST',
      body: {
        fingerprint,
        requestHash,
        integrityToken,
        platform: Platform.OS,
      },
      ...NETWORK_REQUEST_POLICIES.guestSessionCreate,
    });
  } catch (error) {
    updateGuestBootstrapState('degraded', mapGuestSessionFailure(error));
    throw error;
  }

  const expiresAt = Date.parse(response.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
    return null;
  }

  updateGuestBootstrapState('ready');
  return {
    token: response.token,
    expiresAt,
    fingerprint,
  };
};

const ensureGuestSession = async (): Promise<GuestSessionRecord | null> => {
  if (cached && isSessionValid(cached)) {
    updateGuestBootstrapState('ready');
    return cached;
  }

  if (Platform.OS === 'web') {
    updateGuestBootstrapState('degraded', GuestSessionErrorCode.PLATFORM_UNSUPPORTED);
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
      updateGuestBootstrapState('ready');
      return stored;
    }

    const fingerprint = await getDeviceFingerprint();
    const fresh = await fetchGuestSession(fingerprint);
    if (!fresh) {
      updateGuestBootstrapState('degraded', GuestSessionErrorCode.UNAVAILABLE);
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

const toGuestSessionError = (state: GuestBootstrapState): GuestSessionError => {
  switch (state.reasonCode) {
    case GuestSessionErrorCode.PLATFORM_UNSUPPORTED:
      return new GuestSessionError(
        GuestSessionErrorCode.PLATFORM_UNSUPPORTED,
        'guest_platform_unsupported'
      );
    case GuestSessionErrorCode.EXPIRED:
      return new GuestSessionError(
        GuestSessionErrorCode.EXPIRED,
        'guest_session_expired'
      );
    case GuestSessionErrorCode.QUOTA_UNAVAILABLE:
      return new GuestSessionError(
        GuestSessionErrorCode.QUOTA_UNAVAILABLE,
        'guest_quota_unavailable'
      );
    case GuestSessionErrorCode.UNAVAILABLE:
    default:
      return new GuestSessionError(
        GuestSessionErrorCode.UNAVAILABLE,
        'guest_session_unavailable'
      );
  }
};

export async function getGuestHeaders(
  options?: { requireSession?: boolean }
): Promise<Record<string, string>> {
  try {
    const session = await ensureGuestSession();
    if (!session) {
      if (options?.requireSession) {
        throw toGuestSessionError(getGuestBootstrapState());
      }
      return {};
    }
    return {
      'x-guest-token': session.token,
      'x-guest-fingerprint': session.fingerprint,
      'x-guest-platform': Platform.OS,
    };
  } catch (error) {
    logger.warn('[guestSession] Failed to resolve guest session', error);
    if (options?.requireSession) {
      if (error instanceof GuestSessionError) {
        throw error;
      }
      throw toGuestSessionError(getGuestBootstrapState());
    }
    return {};
  }
}

export async function invalidateGuestSession(): Promise<void> {
  sessionEpoch += 1;
  cached = null;
  preparePromise = null;
  sessionPromise = null;
  updateGuestBootstrapState('degraded', GuestSessionErrorCode.EXPIRED);
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Ignore storage failures; session will remain cleared in memory.
  }
}
