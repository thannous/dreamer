import { corsHeaders } from '../lib/constants.ts';
import { resolveGuestQaPassport } from '../lib/guestQa.ts';
import { createGuestToken } from '../lib/guestToken.ts';
import { verifyAndroidIntegrity } from '../lib/playIntegrity.ts';
import { getRemoteIp, isTurnstileConfigured, verifyTurnstileToken } from '../lib/turnstile.ts';
import { verifyAppleAppAssertion, verifyAppleAppAttestation } from '../lib/appleAppAttest.ts';
import { createAppAttestStore, type AppAttestStore } from '../lib/appleAppAttestStore.ts';

type GuestSessionBody = {
  fingerprint?: string;
  requestHash?: string;
  integrityToken?: string;
  turnstileToken?: string;
  platform?: string;
  keyId?: string;
  challengeId?: string;
  attestationObject?: string;
  assertionObject?: string;
};

type GuestSessionDependencies = {
  resolveQaPassport?: typeof resolveGuestQaPassport;
  verifyIntegrity?: typeof verifyAndroidIntegrity;
  verifyTurnstile?: typeof verifyTurnstileToken;
  isTurnstileConfigured?: typeof isTurnstileConfigured;
  appAttestStore?: AppAttestStore;
  verifyAppAttestation?: typeof verifyAppleAppAttestation;
  verifyAppAssertion?: typeof verifyAppleAppAssertion;
};

// Verdict codes returned by verifyAndroidIntegrity. Anything else is logged as
// 'other' so an unexpected value can never carry request data into the log.
const LOGGED_INTEGRITY_REASONS = new Set([
  'decode_error',
  'package_mismatch',
  'nonce_mismatch',
  'app_unrecognized',
  'device_not_integrity',
]);

export function toLoggedIntegrityReason(reason: string | undefined): string {
  if (!reason) return 'unknown';
  return LOGGED_INTEGRITY_REASONS.has(reason) ? reason : 'other';
}

const response = (error: string, status: number) => new Response(JSON.stringify({ error }), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
});

const IOS_FINGERPRINT = /^[0-9a-f]{64}$/;
// Apple's 32-byte key identifier is standard padded Base64. A single textual
// representation prevents one attested key from acquiring multiple quota rows.
const KEY_ID = /^[A-Za-z0-9+/]{43}=$/;

type IosAppAttestConfig = {
  appId: string;
  environment: 'development' | 'production';
  allowedBundleVersions: string[];
};

function parseAppAttestConfig(value: unknown): IosAppAttestConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !==
      'allowedBundleVersions,bundleId,environment,teamId') return null;
  const { teamId, bundleId, environment, allowedBundleVersions } = record;
  if (typeof teamId !== 'string' || !/^[A-Z0-9]{10}$/.test(teamId) ||
      typeof bundleId !== 'string' ||
      !/^com(?:\.[A-Za-z0-9][A-Za-z0-9-]*){2,}$/.test(bundleId) ||
      (environment !== 'development' && environment !== 'production') ||
      !Array.isArray(allowedBundleVersions) ||
      allowedBundleVersions.length === 0 || allowedBundleVersions.length > 20 ||
      allowedBundleVersions.some((version) =>
        typeof version !== 'string' || !/^[A-Za-z0-9._-]{1,32}$/.test(version)) ||
      new Set(allowedBundleVersions).size !== allowedBundleVersions.length) return null;
  return { appId: teamId + '.' + bundleId, environment, allowedBundleVersions };
}

