import { Buffer } from 'node:buffer';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  isValidAppAttestAaguid,
  verifyAppleAppAssertion,
  verifyAppleAppAttestation,
  verifyAppleAppAttestationWithClientDataHash,
} from './appleAppAttest.ts';
import { APPLE_OFFICIAL_ATTESTATION_OBJECT } from './appleAppAttestOfficialFixture.ts';

const challenge = 'example_server_challenge';
const appId = '1234567890.com.example.myapp';
const keyId = 'zgSY9YSD+7TaDXssY6WlOPVS1K3Lmk+pFhlcSWE+ZV0=';
const fixtureTime = new Date('2026-04-21T18:13:12Z');
const fixtureInput = {
  keyId,
  challenge,
  attestationObject: APPLE_OFFICIAL_ATTESTATION_OBJECT,
  expectedAppId: appId,
  expectedEnvironment: 'production' as const,
  allowedBundleVersions: ['1'],
  // Apple's sample is an OS executable (category 1); Noctalia's production
  // policy only permits TestFlight/App Store (2/4).
  allowedCategories: [1],
  now: fixtureTime,
};

const fixtureHash = new TextEncoder().encode(challenge);

Deno.test('Apple development AAGUID variants stay sandbox-only', () => {
  const encode = (value: string) => new TextEncoder().encode(value);
  for (const value of ['appattestdevelop', 'appattestsandbox']) {
    assertEquals(isValidAppAttestAaguid(encode(value), 'development'), true);
    assertEquals(isValidAppAttestAaguid(encode(value), 'production'), false);
  }
  const production = new Uint8Array([...encode('appattest'), ...new Uint8Array(7)]);
  assertEquals(isValidAppAttestAaguid(production, 'production'), true);
  assertEquals(isValidAppAttestAaguid(production, 'development'), false);
});

Deno.test('Apple published attestation verifies chain, nonce, app ID, extensions, and CMS receipt', () => {
  const verified = verifyAppleAppAttestationWithClientDataHash(fixtureInput, fixtureHash);
  assertEquals(verified.appId, appId);
  assertEquals(verified.environment, 'production');
  assertEquals(verified.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'), true);
  assertEquals(verified.receiptBase64.length > 1000, true);
});

Deno.test('attestation rejects changed nonce, app, key, category, version, receipt, and expired chain', () => {
  assertThrows(() => verifyAppleAppAttestation(fixtureInput)); // Expo hashes the challenge; Apple's sample does not.
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash(fixtureInput,
    new TextEncoder().encode('wrong_server_challenge')));
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    expectedAppId: '1234567890.com.other.app' }, fixtureHash));
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    keyId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }, fixtureHash));
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    allowedCategories: undefined }, fixtureHash));
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    allowedBundleVersions: ['14'] }, fixtureHash));
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    now: new Date('2026-10-21T00:00:00Z') }, fixtureHash));

  const corrupted = Buffer.from(APPLE_OFFICIAL_ATTESTATION_OBJECT, 'base64');
  const receiptChallenge = corrupted.lastIndexOf(Buffer.from(challenge));
  if (receiptChallenge < 0) throw new Error('Official receipt fixture changed');
  corrupted[receiptChallenge] ^= 1;
  assertThrows(() => verifyAppleAppAttestationWithClientDataHash({ ...fixtureInput,
    attestationObject: corrupted.toString('base64') }, fixtureHash));
});

Deno.test('assertion verifies signed challenge and strictly increasing counter', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const assertionChallenge = 'fresh_server_challenge_12345';
  const authData = Buffer.alloc(37);
  createHash('sha256').update(appId).digest().copy(authData, 0);
  authData.writeUInt32BE(1, 33);
  const signed = Buffer.concat([authData, createHash('sha256').update(assertionChallenge).digest()]);
  const signature = sign('sha256', signed, privateKey);
  const assertionObject = Buffer.concat([
    Buffer.from([0xa2, 0x69]), Buffer.from('signature'),
    Buffer.from([0x58, signature.length]), signature,
    Buffer.from([0x71]), Buffer.from('authenticatorData'),
    Buffer.from([0x58, authData.length]), authData,
  ]).toString('base64');
  const input = {
    assertionObject,
    challenge: assertionChallenge,
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    expectedAppId: appId,
    expectedEnvironment: 'production' as const,
    allowedBundleVersions: ['14'],
    previousCounter: 0,
  };
  assertEquals(verifyAppleAppAssertion(input), 1);
  assertThrows(() => verifyAppleAppAssertion({ ...input, previousCounter: 1 }));
  assertThrows(() => verifyAppleAppAssertion({ ...input, challenge: 'fresh_server_challenge_99999' }));
  assertThrows(() => verifyAppleAppAssertion({ ...input, expectedAppId: '1234567890.com.other.app' }));
});
