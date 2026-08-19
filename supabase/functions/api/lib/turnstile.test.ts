import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { getRemoteIp, isTurnstileConfigured, verifyTurnstileToken } from './turnstile.ts';

const env = (values: Record<string, string | undefined>) => (name: string) => values[name];

Deno.test('turnstile is fail-closed without a secret', async () => {
  assertEquals(isTurnstileConfigured(env({})), false);
  assertEquals(isTurnstileConfigured(env({ TURNSTILE_SECRET_KEY: 'x' })), true);
  const verdict = await verifyTurnstileToken({ token: 'abc' }, { readEnv: env({}) });
  assertEquals(verdict, { ok: false, reason: 'not_configured' });
});

Deno.test('turnstile verification posts the token and honours the siteverify verdict', async () => {
  let sentBody = '';
  const fetchImpl = ((_url: string | URL | Request, init?: RequestInit) => {
    sentBody = String(init?.body ?? '');
    return Promise.resolve(
      new Response(JSON.stringify({ success: true, action: 'guest_session' }), { status: 200 })
    );
  }) as typeof fetch;

  const ok = await verifyTurnstileToken(
    { token: 'tok', remoteIp: '203.0.113.9', expectedAction: 'guest_session' },
    { fetchImpl, readEnv: env({ TURNSTILE_SECRET_KEY: 'secret' }) }
  );
  assertEquals(ok, { ok: true });
  const params = new URLSearchParams(sentBody);
  assertEquals(params.get('secret'), 'secret');
  assertEquals(params.get('response'), 'tok');
  assertEquals(params.get('remoteip'), '203.0.113.9');

  const mismatch = await verifyTurnstileToken(
    { token: 'tok', expectedAction: 'other' },
    { fetchImpl, readEnv: env({ TURNSTILE_SECRET_KEY: 'secret' }) }
  );
  assertEquals(mismatch, { ok: false, reason: 'action_mismatch' });

  const rejectingFetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 })
    )) as typeof fetch;
  const rejected = await verifyTurnstileToken(
    { token: 'tok' },
    { fetchImpl: rejectingFetch, readEnv: env({ TURNSTILE_SECRET_KEY: 'secret' }) }
  );
  assertEquals(rejected, { ok: false, reason: 'rejected:invalid-input-response' });
});

Deno.test('remote ip prefers the first x-forwarded-for entry', () => {
  assertEquals(getRemoteIp(new Headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' })), '198.51.100.4');
  assertEquals(getRemoteIp(new Headers({ 'cf-connecting-ip': '198.51.100.7' })), '198.51.100.7');
  assertEquals(getRemoteIp(new Headers()), null);
});