function appAttestConfigs(): IosAppAttestConfig[] | null {
  const configuredApps = Deno.env.get('IOS_APP_ATTEST_ALLOWED_APPS');
  if (configuredApps !== undefined) {
    let values: unknown;
    try { values = JSON.parse(configuredApps); } catch { return null; }
    if (!Array.isArray(values) || values.length === 0 || values.length > 8) return null;
    const configs = values.map(parseAppAttestConfig);
    if (configs.some((config) => !config)) return null;
    const exact = configs as IosAppAttestConfig[];
    const identities = exact.map((config) => config.appId + '|' + config.environment);
    if (new Set(identities).size !== identities.length) return null;
    return exact;
  }

  // Existing single-app installations keep their explicit configuration.
  const teamId = Deno.env.get('IOS_APP_ATTEST_TEAM_ID')?.trim();
  const bundleId = Deno.env.get('IOS_APP_ATTEST_BUNDLE_ID')?.trim();
  const environment = Deno.env.get('IOS_APP_ATTEST_ENVIRONMENT')?.trim();
  const allowedBundleVersions = Deno.env.get('IOS_APP_ATTEST_ALLOWED_BUNDLE_VERSIONS')
    ?.split(',').map((value) => value.trim()) ?? [];
  const single = parseAppAttestConfig({ teamId, bundleId, environment, allowedBundleVersions });
  return single ? [single] : null;
}

