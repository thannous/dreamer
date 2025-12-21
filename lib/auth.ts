import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import * as mockAuth from './mockAuth';
import { isMockModeEnabled } from './env';
import { createScopedLogger } from './logger';
import type { SubscriptionTier } from './types';

export type { MockProfile } from './mockAuth';

const isMockMode = isMockModeEnabled();
const log = createScopedLogger('[Auth]');
type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');
const ACCESS_TOKEN_WAIT_RETRIES = 2;
const ACCESS_TOKEN_WAIT_DELAY_MS = 150;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let googleSignInModule: Promise<GoogleSignInModule> | null = null;

async function ensureSessionPersistence(session: Session | null, label: string): Promise<void> {
  if (!session?.access_token || !session?.refresh_token) return;
  try {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (error) {
    log.warn(`${label}: failed to persist session`, error);
  }
}

async function getGoogleSignInModule(): Promise<GoogleSignInModule> {
  if (Platform.OS === 'web') {
    throw new Error('Native Google Sign-In is not available on web platforms.');
  }

  if (!googleSignInModule) {
    googleSignInModule = import('@react-native-google-signin/google-signin');
  }

  return googleSignInModule;
}

/**
 * Initialize Google Sign-In with web client ID
 * Should be called once at app startup
 */
export function initializeGoogleSignIn() {
  if (isMockMode || Platform.OS === 'web') {
    // No-op in mock mode or web (handled elsewhere)
    return;
  }

  const webClientId = (process?.env as any)?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string | undefined;

  if (!webClientId) {
    log.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not configured. Google Sign-In will not work.');
    return;
  }

  // Lazy load module to avoid importing native-only code on web bundles
  getGoogleSignInModule()
    .then(({ GoogleSignin }) =>
      GoogleSignin.configure({
        webClientId,
        scopes: ['openid', 'email', 'profile'],
        offlineAccess: false,
      })
    )
    .catch((error) => {
      log.warn('Failed to initialize Google Sign-In', error);
    });
}

export async function getAccessToken(): Promise<string | null> {
  if (isMockMode) {
    return mockAuth.getAccessToken();
  }

  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function waitForAccessToken(): Promise<string | null> {
  for (let attempt = 0; attempt <= ACCESS_TOKEN_WAIT_RETRIES; attempt += 1) {
    const token = await getAccessToken();
    if (token) {
      return token;
    }
    if (attempt < ACCESS_TOKEN_WAIT_RETRIES) {
      await sleep(ACCESS_TOKEN_WAIT_DELAY_MS);
    }
  }
  return null;
}

/**
 * Mark that an account has been created on this device.
 * This blocks guest mode for returning users who logged out.
 */
async function markAccountCreated(): Promise<void> {
  if (isMockMode) {
    // In mock mode, use the mock implementation
    return mockAuth.markAccountCreatedOnDevice();
  }

  try {
    const { markAccountCreatedOnDevice } = await import('./deviceFingerprint');
    await markAccountCreatedOnDevice();
    log.debug('Successfully marked account as created on device');
  } catch (error) {
    log.warn('Failed to mark account as created on device', error);
  }
}

/**
 * Check if an account was ever created on this device.
 * Used to block guest mode for returning users who logged out.
 */
export async function wasAccountCreatedOnDevice(): Promise<boolean> {
  if (isMockMode) {
    return mockAuth.wasAccountCreatedOnDevice();
  }

  try {
    const deviceFingerprint = await import('./deviceFingerprint');
    return deviceFingerprint.wasAccountCreatedOnDevice();
  } catch (error) {
    log.warn('Failed to check if account was created on device', error);
    return false;
  }
}

/**
 * Mark the device fingerprint as upgraded after successful signup
 * This prevents the device from getting fresh guest quotas after creating an account
 */
async function markFingerprintUpgraded(): Promise<void> {
  if (isMockMode) {
    // No-op in mock mode
    return;
  }

  try {
    const { getDeviceFingerprint } = await import('./deviceFingerprint');
    const { getApiBaseUrl } = await import('./config');
    const { fetchJSON } = await import('./http');

    const fingerprint = await getDeviceFingerprint();
    const token = await waitForAccessToken();

    if (!token) {
      log.warn('No access token available to mark fingerprint');
      return;
    }

    await fetchJSON(`${getApiBaseUrl()}/auth/mark-upgrade`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: { fingerprint },
      retries: 2,
      timeoutMs: 10000,
    });

    log.debug('Successfully marked fingerprint as upgraded');
  } catch (error) {
    // Fail silently: the quota will still be enforced server-side
    log.warn('Failed to mark fingerprint as upgraded', error);
  }
}

export function onAuthChange(cb: (user: User | null, session: Session | null) => void) {
  const handleAuthChange = (user: User | null, session: Session | null) => {
    if (user) {
      void markAccountCreated().catch(() => {
        // Fail silently if marking fails
      });
    }
    cb(user, session);
  };

  if (isMockMode) {
    return mockAuth.onAuthChange(handleAuthChange);
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthChange(session?.user ?? null, session ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function getCurrentUser(): Promise<User | null> {
  if (isMockMode) {
    return mockAuth.getCurrentUser();
  }

  try {
    // getSession() is usually cached locally and might not reflect server-side updates
    // to app_metadata (e.g. tier updates from RevenueCat webhook). Prefer getUser().
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      return data.user ?? null;
    }

    const session = await supabase.auth.getSession();
    return session.data.session?.user ?? null;
  } catch {
    return null;
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (isMockMode) {
    return mockAuth.signInWithEmailPassword(email);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await ensureSessionPersistence(data.session ?? null, 'signInWithEmailPassword');

  return data.user;
}

// Use an https redirect so the same confirmation link works on desktop (web) and on mobile
// (via Universal Links / Android App Links), avoiding OS prompts like "xdg-open" on Linux.
const EMAIL_REDIRECT_NATIVE = 'https://dream.noctalia.app/recording';

export async function signUpWithEmailPassword(email: string, password: string, userLang?: string) {
  if (isMockMode) {
    return mockAuth.signUpWithEmailPassword(email, userLang);
  }

  const signUpOptions = {
    emailRedirectTo: EMAIL_REDIRECT_NATIVE,
    data: userLang ? { lang: userLang } : undefined,
  };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: signUpOptions,
  });
  if (error) throw error;
  await ensureSessionPersistence(data.session ?? null, 'signUpWithEmailPassword');
  if (data.user) {
    await markAccountCreated();
  }

  // Mark fingerprint as upgraded to prevent quota bypass
  await markFingerprintUpgraded().catch(() => {
    // Fail silently if marking fails
  });

  return data.user;
}

export async function resendVerificationEmail(email: string) {
  if (isMockMode) {
    await mockAuth.resendVerificationEmail(email);
    return;
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: EMAIL_REDIRECT_NATIVE,
    },
  });
  if (error) throw error;
}

/**
 * Sign in with Google using native Google Sign-In
 * Returns the authenticated user from Supabase
 */
export async function signInWithGoogle(): Promise<User> {
  if (isMockMode) {
    return mockAuth.signInWithGoogle();
  }

  if (Platform.OS === 'web') {
    throw new Error('Google Sign-In on web should use the web-specific implementation');
  }

  const { GoogleSignin, statusCodes } = await getGoogleSignInModule();

  try {
    log.debug('Starting Google Sign-In process');

    // Check for Play Services availability (Android)
    log.debug('Checking Google Play Services availability');
    await GoogleSignin.hasPlayServices();
    log.debug('Play Services available');

    // Sign in with Google; library throws on cancellation
    log.debug('Showing Google Sign-In dialog');
    const signInResponse = await GoogleSignin.signIn();
    log.debug('Google Sign-In dialog closed');

    if ((signInResponse as any)?.type === 'cancelled') {
      log.debug('User cancelled Google Sign-In');
      throw new Error('SIGN_IN_CANCELLED');
    }

    // Support both current library shape (idToken top-level) and legacy nested shape
    log.debug('Extracting ID token from response');
    const idToken = (signInResponse as any).idToken ?? (signInResponse as any)?.data?.idToken;
    if (!idToken) {
      log.error('No ID token found in response');
      log.debug('Google Sign-In response keys', Object.keys((signInResponse as object) ?? {}));
      throw new Error('No ID token received from Google');
    }
    log.debug('ID token extracted successfully');

    // Sign in to Supabase with the Google ID token
    log.debug('Exchanging ID token with Supabase');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      log.error('Supabase signInWithIdToken failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      throw error;
    }

    if (!data.user) {
      log.error('No user data received from Supabase');
      throw new Error('No user data received from Supabase');
    }

    await ensureSessionPersistence(data.session ?? null, 'signInWithGoogle');

    log.debug('Successfully signed in with Google', {
      hasEmail: Boolean(data.user.email),
      hasId: Boolean(data.user.id),
      emailDomain: data.user.email?.split('@')[1] ?? 'unknown',
    });

    // Mark fingerprint as upgraded to prevent quota bypass
    await markFingerprintUpgraded().catch(() => {
      // Fail silently if marking fails
    });

    return data.user;
  } catch (error: unknown) {
    log.error('Google Sign-In failed', error);

    // Re-throw with more context for specific error codes
    const errorCode = (error as { code?: string })?.code;
    const errorMessage = (error as { message?: string })?.message;

    log.debug('Error details', { errorCode, errorMessage });

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      log.debug('User cancelled');
      throw new Error('SIGN_IN_CANCELLED');
    } else if (errorCode === statusCodes.IN_PROGRESS) {
      log.debug('Sign-in already in progress');
      throw new Error('Sign-in already in progress');
    } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      log.debug('Play Services not available');
      throw new Error('Google Play Services not available or outdated');
    }
    throw error;
  }
}

