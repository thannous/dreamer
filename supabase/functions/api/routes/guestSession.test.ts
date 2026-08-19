import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleGuestSession } from './guestSession.ts';

type Dependencies = Parameters<typeof handleGuestSession>[1];

async function requestGuestSession(
  body: Record<string, unknown>,
  dependencies?: Dependencies
): Promise<Response> {
  return handleGuestSession(
    new Request('https://example.supabase.co/functions/v1/api/guest/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    dependencies
  );
}

async function withGuestSecret<T>(run: () => Promise<T>): Promise<T> {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    return await run();
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
}

Deno.test('/guest/session issues an iOS guest token from fingerprint without integrity', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    const response = await requestGuestSession({
      fingerprint: 'ios-idfv-fingerprint',
      platform: 'ios',
    });
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(typeof body.token, 'string');
    assertEquals(typeof body.expiresAt, 'string');
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
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

Deno.test('/guest/session refuses unknown platforms', async () => {
  const response = await requestGuestSession({
    fingerprint: 'attacker-controlled-fingerprint',
    platform: 'desktop-app',
  });
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body.error, 'Guest sessions disabled for this platform');
});

Deno.test('/guest/session keeps web closed when Turnstile is not configured', async () => {
  const response = await requestGuestSession(
    { fingerprint: 'web-fingerprint', platform: 'web', turnstileToken: 'any' },
    { isTurnstileConfigured: () => false }
  );
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body.error, 'Guest sessions disabled for this platform');
});

Deno.test('/guest/session requires and verifies a Turnstile token for web guests', async () => {
  await withGuestSecret(async () => {
    const missing = await requestGuestSession(
      { fingerprint: 'web-fingerprint', platform: 'web' },
      { isTurnstileConfigured: () => true, verifyTurnstile: () => Promise.resolve({ ok: true }) }
    );
    assertEquals(missing.status, 401);
    assertEquals((await missing.json()).error, 'Missing Turnstile token');

    const rejected = await requestGuestSession(
      { fingerprint: 'web-fingerprint', platform: 'web', turnstileToken: 'bad' },
      { isTurnstileConfigured: () => true, verifyTurnstile: () => Promise.resolve({ ok: false, reason: 'rejected:invalid-input-response' }) }
    );
    assertEquals(rejected.status, 401);
    assertEquals((await rejected.json()).error, 'Turnstile check failed');

    let receivedAction: string | undefined;
    const accepted = await requestGuestSession(
      { fingerprint: 'web-fingerprint', platform: 'web', turnstileToken: 'good-token' },
      {
        isTurnstileConfigured: () => true,
        verifyTurnstile: (input) => {
          receivedAction = input.expectedAction;
          return Promise.resolve({ ok: true });
        },
      }
    );
    const body = await accepted.json();
    assertEquals(accepted.status, 200);
    assertEquals(typeof body.token, 'string');
    assertEquals(receivedAction, 'guest_session');
  });
});
