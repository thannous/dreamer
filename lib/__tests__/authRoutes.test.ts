import { describe, expect, it } from '@jest/globals';

import { PASSWORD_RESET_ROUTE, isPasswordResetPath } from '../authRoutes';

describe('authRoutes', () => {
  it('recognises the password reset route with or without query, hash or trailing slash', () => {
    expect(isPasswordResetPath(PASSWORD_RESET_ROUTE)).toBe(true);
    expect(isPasswordResetPath('/auth/reset-password/')).toBe(true);
    expect(isPasswordResetPath('/auth/reset-password?lang=fr')).toBe(true);
    expect(isPasswordResetPath('/auth/reset-password#access_token=abc&type=recovery')).toBe(true);
  });

  it('rejects other auth and app routes', () => {
    expect(isPasswordResetPath('/auth/callback')).toBe(false);
    expect(isPasswordResetPath('/auth/reset-password-old')).toBe(false);
    expect(isPasswordResetPath('/recording')).toBe(false);
    expect(isPasswordResetPath(null)).toBe(false);
    expect(isPasswordResetPath(undefined)).toBe(false);
    expect(isPasswordResetPath('')).toBe(false);
  });
});