/**
 * Web-only Google Sign-In using Supabase OAuth popup
 */
export async function signInWithGoogleWeb(): Promise<void> {
  if (isMockMode) {
    await mockAuth.signInWithGoogleWeb();
    return;
  }

  if (Platform.OS !== 'web') return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
    },
  });
  if (error) throw error;
}

/**
 * Complete sign out from both Google and Supabase
 */
export async function signOut() {
  if (isMockMode) {
    await mockAuth.signOut();
    return;
  }

  try {
    // Sign out from Google if signed in
    if (Platform.OS !== 'web') {
      const { GoogleSignin } = await getGoogleSignInModule();
      await GoogleSignin.signOut();
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    log.error('Error during sign out', error);
    throw error;
  }
}

export async function signInMock(profile: mockAuth.MockProfile): Promise<User> {
  if (!isMockMode) {
    throw new Error('Mock sign-in is only available while running in mock mode.');
  }
  return mockAuth.signInWithProfile(profile);
}

/**
 * ✅ CRITICAL SECURITY FIX: Tier can only be updated via RevenueCat webhook (admin-only)
 * This function is DISABLED in production to prevent users from modifying their own tier.
 *
 * In mock mode, it still works for testing purposes.
 * In production, tier is set ONLY via the RevenueCat webhook, which writes to app_metadata.
 */
export async function updateUserTier(tier: SubscriptionTier): Promise<User | null> {
  if (isMockMode) {
    return mockAuth.updateUserTier(tier);
  }

  // ✅ BLOCKED: Tier must be updated via RevenueCat webhook (writes to admin-only app_metadata)
  throw new Error(
    'updateUserTier() is disabled. User tier can only be modified via RevenueCat webhook after subscription purchase.'
  );
}
