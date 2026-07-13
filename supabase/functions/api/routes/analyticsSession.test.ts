import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

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
