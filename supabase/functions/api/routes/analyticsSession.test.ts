import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
import { createGuestToken } from '../lib/guestToken.ts';
import { IOS_LEGACY_GUEST_MAX_BUILD_ENV, IOS_LEGACY_GUEST_UNTIL_ENV } from '../lib/iosLegacyGuest.ts';
import { handleAnalyticsGuestSession } from './analyticsSession.ts';

Deno.test('analytics guest session requires an Android Play Integrity proof without device identity', async () => {
  const response = await handleAnalyticsGuestSession(
    new Request('https://example.supabase.co/functions/v1/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'android' }),
    })
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: 'Invalid integrity proof' });
});

Deno.test('analytics guest session rejects fingerprint and device id fields', async () => {
  const response = await handleAnalyticsGuestSession(
    new Request('https://example.supabase.co/functions/v1/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'android',
        requestHash: 'a'.repeat(64),
        integrityToken: 'x'.repeat(32),
        fingerprint: 'forbidden',
      }),
    })
  );

  assertEquals(response.status, 400);
});

Deno.test('analytics guest session accepts an attested Lucid iOS v3 guest token', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  try {
    const fingerprint = 'a'.repeat(64);
    const request = (token?: string, claimedFingerprint = fingerprint) =>
      new Request('https://example.supabase.co/functions/v1/api/analytics/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-guest-token': token } : {}),
          'x-guest-fingerprint': claimedFingerprint,
        },
        body: JSON.stringify({ platform: 'ios' }),
      });
    assertEquals((await handleAnalyticsGuestSession(request())).status, 401);
    const ios = await createGuestToken(fingerprint, 'ios', {
      appId: 'ABCDEFGHIJ.com.tanuki75.noctalia.lucid',
    });
    assertEquals((await handleAnalyticsGuestSession(request(ios.token, 'b'.repeat(64)))).status, 401);
    const android = await createGuestToken(fingerprint, 'android');
    assertEquals((await handleAnalyticsGuestSession(request(android.token))).status, 401);

    const response = await handleAnalyticsGuestSession(request(ios.token));
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(typeof body.token, 'string');
    assertEquals(typeof body.expiresAt, 'string');
    assertEquals(await verifyAnalyticsGuestToken(body.token), true);
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
});

Deno.test('a pre-3.7.0 iOS build keeps the v120 analytics session only inside the legacy window', async () => {
  const keys = ['GUEST_SESSION_SECRET', IOS_LEGACY_GUEST_UNTIL_ENV, IOS_LEGACY_GUEST_MAX_BUILD_ENV];
  const previous = Object.fromEntries(keys.map((key) => [key, Deno.env.get(key)]));
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  const request = (userAgent: string | null) =>
    new Request('https://example.supabase.co/functions/v1/api/analytics/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '198.51.100.88',
        ...(userAgent ? { 'User-Agent': userAgent } : {}),
      },
      body: JSON.stringify({ platform: 'ios' }),
    });
  const legacyUa = 'Noctalia/14 CFNetwork/3896.100.1.2.1 Darwin/27.0.0';
  const logged: unknown[][] = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args: unknown[]) => logged.push(args);
  console.warn = (...args: unknown[]) => logged.push(args);
  try {
    Deno.env.delete(IOS_LEGACY_GUEST_UNTIL_ENV);
    Deno.env.delete(IOS_LEGACY_GUEST_MAX_BUILD_ENV);
    assertEquals((await handleAnalyticsGuestSession(request(legacyUa))).status, 401);

    Deno.env.set(IOS_LEGACY_GUEST_UNTIL_ENV, new Date(Date.now() + 86_400_000).toISOString());
    Deno.env.set(IOS_LEGACY_GUEST_MAX_BUILD_ENV, '14');
    const accepted = await handleAnalyticsGuestSession(request(legacyUa));
    assertEquals(accepted.status, 200);
    assertEquals(await verifyAnalyticsGuestToken((await accepted.json()).token), true);
    assertEquals((await handleAnalyticsGuestSession(request('Noctalia/15 CFNetwork/3896 Darwin/27.0.0'))).status, 401);
    assertEquals((await handleAnalyticsGuestSession(request(null))).status, 401);

    Deno.env.set(IOS_LEGACY_GUEST_UNTIL_ENV, new Date(Date.now() - 1000).toISOString());
    assertEquals((await handleAnalyticsGuestSession(request(legacyUa))).status, 401);
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
  assertEquals(logged.map((args) => [args[0], args[1]]), [
    ['[api] ios legacy guest rejected', { route: 'analytics_session', reason: 'legacy_disabled' }],
    ['[api] ios legacy guest', { route: 'analytics_session', reason: 'legacy_accepted', build: 14 }],
    ['[api] ios legacy guest rejected', { route: 'analytics_session', reason: 'legacy_version_too_new' }],
    ['[api] ios legacy guest rejected', { route: 'analytics_session', reason: 'legacy_version_unknown' }],
    ['[api] ios legacy guest rejected', { route: 'analytics_session', reason: 'legacy_expired' }],
  ]);
  assertEquals(JSON.stringify(logged).includes('198.51.100.88'), false);
});
