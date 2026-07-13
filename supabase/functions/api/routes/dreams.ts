import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { ANALYZE_DREAM_SCHEMA, CATEGORIZE_DREAM_SCHEMA } from '../lib/schemas.ts';
import {
  callGeminiWithFallback,
  classifyGeminiError,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_MODEL,
} from '../services/gemini.ts';
import { generateImageFromPrompt, resolveImageModel } from '../services/geminiImages.ts';
import { optimizeImage } from '../services/image.ts';
import { createStorageHelpers } from '../services/storage.ts';
import { requireGuestSession, requireUser } from '../lib/guards.ts';
import {
  claimGuestAnalysisQuota,
  isAuthenticatedAnalysisQuotaRetry,
} from '../lib/analysisQuota.ts';
import type { ApiContext } from '../types.ts';

const toCount = (value: unknown): number => {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const serviceUnavailable = (message = 'Service unavailable') =>
  new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

type AnalyzeDreamBody = {
  transcript?: string;
  lang?: string;
  fingerprint?: string;
  remoteDreamId?: number | string | null;
  dreamId?: number | string | null;
  analysisRequestId?: string | null;
  requestId?: string | null;
};

type AuthenticatedAnalysisQuotaClaim = {
  allowed?: boolean;
  code?: string;
  tier?: string;
  limit?: number | null;
  new_count?: number;
  claimed?: boolean;
  claim_id?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toPositiveInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const toUuid = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return uuidPattern.test(trimmed) ? trimmed : null;
};

const quotaBlockedResponse = (claim: AuthenticatedAnalysisQuotaClaim): Response => {
  const used = toCount(claim.new_count);
  const limit = typeof claim.limit === 'number' ? claim.limit : null;

  if (claim.code === 'QUOTA_EXCEEDED') {
    return new Response(
      JSON.stringify({
        error: 'Analysis limit reached',
        code: 'QUOTA_EXCEEDED',
        usage: { analysis: { used, limit } },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  if (isAuthenticatedAnalysisQuotaRetry(claim)) {
    return new Response(
      JSON.stringify({
        error: 'Analysis request is already in progress',
        code: 'ANALYSIS_ALREADY_CLAIMED',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'Analysis request must be synced before AI analysis',
      code: claim.code ?? 'ANALYSIS_CLAIM_REQUIRED',
    }),
    { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
};

async function resolvePendingAnalysisDream(
  adminClient: any,
  userId: string,
  transcript: string,
  analysisRequestId: string | null
): Promise<{ dreamId: number; analysisRequestId: string } | Response | null> {
  const select = 'id, analysis_request_id';

  if (analysisRequestId) {
    const { data, error } = await adminClient
      .from('dreams')
      .select(select)
      .eq('user_id', userId)
      .eq('analysis_request_id', analysisRequestId)
      .eq('analysis_status', 'pending')
      .eq('is_analyzed', false)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[api] authenticated analysis quota resolver failed', error);
      return serviceUnavailable('Authenticated quota unavailable');
    }

    const dreamId = toPositiveInteger((data as any)?.id);
    const resolvedRequestId = toUuid((data as any)?.analysis_request_id);
    if (dreamId && resolvedRequestId) {
      return { dreamId, analysisRequestId: resolvedRequestId };
    }
  }

  const { data, error } = await adminClient
    .from('dreams')
    .select(select)
    .eq('user_id', userId)
    .eq('transcript', transcript)
    .eq('analysis_status', 'pending')
    .eq('is_analyzed', false)
    .order('client_updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[api] authenticated analysis quota transcript resolver failed', error);
    return serviceUnavailable('Authenticated quota unavailable');
  }

  const dreamId = toPositiveInteger((data as any)?.id);
  const resolvedRequestId = toUuid((data as any)?.analysis_request_id);
  if (!dreamId || !resolvedRequestId) return null;

  return { dreamId, analysisRequestId: resolvedRequestId };
}

async function claimAuthenticatedAnalysisQuota({
  body,
  route,
  supabaseUrl,
  supabaseServiceRoleKey,
  transcript,
  userId,
}: {
  body: AnalyzeDreamBody;
  route: string;
  supabaseUrl: string;
  supabaseServiceRoleKey?: string | null;
  transcript: string;
  userId: string;
}): Promise<{ response?: Response; quotaUsed?: { analysis: number }; tier?: string }> {
  if (!supabaseServiceRoleKey) {
    console.error(`[api] ${route}: authenticated quota unavailable before provider work`, {
      hasServiceRoleKey: false,
    });
    return { response: serviceUnavailable('Authenticated quota unavailable') };
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let dreamId = toPositiveInteger(body.remoteDreamId) ?? toPositiveInteger(body.dreamId);
  let analysisRequestId = toUuid(body.analysisRequestId) ?? toUuid(body.requestId);

  if (!dreamId || !analysisRequestId) {
    const resolved = await resolvePendingAnalysisDream(adminClient, userId, transcript, analysisRequestId);
    if (resolved instanceof Response) {
      return { response: resolved };
    }
    if (resolved) {
      dreamId ??= resolved.dreamId;
      analysisRequestId ??= resolved.analysisRequestId;
    }
  }

  const { data: quotaResult, error: quotaError } = await adminClient.rpc(
    'claim_authenticated_analysis_quota',
    {
      p_user_id: userId,
      p_dream_id: dreamId,
      p_analysis_request_id: analysisRequestId,
    }
  );

  if (quotaError) {
    console.error(`[api] ${route}: authenticated quota claim failed before provider work`, quotaError);
    return { response: serviceUnavailable('Authenticated quota unavailable') };
  }

  const claim = (quotaResult ?? {}) as AuthenticatedAnalysisQuotaClaim;
  // The quota row already exists for this exact dream/request pair. Treat it
  // as an idempotent retry: provider work may be repeated after a lost
  // response, but quota consumption must not be repeated.
  if (isAuthenticatedAnalysisQuotaRetry(claim)) {
    return {
      quotaUsed: claim.new_count === undefined ? undefined : { analysis: toCount(claim.new_count) },
      tier: claim.tier,
    };
  }
  if (!claim.allowed) {
    console.log(`[api] ${route}: authenticated quota blocked before provider work`, {
      userId,
      code: claim.code ?? 'UNKNOWN',
      dreamId: dreamId ?? null,
      hasAnalysisRequestId: !!analysisRequestId,
    });
    return { response: quotaBlockedResponse(claim) };
  }

  return {
    quotaUsed: claim.new_count === undefined ? undefined : { analysis: toCount(claim.new_count) },
    tier: claim.tier,
  };
}

export async function handleAnalyzeDream(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json()) as AnalyzeDreamBody;
    const transcript = String(body?.transcript ?? '').trim();
    const lang = String(body?.lang ?? 'en');
    const guestCheck = await requireGuestSession(req, body, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const fingerprint = guestCheck.fingerprint;
    if (!transcript) throw new Error('Missing transcript');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /analyzeDream request', {
      userId: user?.id ?? null,
      transcriptLength: transcript.length,
      lang,
      hasFingerprint: !!fingerprint,
      hasRemoteDreamId: body.remoteDreamId != null || body.dreamId != null,
      hasAnalysisRequestId: body.analysisRequestId != null || body.requestId != null,
    });

    const guestAnalysisLimit = GUEST_LIMITS.analysis;
    let quotaUsed: { analysis: number } | undefined;
    if (user) {
      const quotaClaim = await claimAuthenticatedAnalysisQuota({
        body,
        route: '/analyzeDream',
        supabaseUrl,
        supabaseServiceRoleKey,
        transcript,
        userId: user.id,
      });
      if (quotaClaim.response) {
        return quotaClaim.response;
      }
      quotaUsed = quotaClaim.quotaUsed;
    } else {
      if (!supabaseServiceRoleKey || !fingerprint) {
        console.error('[api] /analyzeDream: guest quota unavailable before provider work', {
          hasServiceRoleKey: !!supabaseServiceRoleKey,
          hasFingerprint: !!fingerprint,
        });
        return serviceUnavailable('Guest quota unavailable');
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const guestQuota = await claimGuestAnalysisQuota({
        adminClient,
        analysisRequestId: toUuid(body.analysisRequestId) ?? toUuid(body.requestId),
        fingerprint,
        limit: guestAnalysisLimit,
      });
      if (guestQuota.response) return guestQuota.response;
      const quotaResult = guestQuota.claim;

      if (!quotaResult?.allowed) {
        const used = toCount((quotaResult as any)?.new_count);
        const isUpgraded = Boolean((quotaResult as any)?.is_upgraded);
        const payload = isUpgraded
          ? {
              error: 'Login required',
              code: 'GUEST_DEVICE_UPGRADED',
              isUpgraded: true,
              usage: { analysis: { used, limit: guestAnalysisLimit } },
            }
          : {
              error: 'Guest analysis limit reached',
              code: 'QUOTA_EXCEEDED',
              usage: { analysis: { used, limit: guestAnalysisLimit } },
            };

        console.log('[api] /analyzeDream: guest quota blocked before provider work', {
          fingerprint: '[redacted]',
          used,
          isUpgraded,
        });
        return new Response(JSON.stringify(payload), {
          status: isUpgraded ? 403 : 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      quotaUsed = { analysis: toCount((quotaResult as any)?.new_count) };
    }

    const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
    const systemInstruction = lang === 'fr'
      ? 'Analyse les rêves. Retourne UNIQUEMENT du JSON valide.'
      : lang === 'es'
        ? 'Analiza sueños. Devuelve SOLO JSON válido.'
        : 'Analyze dreams. Return ONLY valid JSON.';

    const prompt = `You analyze user dreams with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

    const primaryModel = Deno.env.get('GEMINI_MODEL') ?? GEMINI_FLASH_MODEL;
    const { text } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      Deno.env.get('GEMINI_FALLBACK_MODEL') ?? GEMINI_FLASH_LITE_MODEL,
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYZE_DREAM_SCHEMA,
        thinkingLevel: 'low',
      }
    );

    console.log('[api] /analyzeDream model raw length', text.length);

    let analysis: any;
    try {
      analysis = JSON.parse(text);
    } catch (parseErr) {
      console.error('[api] /analyzeDream: unexpected JSON parse failure', parseErr, { text });
      throw new Error('Failed to parse model response');
    }

    if (!analysis.title || !analysis.interpretation) {
      throw new Error('Missing required fields in model response');
    }

    const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
      ? analysis.theme
      : 'surreal';

    console.log('[api] /analyzeDream success', {
      userId: user?.id ?? null,
      theme,
      titleLength: String(analysis.title ?? '').length,
      quotaUsed,
    });

    return new Response(
      JSON.stringify({
        title: String(analysis.title ?? ''),
        interpretation: String(analysis.interpretation ?? ''),
        shareableQuote: String(analysis.shareableQuote ?? ''),
        theme,
        dreamType: String(analysis.dreamType ?? 'Symbolic Dream'),
        imagePrompt: String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere'),
        ...(quotaUsed && { quotaUsed }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /analyzeDream error', e);
    const errorInfo = classifyGeminiError(e);
    return new Response(JSON.stringify({ error: errorInfo.userMessage }), {
      status: errorInfo.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function handleAnalyzeDreamFull(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey, storageBucket } = ctx;

  try {
    const authCheck = requireUser(user);
    if (authCheck) {
      return authCheck;
    }
    const body = (await req.json()) as AnalyzeDreamBody;
    const transcript = String(body?.transcript ?? '').trim();
    const lang = String(body?.lang ?? 'en');
    const fingerprint = body?.fingerprint;
    if (!transcript) throw new Error('Missing transcript');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /analyzeDreamFull request', {
      userId: user?.id ?? null,
      transcriptLength: transcript.length,
      lang,
      hasFingerprint: !!fingerprint,
      hasRemoteDreamId: body.remoteDreamId != null || body.dreamId != null,
      hasAnalysisRequestId: body.analysisRequestId != null || body.requestId != null,
    });

    const quotaClaim = await claimAuthenticatedAnalysisQuota({
      body,
      route: '/analyzeDreamFull',
      supabaseUrl,
      supabaseServiceRoleKey,
      transcript,
      userId: user!.id,
    });
    if (quotaClaim.response) {
      return quotaClaim.response;
    }
    const quotaUsed = quotaClaim.quotaUsed;
    const imageModel = resolveImageModel(quotaClaim.tier);

    const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
    const systemInstruction = lang === 'fr'
      ? 'Analyse les rêves. Retourne UNIQUEMENT du JSON valide.'
      : lang === 'es'
        ? 'Analiza sueños. Devuelve SOLO JSON válido.'
        : 'Analyze dreams. Return ONLY valid JSON.';

    const prompt = `You analyze user dreams with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

    const primaryModel = Deno.env.get('GEMINI_MODEL') ?? GEMINI_FLASH_MODEL;
    const { text } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      Deno.env.get('GEMINI_FALLBACK_MODEL') ?? GEMINI_FLASH_LITE_MODEL,
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYZE_DREAM_SCHEMA,
        thinkingLevel: 'low',
      }
    );

    console.log('[api] /analyzeDreamFull model raw length', text.length);

    let analysis: any;
    try {
      analysis = JSON.parse(text);
    } catch (parseErr) {
      console.error('[api] /analyzeDreamFull: unexpected JSON parse failure', parseErr, { text });
      throw new Error('Failed to parse model response');
    }
    if (!analysis.title || !analysis.interpretation) {
      throw new Error('Missing required fields in model response');
    }

    const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
      ? analysis.theme
      : 'surreal';

    const imagePrompt = String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere');

    const { imageBase64, mimeType, raw: imgJson } = await generateImageFromPrompt({
      prompt: imagePrompt,
      apiKey,
      model: imageModel,
      aspectRatio: '9:16',
    });

    if (!imageBase64) {
      return new Response(
        JSON.stringify({
          error: 'No image returned',
          raw: imgJson,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const optimized =
      (await optimizeImage(
        { base64: imageBase64, contentType: mimeType ?? 'image/png' },
        { maxWidth: 1024, maxHeight: 1024, quality: 78, aspectRatio: 9 / 16 }
      ).catch(() => null)) ?? {
        base64: imageBase64,
        contentType: mimeType ?? 'image/png',
      };

    const { uploadImageToStorage } = createStorageHelpers({
      supabaseUrl,
      supabaseServiceRoleKey,
      storageBucket,
      ownerId: user?.id ?? null,
    });
    const storedImageUrl = await uploadImageToStorage(optimized.base64, optimized.contentType);
    const imageUrl = storedImageUrl ?? `data:${optimized.contentType};base64,${optimized.base64}`;

    return new Response(
      JSON.stringify({
        title: String(analysis.title ?? ''),
        interpretation: String(analysis.interpretation ?? ''),
        shareableQuote: String(analysis.shareableQuote ?? ''),
        theme,
        dreamType: String(analysis.dreamType ?? 'Symbolic Dream'),
        imagePrompt,
        imageUrl,
        imageBytes: optimized.base64,
        ...(quotaUsed && { quotaUsed }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /analyzeDreamFull error', e);
    const errorInfo = classifyGeminiError(e);
    return new Response(
      JSON.stringify({
        error: errorInfo.userMessage,
        ...(e as any)?.blockReason ? { blockReason: (e as any).blockReason } : {},
        ...(e as any)?.promptFeedback ? { promptFeedback: (e as any).promptFeedback } : {},
      }),
      {
        status: errorInfo.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

export async function handleCategorizeDream(ctx: ApiContext): Promise<Response> {
  const { req, user } = ctx;

  try {
    const body = (await req.json()) as { transcript?: string; lang?: string };
    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const transcript = String(body?.transcript ?? '').trim();
    const lang = String(body?.lang ?? 'en');
    if (!transcript) throw new Error('Missing transcript');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /categorizeDream request', {
      userId: user?.id ?? null,
      transcriptLength: transcript.length,
      lang,
    });

    const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
    const systemInstruction = lang === 'fr'
      ? 'Catégorise rapidement. Retourne UNIQUEMENT du JSON valide.'
      : lang === 'es'
        ? 'Categoriza rápidamente. Devuelve SOLO JSON válido.'
        : 'Categorize quickly. Return ONLY valid JSON.';

    const prompt = `You analyze user dreams with keys: {"title": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "hasPerson": boolean, "hasAnimal": boolean}. Choose the single most appropriate theme and dreamType from that list. The title MUST be in ${langName}.

"hasPerson": true if the dream mentions any person (self, friend, stranger, family member, character, figure, etc.), false otherwise
"hasAnimal": true if the dream mentions any animal (pet, wild animal, creature, bird, mythical being, etc.), false otherwise

Dream transcript:\n${transcript}`;

    const { text } = await callGeminiWithFallback(
      apiKey,
      Deno.env.get('GEMINI_LITE_MODEL') ?? GEMINI_FLASH_LITE_MODEL,
      Deno.env.get('GEMINI_LITE_MODEL') ?? GEMINI_FLASH_LITE_MODEL,
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: CATEGORIZE_DREAM_SCHEMA,
        thinkingLevel: 'minimal',
      }
    );

    let analysis: any;
    try {
      analysis = JSON.parse(text);
    } catch (parseErr) {
      console.error('[api] /categorizeDream: unexpected JSON parse failure', parseErr, { text });
      throw new Error('Failed to parse model response');
    }
    if (!analysis.title || !analysis.theme || !analysis.dreamType || typeof analysis.hasPerson !== 'boolean' || typeof analysis.hasAnimal !== 'boolean') {
      throw new Error('Missing required fields in model response');
    }

    const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
      ? analysis.theme
      : 'surreal';
    const dreamType = ['Lucid Dream', 'Recurring Dream', 'Nightmare', 'Symbolic Dream'].includes(analysis.dreamType)
      ? analysis.dreamType
      : 'Symbolic Dream';

    return new Response(
      JSON.stringify({
        title: String(analysis.title ?? 'New Dream'),
        theme,
        dreamType,
        hasPerson: Boolean(analysis.hasPerson),
        hasAnimal: Boolean(analysis.hasAnimal),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /categorizeDream error', e);
    const errorInfo = classifyGeminiError(e);
    return new Response(JSON.stringify({ error: errorInfo.userMessage }), {
      status: errorInfo.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
