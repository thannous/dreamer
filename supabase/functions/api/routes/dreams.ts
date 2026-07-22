import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { CATEGORIZE_DREAM_SCHEMA } from '../lib/schemas.ts';
import {
  callGeminiWithFallback,
  classifyGeminiError,
  GEMINI_FLASH_LITE_MODEL,
  resolveTextModel,
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
import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  normalizeAiLanguage,
  validateBoundedText,
} from '../lib/aiRequestPolicy.ts';
import { admitSynchronousAiRequest } from '../services/aiAdmission.ts';
import { runDreamAnalysis } from '../services/dreamAnalysis.ts';

export {
  sanitizeAnalysisDetails,
  type DreamAnalysisDetails,
} from '../services/dreamAnalysis.ts';

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

const parseDreamTextInput = (
  body: AnalyzeDreamBody
): { transcript: string; lang: string } | Response => {
  const transcript = validateBoundedText(body?.transcript, {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptChars,
  });
  if (!transcript.ok) return aiInputErrorResponse(transcript);

  const language = validateBoundedText(body?.lang, {
    field: 'lang',
    maxChars: AI_REQUEST_LIMITS.languageChars,
    required: false,
  });
  if (!language.ok) return aiInputErrorResponse(language);

  return {
    transcript: transcript.value,
    lang: normalizeAiLanguage(language.value || 'en'),
  };
};

const validateAnalysisRequestId = (body: AnalyzeDreamBody): Response | null => {
  const candidate = body.analysisRequestId ?? body.requestId;
  if (candidate == null) return null;
  if (toUuid(candidate)) return null;
  return aiInputErrorResponse({
    ok: false,
    code: 'INVALID_INPUT',
    field: 'analysisRequestId',
  });
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
      console.error('[api] authenticated analysis quota resolver failed', {
        code: error?.code ?? null,
      });
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
    console.error('[api] authenticated analysis quota transcript resolver failed', {
      code: error?.code ?? null,
    });
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
    console.error(`[api] ${route}: authenticated quota claim failed before provider work`, {
      code: quotaError?.code ?? null,
    });
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
      code: claim.code ?? 'UNKNOWN',
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
    const guestCheck = await requireGuestSession(req, body, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const parsedInput = parseDreamTextInput(body);
    if (parsedInput instanceof Response) return parsedInput;
    const invalidRequestId = validateAnalysisRequestId(body);
    if (invalidRequestId) return invalidRequestId;
    const { transcript, lang } = parsedInput;
    const fingerprint = guestCheck.fingerprint;

    const admission = await admitSynchronousAiRequest({
      ctx,
      capability: 'analyze_dream',
      guestFingerprint: fingerprint,
    });
    if (admission instanceof Response) return admission;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /analyzeDream request', {
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
        const effectiveLimit = typeof (quotaResult as any)?.limit === 'number'
          ? toCount((quotaResult as any).limit)
          : guestAnalysisLimit;
        const payload = {
          error: 'Guest interpretation limit reached',
          code: 'QUOTA_EXCEEDED',
          usage: { analysis: { used, limit: effectiveLimit } },
        };

        console.log('[api] /analyzeDream: guest quota blocked before provider work', {
          fingerprint: '[redacted]',
          used,
          riskLevel: (quotaResult as any)?.risk_level ?? 'unknown',
        });
        return new Response(JSON.stringify(payload), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      quotaUsed = { analysis: toCount((quotaResult as any)?.new_count) };
    }

    const analysis = await runDreamAnalysis({ apiKey, transcript, lang, route: '/analyzeDream' });

    console.log('[api] /analyzeDream success', {
      titleLength: analysis.title.length,
      quotaReported: quotaUsed?.analysis !== undefined,
    });

    return new Response(
      JSON.stringify({
        ...analysis,
        ...(quotaUsed && { quotaUsed }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /analyzeDream failed');
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
    const parsedInput = parseDreamTextInput(body);
    if (parsedInput instanceof Response) return parsedInput;
    const invalidRequestId = validateAnalysisRequestId(body);
    if (invalidRequestId) return invalidRequestId;
    const { transcript, lang } = parsedInput;

    const admission = await admitSynchronousAiRequest({
      ctx,
      capability: 'analyze_dream_full',
      guestFingerprint: null,
    });
    if (admission instanceof Response) return admission;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /analyzeDreamFull request', {
      transcriptLength: transcript.length,
      lang,
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

    const analysis = await runDreamAnalysis({ apiKey, transcript, lang, route: '/analyzeDreamFull' });
    const imagePrompt = analysis.imagePrompt;

    const { imageBase64, mimeType } = await generateImageFromPrompt({
      prompt: imagePrompt,
      apiKey,
      model: imageModel,
      aspectRatio: '9:16',
    });

    if (!imageBase64) {
      return new Response(
        JSON.stringify({
          error: 'No image returned',
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
        ...analysis,
        imageUrl,
        imageBytes: optimized.base64,
        ...(quotaUsed && { quotaUsed }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('[api] /analyzeDreamFull failed');
    const errorInfo = classifyGeminiError(e);
    return new Response(
      JSON.stringify({
        error: errorInfo.userMessage,
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
    const body = (await req.json()) as AnalyzeDreamBody;
    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const parsedInput = parseDreamTextInput(body);
    if (parsedInput instanceof Response) return parsedInput;
    const { transcript, lang } = parsedInput;

    const admission = await admitSynchronousAiRequest({
      ctx,
      capability: 'categorize_dream',
      guestFingerprint: guestCheck.fingerprint,
    });
    if (admission instanceof Response) return admission;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /categorizeDream request', {
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

    const liteModel = resolveTextModel('GEMINI_LITE_MODEL', GEMINI_FLASH_LITE_MODEL);
    const { text } = await callGeminiWithFallback(
      apiKey,
      liteModel,
      liteModel,
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: CATEGORIZE_DREAM_SCHEMA,
        thinkingLevel: 'minimal',
        maxOutputTokens: 512,
      }
    );

    let analysis: any;
    try {
      analysis = JSON.parse(text);
    } catch {
      console.error('[api] /categorizeDream: model returned invalid JSON', {
        responseLength: text.length,
      });
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
    console.error('[api] /categorizeDream failed');
    const errorInfo = classifyGeminiError(e);
    return new Response(JSON.stringify({ error: errorInfo.userMessage }), {
      status: errorInfo.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
