import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleGuestSession, handleIosGuestChallenge } from './guestSession.ts';
import type { AppAttestStore } from '../lib/appleAppAttestStore.ts';

type Dependencies = Parameters<typeof handleGuestSession>[1];

function requestGuestSession(
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

Deno.test('/guest/session refuses iOS fingerprint without App Attest proof', async () => {
  const response = await requestGuestSession({
    fingerprint: 'a'.repeat(64),
    platform: 'ios',
  });
  assertEquals(response.status, 503); // Missing server configuration fails closed.
});

async function withAppAttestConfig<T>(run: () => Promise<T>): Promise<T> {
  const config = {
    IOS_APP_ATTEST_TEAM_ID: 'ABCDEFGHIJ',
    IOS_APP_ATTEST_BUNDLE_ID: 'com.tanuki75.noctalia',
    IOS_APP_ATTEST_ENVIRONMENT: 'development',
    IOS_APP_ATTEST_ALLOWED_BUNDLE_VERSIONS: '14',
  };
  const keys = [...Object.keys(config), 'IOS_APP_ATTEST_ALLOWED_APPS'];
  const previous = Object.fromEntries(keys.map((key) => [key, Deno.env.get(key)]));
  Deno.env.delete('IOS_APP_ATTEST_ALLOWED_APPS');
  for (const [key, value] of Object.entries(config)) Deno.env.set(key, value);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test('iOS challenge and attestation mint one guest token; replay is rejected', async () => {
  await withAppAttestConfig(() => withGuestSecret(async () => {
    const fingerprint = 'a'.repeat(64);
    const keyId = 'A'.repeat(43) + '=';
    const challengeId = 'signed.challenge';
    let consumed = false;
    const challenge = {
      id: challengeId,
      challenge: 'fresh-server-signed-challenge',
      key_id: keyId,
      fingerprint_hash: fingerprint,
      kind: 'attestation' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
    };
    const store: AppAttestStore = {
      issue: () => Promise.resolve(challenge),
      challenge: () => Promise.resolve(challenge),
      key: () => Promise.resolve(null),
      completeAttestation: (input) => {
        if (input.fingerprint !== fingerprint || consumed) return Promise.resolve(false);
        consumed = true;
        return Promise.resolve(true);
      },
      completeAssertion: () => Promise.resolve(false),
    };
    const challengeResponse = await handleIosGuestChallenge(new Request('https://example.com/guest/session/challenge', {
      method: 'POST', body: JSON.stringify({ fingerprint, keyId }),
    }), { appAttestStore: store });
    assertEquals(challengeResponse.status, 200);
    const challengeBody = await challengeResponse.json();
    assertEquals(challengeBody.kind, 'attestation');
    assertEquals(challengeBody.expiresAt, challenge.expires_at);

    const body = { fingerprint, platform: 'ios', keyId, challengeId, attestationObject: 'apple-proof' };
    const unauthenticated = await requestGuestSession({ fingerprint, platform: 'ios' }, { appAttestStore: store });
    assertEquals(unauthenticated.status, 401);
    const accepted = await requestGuestSession(body, {
      appAttestStore: store,
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAttestation: () => ({
        publicKeyPem: 'verified-key', receiptBase64: 'verified-receipt',
        environment: 'development', appId: 'ABCDEFGHIJ.com.tanuki75.noctalia',
      }),
    });
    assertEquals(accepted.status, 200);
    assertEquals(typeof (await accepted.json()).token, 'string');
    const replay = await requestGuestSession(body, { appAttestStore: store });
    assertEquals(replay.status, 401);
  }));
});

Deno.test('iOS App Attest accepts only an exact configured Dreamer or QA app identity', async () => {
  await withAppAttestConfig(() => withGuestSecret(async () => {
    Deno.env.set('IOS_APP_ATTEST_ALLOWED_APPS', JSON.stringify([
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia',
        environment: 'production', allowedBundleVersions: ['42'] },
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia.qa',
        environment: 'development', allowedBundleVersions: ['43'] },
    ]));
    const fingerprint = 'a'.repeat(64);
    const keyId = 'A'.repeat(43) + '=';
    const challengeId = 'signed.challenge';
    const challenge = {
      id: challengeId, challenge: 'fresh-server-signed-challenge',
      key_id: keyId, fingerprint_hash: fingerprint,
      kind: 'attestation' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    };
    let completions = 0;
    const store: AppAttestStore = {
      issue: () => Promise.resolve(challenge),
      challenge: () => Promise.resolve(challenge),
      key: () => Promise.resolve(null),
      completeAttestation: () => { completions += 1; return Promise.resolve(true); },
      completeAssertion: () => Promise.resolve(false),
    };
    const request = { fingerprint, platform: 'ios', keyId, challengeId, attestationObject: 'apple-proof' };
    const accepted = await requestGuestSession(request, {
      appAttestStore: store,
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAttestation: (input) => {
        if (input.expectedAppId !== 'ABCDEFGHIJ.com.tanuki75.noctalia.qa' ||
            input.expectedEnvironment !== 'development' ||
            input.allowedBundleVersions.join(',') !== '43') throw new Error('wrong app identity');
        return { publicKeyPem: 'verified-key', receiptBase64: 'verified-receipt',
          appId: input.expectedAppId, environment: input.expectedEnvironment };
      },
    });
    assertEquals(accepted.status, 200);
    assertEquals(completions, 1);

    const mismatched = await requestGuestSession(request, {
      appAttestStore: store,
      verifyAppAttestation: () => ({
        publicKeyPem: 'verified-key', receiptBase64: 'verified-receipt',
        appId: 'ABCDEFGHIJ.com.tanuki75.noctalia.evil', environment: 'development',
      }),
    });
    assertEquals(mismatched.status, 401);
    assertEquals(completions, 1);

    const assertionChallenge = { ...challenge, kind: 'assertion' as const };
    const qaKey = {
      key_id: keyId, fingerprint_hash: fingerprint, public_key_pem: 'verified-key',
      environment: 'development' as const,
      app_id: 'ABCDEFGHIJ.com.tanuki75.noctalia.qa', assertion_counter: 0,
    };
    const assertionStore: AppAttestStore = {
      issue: () => Promise.resolve(assertionChallenge),
      challenge: () => Promise.resolve(assertionChallenge),
      key: () => Promise.resolve(qaKey),
      completeAttestation: () => Promise.resolve(false),
      completeAssertion: () => Promise.resolve(true),
    };
    const asserted = await requestGuestSession({
      fingerprint, platform: 'ios', keyId, challengeId, assertionObject: 'apple-assertion',
    }, {
      appAttestStore: assertionStore,
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAssertion: (input) => {
        if (input.expectedAppId !== qaKey.app_id ||
            input.expectedEnvironment !== 'development' ||
            input.allowedBundleVersions.join(',') !== '43') throw new Error('wrong app identity');
        return 1;
      },
    });
    assertEquals(asserted.status, 200);

    Deno.env.set('IOS_APP_ATTEST_ALLOWED_APPS', JSON.stringify([
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.*', environment: 'development',
        allowedBundleVersions: ['43'] },
    ]));
    const invalidConfig = await handleIosGuestChallenge(new Request(
      'https://example.com/guest/session/challenge', {
        method: 'POST', body: JSON.stringify({ fingerprint, keyId }),
      }), { appAttestStore: store });
    assertEquals(invalidConfig.status, 503);
  }));
});

