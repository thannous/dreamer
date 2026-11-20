import { assertEquals } from 'jsr:@std/assert@1';
import { createGuestToken } from '../../supabase/functions/api/lib/guestToken.ts';
import { createGuestResetHandler } from './guestReset.ts';

const fingerprint = 'b'.repeat(64);
const request = (headers: Record<string, string> = {}) =>
  new Request('http://127.0.0.1:31300/functions/v1/api/dev-local/guest-reset', { method: 'POST', headers, body: '{}' });

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

Deno.test('a guest resets only its own device', () => withSecret(async () => {
  const reset: string[] = [];
  const handler = createGuestResetHandler(async (value) => { reset.push(value); return { guestUsage: 1 }; });
  const { token } = await createGuestToken(fingerprint, 'web');
  const response = await handler({
    req: request({ 'x-guest-token': token, 'x-guest-fingerprint': fingerprint, 'x-guest-platform': 'web' }),
    user: null,
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { reset: true, forgotten: { guestUsage: 1 } });
  assertEquals(reset, [fingerprint]);
}));

Deno.test('the reset needs a valid guest session and no signed-in account', () => withSecret(async () => {
  const reset: string[] = [];
  const handler = createGuestResetHandler(async (value) => { reset.push(value); return {}; });
  const { token } = await createGuestToken(fingerprint, 'web');
  // Another device's fingerprint with this token, no session, or an account: nothing is reset.
  assertEquals((await handler({ req: request({ 'x-guest-token': token, 'x-guest-fingerprint': 'c'.repeat(64) }), user: null })).status, 401);
  assertEquals((await handler({ req: request(), user: null })).status, 401);
  assertEquals((await handler({ req: request({ 'x-guest-token': token, 'x-guest-fingerprint': fingerprint }), user: { id: 'u' } })).status, 400);
  assertEquals(reset, []);
}));
