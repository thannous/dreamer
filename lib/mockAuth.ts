import type { User } from '@supabase/supabase-js';

import type { UserTier } from '@/constants/limits';
import { preloadDreamsNow, resetMockStorage, setPreloadDreamsEnabled } from '@/services/mocks/storageServiceMock';

export type MockProfile = 'new' | 'existing' | 'premium';

type ProfileConfig = {
  email: string;
  displayName: string;
  preloadDreams: boolean;
  tier: UserTier;
};

const PROFILE_CONFIG: Record<MockProfile, ProfileConfig> = {
  new: {
    email: 'mock.new@dreamer.app',
    displayName: 'New Dreamer',
    preloadDreams: false,
    tier: 'free',
  },
  existing: {
    email: 'mock.existing@dreamer.app',
    displayName: 'Existing Dreamer',
    preloadDreams: true,
    tier: 'free',
  },
  premium: {
    email: 'mock.premium@dreamer.app',
    displayName: 'Premium Dreamer',
    preloadDreams: false,
    tier: 'premium',
  },
};

let currentUser: User | null = null;
const listeners = new Set<(user: User | null) => void>();

function emitAuthChange(): void {
  listeners.forEach((listener) => {
    listener(currentUser);
  });
}

function buildMockUser(params: { email: string; displayName: string; tier: UserTier; profile: MockProfile }): User {
  const timestamp = new Date().toISOString();

  return {
    id: `mock-${params.profile}-${Math.random().toString(36).slice(2)}`,
    app_metadata: { provider: 'mock', providers: ['mock'] },
    user_metadata: {
      tier: params.tier,
      full_name: params.displayName,
      profile: params.profile,
    },
    aud: 'authenticated',
    email: params.email,
    created_at: timestamp,
    last_sign_in_at: timestamp,
    role: 'authenticated',
    identities: [],
  } as User;
}

function applyProfile(profile: MockProfile, emailOverride?: string): User {
  resetMockStorage();

  const config = PROFILE_CONFIG[profile];
  setPreloadDreamsEnabled(config.preloadDreams);
  if (config.preloadDreams) {
    preloadDreamsNow();
  }

  currentUser = buildMockUser({
    email: emailOverride ?? config.email,
    displayName: config.displayName,
    tier: config.tier,
    profile,
  });

  emitAuthChange();
  return currentUser;
}

export async function signInWithProfile(profile: MockProfile): Promise<User> {
  return applyProfile(profile);
}

export async function signInWithEmailPassword(email: string): Promise<User> {
  return applyProfile('existing', email);
}

export async function signUpWithEmailPassword(email: string): Promise<User> {
  return applyProfile('new', email);
}

export async function signInWithGoogle(): Promise<User> {
  return applyProfile('existing');
}

export async function signInWithGoogleWeb(): Promise<User> {
  return applyProfile('existing');
}

export async function signOut(): Promise<void> {
  currentUser = null;
  resetMockStorage();
  setPreloadDreamsEnabled(false);
  emitAuthChange();
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export async function getCurrentUser(): Promise<User | null> {
  return currentUser;
}

export async function getAccessToken(): Promise<string | null> {
  return currentUser ? 'mock-access-token' : null;
}
