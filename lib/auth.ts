import type { User } from '@supabase/supabase-js';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import * as mockAuth from './mockAuth';
import type { SubscriptionTier } from './types';

export type { MockProfile } from './mockAuth';

const isMockMode = ((process?.env as Record<string, string> | undefined)?.EXPO_PUBLIC_MOCK_MODE ?? '') === 'true';

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

  GoogleSignin.configure({
    webClientId,
    scopes: ['openid', 'email', 'profile'],
    offlineAccess: false,
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

export async function signUpWithEmailPassword(email: string, password: string) {
  if (isMockMode) {
    return mockAuth.signUpWithEmailPassword(email);
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
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

  try {
    // Check for Play Services availability (Android)
    await GoogleSignin.hasPlayServices();

    // Sign in with Google
    const userInfo = await GoogleSignin.signIn();

    if (!userInfo.data?.idToken) {
      throw new Error('No ID token received from Google');
    }

    // Sign in to Supabase with the Google ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.data.idToken,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('No user data received from Supabase');
    }

    return data.user;
  } catch (error: any) {
    // Re-throw with more context for specific error codes
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('SIGN_IN_CANCELLED');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Sign-in already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
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
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }
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
