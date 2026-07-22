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
