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

  it('exchanges a recovery PKCE code only with the browser recovery verifier', async () => {
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'browser-recovery-verifier/PASSWORD_RECOVERY');
    history.replaceState(null, '', '/auth/reset-password?code=recovery-code');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'recovery-access', refresh_token: 'recovery-refresh',
        token_type: 'bearer', expires_in: 3600,
        user: { id: 'recovery-user', email: 'recovery@example.com' },
      }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { supabase, getWebRecoveryLinkState, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    expect(getWebRecoveryLinkState()).toBe('checking');
    await webAuthCallbackPromise;
    const { data } = await supabase.auth.getSession();

    expect(getWebRecoveryLinkState()).toBe('none');
    expect(data.session?.user.id).toBe('recovery-user');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/v1/token?grant_type=pkce');
    expect(location.pathname + location.search).toBe('/auth/reset-password');
  });

  it('exchanges a same-browser PKCE code with its stored verifier', async () => {
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'browser-verifier');
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
  });

  it('preserves an existing session when an injected code fails exchange', async () => {
    storeExistingSession();
    localStorage.setItem(`${STORAGE_KEY}-code-verifier`, 'browser-verifier');
    history.replaceState(null, '', '/recording?code=attacker-code');
    globalThis.fetch = jest.fn(async () => { throw new Error('invalid code'); }) as unknown as typeof fetch;

    const { supabase, webAuthCallbackPromise } = require('../supabase') as typeof import('../supabase');
    await webAuthCallbackPromise;
    const { data, error } = await supabase.auth.getSession();

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
