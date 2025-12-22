import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

export async function handleQuotaStatus(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      fingerprint?: string;
      targetDreamId?: number | null;
    };
    console.log('[api] /quota/status request', {
      userId: user?.id ?? null,
      fingerprint: body?.fingerprint ? '[redacted]' : null,
      targetDreamId: body?.targetDreamId ?? null,
    });

    // Si pas de fingerprint, retourner mode dégradé (client enforcera localement)
    if (!body?.fingerprint || !supabaseServiceRoleKey) {
      console.log('[api] /quota/status: no fingerprint or service key, returning degraded mode');
      return new Response(
        JSON.stringify({
          tier: 'guest',
          usage: {
            analysis: { used: 0, limit: GUEST_LIMITS.analysis },
            exploration: { used: 0, limit: GUEST_LIMITS.exploration },
            messages: { used: 0, limit: GUEST_LIMITS.messagesPerDream },
          },
          canAnalyze: true,
          canExplore: true,
          reasons: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Query actual usage from database
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: quotaData, error: quotaError } = await adminClient.rpc('get_guest_quota_status', {
      p_fingerprint: body.fingerprint,
    });

    if (quotaError) {
      console.warn('[api] /quota/status: failed to get quota status', quotaError);
      // Fallback to degraded mode
      return new Response(
        JSON.stringify({
          tier: 'guest',
          usage: {
            analysis: { used: 0, limit: GUEST_LIMITS.analysis },
            exploration: { used: 0, limit: GUEST_LIMITS.exploration },
            messages: { used: 0, limit: GUEST_LIMITS.messagesPerDream },
          },
          canAnalyze: true,
          canExplore: true,
          reasons: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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
          reasons: ["Vous avez déjà utilisé l'application ! Connectez-vous pour retrouver vos rêves et analyses illimitées."],
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
  } catch (e) {
    console.error('[api] /quota/status error', e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 400,
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
      p_fingerprint: body.fingerprint,
      p_user_id: user.id,
    });

    if (error) {
      console.error('[api] /auth/mark-upgrade: failed to mark fingerprint', error);
      return new Response(
        JSON.stringify({ error: 'Failed to mark upgrade' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('[api] /auth/mark-upgrade: success', { userId: user.id });
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /auth/mark-upgrade error', e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message || e) }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}
