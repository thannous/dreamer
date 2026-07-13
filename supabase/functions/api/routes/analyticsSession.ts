import { createAnalyticsGuestToken } from '../lib/analyticsGuestToken.ts';
import { corsHeaders } from '../lib/constants.ts';
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

    return jsonResponse(await createAnalyticsGuestToken(), 200);
  } catch (error) {
    console.warn('[api] analytics guest session failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse({ error: 'Session unavailable' }, 503);
  }
}
