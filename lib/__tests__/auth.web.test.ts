import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSignInWithOAuth = jest.fn();

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
    },
  },
}));

describe('web auth helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://dream.noctalia.app' },
    });
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
});
