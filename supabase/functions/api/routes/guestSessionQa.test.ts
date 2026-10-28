import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { verifyGuestToken } from '../lib/guestToken.ts';
import { fingerprintRequestHash } from '../lib/playIntegrity.ts';
import { handleGuestSession } from './guestSession.ts';

const QA_SUBJECT = 'qa:11111111-1111-4111-8111-111111111111';

async function assertQaSession(
  fingerprint: string,
  proof: Record<string, unknown>,
  verdict: { ok: boolean; requestedAtMs?: number },
  strict: boolean
) {
  const previous = {
    GUEST_SESSION_SECRET: Deno.env.get('GUEST_SESSION_SECRET'),
    PLAY_INTEGRITY_STRICT: Deno.env.get('PLAY_INTEGRITY_STRICT'),
  };
  Deno.env.set('GUEST_SESSION_SECRET', 'test-only-secret-with-sufficient-entropy');
  if (strict) Deno.env.set('PLAY_INTEGRITY_STRICT', 'true');
  else Deno.env.delete('PLAY_INTEGRITY_STRICT');
  try {
    const response = await handleGuestSession(
      new Request('https://example.test/functions/v1/api/guest/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          integrityToken: 'play-integrity-token',
          platform: 'android',
          ...proof,
        }),
      }),
      {
        verifyIntegrity: async () => verdict,
        resolveQaPassport: async () => ({
          active: true,
          quotaSubject: QA_SUBJECT,
          validUntil: new Date(Date.now() + 60_000).toISOString(),
        }),
      }
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    const verified = await verifyGuestToken(body.token, fingerprint, 'android');
    assertEquals(verified.ok, true);
    assertEquals(verified.payload?.quotaSubject, QA_SUBJECT);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test('/guest/session binds an active QA passport to a Play-verified device token', async () => {
  await assertQaSession('a'.repeat(64), { requestHash: 'request-hash' }, { ok: true }, false);
});

Deno.test('a tester build with the hash seed keeps its QA passport once Play Integrity is strict', async () => {
  const fingerprint = 'a'.repeat(64);
  const requestHashSeed = '1761609600000:0b7c4d4e-5d1e-4c55-9a3e-2b1f8f0c6a11';
  await assertQaSession(
    fingerprint,
    { requestHash: await fingerprintRequestHash(fingerprint, requestHashSeed), requestHashSeed },
    { ok: true, requestedAtMs: Date.now() },
    true
  );
});
