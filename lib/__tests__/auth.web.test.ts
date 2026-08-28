import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockSignInWithOAuth = jest.fn();
const mockExchangeCodeForSession = jest.fn();
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
      exchangeCodeForSession: mockExchangeCodeForSession,
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

const PRODUCTION_ORIGIN = 'https://dream.noctalia.app';
const OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
const OAUTH_SESSION = {
  access_token: 'oauth-access',
  refresh_token: 'oauth-refresh',
  user: { id: 'user-1' },
};

type OAuthHarnessMessage = {
  origin: string;
  data: unknown;
  source: unknown;
};

type MessageHandler = (event: OAuthHarnessMessage) => void;

function createOAuthPopupHarness(options?: {
  blocked?: boolean;
  origin?: string;
}) {
  const origin = options?.origin ?? PRODUCTION_ORIGIN;
  const messageListeners: MessageHandler[] = [];
  const popup = {
    closed: false,
    location: { href: 'about:blank' },
    close: jest.fn(() => {
      popup.closed = true;
    }),
  };
  const browserWindow = {
    location: { origin },
    open: jest.fn(() => (options?.blocked ? null : popup)),
    addEventListener: jest.fn((type: string, handler: MessageHandler) => {
      if (type === 'message') {
        messageListeners.push(handler);
      }
    }),
    removeEventListener: jest.fn((type: string, handler: MessageHandler) => {
      if (type !== 'message') return;
      const index = messageListeners.indexOf(handler);
      if (index >= 0) {
        messageListeners.splice(index, 1);
      }
    }),
  };

  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: browserWindow,
  });

  return {
    origin,
    popup,
    browserWindow,
    dispatchMessage(event: OAuthHarnessMessage) {
      for (const listener of [...messageListeners]) {
        listener(event);
      }
    },
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('web auth helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: OAUTH_AUTHORIZE_URL },
      error: null,
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: OAUTH_SESSION },
      error: null,
    });
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
      value: { origin: PRODUCTION_ORIGIN },
    });
    Reflect.deleteProperty(globalThis, 'window');
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('exports Google sign-in availability for web Lucid account', () => {
    const auth = require('../auth.web') as typeof import('../auth.web');

    expect(typeof auth.isGoogleSignInAvailable).toBe('function');
    expect(auth.isGoogleSignInAvailable()).toBe(true);
  });

  it('posts the complete callback URL to a same-origin opener', () => {
    const html = readFileSync(join(__dirname, '../../public/auth-callback.html'), 'utf8');

    expect(html).toContain('window.opener.postMessage(href, window.location.origin)');
    expect(html).toContain('var href = window.location.href;');
  });

  it('opens an empty popup then exchanges the same-origin PKCE code', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();

    await flushMicrotasks();

    expect(harness.browserWindow.open).toHaveBeenCalledWith(
      'about:blank',
      'noctalia-google-oauth',
      'popup=yes,width=480,height=720'
    );
    expect(harness.browserWindow.open.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignInWithOAuth.mock.invocationCallOrder[0]
    );
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: `${PRODUCTION_ORIGIN}/auth-callback.html`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    expect(harness.popup.location.href).toBe(OAUTH_AUTHORIZE_URL);

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=oauth-code`,
    });
    await pending;

    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
    expect(harness.browserWindow.removeEventListener).toHaveBeenCalled();
  });

  it('initializes a session from the implicit callback fragment', async () => {
    const harness = createOAuthPopupHarness();
    mockSetSession.mockResolvedValueOnce({
      data: { session: OAUTH_SESSION },
      error: null,
    });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();

    await flushMicrotasks();
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#access_token=oauth-access&refresh_token=oauth-refresh&token_type=bearer`,
    });
    await pending;

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'oauth-access',
      refresh_token: 'oauth-refresh',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
    expect(harness.browserWindow.removeEventListener).toHaveBeenCalled();
  });

  it('prefers implicit tokens over a PKCE code so the session is initialized once', async () => {
    const harness = createOAuthPopupHarness();
    mockSetSession.mockResolvedValueOnce({
      data: { session: OAUTH_SESSION },
      error: null,
    });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();

    await flushMicrotasks();
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=oauth-code#access_token=oauth-access&refresh_token=oauth-refresh`,
    });
    await pending;

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('uses the current localhost origin for the static OAuth callback', async () => {
    const origin = 'http://localhost:8081';
    const harness = createOAuthPopupHarness({ origin });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();

    await flushMicrotasks();
    harness.dispatchMessage({
      origin,
      source: harness.popup,
      data: `${origin}/auth-callback.html?code=local-code`,
    });
    await pending;

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: `${origin}/auth-callback.html`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('local-code');
  });

  it('ignores messages from another origin or window and exchanges only once', async () => {
    const harness = createOAuthPopupHarness();
    let resolveExchange: ((value: { data: { session: typeof OAUTH_SESSION }; error: null }) => void) | undefined;
    mockExchangeCodeForSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExchange = resolve;
        })
    );
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: 'https://evil.example',
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=evil-code`,
    });
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: {},
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=other-window`,
    });
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=first-code`,
    });
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=second-code`,
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('first-code');

    resolveExchange?.({ data: { session: OAUTH_SESSION }, error: null });
    await pending;
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('ignores duplicate implicit callback messages after session initialization starts', async () => {
    const harness = createOAuthPopupHarness();
    let resolveSetSession:
      | ((value: { data: { session: typeof OAUTH_SESSION }; error: null }) => void)
      | undefined;
    mockSetSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSetSession = resolve;
        })
    );
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#access_token=first-access&refresh_token=first-refresh`,
    });
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#access_token=second-access&refresh_token=second-refresh`,
    });

    expect(mockSetSession).toHaveBeenCalledTimes(1);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'first-access',
      refresh_token: 'first-refresh',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();

    resolveSetSession?.({ data: { session: OAUTH_SESSION }, error: null });
    await pending;
    expect(mockSetSession).toHaveBeenCalledTimes(1);
  });

  it('ignores a same-origin popup message whose data URL is not the static callback', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/lucid/account?code=wrong-path`,
    });
    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: 'https://evil.example/auth-callback.html?code=wrong-origin',
    });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=valid-code`,
    });
    await pending;

    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code');
  });

  it('fails when the implicit callback is missing tokens', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#token_type=bearer`,
    });

    await expect(pending).rejects.toThrow('Google sign-in callback was missing credentials.');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('fails when the implicit callback is missing a refresh token', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#access_token=oauth-access`,
    });

    await expect(pending).rejects.toThrow('Google sign-in callback was malformed.');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('rejects a one-sided implicit fragment even when a PKCE code is also present', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=oauth-code#access_token=oauth-access`,
    });

    await expect(pending).rejects.toThrow('Google sign-in callback was malformed.');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('rejects a refresh token without an access token even when a PKCE code is also present', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=oauth-code#refresh_token=oauth-refresh`,
    });

    await expect(pending).rejects.toThrow('Google sign-in callback was malformed.');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('fails when implicit setSession returns no session', async () => {
    const harness = createOAuthPopupHarness();
    mockSetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html#access_token=oauth-access&refresh_token=oauth-refresh`,
    });

    await expect(pending).rejects.toThrow('Google sign-in did not return a session.');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('fails when the code exchange returns no session', async () => {
    const harness = createOAuthPopupHarness();
    mockExchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?code=oauth-code`,
    });

    await expect(pending).rejects.toThrow('Google sign-in did not return a session.');
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('surfaces a blocked Google sign-in popup', async () => {
    createOAuthPopupHarness({ blocked: true });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await expect(auth.signInWithGoogleWeb()).rejects.toThrow('Google sign-in popup was blocked.');
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('closes the empty popup without a waiter when Google OAuth cannot start', async () => {
    const harness = createOAuthPopupHarness();
    mockSignInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: new Error('oauth provider unavailable'),
    });
    const auth = require('../auth.web') as typeof import('../auth.web');

    await expect(auth.signInWithGoogleWeb()).rejects.toThrow('oauth provider unavailable');
    expect(harness.popup.close).toHaveBeenCalled();
    expect(harness.browserWindow.addEventListener).not.toHaveBeenCalled();
    expect(harness.browserWindow.removeEventListener).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('surfaces an OAuth error returned to the callback', async () => {
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.dispatchMessage({
      origin: PRODUCTION_ORIGIN,
      source: harness.popup,
      data: `${PRODUCTION_ORIGIN}/auth-callback.html?error=access_denied&error_description=User%20cancelled`,
    });

    await expect(pending).rejects.toThrow('User cancelled');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(harness.popup.close).toHaveBeenCalled();
  });

  it('surfaces a closed Google sign-in popup', async () => {
    jest.useFakeTimers();
    const harness = createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    harness.popup.closed = true;
    jest.advanceTimersByTime(250);

    await expect(pending).rejects.toThrow('Google sign-in popup was closed.');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('surfaces a Google sign-in timeout', async () => {
    jest.useFakeTimers();
    createOAuthPopupHarness();
    const auth = require('../auth.web') as typeof import('../auth.web');
    const pending = auth.signInWithGoogleWeb();
    await flushMicrotasks();

    jest.advanceTimersByTime(120_000);

    await expect(pending).rejects.toThrow('Google sign-in timed out.');
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
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
