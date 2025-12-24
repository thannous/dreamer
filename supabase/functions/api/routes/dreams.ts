import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { ANALYZE_DREAM_SCHEMA, CATEGORIZE_DREAM_SCHEMA } from '../lib/schemas.ts';
import { callGeminiWithFallback, classifyGeminiError } from '../services/gemini.ts';
import { generateImageFromPrompt } from '../services/geminiImages.ts';
import { optimizeImage } from '../services/image.ts';
import { createStorageHelpers } from '../services/storage.ts';
import { requireGuestSession, requireUser } from '../lib/guards.ts';
import type { ApiContext } from '../types.ts';

type GuestQuotaStatus = {
  analysis_count?: number;
  exploration_count?: number;
  image_count?: number;
  is_upgraded?: boolean;
};

const toCount = (value: unknown): number => {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

export async function handleAnalyzeDream(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json()) as { transcript?: string; lang?: string; fingerprint?: string };
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
    });

    const guestAnalysisLimit = GUEST_LIMITS.analysis;
    const adminClient =
      !user && supabaseServiceRoleKey && fingerprint
        ? createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

    if (adminClient && fingerprint) {
      const { data: status, error: statusError } = await adminClient.rpc('get_guest_quota_status', {
        p_fingerprint: fingerprint,
      });

      if (statusError) {
        console.error('[api] /analyzeDream: quota status check failed', statusError);
      } else {
        const parsed = (status ?? {}) as GuestQuotaStatus;
        const used = toCount(parsed.analysis_count);
        const isUpgraded = !!parsed.is_upgraded;
        if (isUpgraded) {
          return new Response(
            JSON.stringify({
              error: 'Login required',
              code: 'GUEST_DEVICE_UPGRADED',
              isUpgraded: true,
              usage: { analysis: { used, limit: guestAnalysisLimit } },
            }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        if (used >= guestAnalysisLimit) {
          console.log('[api] /analyzeDream: guest quota exceeded', { fingerprint: '[redacted]', used });
          return new Response(
            JSON.stringify({
              error: 'Guest analysis limit reached',
              code: 'QUOTA_EXCEEDED',
              usage: { analysis: { used, limit: guestAnalysisLimit } },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    }

    let quotaUsed: { analysis: number } | undefined;

    const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
    const systemInstruction = lang === 'fr'
      ? 'Analyse les rêves. Retourne UNIQUEMENT du JSON valide.'
      : lang === 'es'
        ? 'Analiza sueños. Devuelve SOLO JSON válido.'
        : 'Analyze dreams. Return ONLY valid JSON.';

    const prompt = `You analyze user dreams with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

    const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-flash-preview';
    const { text } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      'gemini-3-flash-preview',
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYZE_DREAM_SCHEMA
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

    if (adminClient && fingerprint) {
      const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
        p_fingerprint: fingerprint,
        p_quota_type: 'analysis',
        p_limit: guestAnalysisLimit,
      });

      if (quotaError) {
        console.error('[api] /analyzeDream: quota increment failed', quotaError);
      } else if (!quotaResult?.allowed) {
        const used = toCount((quotaResult as any)?.new_count);
        console.log('[api] /analyzeDream: guest quota exceeded at commit', { fingerprint: '[redacted]', used });
        return new Response(
          JSON.stringify({
            error: 'Guest analysis limit reached',
            code: 'QUOTA_EXCEEDED',
            usage: { analysis: { used, limit: guestAnalysisLimit } },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } else {
        quotaUsed = { analysis: toCount((quotaResult as any)?.new_count) };
      }
    }

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
    const body = (await req.json()) as { transcript?: string; lang?: string; fingerprint?: string };
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
    });

    const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
    const systemInstruction = lang === 'fr'
      ? 'Analyse les rêves. Retourne UNIQUEMENT du JSON valide.'
      : lang === 'es'
        ? 'Analiza sueños. Devuelve SOLO JSON válido.'
        : 'Analyze dreams. Return ONLY valid JSON.';

    const prompt = `You analyze user dreams with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

    const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-flash-preview';
    const { text } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      'gemini-3-flash-preview',
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: ANALYZE_DREAM_SCHEMA
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
        { maxWidth: 1024, maxHeight: 1024, quality: 78 }
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
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash-lite',
      [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction,
      {
        responseMimeType: 'application/json',
        responseJsonSchema: CATEGORIZE_DREAM_SCHEMA
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
