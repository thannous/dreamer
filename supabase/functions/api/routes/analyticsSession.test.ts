import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
import { createGuestToken } from '../lib/guestToken.ts';
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

Deno.test('analytics guest session requires an attested iOS v2 guest token', async () => {
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
    const ios = await createGuestToken(fingerprint, 'ios');
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
