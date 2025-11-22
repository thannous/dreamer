import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getAccessToken,
    getCurrentUser,
    onAuthChange,
    resendVerificationEmail,
    signInWithEmailPassword,
    signInWithGoogle,
    signInWithGoogleWeb,
    signInWithProfile,
    signOut,
    signUpWithEmailPassword,
    updateUserTier,
} from '@/lib/mockAuth';

// Mock storage service to avoid side effects
vi.mock('@/services/mocks/storageServiceMock', () => ({
  resetMockStorage: vi.fn(),
  setPreloadDreamsEnabled: vi.fn(),
  preloadDreamsNow: vi.fn(),
}));

describe('mockAuth', () => {
  const email = 'mock.verify@dreamer.test';

  beforeEach(async () => {
    await signOut();
  });

  describe('email verification', () => {
    it('given new sign up when signing up then initializes as unverified', async () => {
      // Given
      const email = 'mock.verify@dreamer.test';

      // When
      const user = await signUpWithEmailPassword(email);

      // Then
      expect(user.email_confirmed_at).toBeNull();
    });

    it('given unverified user when resending verification then marks as verified', async () => {
      // Given
      await signUpWithEmailPassword(email);

      // When
      await resendVerificationEmail(email);

      // Then
      const user = await getCurrentUser();
      expect(user?.email_confirmed_at).toBeTruthy();
    });
  });

  describe('signInWithProfile', () => {
    it('given new profile when signing in then returns new user with unverified email', async () => {
      // Given
      const profile = 'new';

      // When
      const user = await signInWithProfile(profile);

      // Then
      expect(user.email).toBe('mock.new@dreamer.app');
      expect(user.user_metadata?.profile).toBe('new');
      expect(user.user_metadata?.tier).toBe('free');
      expect(user.email_confirmed_at).toBeNull();
    });

    it('given existing profile when signing in then returns existing user with verified email', async () => {
      // Given
      const profile = 'existing';

      // When
      const user = await signInWithProfile(profile);

      // Then
      expect(user.email).toBe('mock.existing@dreamer.app');
      expect(user.user_metadata?.profile).toBe('existing');
      expect(user.user_metadata?.tier).toBe('free');
      expect(user.email_confirmed_at).toBeTruthy();
    });

    it('given premium profile when signing in then returns premium user with verified email', async () => {
      // Given
      const profile = 'premium';

      // When
      const user = await signInWithProfile(profile);

      // Then
      expect(user.email).toBe('mock.premium@dreamer.app');
      expect(user.user_metadata?.profile).toBe('premium');
      expect(user.user_metadata?.tier).toBe('premium');
      expect(user.email_confirmed_at).toBeTruthy();
    });
  });

  describe('signInWithEmailPassword', () => {
    it('given email when signing in then returns existing user with that email', async () => {
      // Given
      const email = 'custom@example.com';

      // When
      const user = await signInWithEmailPassword(email);

      // Then
      expect(user.email).toBe(email);
      expect(user.user_metadata?.profile).toBe('existing');
      expect(user.email_confirmed_at).toBeTruthy();
    });
  });

  describe('signInWithGoogle', () => {
    it('given Google sign in when signing in then returns existing user', async () => {
      // Given
      // No parameters needed for Google sign in

      // When
      const user = await signInWithGoogle();

      // Then
      expect(user.email).toBe('mock.existing@dreamer.app');
      expect(user.user_metadata?.profile).toBe('existing');
      expect(user.email_confirmed_at).toBeTruthy();
    });
  });

  describe('signInWithGoogleWeb', () => {
    it('given Google web sign in when signing in then returns existing user', async () => {
      // Given
      // No parameters needed for Google web sign in

      // When
      const user = await signInWithGoogleWeb();

      // Then
      expect(user.email).toBe('mock.existing@dreamer.app');
      expect(user.user_metadata?.profile).toBe('existing');
      expect(user.email_confirmed_at).toBeTruthy();
    });
  });

  describe('onAuthChange', () => {
    it('given callback when registering auth change then returns unsubscribe function', () => {
      // Given
      const callback = vi.fn();

      // When
      const unsubscribe = onAuthChange(callback);

      // Then
      expect(typeof unsubscribe).toBe('function');
      expect(callback).not.toHaveBeenCalled(); // No immediate call
    });

    it('given registered callback when unsubscribing then stops receiving auth changes', async () => {
      // Given
      const callback = vi.fn();
      const unsubscribe = onAuthChange(callback);

      // When
      unsubscribe();
      await signInWithProfile('new');

      // Then
      expect(callback).toHaveBeenCalledTimes(0); // Never called since unsubscribed
    });

    it('given multiple callbacks when auth changes then all callbacks are notified', async () => {
      // Given
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      onAuthChange(callback1);
      onAuthChange(callback2);

      // When
      await signInWithProfile('new');

      // Then
      expect(callback1).toHaveBeenCalledTimes(1); // Called after sign in
      expect(callback2).toHaveBeenCalledTimes(1); // Called after sign in
      expect(callback1).toHaveBeenCalledWith(expect.any(Object)); // Called with user object
      expect(callback2).toHaveBeenCalledWith(expect.any(Object)); // Called with user object
    });
  });

  describe('getAccessToken', () => {
    it('given signed in user when getting access token then returns mock token', async () => {
      // Given
      await signInWithProfile('new');

      // When
      const token = await getAccessToken();

      // Then
      expect(token).toBe('mock-access-token');
    });

    it('given signed out user when getting access token then returns null', async () => {
      // Given
      await signOut();

      // When
      const token = await getAccessToken();

      // Then
      expect(token).toBeNull();
    });
  });

  describe('updateUserTier', () => {
    it('given signed in user when updating tier then returns user with new tier', async () => {
      // Given
      await signInWithProfile('new');
      const newTier = 'premium';

      // When
      const user = await updateUserTier(newTier);

      // Then
      expect(user).toBeTruthy();
      expect(user?.user_metadata?.tier).toBe(newTier);
    });

    it('given signed out user when updating tier then returns null', async () => {
      // Given
      await signOut();
      const newTier = 'premium';

      // When
      const user = await updateUserTier(newTier);

      // Then
      expect(user).toBeNull();
    });

    it('given user with existing metadata when updating tier then preserves other metadata', async () => {
      // Given
      await signInWithProfile('existing');
      const newTier = 'premium';

      // When
      const user = await updateUserTier(newTier);

      // Then
      expect(user?.user_metadata?.tier).toBe(newTier);
      expect(user?.user_metadata?.full_name).toBe('Existing Dreamer');
      expect(user?.user_metadata?.profile).toBe('existing');
    });
  });
});
