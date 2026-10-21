import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { challengeCompletion, readChallenge, signChallenge } from './appleAppAttestStore.ts';

Deno.test('signed App Attest challenge binds key, fingerprint, kind and expiry without unauthenticated database rows', async () => {
  const previous = Deno.env.get('GUEST_SESSION_SECRET');
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  try {
    const payload = {
      v: 1 as const,
      challenge: 'A'.repeat(43),
      key_id: 'A'.repeat(43) + '=',
      fingerprint_hash: 'a'.repeat(64),
      kind: 'attestation' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const token = await signChallenge(payload);
    assertEquals((await readChallenge(token))?.key_id, payload.key_id);
    assertEquals((await readChallenge(token))?.kind, 'attestation');
    const [body, signature] = token.split('.');
    assertEquals(await readChallenge(body.slice(0, -1) + 'A.' + signature), null);
    assertEquals(await readChallenge(token + 'A'), null);
    assertEquals(await readChallenge(await signChallenge({
      ...payload, expires_at: new Date(Date.now() - 1000).toISOString(),
    })), null);
    assertEquals(await readChallenge(await signChallenge({
      ...payload, expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    })), null);
    const renewed = await signChallenge({
      ...payload, expires_at: new Date(Date.now() + 90_000).toISOString(),
    });
    const differentNonce = await signChallenge({
      ...payload, challenge: 'B'.repeat(43),
    });
    const firstDigest = (await challengeCompletion(
      token, 'attestation', payload.key_id, payload.fingerprint_hash))?.digest;
    assertEquals((await challengeCompletion(
      renewed, 'attestation', payload.key_id, payload.fingerprint_hash))?.digest,
    firstDigest);
    assertEquals((await challengeCompletion(
      differentNonce, 'attestation', payload.key_id, payload.fingerprint_hash))?.digest
      === firstDigest, false);
  } finally {
    if (previous == null) Deno.env.delete('GUEST_SESSION_SECRET');
    else Deno.env.set('GUEST_SESSION_SECRET', previous);
  }
});
