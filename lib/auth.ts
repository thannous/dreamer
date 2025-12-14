import type { User } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import * as mockAuth from './mockAuth';
import { isMockModeEnabled } from './env';
import type { SubscriptionTier } from './types';

export type { MockProfile } from './mockAuth';

const isMockMode = isMockModeEnabled();
type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let googleSignInModule: Promise<GoogleSignInModule> | null = null;

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
    console.warn('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not configured. Google Sign-In will not work.');
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
      if (__DEV__) {
        console.warn('[Auth] Failed to initialize Google Sign-In', error);
      }
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

export function onAuthChange(cb: (user: User | null) => void) {
  if (isMockMode) {
    return mockAuth.onAuthChange(cb);
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
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
    console.log('[Auth] Starting Google Sign-In process...');

    // Check for Play Services availability (Android)
    console.log('[Auth] Checking Google Play Services availability...');
    await GoogleSignin.hasPlayServices();
    console.log('[Auth] Play Services available ✓');

    // Sign in with Google; library throws on cancellation
    console.log('[Auth] Showing Google Sign-In dialog...');
    const signInResponse = await GoogleSignin.signIn();
    console.log('[Auth] Google Sign-In dialog closed');

    if ((signInResponse as any)?.type === 'cancelled') {
      console.log('[Auth] User cancelled Google Sign-In');
      throw new Error('SIGN_IN_CANCELLED');
    }

    // Support both current library shape (idToken top-level) and legacy nested shape
    console.log('[Auth] Extracting ID token from response...');
    const idToken = (signInResponse as any).idToken ?? (signInResponse as any)?.data?.idToken;
    if (!idToken) {
      console.error('[Auth] ❌ No ID token found in response');
      console.error('[Auth] Response structure:', JSON.stringify(signInResponse, null, 2));
      throw new Error('No ID token received from Google');
    }
    console.log('[Auth] ID token extracted successfully ✓');

    // Sign in to Supabase with the Google ID token
    console.log('[Auth] Exchanging ID token with Supabase...');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[Auth] ❌ Supabase signInWithIdToken failed:');
      console.error('[Auth] Error code:', error.code);
      console.error('[Auth] Error message:', error.message);
      console.error('[Auth] Error status:', error.status);
      throw error;
    }

    if (!data.user) {
      console.error('[Auth] ❌ No user data received from Supabase');
      throw new Error('No user data received from Supabase');
    }

    console.log('[Auth] ✓ Successfully signed in with Google');
    if (__DEV__) {
      console.log('[Auth] User email:', data.user.email);
      console.log('[Auth] User ID:', data.user.id);
    } else {
      console.log('[Auth] User authenticated:', {
        hasEmail: Boolean(data.user.email),
        hasId: Boolean(data.user.id),
        emailDomain: data.user.email?.split('@')[1] ?? 'unknown'
      });
    }

    return data.user;
  } catch (error: unknown) {
    console.error('[Auth] ❌ Google Sign-In failed with error:');
    console.error('[Auth] Error object:', error);

    // Re-throw with more context for specific error codes
    const errorCode = (error as { code?: string })?.code;
    const errorMessage = (error as { message?: string })?.message;

    console.error('[Auth] Error code:', errorCode);
    console.error('[Auth] Error message:', errorMessage);

    if (errorCode === statusCodes.SIGN_IN_CANCELLED) {
      console.log('[Auth] → User cancelled');
      throw new Error('SIGN_IN_CANCELLED');
    } else if (errorCode === statusCodes.IN_PROGRESS) {
      console.log('[Auth] → Sign-in already in progress');
      throw new Error('Sign-in already in progress');
    } else if (errorCode === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.log('[Auth] → Play Services not available');
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
    console.error('Error during sign out:', error);
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
