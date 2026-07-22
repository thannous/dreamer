import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { requireGuestSession } from '../lib/guards.ts';
import { verifyGuestToken } from '../lib/guestToken.ts';
import type { ApiContext } from '../types.ts';

const toCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export async function handleQuotaStatus(ctx: ApiContext): Promise<Response> {
  const { req, user, supabase, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      fingerprint?: string;
      targetDreamId?: number | null;
    };
    const targetDreamId = body.targetDreamId == null ? null : body.targetDreamId;
    if (
      targetDreamId !== null
      && (
        typeof targetDreamId !== 'number'
        || !Number.isSafeInteger(targetDreamId)
        || targetDreamId <= 0
      )
    ) {
      return new Response(JSON.stringify({ error: 'Invalid targetDreamId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (user) {
      const { data, error } = await supabase.rpc('get_authenticated_quota_snapshot', {
        p_target_dream_id: targetDreamId,
      });
      if (error || !data) {
        console.warn('[api] /quota/status: authenticated snapshot failed', {
          code: error?.code ?? null,
        });
        return new Response(JSON.stringify({ error: 'Quota service unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const guestCheck = await requireGuestSession(req, body, null);
    if (guestCheck instanceof Response) return guestCheck;
    const fingerprint = guestCheck.fingerprint;
    if (!fingerprint) {
      return new Response(JSON.stringify({ error: 'Invalid guest session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!supabaseServiceRoleKey) {
      console.log('[api] /quota/status: missing service key');
      return new Response(
        JSON.stringify({ error: 'Service unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Query actual usage from database
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: quotaData, error: quotaError } = await adminClient.rpc('get_guest_quota_status', {
      p_fingerprint: fingerprint,
    });

    if (quotaError) {
      console.warn('[api] /quota/status: failed to get guest quota status', {
        code: quotaError?.code ?? null,
      });
      return new Response(
        JSON.stringify({ error: 'Quota service unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const analysisUsed = quotaData?.analysis_count ?? 0;
    const explorationUsed = quotaData?.exploration_count ?? 0;
    const analysisLimit = quotaData?.effective_analysis_limit ?? GUEST_LIMITS.analysis;
    const messageLimit = quotaData?.effective_message_limit ?? GUEST_LIMITS.messagesPerDream;
    let messagesUsed = 0;
    if (targetDreamId !== null) {
      const { data: messageCount, error: messageCountError } = await adminClient.rpc(
        'get_guest_chat_message_count',
        {
          p_fingerprint: fingerprint,
          p_dream_key: String(targetDreamId),
        }
      );
      if (messageCountError) {
        console.warn('[api] /quota/status: failed to get guest dream message count', {
          code: messageCountError?.code ?? null,
        });
        return new Response(
          JSON.stringify({ error: 'Quota service unavailable' }),
          { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      messagesUsed = toCount(messageCount);
    }

    const canAnalyze = analysisUsed < analysisLimit;
    const canExplore = true;

    const reasons: string[] = [];
    if (!canAnalyze) {
      reasons.push(`Guest analysis limit reached (${analysisUsed}/${GUEST_LIMITS.analysis}). Create a free account to get more!`);
    }

    return new Response(
      JSON.stringify({
        tier: 'guest',
        usage: {
          analysis: { used: analysisUsed, limit: analysisLimit },
          exploration: { used: explorationUsed, limit: null },
          messages: { used: messagesUsed, limit: messageLimit },
        },
        canAnalyze,
        canExplore,
        isUpgraded: false,
        riskScore: quotaData?.risk_score ?? 0,
        riskLevel: quotaData?.risk_level ?? 'low',
        reasons,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch {
    console.error('[api] /quota/status request failed');
    return new Response(JSON.stringify({ error: 'Quota service unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function handleAuthMarkUpgrade(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      fingerprint?: string;
    };

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!body?.fingerprint || typeof body.fingerprint !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid fingerprint' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const fingerprint = body.fingerprint.trim();
    const headerFingerprint = req.headers.get('x-guest-fingerprint')?.trim() ?? '';
    if (!fingerprint || (headerFingerprint && headerFingerprint !== fingerprint)) {
      return new Response(
        JSON.stringify({ error: 'Invalid guest session' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const guestToken = req.headers.get('x-guest-token')?.trim() ?? '';
    const guestPlatform = req.headers.get('x-guest-platform')?.trim() ?? undefined;
    const verifiedGuest = await verifyGuestToken(guestToken, fingerprint, guestPlatform);
    if (!verifiedGuest.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid guest session' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!supabaseServiceRoleKey) {
      console.warn('[api] /auth/mark-upgrade: no service role key available');
      return new Response(
        JSON.stringify({ error: 'Service unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const platform = verifiedGuest.payload?.platform;
    // Guest tokens are currently issued only after a verified Play Integrity
    // verdict. Keep iOS unverified until the App Attest attestation/assertion
    // exchange is implemented server-side; the platform string alone is not
    // an integrity proof.
    const integrityProvider = platform === 'android' ? 'play_integrity' : 'unknown';
    const integrityVerified = platform === 'android';

    const { data: risk, error } = await adminClient.rpc('register_device_account_link', {
      p_fingerprint: fingerprint,
      p_user_id: user.id,
      p_integrity_provider: integrityProvider,
      p_integrity_verified: integrityVerified,
    });

    if (error) {
      console.error('[api] /auth/mark-upgrade: failed to mark fingerprint', {
        code: error?.code ?? null,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to mark upgrade' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('[api] /auth/mark-upgrade: device account signal registered', {
      riskLevel: (risk as any)?.risk_level ?? 'unknown',
      integrityProvider,
    });
    return new Response(
      JSON.stringify({
        success: true,
        riskScore: (risk as any)?.risk_score ?? 0,
        riskLevel: (risk as any)?.risk_level ?? 'low',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch {
    console.error('[api] /auth/mark-upgrade request failed');
    return new Response(
      JSON.stringify({ error: 'Unable to mark guest upgrade' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
