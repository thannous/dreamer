/* @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('expo-secure-store', () => ({}));

const STORAGE_KEY = 'sb-example-auth-token';
const now = () => Math.floor(Date.now() / 1000);
const originalFetch = globalThis.fetch;

function storeExistingSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: 'existing-access',
    refresh_token: 'existing-refresh',
    token_type: 'bearer',
    expires_at: now() + 3600,
    user: { id: 'existing-user', email: 'existing@example.com' },
  }));
}

describe('real Supabase web URL boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    history.replaceState(null, '', '/recording');
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '/recording');
    globalThis.fetch = originalFetch;
  });

  it.each([
    '/recording#access_token=attacker-access&refresh_token=attacker-refresh&token_type=bearer&expires_in=3600',
    '/recording?access_token=attacker-access&refresh_token=attacker-refresh&token_type=bearer&expires_in=3600',
  ])('does not replace an existing session with injected URL credentials: %s', async (path: string) => {
    storeExistingSession();
    history.replaceState(null, '', path);
    const { supabase } = require('../supabase') as typeof import('../supabase');

    const { data, error } = await supabase.auth.getSession();

    expect(error).toBeNull();
    expect(data.session?.user.id).toBe('existing-user');
    expect(data.session?.access_token).toBe('existing-access');
    expect(location.pathname + location.search + location.hash).toBe('/recording');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').user.id).toBe('existing-user');
  });

  it('rejects an implicit recovery link instead of installing its session', async () => {
    history.replaceState(null, '', '/auth/reset-password#access_token=unbound-access&refresh_token=unbound-refresh&type=recovery&expires_in=3600');
    const { supabase, getWebRecoveryLinkState } = require('../supabase') as typeof import('../supabase');

    const { data } = await supabase.auth.getSession();

    expect(data.session).toBeNull();
    expect(getWebRecoveryLinkState()).toBe('invalid');
    expect(location.pathname + location.search + location.hash).toBe('/auth/reset-password');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not exchange an OAuth code on the reset route when its verifier is not recovery-scoped', async () => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'browser-oauth-verifier');
    history.replaceState(null, '', '/auth/reset-password?code=oauth-code');
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    const { data } = await supabase.auth.getSession();

    expect(getWebRecoveryLinkState()).toBe('invalid');
    expect(data.session?.user.id).toBe('existing-user');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(location.pathname + location.search).toBe('/auth/reset-password');
  });

  it('does not exchange a serialized OAuth verifier on the recovery route', async () => {
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, JSON.stringify('browser-oauth-verifier'));
    history.replaceState(null, '', '/auth/reset-password?code=oauth-code');
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    expect(getWebRecoveryLinkState()).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['null', '42', JSON.stringify({ verifier: 'browser/PASSWORD_RECOVERY' })])(
    'refuses non-string JSON recovery verifiers', async (stored: string) => {
      localStorage.setItem(`${STORAGE_KEY}-code-verifier`, stored);
      history.replaceState(null, '', '/auth/reset-password?code=untrusted-code');
      const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const { getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
      await webAuthCallbackPromise;
      expect(getWebRecoveryLinkState()).toBe('invalid');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  // auth-js 2.119 marks a recovery verifier `/recovery` and returns that as
  // redirectType; 2.89 used `/PASSWORD_RECOVERY`, which a reset requested
  // before an app update still holds.
  it.each([
    ['JSON from auth-js', JSON.stringify('browser-recovery-verifier/recovery')],
    ['JSON from auth-js 2.89', JSON.stringify('browser-recovery-verifier/PASSWORD_RECOVERY')],
    ['legacy raw string', 'browser-recovery-verifier/recovery'],
  ])('exchanges a recovery PKCE code using the %s verifier', async (_format: string, verifier: string) => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, verifier);
    history.replaceState(null, '', '/auth/reset-password?code=recovery-code');
    const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => String(input).endsWith('/user')
        ? { user: { id: 'recovery-user', email: 'recovery@example.com' } }
        : {
          access_token: 'recovery-access', refresh_token: 'recovery-refresh',
          token_type: 'bearer', expires_in: 3600,
          user: { id: 'recovery-user', email: 'recovery@example.com' },
        },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    expect(getWebRecoveryLinkState()).toBe('checking');
    await webAuthCallbackPromise;
    const { data } = await supabase.auth.getSession();

    expect(getWebRecoveryLinkState()).toBe('pending');
    expect(data.session?.user.id).toBe('existing-user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=pkce');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      auth_code: 'recovery-code', code_verifier: 'browser-recovery-verifier',
    });
    const { updatePasswordFromPendingWebRecoveryPkce } = require('../supabase') as typeof import('../supabase');
    await expect(updatePasswordFromPendingWebRecoveryPkce('other@example.com', 'new-secret'))
      .rejects.toThrow('recovery_email_mismatch');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await updatePasswordFromPendingWebRecoveryPkce('recovery@example.com', 'new-secret');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization)
      .toBe('Bearer recovery-access');
    const { data: after } = await supabase.auth.getSession();
    expect(after.session?.user.id).toBe('existing-user');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('existing-user');
    expect(Object.keys(localStorage).filter((key) => key.startsWith('noctalia-recovery-pkce-'))).toEqual([]);
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBeNull();
    expect(location.pathname + location.search).toBe('/auth/reset-password');
  });

  it('opens the reset form from the link that the installed auth-js asked for', async () => {
    // No hand-written storage: auth-js itself stores the verifier and builds
    // the redirect, as it does when the reset email is requested in this browser.
    const requests: string[] = [];
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    }) as unknown as typeof fetch;
    const first = require('../supabase') as typeof import('../supabase');
    const { error } = await first.supabase.auth.resetPasswordForEmail('recovery@example.com', {
      redirectTo: 'https://example.org/auth/reset-password',
    });
    expect(error).toBeNull();
    const redirect = new URL(new URL(requests[0]).searchParams.get('redirect_to') ?? '');
    expect(redirect.pathname).toBe('/auth/reset-password');

    jest.resetModules();
    redirect.searchParams.set('code', 'recovery-code');
    history.replaceState(null, '', `${redirect.pathname}${redirect.search}`);
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        access_token: 'recovery-access', refresh_token: 'recovery-refresh',
        token_type: 'bearer', expires_in: 3600,
        user: { id: 'recovery-user', email: 'recovery@example.com' },
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(getWebRecoveryLinkState()).toBe('pending');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=pkce');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).code_verifier).toMatch(/^[^/]+$/);
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBeNull();
    expect(location.pathname + location.search).toBe('/auth/reset-password');
  });

  it('exchanges a same-browser PKCE code with its stored verifier', async () => {
    // auth-js writes the verifier as JSON, and 2.119 ignores any other value.
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, JSON.stringify('browser-verifier'));
    history.replaceState(null, '', '/recording?code=bound-code');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'bound-access', refresh_token: 'bound-refresh',
        token_type: 'bearer', expires_in: 3600,
        user: { id: 'bound-user', email: 'bound@example.com' },
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    const { data, error } = await supabase.auth.getSession();

    expect(error).toBeNull();
    expect(data.session?.user.id).toBe('bound-user');
    expect(location.pathname + location.search).toBe('/recording');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=pkce');
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({
      auth_code: 'bound-code', code_verifier: 'browser-verifier',
    });
  });

  it('preserves an existing session when an injected code fails exchange', async () => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, JSON.stringify('browser-verifier'));
    history.replaceState(null, '', '/recording?code=attacker-code');
    const fetchMock = jest.fn(async () => { throw new Error('invalid code'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    const { data, error } = await supabase.auth.getSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(error).toBeNull();
    expect(data.session?.user.id).toBe('existing-user');
    expect(data.session?.access_token).toBe('existing-access');
    expect(location.pathname + location.search).toBe('/recording');
  });

  it('leaves a Lucid callback code and the Supabase PKCE verifier untouched', async () => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'browser-verifier');
    history.replaceState(null, '', '/auth/callback/success?code=lucid-code');
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    const { data } = await supabase.auth.getSession();

    expect(data.session?.user.id).toBe('existing-user');
    expect(location.pathname + location.search).toBe('/auth/callback/success?code=lucid-code');
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe('browser-verifier');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
