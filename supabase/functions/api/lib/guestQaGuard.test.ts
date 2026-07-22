import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { requireGuestSession } from './guards.ts';
import { createGuestToken } from './guestToken.ts';

Deno.test('guest guard exposes only the signed QA quota subject to downstream routes', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  const fingerprint = 'a'.repeat(64);
  try {
    const session = await createGuestToken(fingerprint, 'android', {
      quotaSubject: 'qa:11111111-1111-4111-8111-111111111111',
    });
    const request = new Request('https://example.test/api/chat', {
      headers: {
        'x-guest-token': session.token,
        'x-guest-fingerprint': fingerprint,
        'x-guest-platform': 'android',
      },
    });

    const result = await requireGuestSession(request, null, null);
    if (result instanceof Response) throw new Error('Expected a verified guest subject');
    assertEquals(
      result.fingerprint,
      'qa:11111111-1111-4111-8111-111111111111'
    );
  } finally {
    if (previous) Deno.env.set('GUEST_SESSION_SECRET', previous);
    else Deno.env.delete('GUEST_SESSION_SECRET');
  }
});
