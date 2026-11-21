import { assert, assertEquals } from 'jsr:@std/assert@1';
import { verifyGuestToken } from '../../supabase/functions/api/lib/guestToken.ts';
import { withSimulatorGuestSessions } from './simulatorGuest.ts';

const APP_ID = '27BLU7U28W.com.tanuki75.noctalia';
const fingerprint = 'a'.repeat(64);
const post = (body: unknown) => new Request('http://192.168.1.9:31300/functions/v1/api/guest/session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const notReached = async () => new Response('next', { status: 299 });

async function withSecret<T>(run: () => Promise<T>): Promise<T> {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'dev-local-test-secret-with-enough-entropy');
  try {
    return await run();
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
}

Deno.test('a Simulator guest gets a Dreamer iOS guest token that the guest routes accept', () => withSecret(async () => {
  const handler = withSimulatorGuestSessions(APP_ID, notReached);
  const response = await handler(post({ fingerprint, platform: 'ios', localSimulator: true }));
  assertEquals(response.status, 200);
  const { token, expiresAt } = await response.json();
  assert(Date.parse(expiresAt) > Date.now());
  const verified = await verifyGuestToken(token, fingerprint, 'ios', 'dreamer');
  assertEquals(verified.ok, true);
  assertEquals(verified.payload?.appId, APP_ID);
}));

Deno.test('every other guest request keeps the real flow', async () => {
  const seen: unknown[] = [];
  const handler = withSimulatorGuestSessions(APP_ID, async (req) => {
    seen.push(await req.json());
    return new Response('next', { status: 299 });
  });
  for (const body of [
    { fingerprint, platform: 'ios', keyId: 'k', challengeId: 'c' },
    { fingerprint, platform: 'ios', localSimulator: 'true' },
    { fingerprint, platform: 'android', localSimulator: true },
    { fingerprint, platform: 'web', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX' },
  ]) {
    assertEquals((await handler(post(body))).status, 299);
  }
  // The real handler still reads the untouched body.
  assertEquals(seen.length, 4);
});

Deno.test('a Simulator request with a proof or a malformed fingerprint is refused', () => withSecret(async () => {
  const handler = withSimulatorGuestSessions(APP_ID, notReached);
  for (const body of [
    { fingerprint, platform: 'ios', localSimulator: true, keyId: 'k' },
    { fingerprint, platform: 'ios', localSimulator: true, attestationObject: 'x' },
    { fingerprint: 'not-a-fingerprint', platform: 'ios', localSimulator: true },
    { platform: 'ios', localSimulator: true },
  ]) {
    assertEquals((await handler(post(body))).status, 400);
  }
}));
