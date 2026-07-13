import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { createAnalyticsGuestToken, verifyAnalyticsGuestToken } from './analyticsGuestToken.ts';

Deno.test('analytics guest token is purpose-bound and contains no quota/device identifier', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  try {
    const session = await createAnalyticsGuestToken();
    assertEquals(await verifyAnalyticsGuestToken(session.token), true);

    const payloadPart = session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=')));
    assertEquals(payload.purpose, 'product_analytics');
    assertEquals(payload.platform, 'android');
    assertStringIncludes(JSON.stringify(payload), 'session_id');
    assertEquals(/fingerprint|device[_-]?id|user_id|email/i.test(JSON.stringify(payload)), false);
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
});

Deno.test('analytics guest token rejects unrelated or malformed tokens', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'analytics-test-secret-with-sufficient-entropy');
  try {
    assertEquals(await verifyAnalyticsGuestToken(null), false);
    assertEquals(await verifyAnalyticsGuestToken('invalid.token.value'), false);
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
});