/** A signed challenge is short-lived and bound to this key and quota identity. */
export async function handleIosGuestChallenge(
  req: Request,
  dependencies: Pick<GuestSessionDependencies, 'appAttestStore'> = {}
): Promise<Response> {
  try {
    if (!appAttestConfigs()) return response('Guest session unavailable', 503);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const fingerprint = body?.fingerprint;
    const keyId = body?.keyId;
    if (typeof fingerprint !== 'string' || !IOS_FINGERPRINT.test(fingerprint) ||
        typeof keyId !== 'string' || !KEY_ID.test(keyId)) {
      return response('Invalid App Attest request', 400);
    }
    const challenge = await (dependencies.appAttestStore ?? createAppAttestStore())
      .issue(fingerprint, keyId);
    if (!challenge) return response('Guest session unavailable', 503);
    return new Response(JSON.stringify({
      challengeId: challenge.id,
      challenge: challenge.challenge,
      kind: challenge.kind,
      expiresAt: challenge.expires_at,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch {
    return response('Guest session unavailable', 503);
  }
}

export async function handleGuestSession(
  req: Request,
  dependencies: GuestSessionDependencies = {}
): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as GuestSessionBody;
    const fingerprint = String(body?.fingerprint ?? '').trim();
    const requestHash = String(body?.requestHash ?? '').trim();
    const integrityToken = String(body?.integrityToken ?? '').trim();
    const turnstileToken = String(body?.turnstileToken ?? '').trim();
    const platform = String(body?.platform ?? '').trim() || 'unknown';

    if (!fingerprint) {
      return new Response(JSON.stringify({ error: 'Missing fingerprint' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[api] /guest/session request', {
      platform,
      fingerprintLength: fingerprint.length,
      hasRequestHash: !!requestHash,
      hasIntegrityToken: !!integrityToken,
    });

    if (platform === 'android') {
      if (!requestHash || !integrityToken) {
        return new Response(JSON.stringify({ error: 'Missing integrity token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      let verdict: { ok: boolean; reason?: string };
      try {
        verdict = await (dependencies.verifyIntegrity ?? verifyAndroidIntegrity)({
          integrityToken,
          requestHash,
        });
      } catch (error) {
        console.error('[api] /guest/session integrity error', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
      if (!verdict.ok) {
        // Log the verdict code only. The token, request hash, fingerprint and
        // caller identity never reach the log.
        console.warn('[api] /guest/session integrity rejected', {
          reason: toLoggedIntegrityReason(verdict.reason),
        });
        return new Response(JSON.stringify({ error: `Integrity check failed (${verdict.reason ?? 'unknown'})` }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } else if (platform === 'web') {
      // Web guests are gated by a Cloudflare Turnstile challenge. Fail closed
      // when the secret is not configured on this deployment.
      const configured = (dependencies.isTurnstileConfigured ?? isTurnstileConfigured)();
      if (!configured) {
        return new Response(JSON.stringify({ error: 'Guest sessions disabled for this platform' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      if (!turnstileToken) {
        return new Response(JSON.stringify({ error: 'Missing Turnstile token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      const verdict = await (dependencies.verifyTurnstile ?? verifyTurnstileToken)({
        token: turnstileToken,
        remoteIp: getRemoteIp(req.headers),
        expectedAction: 'guest_session',
      });
      if (!verdict.ok) {
        console.warn('[api] /guest/session turnstile rejected', { reason: verdict.reason ?? 'unknown' });
        return new Response(JSON.stringify({ error: 'Turnstile check failed' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    } else if (platform === 'ios') {
      const configs = appAttestConfigs();
      const keyId = body?.keyId;
      const challengeId = body?.challengeId;
      if (!configs) return response('Guest session unavailable', 503);
      if (!IOS_FINGERPRINT.test(fingerprint) || typeof keyId !== 'string' || !KEY_ID.test(keyId) ||
          typeof challengeId !== 'string' || challengeId.length > 1024 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(challengeId)) {
        return response('Invalid App Attest proof', 401);
      }
      const store = dependencies.appAttestStore ?? createAppAttestStore();
      const challenge = await store.challenge(challengeId);
      if (!challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now() ||
          challenge.key_id !== keyId || challenge.fingerprint_hash !== fingerprint) {
        return response('Invalid App Attest proof', 401);
      }
      try {
        if (challenge.kind === 'attestation') {
          if (typeof body.attestationObject !== 'string' || body.assertionObject != null) {
            return response('Invalid App Attest proof', 401);
          }
          let verified: ReturnType<typeof verifyAppleAppAttestation> | null = null;
          for (const config of configs) {
            try {
              const candidate = (dependencies.verifyAppAttestation ?? verifyAppleAppAttestation)({
                keyId,
                challenge: challenge.challenge,
                attestationObject: body.attestationObject,
                expectedAppId: config.appId,
                expectedEnvironment: config.environment,
                allowedBundleVersions: config.allowedBundleVersions,
              });
              if (candidate.appId === config.appId &&
                  candidate.environment === config.environment) {
                verified = candidate;
                break;
              }
            } catch { /* This exact app identity did not verify. */ }
          }
          if (!verified) return response('Invalid App Attest proof', 401);
          const completed = await store.completeAttestation({
            challengeId,
            keyId,
            fingerprint,
            publicKeyPem: verified.publicKeyPem,
            receiptBase64: verified.receiptBase64,
            environment: verified.environment,
            appId: verified.appId,
          });
          if (!completed) return response('Invalid App Attest proof', 401);
        } else if (challenge.kind === 'assertion') {
          if (typeof body.assertionObject !== 'string' || body.attestationObject != null) {
            return response('Invalid App Attest proof', 401);
          }
          const key = await store.key(keyId);
          const config = configs.find((item) => item.appId === key?.app_id &&
            item.environment === key?.environment);
          if (!key || !config || key.fingerprint_hash !== fingerprint) {
            return response('Invalid App Attest proof', 401);
          }
          const counter = (dependencies.verifyAppAssertion ?? verifyAppleAppAssertion)({
            assertionObject: body.assertionObject,
            challenge: challenge.challenge,
            publicKeyPem: key.public_key_pem,
            expectedAppId: config.appId,
            expectedEnvironment: config.environment,
            allowedBundleVersions: config.allowedBundleVersions,
            previousCounter: key.assertion_counter,
          });
          const completed = await store.completeAssertion({ challengeId, keyId, fingerprint, counter });
          if (!completed) return response('Invalid App Attest proof', 401);
        } else {
          return response('Invalid App Attest proof', 401);
        }
      } catch {
        return response('Invalid App Attest proof', 401);
      }
    } else {
      // Android and web retain their own proofs. Unknown platforms stay closed.
      return new Response(JSON.stringify({ error: 'Guest sessions disabled for this platform' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // QA lookup is deliberately best-effort. If its private state is missing or
    // unavailable, the device receives a normal guest token and all production
    // anti-abuse rules remain in force.
    const qaPassport = await (dependencies.resolveQaPassport ?? resolveGuestQaPassport)(fingerprint);
    const token = await createGuestToken(
      fingerprint,
      platform,
      qaPassport?.active
        ? {
            quotaSubject: qaPassport.quotaSubject,
            validUntil: qaPassport.validUntil,
          }
        : undefined
    );
    return new Response(JSON.stringify(token), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('[api] /guest/session error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(JSON.stringify({ error: 'Failed to create guest session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
