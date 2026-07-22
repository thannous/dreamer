import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { requireGuestSession } from '../lib/guards.ts';
import { verifyGuestToken } from '../lib/guestToken.ts';
import type { ApiContext } from '../types.ts';

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
    const isUpgraded = quotaData?.is_upgraded ?? false;

    // If fingerprint has been upgraded, block guest access
    if (isUpgraded) {
      return new Response(
        JSON.stringify({
          tier: 'guest',
          usage: {
            analysis: { used: analysisUsed, limit: GUEST_LIMITS.analysis },
            exploration: { used: explorationUsed, limit: GUEST_LIMITS.exploration },
            messages: { used: 0, limit: GUEST_LIMITS.messagesPerDream },
          },
          canAnalyze: false,
          canExplore: false,
          isUpgraded: true,
          reasons: ['Cet appareil est déjà lié à un compte. Connectez-vous pour retrouver vos rêves.'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const canAnalyze = analysisUsed < GUEST_LIMITS.analysis;
    const canExplore = explorationUsed < GUEST_LIMITS.exploration;

    const reasons: string[] = [];
    if (!canAnalyze) {
      reasons.push(`Guest analysis limit reached (${analysisUsed}/${GUEST_LIMITS.analysis}). Create a free account to get more!`);
    }
    if (!canExplore) {
      reasons.push(`Guest exploration limit reached (${explorationUsed}/${GUEST_LIMITS.exploration}). Create a free account to continue!`);
    }

    return new Response(
      JSON.stringify({
        tier: 'guest',
        usage: {
          analysis: { used: analysisUsed, limit: GUEST_LIMITS.analysis },
          exploration: { used: explorationUsed, limit: GUEST_LIMITS.exploration },
          messages: { used: 0, limit: GUEST_LIMITS.messagesPerDream },
        },
        canAnalyze,
        canExplore,
        isUpgraded: false,
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

    const { error } = await adminClient.rpc('mark_fingerprint_upgraded', {
      p_fingerprint: fingerprint,
      p_user_id: user.id,
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

    console.log('[api] /auth/mark-upgrade: success');
    return new Response(
      JSON.stringify({ success: true }),
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
