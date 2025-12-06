import type { User } from '@supabase/supabase-js';

import * as mockAuth from './mockAuth';
import { supabase } from './supabase';
import type { SubscriptionTier } from './types';

export type { MockProfile } from './mockAuth';

const isMockMode = ((process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_MOCK_MODE ?? '') === 'true';
const EMAIL_REDIRECT_WEB = 'https://noctalia.app/auth/callback';

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

  const { error } = await supabase.auth.resend({ type: 'signup', email });
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

export async function updateUserTier(tier: SubscriptionTier): Promise<User | null> {
  if (isMockMode) {
    return mockAuth.updateUserTier(tier);
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      data: { tier },
    });
    if (error) {
      throw error;
    }
    return data.user ?? null;
  } catch (error) {
    console.error('Failed to update user tier', error);
    throw error;
  }
}
