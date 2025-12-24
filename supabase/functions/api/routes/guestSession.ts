import { corsHeaders } from '../lib/constants.ts';
import { createGuestToken } from '../lib/guestToken.ts';
import { verifyAndroidIntegrity } from '../lib/playIntegrity.ts';

type GuestSessionBody = {
  fingerprint?: string;
  requestHash?: string;
  integrityToken?: string;
  platform?: string;
};

const isInsecureAllowed = (): boolean => {
  return (Deno.env.get('ALLOW_INSECURE_GUEST_SESSION') ?? '').toLowerCase() === 'true';
};

export async function handleGuestSession(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as GuestSessionBody;
    const fingerprint = String(body?.fingerprint ?? '').trim();
    const requestHash = String(body?.requestHash ?? '').trim();
    const integrityToken = String(body?.integrityToken ?? '').trim();
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
        verdict = await verifyAndroidIntegrity({ integrityToken, requestHash });
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
    } else if (!isInsecureAllowed()) {
      return new Response(JSON.stringify({ error: 'Guest sessions disabled for this platform' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const token = await createGuestToken(fingerprint, platform);
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
