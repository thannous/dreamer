import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { requireGuestSession } from '../lib/guards.ts';
import { verifyGuestToken } from '../lib/guestToken.ts';
import type { ApiContext } from '../types.ts';

type AdminClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
};

export type QuotaStatusDependencies = {
  createAdminClient?: (
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ) => AdminClient;
};

const toCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const toOptionalLimit = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
};

const metric = (used: number, limit: number | null) => ({
  used,
  limit,
  remaining: limit === null ? null : Math.max(limit - used, 0),
});

type GuestQuotaRpc = {
  analysis_count?: unknown;
  exploration_count?: unknown;
  image_count?: unknown;
  effective_analysis_limit?: unknown;
  effective_message_limit?: unknown;
  effective_image_limit?: unknown;
  risk_score?: unknown;
  risk_level?: unknown;
};

export function buildGuestQuotaStatus(
  quotaData: GuestQuotaRpc | null | undefined,
  messagesUsed: number,
): Record<string, unknown> {
  const analysisUsed = toCount(quotaData?.analysis_count);
  const explorationUsed = toCount(quotaData?.exploration_count);
  const imageUsed = toCount(quotaData?.image_count);
  const analysisLimit = toOptionalLimit(quotaData?.effective_analysis_limit, GUEST_LIMITS.analysis);
  const messageLimit = toOptionalLimit(quotaData?.effective_message_limit, GUEST_LIMITS.messagesPerDream);
  const imageLimit = toOptionalLimit(quotaData?.effective_image_limit, GUEST_LIMITS.image);

  const canAnalyze = analysisUsed < analysisLimit;
  const canExplore = true;
  const canGenerateImage = imageUsed < imageLimit;

  const reasons: string[] = [];
  if (!canAnalyze) {
    reasons.push(`Guest analysis limit reached (${analysisUsed}/${GUEST_LIMITS.analysis}). Create a free account to get more!`);
  }
  if (!canGenerateImage) {
    reasons.push(`Guest illustration limit reached (${imageUsed}/${imageLimit}).`);
  }

  return {
    tier: 'guest',
    usage: {
      analysis: metric(analysisUsed, analysisLimit),
      exploration: metric(explorationUsed, null),
      messages: metric(messagesUsed, messageLimit),
      image: metric(imageUsed, imageLimit),
    },
    canAnalyze,
    canExplore,
    canGenerateImage,
    isUpgraded: false,
    riskScore: quotaData?.risk_score ?? 0,
    riskLevel: quotaData?.risk_level ?? 'low',
    reasons,
  };
}

/**
 * Authenticated /quota/status must not invent a monthly illustration credit.
 * Plus is unlimited. Free generic status is bundled-with-analysis, so
 * canGenerateImage is false and usage.image is not a paid pool.
 */
export function enrichAuthenticatedQuotaStatus(data: Record<string, unknown>): Record<string, unknown> {
  const usageIn = data.usage && typeof data.usage === 'object' && !Array.isArray(data.usage)
    ? { ...(data.usage as Record<string, unknown>) }
    : {};
  if (data.tier === 'plus') {
    if (usageIn.image == null) {
      usageIn.image = metric(0, null);
    }
    return {
      ...data,
      usage: usageIn,
      canGenerateImage: typeof data.canGenerateImage === 'boolean' ? data.canGenerateImage : true,
    };
  }
  usageIn.image = metric(0, 0);
  return {
    ...data,
    usage: usageIn,
    canGenerateImage: false,
  };
}

export async function handleQuotaStatus(
  ctx: ApiContext,
  deps: QuotaStatusDependencies = {},
): Promise<Response> {
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
      const payload = enrichAuthenticatedQuotaStatus(
        data && typeof data === 'object' && !Array.isArray(data)
          ? data as Record<string, unknown>
          : {},
      );
      return new Response(JSON.stringify(payload), {
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
    const createAdmin = deps.createAdminClient
      ?? ((url: string, key: string, options?: Record<string, unknown>) =>
        createClient(url, key, options) as unknown as AdminClient);
    const adminClient = createAdmin(supabaseUrl, supabaseServiceRoleKey, {
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

    return new Response(
      JSON.stringify(buildGuestQuotaStatus((quotaData ?? {}) as GuestQuotaRpc, messagesUsed)),
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
    // Android guests are Play Integrity attested. iOS guests are fingerprint-gated
    // without App Attest, so the device-account link is recorded as unverified.
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
