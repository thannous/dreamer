import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { createGuestToken, verifyGuestToken } from './guestToken.ts';

Deno.test('signed guest token carries a server-owned QA quota subject', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    const session = await createGuestToken('a'.repeat(64), 'android', {
      quotaSubject: 'qa:11111111-1111-4111-8111-111111111111',
      validUntil: new Date(Date.now() + 60_000).toISOString(),
    });
    const verified = await verifyGuestToken(session.token, 'a'.repeat(64), 'android');

    assertEquals(verified.ok, true);
    assertEquals(
      verified.payload?.quotaSubject,
      'qa:11111111-1111-4111-8111-111111111111'
    );
    assertEquals(Date.parse(session.expiresAt) <= Date.now() + 60_000, true);
  } finally {
    if (previous) Deno.env.set('GUEST_SESSION_SECRET', previous);
    else Deno.env.delete('GUEST_SESSION_SECRET');
  }
});

Deno.test('legacy signed iOS v1 tokens expire at the App Attest boundary while new iOS v2 and Android v1 work', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    const oldIos = await createGuestToken('a'.repeat(64), 'android');
    // A legacy server produced a signed v1 token with platform=ios. Re-sign
    // its payload with the same test secret to reproduce that exact case.
    const [header, payload] = oldIos.token.split('.');
    const legacyPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    legacyPayload.platform = 'ios';
    const legacyBody = btoa(JSON.stringify(legacyPayload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const data = `${header}.${legacyBody}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('GUEST_SESSION_SECRET')!),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
    const signature = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    assertEquals((await verifyGuestToken(`${data}.${signature}`, 'a'.repeat(64), 'ios')).ok, false);

    const newIos = await createGuestToken('a'.repeat(64), 'ios');
    assertEquals((await verifyGuestToken(newIos.token, 'a'.repeat(64), 'ios')).ok, true);
    assertEquals((await verifyGuestToken(oldIos.token, 'a'.repeat(64), 'android')).ok, true);
  } finally {
    if (previous) Deno.env.set('GUEST_SESSION_SECRET', previous);
    else Deno.env.delete('GUEST_SESSION_SECRET');
  }
});
