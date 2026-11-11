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
    ['legacy raw string from auth-js 2.89', 'browser-recovery-verifier/PASSWORD_RECOVERY'],
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

  it.each([
    ['current JSON', JSON.stringify('browser-verifier')],
    ['legacy raw', 'browser-verifier'],
  ])('exchanges a same-browser PKCE code with its %s verifier', async (_format: string, verifier: string) => {
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, verifier);
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

  it('exchanges an SDK-generated recovery flow without consuming a newer flow or the primary session', async () => {
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => String(input).includes('/recover') ? {} : {
        access_token: 'recovery-access', refresh_token: 'recovery-refresh',
        token_type: 'bearer', expires_in: 3600,
        user: { id: 'recovery-user', email: 'recovery@example.com' },
      },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const requestClient = createClient('https://example.supabase.co', 'anon-key', {
      auth: {
        storageKey: STORAGE_KEY, autoRefreshToken: false, persistSession: true,
        detectSessionInUrl: false, flowType: 'pkce',
        experimental: { appendPkceFlowIdToRedirects: true },
      },
    });
    try {
      for (let request = 0; request < 2; request += 1) {
        const { error } = await requestClient.auth.resetPasswordForEmail('recovery@example.com', {
          redirectTo: 'https://example.org/auth/reset-password?next=kept',
        });
        expect(error).toBeNull();
      }
    } finally {
      await requestClient.auth.dispose();
    }
    const callbackUrls: URL[] = fetchMock.mock.calls.map(([input]: [RequestInfo | URL, RequestInit?]) =>
      new URL(new URL(String(input)).searchParams.get('redirect_to')!)
    );
    const [firstFlow, newerFlow] = callbackUrls.map(url => url.searchParams.get('sb_flow_id')!);
    expect(firstFlow).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    expect(newerFlow).not.toBe(firstFlow);
    const firstKey = `${STORAGE_KEY}-flow-${firstFlow}-code-verifier`;
    const newerKey = `${STORAGE_KEY}-flow-${newerFlow}-code-verifier`;
    const firstVerifier = JSON.parse(localStorage.getItem(firstKey)!);
    const newerStoredVerifier = localStorage.getItem(newerKey);
    expect(firstVerifier).toMatch(/\/recovery$/);
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(newerStoredVerifier);
    storeExistingSession();
    callbackUrls[0].searchParams.set('code', 'first-recovery-code');
    history.replaceState(null, '', callbackUrls[0].pathname + callbackUrls[0].search);
    fetchMock.mockClear();

    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(getWebRecoveryLinkState()).toBe('pending');
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('existing-user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      auth_code: 'first-recovery-code', code_verifier: firstVerifier.split('/')[0],
    });
    expect(localStorage.getItem(firstKey)).toBeNull();
    expect(localStorage.getItem(newerKey)).toBe(newerStoredVerifier);
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(newerStoredVerifier);
    expect(JSON.parse(localStorage.getItem(`${STORAGE_KEY}-flows-code-verifier`)!)).toEqual([newerFlow]);
    expect(location.pathname + location.search + location.hash).toBe('/auth/reset-password?next=kept');
    expect(Object.keys(localStorage).some(key => key.startsWith('noctalia-recovery-pkce-'))).toBe(false);
  });

  it.each(['query', 'fragment'])('binds a normal PKCE %s callback to its own slot rather than the newer legacy mirror', async (component: string) => {
    const firstFlow = 'first-flow-1234';
    const newerFlow = 'newer-flow-5678';
    const firstKey = `${STORAGE_KEY}-flow-${firstFlow}-code-verifier`;
    const newerKey = `${STORAGE_KEY}-flow-${newerFlow}-code-verifier`;
    localStorage.setItem(firstKey, JSON.stringify('first-oauth-verifier'));
    localStorage.setItem(newerKey, JSON.stringify('newer-oauth-verifier'));
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, JSON.stringify('newer-oauth-verifier'));
    localStorage.setItem(`${STORAGE_KEY}-flows-code-verifier`, JSON.stringify([firstFlow, newerFlow]));
    const delimiter = component === 'query' ? '?' : '#';
    history.replaceState(null, '', `/recording${delimiter}code=bound-code&sb_flow_id=${firstFlow}`);
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
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

    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('bound-user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      auth_code: 'bound-code', code_verifier: 'first-oauth-verifier',
    });
    expect(localStorage.getItem(firstKey)).toBeNull();
    expect(localStorage.getItem(newerKey)).toBe(JSON.stringify('newer-oauth-verifier'));
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(JSON.stringify('newer-oauth-verifier'));
    expect(location.pathname + location.search + location.hash).toBe('/recording');
  });

  it.each(['/recording', '/auth/reset-password'])('does not borrow a legacy verifier when the requested slot is absent on %s', async (route: string) => {
    storeExistingSession();
    const legacy = JSON.stringify('other-flow-verifier/recovery');
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, legacy);
    localStorage.setItem(`${STORAGE_KEY}-flow-other-flow-1234-code-verifier`, legacy);
    history.replaceState(null, '', `${route}?code=untrusted-code&sb_flow_id=missing-flow-1234`);
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(fetchMock).not.toHaveBeenCalled();
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('existing-user');
    if (route === '/auth/reset-password') expect(getWebRecoveryLinkState()).toBe('invalid');
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(legacy);
    expect(localStorage.getItem(`${STORAGE_KEY}-flow-other-flow-1234-code-verifier`)).toBe(legacy);
    expect(location.pathname + location.search + location.hash).toBe(route);
  });

  it('does not use a recovery mirror when the selected flow belongs to OAuth', async () => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-flow-oauth-flow-1234-code-verifier`, JSON.stringify('oauth-verifier'));
    const legacy = JSON.stringify('other-reset-verifier/recovery');
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, legacy);
    history.replaceState(null, '', '/auth/reset-password?code=oauth-code&sb_flow_id=oauth-flow-1234');
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    expect(getWebRecoveryLinkState()).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('existing-user');
    expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(legacy);
  });

  it.each([
    ['legacy recovery verifier', 'browser-reset/PASSWORD_RECOVERY', null],
    ['current recovery flow', 'browser-reset/recovery', 'recovery-flow-1234'],
  ])('does not install a %s into the primary client on the recording route', async (
    _case: string, verifier: string, flowId: string | null,
  ) => {
    storeExistingSession();
    const key = flowId ? `${STORAGE_KEY}-flow-${flowId}-code-verifier` : `${STORAGE_KEY}-code-verifier`;
    const stored = JSON.stringify(verifier);
    localStorage.setItem(key, stored);
    history.replaceState(null, '', `/recording?code=recovery-code${flowId ? `&sb_flow_id=${flowId}` : ''}`);
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(fetchMock).not.toHaveBeenCalled();
    const { data } = await supabase.auth.getSession();
    expect(data.session?.user.id).toBe('existing-user');
    expect(data.session?.access_token).toBe('existing-access');
    expect(localStorage.getItem(key)).toBe(stored);
    expect(location.pathname + location.search + location.hash).toBe('/recording');
  });

  describe.each(['/recording', '/auth/reset-password'])('ambiguous PKCE callbacks on %s', (route: string) => {
    it.each([
      '?code=untrusted-code&sb_flow_id=first-flow-1234&sb_flow_id=first-flow-1234',
      '#code=untrusted-code&sb_flow_id=first-flow-1234&sb_flow_id=other-flow-5678',
      '?code=untrusted-code&sb_flow_id=first-flow-1234#sb_flow_id=first-flow-1234',
      '?code=untrusted-code#sb_flow_id=first-flow-1234',
      '?sb_flow_id=first-flow-1234#code=untrusted-code',
      '?code=untrusted-code&sb_flow_id=bad',
      '?code=untrusted-code&sb_flow_id=',
    ])('rejects %s without touching an existing session or verifier', async (suffix: string) => {
      storeExistingSession();
      const stored = JSON.stringify('reset-verifier/recovery');
      localStorage.setItem(`${STORAGE_KEY}-code-verifier`, stored);
      localStorage.setItem(`${STORAGE_KEY}-flow-first-flow-1234-code-verifier`, stored);
      history.replaceState(null, '', route + suffix);
      const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
      await webAuthCallbackPromise;
      expect(fetchMock).not.toHaveBeenCalled();
      expect((await supabase.auth.getSession()).data.session?.user.id).toBe('existing-user');
      if (route === '/auth/reset-password') expect(getWebRecoveryLinkState()).toBe('invalid');
      expect(localStorage.getItem(`${STORAGE_KEY}-code-verifier`)).toBe(stored);
      expect(localStorage.getItem(`${STORAGE_KEY}-flow-first-flow-1234-code-verifier`)).toBe(stored);
      expect(location.pathname + location.search + location.hash).toBe(route);
    });
  });

  it('signs in from the first of two overlapping email links with the verifier of its own flow', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => String(input).includes('/otp') ? {} : {
        access_token: 'first-access', refresh_token: 'first-refresh',
        token_type: 'bearer', expires_in: 3600,
        user: { id: 'first-user', email: 'first@example.com' },
      },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // The app's own client, as configured for the web, requests both links.
    const requesting = require('../supabase') as typeof import('../supabase');
    for (const email of ['first@example.com', 'second@example.com']) {
      const { error } = await requesting.supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: 'https://dream.noctalia.app/recording' },
      });
      expect(error).toBeNull();
    }
    const [firstLink, secondLink] = fetchMock.mock.calls.map(([input]: [RequestInfo | URL, RequestInit?]) =>
      new URL(new URL(String(input)).searchParams.get('redirect_to')!)
    );
    const firstFlow = firstLink.searchParams.get('sb_flow_id')!;
    const secondFlow = secondLink.searchParams.get('sb_flow_id')!;
    expect(firstFlow).toMatch(/^[a-zA-Z0-9_-]{8,64}$/);
    expect(secondFlow).not.toBe(firstFlow);
    expect(firstLink.origin + firstLink.pathname).toBe('https://dream.noctalia.app/recording');
    const firstVerifier = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-flow-${firstFlow}-code-verifier`)!);
    const secondStored = localStorage.getItem(`${STORAGE_KEY}-flow-${secondFlow}-code-verifier`);
    expect(JSON.parse(secondStored!)).not.toBe(firstVerifier);
    await requesting.supabase.auth.dispose();

    // The first email is opened after the second sign-in was requested.
    jest.resetModules();
    history.replaceState(null, '', `/recording?code=first-code&sb_flow_id=${firstFlow}`);
    fetchMock.mockClear();
    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      auth_code: 'first-code', code_verifier: firstVerifier,
    });
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('first-user');
    expect(localStorage.getItem(`${STORAGE_KEY}-flow-${secondFlow}-code-verifier`)).toBe(secondStored);
    expect(location.pathname + location.search + location.hash).toBe('/recording');
  });

  it('keeps a recovery token hash that the email template glued after the flow id', async () => {
    storeExistingSession();
    history.replaceState(null, '', '/auth/reset-password?sb_flow_id=reset-flow-1234?token_hash=recovery-proof&type=recovery');
    const fetchMock = jest.fn(async () => { throw new Error('unexpected exchange'); });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const {
      supabase, getWebRecoveryLinkState, getPendingWebRecoveryTokenHash, webAuthCallbackPromise,
    } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;

    expect(getWebRecoveryLinkState()).toBe('pending');
    expect(getPendingWebRecoveryTokenHash()).toBe('recovery-proof');
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('existing-user');
    expect(location.pathname + location.search + location.hash).toBe('/auth/reset-password');
  });

  it('does not read a glued token hash outside the reset route', async () => {
    storeExistingSession();
    history.replaceState(null, '', '/recording?sb_flow_id=reset-flow-1234?token_hash=recovery-proof&type=recovery');
    const { getWebRecoveryLinkState, getPendingWebRecoveryTokenHash } = require('../supabase') as typeof import('../supabase');

    expect(getWebRecoveryLinkState()).toBe('none');
    expect(getPendingWebRecoveryTokenHash()).toBeNull();
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
