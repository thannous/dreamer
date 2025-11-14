import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCurrentUser,
  resendVerificationEmail,
  signOut,
  signUpWithEmailPassword,
} from '@/lib/mockAuth';

describe('mockAuth email verification', () => {
  const email = 'mock.verify@dreamer.test';

  beforeEach(async () => {
    await signOut();
  });

  it('initializes new sign ups as unverified', async () => {
    const user = await signUpWithEmailPassword(email);
    expect(user.email_confirmed_at).toBeNull();
  });

  it('marks the user as verified after resending the verification email', async () => {
    await signUpWithEmailPassword(email);
    await resendVerificationEmail(email);
    const user = await getCurrentUser();
    expect(user?.email_confirmed_at).toBeTruthy();
  });
});
