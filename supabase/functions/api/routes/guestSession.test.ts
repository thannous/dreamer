import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleGuestSession } from './guestSession.ts';

async function requestGuestSession(body: Record<string, unknown>): Promise<Response> {
  return handleGuestSession(
    new Request('https://example.supabase.co/functions/v1/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

Deno.test('/guest/session refuses non-Android even when insecure env is enabled', async () => {
  const previous = Deno.env.get('ALLOW_INSECURE_GUEST_SESSION');
  Deno.env.set('ALLOW_INSECURE_GUEST_SESSION', 'true');

  try {
    const response = await requestGuestSession({
      fingerprint: 'attacker-controlled-fingerprint',
      platform: 'ios',
    });
    const body = await response.json();

    assertEquals(response.status, 401);
    assertEquals(body.error, 'Guest sessions disabled for this platform');
  } finally {
    if (previous == null) {
      Deno.env.delete('ALLOW_INSECURE_GUEST_SESSION');
    } else {
      Deno.env.set('ALLOW_INSECURE_GUEST_SESSION', previous);
    }
  }
});

Deno.test('/guest/session keeps Android gated on Play Integrity inputs', async () => {
  const response = await requestGuestSession({
    fingerprint: 'android-fingerprint',
    platform: 'android',
  });
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body.error, 'Missing integrity token');
});