Deno.test('iOS assertion cannot move an attested key to another quota fingerprint', async () => {
  await withAppAttestConfig(async () => {
    const fingerprint = 'a'.repeat(64);
    const keyId = 'A'.repeat(43) + '=';
    const challengeId = 'signed.assertion';
    const challenge = {
      id: challengeId, challenge: 'another-fresh-server-challenge', key_id: keyId,
      fingerprint_hash: fingerprint, kind: 'assertion' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    };
    let verifierCalls = 0;
    const store: AppAttestStore = {
      issue: () => Promise.resolve(null),
      challenge: () => Promise.resolve(challenge),
      key: () => Promise.resolve({ key_id: keyId, fingerprint_hash: 'b'.repeat(64),
        public_key_pem: 'key', environment: 'development',
        app_id: 'ABCDEFGHIJ.com.tanuki75.noctalia', assertion_counter: 0 }),
      completeAttestation: () => Promise.resolve(false),
      completeAssertion: () => Promise.resolve(false),
    };
    const rejected = await requestGuestSession({ fingerprint, platform: 'ios', keyId,
      challengeId, assertionObject: 'signed-proof' }, {
      appAttestStore: store,
      verifyAppAssertion: () => { verifierCalls += 1; return 1; },
    });
    assertEquals(rejected.status, 401);
    assertEquals(verifierCalls, 0);
  });
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

Deno.test('/guest/session logs the Play Integrity verdict code without the token or request data', async () => {
  const integrityToken = 'secret-integrity-token-value';
  const requestHash = 'secret-request-hash-value';
  const fingerprint = 'secret-android-fingerprint';
  const reasons = ['package_mismatch', 'app_unrecognized', 'nonce_mismatch', 'device_not_integrity', 'decode_error'];
  const unexpectedReason = `leak:${integrityToken}`;

  const logged: unknown[][] = [];
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalError = console.error;
  const capture = (...args: unknown[]) => {
    logged.push(args);
  };
  console.warn = capture;
  console.log = capture;
  console.error = capture;
  try {
    for (const reason of [...reasons, unexpectedReason]) {
      const response = await requestGuestSession(
        { fingerprint, platform: 'android', integrityToken, requestHash },
        { verifyIntegrity: () => Promise.resolve({ ok: false, reason }) }
      );
      assertEquals(response.status, 401);
      await response.body?.cancel();
    }
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
  }

  const rejections = logged
    .filter((args) => args[0] === '[api] /guest/session integrity rejected')
    .map((args) => args[1]);
  assertEquals(rejections, [...reasons, 'other'].map((reason) => ({ reason })));

  const serialized = JSON.stringify(logged);
  for (const secret of [integrityToken, requestHash, fingerprint]) {
    assertEquals(serialized.includes(secret), false, `log must not contain ${secret}`);
  }
});
