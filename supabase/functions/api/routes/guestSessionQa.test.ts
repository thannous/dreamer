import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyGuestToken } from '../lib/guestToken.ts';
import { handleGuestSession } from './guestSession.ts';

Deno.test('/guest/session binds an active QA passport to a Play-verified device token', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  const fingerprint = 'a'.repeat(64);
  try {
    const response = await handleGuestSession(
      new Request('https://example.test/functions/v1/api/guest/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          requestHash: 'request-hash',
          integrityToken: 'play-integrity-token',
          platform: 'android',
        }),
      }),
      {
        verifyIntegrity: async () => ({ ok: true }),
        resolveQaPassport: async () => ({
          active: true,
          quotaSubject: 'qa:11111111-1111-4111-8111-111111111111',
          validUntil: new Date(Date.now() + 60_000).toISOString(),
        }),
      }
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    const verified = await verifyGuestToken(body.token, fingerprint, 'android');
    assertEquals(verified.ok, true);
    assertEquals(
      verified.payload?.quotaSubject,
      'qa:11111111-1111-4111-8111-111111111111'
    );
  } finally {
    if (previous) Deno.env.set('GUEST_SESSION_SECRET', previous);
    else Deno.env.delete('GUEST_SESSION_SECRET');
  }
});
