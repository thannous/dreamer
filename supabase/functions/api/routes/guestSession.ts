import { corsHeaders } from '../lib/constants.ts';
import { resolveGuestQaPassport } from '../lib/guestQa.ts';
import { createGuestToken } from '../lib/guestToken.ts';
import { verifyAndroidIntegrity } from '../lib/playIntegrity.ts';
import { getRemoteIp, isTurnstileConfigured, verifyTurnstileToken } from '../lib/turnstile.ts';

type GuestSessionBody = {
  fingerprint?: string;
  requestHash?: string;
  integrityToken?: string;
  turnstileToken?: string;
  platform?: string;
};

type GuestSessionDependencies = {
  resolveQaPassport?: typeof resolveGuestQaPassport;
  verifyIntegrity?: typeof verifyAndroidIntegrity;
  verifyTurnstile?: typeof verifyTurnstileToken;
  isTurnstileConfigured?: typeof isTurnstileConfigured;
};

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
    } else if (platform !== 'ios') {
      // iOS guests are fingerprint-gated (IDFV) without App Attest for launch.
      // Android still requires Play Integrity. Unknown platforms stay closed.
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
