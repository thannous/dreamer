import type { User } from '@supabase/supabase-js';

import * as mockAuth from './mockAuth';
import { isMockModeEnabled } from './env';
import { supabase } from './supabase';
import type { SubscriptionTier } from './types';

export type { MockProfile } from './mockAuth';

const isMockMode = isMockModeEnabled();
const EMAIL_REDIRECT_WEB = 'https://dream.noctalia.app/recording';

/**
 * Initialize Google Sign-In with web client ID
 * Web uses Supabase OAuth popup, so nothing to configure here
 */
export function initializeGoogleSignIn() {
  // No-op on web
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
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
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

export async function signUpWithEmailPassword(email: string, password: string, userLang?: string) {
  if (isMockMode) {
    return mockAuth.signUpWithEmailPassword(email, userLang);
  }

  const signUpOptions = {
    emailRedirectTo: EMAIL_REDIRECT_WEB,
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
      emailRedirectTo: EMAIL_REDIRECT_WEB,
    },
  });
  if (error) throw error;
}

/**
 * Sign in with Google using Supabase OAuth popup (web)
 */
export async function signInWithGoogleWeb(): Promise<void> {
  if (isMockMode) {
    await mockAuth.signInWithGoogleWeb();
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
    },
  });
  if (error) throw error;
}

/**
 * Native Google Sign-In should not be used on web
 */
export async function signInWithGoogle(): Promise<User> {
  if (isMockMode) {
    return mockAuth.signInWithGoogle();
  }

  throw new Error('Google Sign-In on web should use the web-specific implementation');
}

/**
 * Complete sign out from both Google (mock) and Supabase
 */
export async function signOut() {
  if (isMockMode) {
    await mockAuth.signOut();
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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
