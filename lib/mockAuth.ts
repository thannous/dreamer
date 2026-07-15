import type { Session, User } from '@supabase/supabase-js';

import type { UserTier } from '@/constants/limits';
import { resetGuestDreamRecordingCount } from '@/services/quota/GuestDreamCounter';
import { resetMockQuotaEvents } from '@/services/quota/MockQuotaEventStore';
import { quotaService } from '@/services/quotaService';
import { preloadDreamsNow, resetMockStorage, setPreloadDreamsEnabled } from '@/services/mocks/storageServiceMock';

export type MockProfile = 'new' | 'existing' | 'plus';

type ProfileConfig = {
  email: string;
  displayName: string;
  preloadDreams: boolean;
  tier: UserTier;
  emailConfirmed: boolean;
};

const PROFILE_CONFIG: Record<MockProfile, ProfileConfig> = {
  new: {
    email: 'mock.new@dreamer.app',
    displayName: 'New Dreamer',
    preloadDreams: false,
    tier: 'free',
    emailConfirmed: false,
  },
  existing: {
    email: 'mock.existing@dreamer.app',
    displayName: 'Existing Dreamer',
    preloadDreams: true,
    tier: 'free',
    emailConfirmed: true,
  },
  plus: {
    email: 'mock.plus@dreamer.app',
    displayName: 'Plus Dreamer',
    preloadDreams: true,
    tier: 'plus',
    emailConfirmed: true,
  },
};

let currentUser: User | null = null;
let accountCreatedOnDevice = false;
const listeners = new Set<(user: User | null, session: Session | null) => void>();

function emitAuthChange(): void {
  listeners.forEach((listener) => {
    listener(currentUser, null);
  });
}

function buildMockUser(params: {
  email: string;
  displayName: string;
  tier: UserTier;
  profile: MockProfile;
  emailConfirmed: boolean;
}): User {
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
    email_confirmed_at: params.emailConfirmed ? timestamp : null,
    role: 'authenticated',
    identities: [],
  } as User;
}

type ApplyProfileOptions = {
  preserveStorage?: boolean;
};

async function applyProfile(profile: MockProfile, emailOverride?: string, options?: ApplyProfileOptions): Promise<User> {
  const config = PROFILE_CONFIG[profile];
  const shouldResetState = !options?.preserveStorage;

  if (shouldResetState) {
    // Disable the previous profile before clearing storage so an eager quota
    // refresh cannot repopulate its predefined dreams during the reset.
    setPreloadDreamsEnabled(false);
    resetMockStorage();
    await Promise.all([
      resetMockQuotaEvents(),
      resetGuestDreamRecordingCount(),
    ]);
  }

  setPreloadDreamsEnabled(config.preloadDreams);
  if (config.preloadDreams) {
    preloadDreamsNow();
  }

  currentUser = buildMockUser({
    email: emailOverride ?? config.email,
    displayName: config.displayName,
    tier: config.tier,
    profile,
    emailConfirmed: config.emailConfirmed,
  });

  if (shouldResetState) {
    quotaService.invalidate(null);
  }
  emitAuthChange();
  return currentUser;
}

export async function signInWithProfile(profile: MockProfile): Promise<User> {
  return applyProfile(profile);
}

export async function signInWithEmailPassword(email: string, _lang?: string): Promise<User> {
  return applyProfile('existing', email);
}

export async function signUpWithEmailPassword(email: string, _lang?: string): Promise<User> {
  return applyProfile('new', email, { preserveStorage: true });
}

export async function signInWithGoogle(): Promise<User> {
  return applyProfile('existing');
}

export async function signInWithGoogleWeb(): Promise<User> {
  return applyProfile('existing');
}

export async function signOut(): Promise<void> {
  currentUser = null;
  setPreloadDreamsEnabled(false);
  resetMockStorage();
  await Promise.all([
    resetMockQuotaEvents(),
    resetGuestDreamRecordingCount(),
  ]);
  quotaService.invalidate(null);
  emitAuthChange();
}

// Simulate verification after resending so automated tests can cover both states.
export async function resendVerificationEmail(_email?: string): Promise<void> {
  if (!currentUser) {
    return;
  }
  currentUser = {
    ...currentUser,
    email_confirmed_at: new Date().toISOString(),
  } as User;
  emitAuthChange();
}

export function onAuthChange(callback: (user: User | null, session: Session | null) => void): () => void {
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

export async function updateUserTier(tier: UserTier): Promise<User | null> {
  if (!currentUser) {
    return null;
  }
  currentUser = {
    ...currentUser,
    user_metadata: {
      ...(currentUser.user_metadata ?? {}),
      tier,
    },
  } as User;
  emitAuthChange();
  return currentUser;
}

/**
 * Mark that an account has been created on this device (mock implementation).
 */
export async function markAccountCreatedOnDevice(): Promise<void> {
  accountCreatedOnDevice = true;
}

/**
 * Check if an account was ever created on this device (mock implementation).
 */
export async function wasAccountCreatedOnDevice(): Promise<boolean> {
  return accountCreatedOnDevice;
}

/**
 * Reset the account created flag (for testing purposes).
 */
export function resetAccountCreatedFlag(): void {
  accountCreatedOnDevice = false;
}
