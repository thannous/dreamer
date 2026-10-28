import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  fingerprintRequestHash,
  isFreshIntegrityToken,
  MAX_INTEGRITY_TOKEN_AGE_MS,
  MAX_REQUEST_HASH_SEED_LENGTH,
  requestHashBinding,
} from './playIntegrity.ts';

const FINGERPRINT = 'f'.repeat(64);
const SEED = '1761609600000:0b7c4d4e-5d1e-4c55-9a3e-2b1f8f0c6a11';

Deno.test('the server hash matches the client SHA-256 hex of fingerprint and seed', async () => {
  // `printf 'abc:seed' | shasum -a 256`: lowercase hex, as expo-crypto returns it.
  assertEquals(
    await fingerprintRequestHash('abc', 'seed'),
    '3d039c74a24676cfaf5bc0cfe8afba67ca85f492fda939e4b2ee0320eb111569'
  );
});

Deno.test('a seed binds the request hash to the fingerprint it was computed for', async () => {
  const requestHash = await fingerprintRequestHash(FINGERPRINT, SEED);

  assertEquals(await requestHashBinding(FINGERPRINT, requestHash, SEED), 'bound');
  assertEquals(await requestHashBinding(FINGERPRINT, requestHash.toUpperCase(), SEED), 'bound');
  assertEquals(await requestHashBinding('e'.repeat(64), requestHash, SEED), 'mismatch');
  assertEquals(await requestHashBinding(FINGERPRINT, requestHash, `${SEED}x`), 'mismatch');
});

Deno.test('a request without a seed is a pre-transition build; a malformed seed never binds', async () => {
  const requestHash = await fingerprintRequestHash(FINGERPRINT, SEED);

  assertEquals(await requestHashBinding(FINGERPRINT, requestHash, undefined), 'legacy');
  assertEquals(await requestHashBinding(FINGERPRINT, requestHash, null), 'legacy');
  for (const seed of ['', 42, { seed: SEED }, 'x'.repeat(MAX_REQUEST_HASH_SEED_LENGTH + 1)]) {
    assertEquals(await requestHashBinding(FINGERPRINT, requestHash, seed), 'mismatch');
  }
});

Deno.test('a token is fresh within the window on either side of the server clock', () => {
  const now = 1_761_609_600_000;

  assertEquals(isFreshIntegrityToken(now - 2_000, now), true);
  assertEquals(isFreshIntegrityToken(now - MAX_INTEGRITY_TOKEN_AGE_MS, now), true);
  assertEquals(isFreshIntegrityToken(now + MAX_INTEGRITY_TOKEN_AGE_MS, now), true);
  assertEquals(isFreshIntegrityToken(now - MAX_INTEGRITY_TOKEN_AGE_MS - 1, now), false);
  assertEquals(isFreshIntegrityToken(now + MAX_INTEGRITY_TOKEN_AGE_MS + 1, now), false);
  assertEquals(isFreshIntegrityToken(undefined, now), false);
});
