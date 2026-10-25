import { createAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
import { corsHeaders } from '../lib/constants.ts';
import { verifyGuestToken } from '../lib/guestToken.ts';
import { decideIosLegacyGuest } from '../lib/iosLegacyGuest.ts';
import { appAttestBundleVersions, logIosLegacyDecision } from './guestSession.ts';
import { verifyAndroidIntegrity } from '../lib/playIntegrity.ts';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function handleAnalyticsGuestSession(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Object.keys(body).some((key) => !['requestHash', 'integrityToken', 'platform'].includes(key))) {
      return jsonResponse({ error: 'Invalid payload' }, 400);
    }
    const requestHash = body.requestHash;
    const integrityToken = body.integrityToken;
    if (body.platform === 'ios') {
      if (Object.keys(body).length !== 1) return jsonResponse({ error: 'Invalid integrity proof' }, 401);
      const guestToken = req.headers.get('x-guest-token')?.trim() ?? null;
      const fingerprint = req.headers.get('x-guest-fingerprint')?.trim() ?? '';
      if (!guestToken && !fingerprint) {
        // Pre-3.7.0 iOS builds ask with { platform: 'ios' } only, which v120
        // accepted. Only those builds, inside the legacy window, still may.
        const decision = decideIosLegacyGuest({
          userAgent: req.headers.get('user-agent'),
          now: Date.now(),
          attestedBuilds: appAttestBundleVersions(),
        });
        logIosLegacyDecision('analytics_session', decision);
        if (!decision.accepted) return jsonResponse({ error: 'Invalid integrity proof' }, 401);
        return jsonResponse(await createAnalyticsGuestToken('ios'), 200);
      }
      if (!/^[0-9a-f]{64}$/.test(fingerprint) ||
          !(await verifyGuestToken(guestToken, fingerprint, 'ios', 'analytics')).ok) {
        return jsonResponse({ error: 'Invalid integrity proof' }, 401);
      }
      return jsonResponse(await createAnalyticsGuestToken('ios'), 200);
    }
    if (
      body.platform !== 'android' ||
      typeof requestHash !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(requestHash) ||
      typeof integrityToken !== 'string' ||
      integrityToken.length < 16 ||
      integrityToken.length > 20_000
    ) {
      return jsonResponse({ error: 'Invalid integrity proof' }, 401);
    }

    const verdict = await verifyAndroidIntegrity({ integrityToken, requestHash });
    if (!verdict.ok) return jsonResponse({ error: 'Invalid integrity proof' }, 401);

    return jsonResponse(await createAnalyticsGuestToken('android'), 200);
  } catch (error) {
    console.warn('[api] analytics guest session failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse({ error: 'Session unavailable' }, 503);
  }
}
