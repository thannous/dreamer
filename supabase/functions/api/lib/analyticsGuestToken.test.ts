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

    const iosSession = await createAnalyticsGuestToken('ios');
    assertEquals(await verifyAnalyticsGuestToken(iosSession.token), true);
    const iosPayloadPart = iosSession.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const iosPayload = JSON.parse(atob(iosPayloadPart.padEnd(Math.ceil(iosPayloadPart.length / 4) * 4, '=')));
    assertEquals(payload.v, 1);
    assertEquals(iosPayload.platform, 'ios');
    assertEquals(iosPayload.v, 2);
    assertEquals(/fingerprint|device[_-]?id|user_id|email/i.test(JSON.stringify(iosPayload)), false);

    // A correctly signed token from the previous proofless iOS issuer must
    // fail even before its normal 15-minute expiration.
    const [header] = iosSession.token.split('.');
    const legacyPayload = btoa(JSON.stringify({ ...iosPayload, v: 1 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const signedData = `${header}.${legacyPayload}`;
    const key = await crypto.subtle.importKey('raw',
      new TextEncoder().encode('product-analytics:analytics-test-secret-with-sufficient-entropy'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedData)))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    assertEquals(await verifyAnalyticsGuestToken(`${signedData}.${signature}`), false);
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
