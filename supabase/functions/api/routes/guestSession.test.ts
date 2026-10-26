import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  handleGuestSession,
  handleIosGuestChallenge,
  toLoggedAttestationConfigResult,
  toLoggedIosGuestReason,
} from './guestSession.ts';
import { handleAnalyticsGuestSession } from './analyticsSession.ts';
import { AppAttestProofError } from '../lib/appleAppAttest.ts';
import type { AppAttestStore } from '../lib/appleAppAttestStore.ts';
import { verifyGuestToken } from '../lib/guestToken.ts';

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
    const issued = await accepted.json();
    assertEquals(typeof issued.token, 'string');
    assertEquals((await verifyGuestToken(issued.token, fingerprint, 'ios')).payload?.appId,
      'ABCDEFGHIJ.com.tanuki75.noctalia');
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
    const qaToken = (await accepted.json()).token as string;
    assertEquals((await verifyGuestToken(qaToken, fingerprint, 'ios')).payload?.appId,
      'ABCDEFGHIJ.com.tanuki75.noctalia.qa');

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

Deno.test('iOS App Attest passes a configured minimum build to both verifiers', async () => {
  await withAppAttestConfig(() => withGuestSecret(async () => {
    const setApps = (apps: unknown[]) =>
      Deno.env.set('IOS_APP_ATTEST_ALLOWED_APPS', JSON.stringify(apps));
    const fingerprint = 'a'.repeat(64);
    const keyId = 'A'.repeat(43) + '=';
    const challengeId = 'signed.challenge';
    const challenge = {
      id: challengeId, challenge: 'fresh-server-signed-challenge',
      key_id: keyId, fingerprint_hash: fingerprint,
      kind: 'attestation' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    };
    const store: AppAttestStore = {
      issue: () => Promise.resolve(challenge),
      challenge: () => Promise.resolve(challenge),
      key: () => Promise.resolve(null),
      completeAttestation: () => Promise.resolve(true),
      completeAssertion: () => Promise.resolve(false),
    };
    const request = { fingerprint, platform: 'ios', keyId, challengeId, attestationObject: 'apple-proof' };
    const seen: { allowed: string; minimum?: string }[] = [];
    const attest = () => requestGuestSession(request, {
      appAttestStore: store,
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAttestation: (input) => {
        seen.push({ allowed: input.allowedBundleVersions.join(','), minimum: input.minimumBundleVersion });
        return { publicKeyPem: 'verified-key', receiptBase64: 'verified-receipt',
          appId: input.expectedAppId, environment: input.expectedEnvironment };
      },
    });

    setApps([{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia',
      environment: 'production', minimumBundleVersion: '15' }]);
    assertEquals((await attest()).status, 200);
    setApps([{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia',
      environment: 'production', allowedBundleVersions: ['14'], minimumBundleVersion: '15' }]);
    assertEquals((await attest()).status, 200);
    assertEquals(seen, [{ allowed: '', minimum: '15' }, { allowed: '14', minimum: '15' }]);

    const assertionChallenge = { ...challenge, kind: 'assertion' as const };
    const key = {
      key_id: keyId, fingerprint_hash: fingerprint, public_key_pem: 'verified-key',
      environment: 'production' as const,
      app_id: 'ABCDEFGHIJ.com.tanuki75.noctalia', assertion_counter: 0,
    };
    let assertedMinimum: string | undefined;
    const asserted = await requestGuestSession({
      fingerprint, platform: 'ios', keyId, challengeId, assertionObject: 'apple-assertion',
    }, {
      appAttestStore: {
        ...store,
        issue: () => Promise.resolve(assertionChallenge),
        challenge: () => Promise.resolve(assertionChallenge),
        key: () => Promise.resolve(key),
        completeAssertion: () => Promise.resolve(true),
      },
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAssertion: (input) => {
        assertedMinimum = input.minimumBundleVersion;
        return 1;
      },
    });
    assertEquals(asserted.status, 200);
    assertEquals(assertedMinimum, '15');

    // No build rule, an empty list, or a non-numeric minimum fails closed.
    for (const apps of [
      [{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia', environment: 'production' }],
      [{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia', environment: 'production',
        allowedBundleVersions: [], minimumBundleVersion: '15' }],
      [{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia', environment: 'production',
        minimumBundleVersion: '15b' }],
      [{ teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia', environment: 'production',
        minimumBundleVersion: 15 }],
    ]) {
      setApps(apps);
      const refused = await handleIosGuestChallenge(new Request(
        'https://example.com/guest/session/challenge', {
          method: 'POST', body: JSON.stringify({ fingerprint, keyId }),
        }), { appAttestStore: store });
      assertEquals(refused.status, 503);
    }
  }));
});

Deno.test('iOS App Attest single-app fallback accepts a minimum build alone', async () => {
  await withAppAttestConfig(() => withGuestSecret(async () => {
    const previous = Deno.env.get('IOS_APP_ATTEST_MIN_BUNDLE_VERSION');
    Deno.env.delete('IOS_APP_ATTEST_ALLOWED_BUNDLE_VERSIONS');
    Deno.env.set('IOS_APP_ATTEST_MIN_BUNDLE_VERSION', '15');
    try {
      const store: AppAttestStore = {
        issue: (fingerprint, keyId) => Promise.resolve({
          id: 'signed.challenge', challenge: 'fresh-server-signed-challenge',
          key_id: keyId, fingerprint_hash: fingerprint, kind: 'attestation',
          expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
        }),
        challenge: () => Promise.resolve(null),
        key: () => Promise.resolve(null),
        completeAttestation: () => Promise.resolve(false),
        completeAssertion: () => Promise.resolve(false),
      };
      const issue = () => handleIosGuestChallenge(new Request(
        'https://example.com/guest/session/challenge', {
          method: 'POST', body: JSON.stringify({ fingerprint: 'a'.repeat(64), keyId: 'A'.repeat(43) + '=' }),
        }), { appAttestStore: store });
      assertEquals((await issue()).status, 200);
      Deno.env.delete('IOS_APP_ATTEST_MIN_BUNDLE_VERSION');
      assertEquals((await issue()).status, 503);
    } finally {
      if (previous == null) Deno.env.delete('IOS_APP_ATTEST_MIN_BUNDLE_VERSION');
      else Deno.env.set('IOS_APP_ATTEST_MIN_BUNDLE_VERSION', previous);
    }
  }));
});

Deno.test('Lucid App Attest issues an analytics-only iOS guest token', async () => {
  await withAppAttestConfig(() => withGuestSecret(async () => {
    const appId = 'ABCDEFGHIJ.com.tanuki75.noctalia.lucid';
    Deno.env.set('IOS_APP_ATTEST_ALLOWED_APPS', JSON.stringify([
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia.lucid',
        environment: 'production', allowedBundleVersions: ['1'] },
    ]));
    const fingerprint = 'a'.repeat(64);
    const keyId = 'A'.repeat(43) + '=';
    const challengeId = 'signed.challenge';
    const challenge = {
      id: challengeId, challenge: 'fresh-server-signed-challenge', key_id: keyId,
      fingerprint_hash: fingerprint, kind: 'attestation' as const,
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    };
    const store: AppAttestStore = {
      issue: () => Promise.resolve(challenge),
      challenge: () => Promise.resolve(challenge),
      key: () => Promise.resolve(null),
      completeAttestation: () => Promise.resolve(true),
      completeAssertion: () => Promise.resolve(false),
    };
    const issued = await requestGuestSession({
      fingerprint, platform: 'ios', keyId, challengeId, attestationObject: 'apple-proof',
    }, {
      appAttestStore: store,
      resolveQaPassport: () => Promise.resolve(null),
      verifyAppAttestation: (input) => {
        if (input.expectedAppId !== appId || input.expectedEnvironment !== 'production') {
          throw new Error('wrong app identity');
        }
        return { publicKeyPem: 'verified-key', receiptBase64: 'verified-receipt',
          appId: input.expectedAppId, environment: input.expectedEnvironment };
      },
    });
    assertEquals(issued.status, 200);
    const token = (await issued.json()).token as string;
    assertEquals((await verifyGuestToken(token, fingerprint, 'ios', 'analytics')).payload?.appId, appId);
    assertEquals((await verifyGuestToken(token, fingerprint, 'ios')).ok, false);

    const analytics = await handleAnalyticsGuestSession(new Request(
      'https://example.supabase.co/functions/v1/api/analytics/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'x-guest-token': token, 'x-guest-fingerprint': fingerprint },
        body: JSON.stringify({ platform: 'ios' }),
      }
    ));
    assertEquals(analytics.status, 200);
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

// Values that must never reach a log line in the reject-reason tests below.
const SECRET_FINGERPRINT = '5ec7e7f1'.repeat(8);
const SECRET_KEY_ID = 'SECRETkeyIdValue' + 'q'.repeat(27) + '=';
const SECRET_CHALLENGE_ID = 'secretChallengeHead.secretChallengeTail';
const SECRET_CHALLENGE = 'secret-server-challenge-value';
const SECRET_PROOF = 'secret-apple-proof-object';
const SECRET_IP = '198.51.100.23';
const SECRET_VALUES = [SECRET_FINGERPRINT, SECRET_KEY_ID, SECRET_CHALLENGE_ID, SECRET_CHALLENGE,
  SECRET_PROOF, SECRET_IP, 'secretChallengeHead', 'SECRETkeyIdValue'];

async function captureLogs(run: () => Promise<void>): Promise<unknown[][]> {
  const logged: unknown[][] = [];
  const originals = { warn: console.warn, log: console.log, error: console.error };
  const capture = (...args: unknown[]) => {
    logged.push(args);
  };
  console.warn = capture;
  console.log = capture;
  console.error = capture;
  try {
    await run();
  } finally {
    console.warn = originals.warn;
    console.log = originals.log;
    console.error = originals.error;
  }
  return logged;
}

function assertNoSecrets(logged: unknown[][]) {
  const serialized = JSON.stringify(logged);
  for (const secret of SECRET_VALUES) {
    assertEquals(serialized.includes(secret), false, `log must not contain ${secret}`);
  }
}

function iosRequest(path: string, body: unknown): Request {
  return new Request(`https://example.supabase.co/functions/v1/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': SECRET_IP, 'CF-Connecting-IP': SECRET_IP },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

type ChallengeRow = NonNullable<Awaited<ReturnType<AppAttestStore['challenge']>>>;
type KeyRow = NonNullable<Awaited<ReturnType<AppAttestStore['key']>>>;

function secretChallenge(overrides: Record<string, unknown> = {}): ChallengeRow {
  return {
    id: SECRET_CHALLENGE_ID,
    challenge: SECRET_CHALLENGE,
    key_id: SECRET_KEY_ID,
    fingerprint_hash: SECRET_FINGERPRINT,
    kind: 'attestation',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    consumed_at: null,
    ...overrides,
  } as ChallengeRow;
}

const DREAMER_APP_ID = 'ABCDEFGHIJ.com.tanuki75.noctalia';

function secretKey(overrides: Record<string, unknown> = {}): KeyRow {
  return {
    key_id: SECRET_KEY_ID,
    fingerprint_hash: SECRET_FINGERPRINT,
    public_key_pem: 'secret-public-key',
    environment: 'development',
    app_id: DREAMER_APP_ID,
    assertion_counter: 0,
    ...overrides,
  } as KeyRow;
}

function fakeStore(overrides: Partial<AppAttestStore> = {}): AppAttestStore {
  return {
    issue: () => Promise.resolve(secretChallenge()),
    challenge: () => Promise.resolve(secretChallenge()),
    key: () => Promise.resolve(secretKey()),
    completeAttestation: () => Promise.resolve(true),
    completeAssertion: () => Promise.resolve(true),
    ...overrides,
  };
}

const iosRejects = (logged: unknown[][], label: string) =>
  logged.filter((args) => args[0] === label).map((args) => args[1]);

Deno.test('iOS challenge rejects log an allowlisted reason code and no request values', async () => {
  const cases: { name: string; body: unknown; store?: AppAttestStore; configured?: boolean;
    status: number; reason: string }[] = [
    { name: 'unconfigured', body: { fingerprint: SECRET_FINGERPRINT, keyId: SECRET_KEY_ID },
      configured: false, status: 503, reason: 'config_unavailable' },
    { name: 'not json', body: `{"fingerprint":"${SECRET_FINGERPRINT}"`, status: 400, reason: 'body_invalid' },
    { name: 'array body', body: [SECRET_FINGERPRINT], status: 400, reason: 'body_invalid' },
    { name: 'bad fingerprint', body: { fingerprint: SECRET_FINGERPRINT + 'z', keyId: SECRET_KEY_ID },
      status: 400, reason: 'fingerprint_malformed' },
    { name: 'bad keyId', body: { fingerprint: SECRET_FINGERPRINT, keyId: SECRET_KEY_ID.slice(1) },
      status: 400, reason: 'key_id_malformed' },
    { name: 'issue refused', body: { fingerprint: SECRET_FINGERPRINT, keyId: SECRET_KEY_ID },
      store: fakeStore({ issue: () => Promise.resolve(null) }), status: 503, reason: 'challenge_issue_failed' },
    { name: 'issue throws', body: { fingerprint: SECRET_FINGERPRINT, keyId: SECRET_KEY_ID },
      store: fakeStore({ issue: () => Promise.reject(new Error(`db down ${SECRET_KEY_ID}`)) }),
      status: 503, reason: 'challenge_error' },
  ];
  for (const testCase of cases) {
    const run = async () => {
      const logged = await captureLogs(async () => {
        const response = await handleIosGuestChallenge(iosRequest('/guest/session/challenge', testCase.body),
          { appAttestStore: testCase.store ?? fakeStore() });
        assertEquals(response.status, testCase.status, testCase.name);
        await response.body?.cancel();
      });
      assertEquals(iosRejects(logged, '[api] /guest/session/challenge rejected'),
        [{ reason: testCase.reason, status: testCase.status }], testCase.name);
      assertNoSecrets(logged);
    };
    if (testCase.configured === false) await run();
    else await withAppAttestConfig(run);
  }
});

Deno.test('every iOS guest session reject logs an allowlisted reason code and no request values', async () => {
  const proofBody = (extra: Record<string, unknown> = {}) => ({
    fingerprint: SECRET_FINGERPRINT, platform: 'ios', keyId: SECRET_KEY_ID,
    challengeId: SECRET_CHALLENGE_ID, attestationObject: SECRET_PROOF, ...extra,
  });
  const assertionBody = (extra: Record<string, unknown> = {}) => ({
    fingerprint: SECRET_FINGERPRINT, platform: 'ios', keyId: SECRET_KEY_ID,
    challengeId: SECRET_CHALLENGE_ID, assertionObject: SECRET_PROOF, ...extra,
  });
  const assertionStore = (overrides: Partial<AppAttestStore> = {}) => fakeStore({
    challenge: () => Promise.resolve(secretChallenge({ kind: 'assertion' })), ...overrides,
  });
  const rejectedProof = () => {
    throw new AppAttestProofError();
  };
  const cases: { name: string; body: Record<string, unknown>; dependencies?: Dependencies;
    configured?: boolean; status?: number; reason: string }[] = [
    { name: 'unconfigured', body: proofBody(), configured: false, status: 503, reason: 'config_unavailable' },
    { name: 'legacy body without proof', body: { fingerprint: SECRET_FINGERPRINT, platform: 'ios' },
      reason: 'proof_missing' },
    { name: 'bad fingerprint', body: proofBody({ fingerprint: SECRET_FINGERPRINT.slice(2) }),
      reason: 'fingerprint_malformed' },
    { name: 'bad keyId', body: proofBody({ keyId: 'x' + SECRET_KEY_ID }), reason: 'key_id_malformed' },
    { name: 'missing keyId', body: proofBody({ keyId: undefined }), reason: 'key_id_malformed' },
    { name: 'bad challengeId', body: proofBody({ challengeId: 'secretChallengeHead' }),
      reason: 'challenge_id_malformed' },
    { name: 'unknown challenge', body: proofBody(),
      dependencies: { appAttestStore: fakeStore({ challenge: () => Promise.resolve(null) }) },
      reason: 'challenge_not_found' },
    { name: 'consumed challenge', body: proofBody(), dependencies: { appAttestStore: fakeStore({
      challenge: () => Promise.resolve(secretChallenge({ consumed_at: new Date().toISOString() })) }) },
      reason: 'challenge_consumed' },
    { name: 'expired challenge', body: proofBody(), dependencies: { appAttestStore: fakeStore({
      challenge: () => Promise.resolve(secretChallenge({ expires_at: new Date(Date.now() - 1).toISOString() })) }) },
      reason: 'challenge_expired' },
    { name: 'challenge for another key', body: proofBody(), dependencies: { appAttestStore: fakeStore({
      challenge: () => Promise.resolve(secretChallenge({ key_id: 'B'.repeat(43) + '=' })) }) },
      reason: 'challenge_key_mismatch' },
    { name: 'challenge for another fingerprint', body: proofBody(), dependencies: { appAttestStore: fakeStore({
      challenge: () => Promise.resolve(secretChallenge({ fingerprint_hash: 'b'.repeat(64) })) }) },
      reason: 'challenge_fingerprint_mismatch' },
    { name: 'unknown challenge kind', body: proofBody(), dependencies: { appAttestStore: fakeStore({
      challenge: () => Promise.resolve(secretChallenge({ kind: 'other' as ChallengeRow['kind'] })) }) },
      reason: 'challenge_kind_unknown' },
    { name: 'attestation with assertion', body: proofBody({ assertionObject: SECRET_PROOF }),
      reason: 'attestation_shape_invalid' },
    { name: 'attestation refused', body: proofBody(),
      dependencies: { verifyAppAttestation: rejectedProof }, reason: 'attestation_unverified' },
    { name: 'attestation store refused', body: proofBody(), dependencies: {
      appAttestStore: fakeStore({ completeAttestation: () => Promise.resolve(false) }),
      verifyAppAttestation: () => ({ publicKeyPem: 'k', receiptBase64: 'r', environment: 'development',
        appId: DREAMER_APP_ID }) }, reason: 'attestation_store_rejected' },
    { name: 'assertion with attestation', body: assertionBody({ attestationObject: SECRET_PROOF }),
      dependencies: { appAttestStore: assertionStore() }, reason: 'assertion_shape_invalid' },
    { name: 'assertion for unknown key', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore({ key: () => Promise.resolve(null) }) }, reason: 'assertion_key_unknown' },
    { name: 'assertion for unconfigured app', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore({ key: () => Promise.resolve(secretKey({ environment: 'production' })) }) },
      reason: 'assertion_config_mismatch' },
    { name: 'assertion from another fingerprint', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore({ key: () => Promise.resolve(secretKey({ fingerprint_hash: 'c'.repeat(64) })) }) },
      reason: 'assertion_fingerprint_mismatch' },
    { name: 'assertion refused', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore(), verifyAppAssertion: rejectedProof }, reason: 'assertion_unverified' },
    { name: 'assertion verifier crashed', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore(),
      verifyAppAssertion: () => { throw new TypeError(`bad ${SECRET_PROOF}`); } },
      reason: 'assertion_verifier_error' },
    { name: 'assertion store refused', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore({ completeAssertion: () => Promise.resolve(false) }),
      verifyAppAssertion: () => 1 }, reason: 'assertion_store_rejected' },
    { name: 'store failure during verification', body: assertionBody(), dependencies: {
      appAttestStore: assertionStore({ key: () => Promise.reject(new Error(`db ${SECRET_KEY_ID}`)) }) },
      reason: 'verification_error' },
  ];
  for (const testCase of cases) {
    const status = testCase.status ?? 401;
    const run = async () => {
      const logged = await captureLogs(async () => {
        const response = await handleGuestSession(iosRequest('/guest/session', testCase.body), {
          appAttestStore: fakeStore(), resolveQaPassport: () => Promise.resolve(null),
          ...testCase.dependencies,
        });
        assertEquals(response.status, status, testCase.name);
        await response.body?.cancel();
      });
      const rejects = iosRejects(logged, '[api] /guest/session ios rejected') as Record<string, unknown>[];
      assertEquals(rejects.length, 1, testCase.name);
      assertEquals(rejects[0].reason, testCase.reason, testCase.name);
      assertEquals(rejects[0].status, status, testCase.name);
      assertNoSecrets(logged);
    };
    if (testCase.configured === false) await run();
    else await withAppAttestConfig(run);
  }
});

Deno.test('iOS attestation reject keeps one error class per configured app identity', async () => {
  await withAppAttestConfig(async () => {
    Deno.env.set('IOS_APP_ATTEST_ALLOWED_APPS', JSON.stringify([
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia', environment: 'production',
        allowedBundleVersions: ['42'] },
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia.qa', environment: 'development',
        allowedBundleVersions: ['43'] },
      { teamId: 'ABCDEFGHIJ', bundleId: 'com.tanuki75.noctalia.lucid', environment: 'production',
        allowedBundleVersions: ['1'] },
    ]));
    let calls = 0;
    const logged = await captureLogs(async () => {
      const response = await handleGuestSession(iosRequest('/guest/session', {
        fingerprint: SECRET_FINGERPRINT, platform: 'ios', keyId: SECRET_KEY_ID,
        challengeId: SECRET_CHALLENGE_ID, attestationObject: SECRET_PROOF,
      }), {
        appAttestStore: fakeStore(),
        verifyAppAttestation: (input) => {
          calls += 1;
          if (input.expectedAppId.endsWith('.noctalia')) throw new AppAttestProofError();
          if (input.expectedAppId.endsWith('.qa')) throw new RangeError(`decoder ${SECRET_PROOF}`);
          return { publicKeyPem: 'k', receiptBase64: 'r', environment: 'development',
            appId: 'ABCDEFGHIJ.com.tanuki75.noctalia.evil' };
        },
      });
      assertEquals(response.status, 401);
      assertEquals((await response.json()).error, 'Invalid App Attest proof');
    });
    assertEquals(calls, 3);
    assertEquals(iosRejects(logged, '[api] /guest/session ios rejected'), [{
      reason: 'attestation_unverified',
      status: 401,
      attestationConfigResults: ['proof_rejected', 'verifier_error', 'identity_mismatch'],
    }]);
    assertNoSecrets(logged);
  });
});

Deno.test('iOS reason helpers map anything outside the allowlist to unknown', () => {
  assertEquals(toLoggedIosGuestReason('proof_missing'), 'proof_missing');
  assertEquals(toLoggedIosGuestReason('challenge_expired'), 'challenge_expired');
  assertEquals(toLoggedIosGuestReason(`leak:${SECRET_KEY_ID}`), 'unknown');
  assertEquals(toLoggedIosGuestReason(undefined), 'unknown');
  assertEquals(toLoggedIosGuestReason(42), 'unknown');
  assertEquals(toLoggedAttestationConfigResult('verifier_error'), 'verifier_error');
  assertEquals(toLoggedAttestationConfigResult(SECRET_FINGERPRINT), 'unknown');
});
