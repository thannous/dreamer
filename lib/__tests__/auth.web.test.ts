import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSignInWithOAuth = jest.fn();
const mockCreateWebOAuthState = jest.fn(() => 'web-oauth-state');

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
  createWebOAuthState: mockCreateWebOAuthState,
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

describe('web auth helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateWebOAuthState.mockReturnValue('web-oauth-state');
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://dream.noctalia.app' },
    });
  });

  it('starts Google OAuth with an app-bound state parameter', async () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    await auth.signInWithGoogleWeb();

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: 'https://dream.noctalia.app',
        queryParams: { state: 'web-oauth-state' },
      },
    });
  });
});
