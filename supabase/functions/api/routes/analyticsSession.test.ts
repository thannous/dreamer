import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
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

Deno.test('analytics guest session accepts iOS without Play Integrity', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  try {
    const response = await handleAnalyticsGuestSession(
      new Request('https://example.supabase.co/functions/v1/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'ios',
        }),
      })
    );
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
