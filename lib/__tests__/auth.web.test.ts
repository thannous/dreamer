import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSignInWithOAuth = jest.fn();
const mockSignOut = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetSession = jest.fn();
const mockSetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('../env', () => ({
  isMockModeEnabled: () => false,
}));

jest.mock('../logger', () => ({
  createScopedLogger: () => ({ warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('../mockAuth', () => ({
  signInWithGoogleWeb: jest.fn(),
}));

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
      setSession: mockSetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

jest.mock('@/services/subscriptionService', () => ({
  logOutSubscriptionUser: jest.fn(),
}));

describe('web auth helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user: { id: 'user-1' },
        },
      },
    });
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://dream.noctalia.app' },
    });
  });

  it('exports Google sign-in availability for web Lucid account', () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    expect(typeof auth.isGoogleSignInAvailable).toBe('function');
    expect(auth.isGoogleSignInAvailable()).toBe(true);
  });

  it('starts Google OAuth with the production origin as redirect', async () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.signInWithGoogleWeb();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'https://dream.noctalia.app',
      },
    });
  });

  it('returns to the current localhost origin after Google OAuth', async () => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:8081' },
    });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.signInWithGoogleWeb();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'http://localhost:8081',
      },
    });
  });

  it('keeps other browser and device sessions active on sign-out', async () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.signOut();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('surfaces a local sign-out failure', async () => {
    mockSignOut.mockResolvedValueOnce({
      error: new Error('local sign-out failed'),
    });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await expect(auth.signOut()).rejects.toThrow('local sign-out failed');
  });

  it('sends the password reset link back to the reset screen of the current origin', async () => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:8081' },
    });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.requestPasswordReset('user@example.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:8081/auth/reset-password',
    });
  });

  it('defaults the password reset link to production when no origin is available', async () => {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: undefined,
    });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.requestPasswordReset('user@example.com');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://dream.noctalia.app/auth/reset-password',
    });
  });

  it('surfaces password reset request errors', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ data: null, error: new Error('rate limited') });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await expect(auth.requestPasswordReset('user@example.com')).rejects.toThrow('rate limited');
  });

  it('updates the password and re-persists the session', async () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    const user = await auth.updatePassword('new-secret');

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-secret' });
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(user?.id).toBe('user-1');
  });

  it('surfaces password update errors without persisting a session', async () => {
    mockUpdateUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('weak password') });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await expect(auth.updatePassword('new-secret')).rejects.toThrow('weak password');
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('forwards recovery auth events and unsubscribes', async () => {
    const unsubscribe = jest.fn();
    mockOnAuthStateChange.mockReturnValueOnce({ data: { subscription: { unsubscribe } } });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const callback = jest.fn();

    const stop = auth.onPasswordRecovery(callback);
    const listener = mockOnAuthStateChange.mock.calls[0][0] as (
      event: string,
      session: unknown
    ) => void;
    const session = { access_token: 'access-token', user: { id: 'user-1' } };
    listener('PASSWORD_RECOVERY', session);
    listener('INITIAL_SESSION', null);
    stop();

    expect(callback).toHaveBeenNthCalledWith(1, 'PASSWORD_RECOVERY', session);
    expect(callback).toHaveBeenNthCalledWith(2, 'INITIAL_SESSION', null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
