// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/categorizeDream { transcript } -> { title, theme, dreamType }
// - POST /api/generateImage { prompt } -> { imageUrl | imageBytes }
// - POST /api/analyzeDreamFull { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt, imageBytes }
// - POST /api/chat { history, message, lang } -> { text }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parseStorageObjectKey = (url: string, bucket: string): string | null => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const encodedBucket = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const signMatch = path.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/${encodedBucket}/(.+)`));
    if (signMatch?.[1]) return decodeURIComponent(signMatch[1]);
    const directMatch = path.match(new RegExp(`/storage/v1/object/${encodedBucket}/(.+)`));
    if (directMatch?.[1]) return decodeURIComponent(directMatch[1]);
    return null;
  } catch {
    return null;
  }
};

const optimizeImage = async (
  imageBase64: string,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<{ base64: string; contentType: string }> => {
  // Force WEBP output to keep stored images small (<500KB–1MB in practice)
  const { maxWidth = 1024, maxHeight = 1024, quality = 68 } = options;
  try {
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const img = await Image.decode(bytes);
    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    if (scale < 1) {
      img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    }
    const q = Math.min(100, Math.max(1, Math.round(quality)));
    const optimizedBytes = await img.encodeWEBP(q);
    const optimizedBase64 = btoa(String.fromCharCode(...optimizedBytes));
    return { base64: optimizedBase64, contentType: 'image/webp' };
  } catch (err) {
    console.warn('[api] optimizeImage fallback (using original bytes)', err);
    return { base64: imageBase64, contentType: 'image/webp' };
  }
};

async function generateImageFromPrompt(options: {
  prompt: string;
  apiKey: string;
  model: string;
  apiBase?: string;
  aspectRatio?: string;
}): Promise<{ imageBase64?: string; raw: any }> {
  const { prompt, apiKey, model, apiBase = 'https://generativelanguage.googleapis.com' } = options;
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  const lowerModel = model.toLowerCase();
  const supportsImageModel = lowerModel.includes('image') || lowerModel.includes('imagen');
  const resolvedModel = supportsImageModel ? model : resolveImageModel();
  // Image models (Gemini image + Imagen) are served from v1beta.
  const apiVersion = 'v1beta';

  if (!supportsImageModel) {
    throw new Error(
      `Unsupported image model "${model}". Use the image-capable model "gemini-2.5-flash-image".`
    );
  }

  const endpoint = `${apiBase}/${apiVersion}/models/${resolvedModel}:generateContent`;
  const createBody = () => ({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    // Request an image modality explicitly; do not force responseMimeType (reserved for text/json).
    generationConfig: { responseModalities: ['IMAGE'] },
  });

  const requestOnce = async () => {
    return fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(createBody()),
    });
  };

  const res = await requestOnce();
  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`Gemini image error ${res.status}: ${bodyText}`);
  }

  const json = (await res.json()) as any;
  const parts = json?.candidates?.[0]?.content?.parts;
  const inlinePart = Array.isArray(parts)
    ? parts.find((p: any) => p?.inlineData?.data)
    : undefined;

  if (inlinePart?.inlineData?.data) return { imageBase64: inlinePart.inlineData.data as string, raw: json };

  const blockReason = json?.promptFeedback?.blockReason ?? json?.promptFeedback?.block_reason;
  // Surface more detail for diagnostics when Gemini refuses to return an image
  console.warn('[api] Gemini image no inlineData returned', {
    blockReason: blockReason ?? null,
    promptFeedback: json?.promptFeedback ?? null,
  });
  const err = new Error(
    `Gemini image error: no inlineData returned${blockReason ? ` (blockReason=${blockReason})` : ''}`
  );
  (err as any).blockReason = blockReason ?? null;
  (err as any).promptFeedback = json?.promptFeedback ?? null;
  throw err;
}

/**
 * Normalize the image model to a supported Gemini image model. Avoids using Imagen
 * models that are not available on the Gemini API endpoints.
 */
const resolveImageModel = (): string => {
  const envModel = Deno.env.get('IMAGEN_MODEL');
  if (envModel && envModel !== 'gemini-2.5-flash-image') {
    console.warn(`[api] IMAGEN_MODEL ${envModel} overridden; forcing gemini-2.5-flash-image`);
  }
  return 'gemini-2.5-flash-image';
};

/**
 * Normalize the Gemini API base. If a versioned path (v1beta) is provided, prefer v1
 * for image models to avoid 404/not supported errors.
 */
const resolveGeminiApiBase = (): string => {
  const raw = Deno.env.get('GEMINI_API_BASE');
  if (!raw) return 'https://generativelanguage.googleapis.com';
  // Keep user-specified versioning; do not force v1.
  return raw.replace(/\/v1$/, '').replace(/\/v1beta$/, '');
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean); // [ 'api', ...]
  const subPath = '/' + segments.slice(1).join('/'); // '/analyzeDream'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }));
  const user = authData?.user ?? null;

  const storageBucket = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'dream-images';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const uploadImageToStorage = async (
    imageBase64: string,
    contentType: string = 'image/webp'
  ): Promise<string | null> => {
    if (!imageBase64) return null;
    if (!supabaseServiceRoleKey) {
      console.warn('[api] storage upload skipped: SUPABASE_SERVICE_ROLE_KEY not set');
      return null;
    }

    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const extension = contentType.split('/')[1] || 'png';
      const objectKey = `${user?.id ?? 'guest'}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await adminClient.storage
        .from(storageBucket)
        .upload(objectKey, bytes, {
          contentType,
          upsert: false,
          cacheControl: '31536000', // 1 year
        });

      if (uploadError) {
        console.warn('[api] storage upload failed', uploadError);
        return null;
      }

      const { data: signed, error: signedErr } = await adminClient.storage
        .from(storageBucket)
        .createSignedUrl(objectKey, 60 * 60 * 24 * 365); // 1 year

      if (!signedErr && signed?.signedUrl) return signed.signedUrl;

      const { data: publicUrl } = adminClient.storage.from(storageBucket).getPublicUrl(objectKey);
      if (publicUrl?.publicUrl) return publicUrl.publicUrl;
    } catch (storageErr) {
      console.warn('[api] storage upload exception', storageErr);
    }

    return null;
  };

  const deleteImageFromStorage = async (imageUrl: string, ownerId?: string): Promise<boolean> => {
    if (!supabaseServiceRoleKey) {
      console.warn('[api] deleteImageFromStorage skipped: SUPABASE_SERVICE_ROLE_KEY not set');
      return false;
    }

    const objectKey = parseStorageObjectKey(imageUrl, storageBucket);
    if (!objectKey) {
      return false;
    }

    if (!ownerId || !objectKey.startsWith(`${ownerId}/`)) {
      console.warn('[api] deleteImageFromStorage skipped: unauthorized request for object', {
        objectKey,
        ownerId: ownerId ?? null,
      });
      return false;
    }

    try {
      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await adminClient.storage.from(storageBucket).remove([objectKey]);
      if (error) {
        console.warn('[api] deleteImageFromStorage error', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[api] deleteImageFromStorage exception', err);
      return false;
    }
  };

  // Guest quota status (public)
  if (req.method === 'POST' && subPath === '/quota/status') {
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

      const guestLimits = { analysis: 2, exploration: 2, messagesPerDream: 20 };

      // Si pas de fingerprint, retourner mode dégradé (client enforcera localement)
      if (!body?.fingerprint || !supabaseServiceRoleKey) {
        console.log('[api] /quota/status: no fingerprint or service key, returning degraded mode');
        return new Response(
          JSON.stringify({
            tier: 'guest',
            usage: {
              analysis: { used: 0, limit: guestLimits.analysis },
              exploration: { used: 0, limit: guestLimits.exploration },
              messages: { used: 0, limit: guestLimits.messagesPerDream },
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
              analysis: { used: 0, limit: guestLimits.analysis },
              exploration: { used: 0, limit: guestLimits.exploration },
              messages: { used: 0, limit: guestLimits.messagesPerDream },
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
      const canAnalyze = analysisUsed < guestLimits.analysis;
      const canExplore = explorationUsed < guestLimits.exploration;

      const reasons: string[] = [];
      if (!canAnalyze) {
        reasons.push(`Guest analysis limit reached (${analysisUsed}/${guestLimits.analysis}). Create a free account to get more!`);
      }
      if (!canExplore) {
        reasons.push(`Guest exploration limit reached (${explorationUsed}/${guestLimits.exploration}). Create a free account to continue!`);
      }

      return new Response(
        JSON.stringify({
          tier: 'guest',
          usage: {
            analysis: { used: analysisUsed, limit: guestLimits.analysis },
            exploration: { used: explorationUsed, limit: guestLimits.exploration },
            messages: { used: 0, limit: guestLimits.messagesPerDream },
          },
          canAnalyze,
          canExplore,
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

  if (req.method === 'POST' && subPath === '/transcribe') {
    try {
      const body = (await req.json()) as {
        contentBase64?: string;
        encoding?: string;
        languageCode?: string;
        sampleRateHertz?: number;
      };

      const contentBase64 = String(body?.contentBase64 ?? '');
      if (!contentBase64) throw new Error('Missing contentBase64');

      const encoding = String(body?.encoding ?? 'LINEAR16');
      const languageCode = String(body?.languageCode ?? 'fr-FR');
      const sampleRateHertz = body?.sampleRateHertz;

      console.log('[api] /transcribe request', {
        userId: user?.id ?? null,
        encoding,
        languageCode,
        sampleRateHertz,
        contentLength: contentBase64.length,
      });

      const apiKey = Deno.env.get('GOOGLE_CLOUD_STT_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
      if (!apiKey) throw new Error('GOOGLE_CLOUD_STT_API_KEY not set');

      const config: Record<string, unknown> = {
        encoding,
        languageCode,
        enableAutomaticPunctuation: true,
      };
      if (typeof sampleRateHertz === 'number' && sampleRateHertz > 0) {
        config.sampleRateHertz = sampleRateHertz;
      }

      const sttRes = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config, audio: { content: contentBase64 } }),
        }
      );
      if (!sttRes.ok) {
        const t = await sttRes.text();
        console.error('[api] /transcribe google error', sttRes.status, t);
        throw new Error(`Google STT error ${sttRes.status}: ${t}`);
      }
      const sttJson = (await sttRes.json()) as any;
      const transcript: string = sttJson?.results?.[0]?.alternatives?.[0]?.transcript ?? '';

      console.log('[api] /transcribe success', {
        userId: user?.id ?? null,
        transcriptLength: transcript.length,
        hasResults: Boolean(sttJson?.results?.length),
      });

      return new Response(JSON.stringify({ transcript }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      console.error('[api] /transcribe error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Public chat endpoint: conversational follow-ups about dreams
  if (req.method === 'POST' && subPath === '/chat') {
    try {
      const body = (await req.json()) as {
        history?: { role: 'user' | 'model'; text: string }[];
        message?: string;
        lang?: string;
      };

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      // Build conversation
      const history = Array.isArray(body?.history) ? body!.history! : [];
      const message = String(body?.message ?? '').trim();
      const lang = String(body?.lang ?? 'en');

      // Compose chat contents in Gemini format
      const systemPreamble =
        lang === 'fr'
          ? 'Tu es un assistant empathique qui aide à interpréter les rêves. Sois clair, bienveillant et évite les affirmations médicales. Réponds en français.'
          : 'You are an empathetic assistant helping interpret dreams. Be clear and kind, avoid medical claims. Reply in the requested language.';

      const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
      contents.push({ role: 'user', parts: [{ text: systemPreamble }] });
      for (const turn of history) {
        const r = turn.role === 'model' ? 'model' : 'user';
        const t = String(turn.text ?? '');
        if (t) contents.push({ role: r, parts: [{ text: t }] });
      }
      if (message) contents.push({ role: 'user', parts: [{ text: message }] });

      const genAI = new GoogleGenerativeAI(apiKey);
      const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

      let reply = '';
      try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent({
          contents,
          generationConfig: { temperature: 0.7 },
        });
        reply = result.response.text();
      } catch (err) {
        console.warn('[api] /chat primary model failed, retrying with flash-lite', primaryModel, err);
        const fallbackModel = 'gemini-2.5-flash-lite';
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent({
          contents,
          generationConfig: { temperature: 0.7 },
        });
        reply = result.response.text();
      }

      if (typeof reply !== 'string' || !reply.trim()) {
        throw new Error('Empty model response');
      }

      return new Response(JSON.stringify({ text: reply.trim() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      console.error('[api] /chat error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Public analyzeDream: allow without auth (skip DB insert when user is null)
  if (req.method === 'POST' && subPath === '/analyzeDream') {
    try {
      const body = (await req.json()) as { transcript?: string; lang?: string; fingerprint?: string };
      const transcript = String(body?.transcript ?? '').trim();
      const lang = String(body?.lang ?? 'en');
      const fingerprint = body?.fingerprint;
      if (!transcript) throw new Error('Missing transcript');

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      console.log('[api] /analyzeDream request', {
        userId: user?.id ?? null,
        transcriptLength: transcript.length,
        lang,
        snippet: transcript.slice(0, 80),
        hasFingerprint: !!fingerprint,
      });

      // Guest quota enforcement
      let quotaUsed: { analysis: number } | undefined;
      if (!user && supabaseServiceRoleKey) {
        if (!fingerprint) {
          // Mode dégradé: pas de fingerprint = autoriser avec warning
          console.warn('[api] /analyzeDream: guest without fingerprint, allowing in degraded mode');
        } else {
          // Vérifier et incrémenter le quota
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const guestAnalysisLimit = 2;
          const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
            p_fingerprint: fingerprint,
            p_quota_type: 'analysis',
            p_limit: guestAnalysisLimit,
          });

          if (quotaError) {
            console.error('[api] /analyzeDream: quota check failed', quotaError);
            // En cas d'erreur, autoriser (fail open) mais logger
          } else if (!quotaResult?.allowed) {
            console.log('[api] /analyzeDream: guest quota exceeded', { fingerprint: '[redacted]', used: quotaResult?.new_count });
            return new Response(
              JSON.stringify({
                error: 'Guest analysis limit reached',
                code: 'QUOTA_EXCEEDED',
                usage: { analysis: { used: quotaResult?.new_count ?? guestAnalysisLimit, limit: guestAnalysisLimit } },
              }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } else {
            quotaUsed = { analysis: quotaResult.new_count };
          }
        }
      }

      const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
      const systemInstruction = lang === 'fr'
        ? 'Réponds uniquement en JSON strict.'
        : lang === 'es'
          ? 'Responde solo en JSON estricto.'
          : 'Return ONLY strict JSON.';

      // Ask the model to return strict JSON (no schema fields here to keep compatibility)
      const prompt = `You analyze user dreams. ${systemInstruction} with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

      let text = '';
      try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      } catch (err) {
        console.warn('[api] /analyzeDream primary model failed, retrying with flash', primaryModel, err);
        const fallbackModel = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      }

      console.log('[api] /analyzeDream model raw length', text.length);

      let analysis: any;
      try {
        analysis = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
      if (!analysis) throw new Error('Failed to parse Gemini response');

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
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Combined: analyze dream and generate image in one call (public)
  if (req.method === 'POST' && subPath === '/analyzeDreamFull') {
    try {
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
        snippet: transcript.slice(0, 80),
        hasFingerprint: !!fingerprint,
      });

      // Guest quota enforcement
      let quotaUsed: { analysis: number } | undefined;
      if (!user && supabaseServiceRoleKey) {
        if (!fingerprint) {
          // Mode dégradé: pas de fingerprint = autoriser avec warning
          console.warn('[api] /analyzeDreamFull: guest without fingerprint, allowing in degraded mode');
        } else {
          // Vérifier et incrémenter le quota
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const guestAnalysisLimit = 2;
          const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
            p_fingerprint: fingerprint,
            p_quota_type: 'analysis',
            p_limit: guestAnalysisLimit,
          });

          if (quotaError) {
            console.error('[api] /analyzeDreamFull: quota check failed', quotaError);
            // En cas d'erreur, autoriser (fail open) mais logger
          } else if (!quotaResult?.allowed) {
            console.log('[api] /analyzeDreamFull: guest quota exceeded', { fingerprint: '[redacted]', used: quotaResult?.new_count });
            return new Response(
              JSON.stringify({
                error: 'Guest analysis limit reached',
                code: 'QUOTA_EXCEEDED',
                usage: { analysis: { used: quotaResult?.new_count ?? guestAnalysisLimit, limit: guestAnalysisLimit } },
              }),
              { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } else {
            quotaUsed = { analysis: quotaResult.new_count };
          }
        }
      }

      const langName = lang === 'fr' ? 'French' : lang === 'es' ? 'Spanish' : 'English';
      const systemInstruction = lang === 'fr'
        ? 'Réponds uniquement en JSON strict.'
        : lang === 'es'
          ? 'Responde solo en JSON estricto.'
          : 'Return ONLY strict JSON.';

      // 1) Analyze the dream
      const prompt = `You analyze user dreams. ${systemInstruction} with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream", "imagePrompt": string}. Choose the single most appropriate dreamType from that list. The content (title, interpretation, quote) MUST be in ${langName}.\nDream transcript:\n${transcript}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-pro';

      let text = '';
      try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      } catch (err) {
        console.warn('[api] /analyzeDreamFull primary model failed, retrying with flash', primaryModel, err);
        const fallbackModel = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      }

      console.log('[api] /analyzeDreamFull model raw length', text.length);

      let analysis: any;
      try {
        analysis = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
      if (!analysis) throw new Error('Failed to parse Gemini response');

      const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
        ? analysis.theme
        : 'surreal';

      // 2) Generate image from the prompt
      const imagePrompt = String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere');

      const apiBase = resolveGeminiApiBase();
      const imageModel = resolveImageModel();
      const { imageBase64, raw: imgJson } = await generateImageFromPrompt({
        prompt: imagePrompt,
        apiKey,
        model: imageModel,
        apiBase,
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
        (await optimizeImage(imageBase64, { maxWidth: 1024, maxHeight: 1024, quality: 68 }).catch(() => null)) ?? {
          base64: imageBase64,
          contentType: 'image/webp',
        };

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
          imageBytes: optimized.base64, // kept for backward compatibility with clients expecting bytes
          ...(quotaUsed && { quotaUsed }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (e) {
      console.error('[api] /analyzeDreamFull error', e);
      return new Response(
        JSON.stringify({
          error: String((e as Error).message || e),
          ...(e as any)?.blockReason ? { blockReason: (e as any).blockReason } : {},
          ...(e as any)?.promptFeedback ? { promptFeedback: (e as any).promptFeedback } : {},
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  }

  // Public categorizeDream: fast metadata generation
  if (req.method === 'POST' && subPath === '/categorizeDream') {
    try {
      const body = (await req.json()) as { transcript?: string; lang?: string };
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
        ? 'Réponds uniquement en JSON strict.'
        : lang === 'es'
          ? 'Responde solo en JSON estricto.'
          : 'Return ONLY strict JSON.';

      const prompt = `You analyze user dreams. ${systemInstruction} with keys: {"title": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": "Lucid Dream"|"Recurring Dream"|"Nightmare"|"Symbolic Dream"}. Choose the single most appropriate theme and dreamType from that list. The title MUST be in ${langName}.\nDream transcript:\n${transcript}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      // Use flash-lite model for speed/cost as requested
      const modelName = 'gemini-2.5-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      });
      const text = result.response.text();

      let analysis: any;
      try {
        analysis = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
      if (!analysis) throw new Error('Failed to parse Gemini response');

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
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (e) {
      console.error('[api] /categorizeDream error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Public generateImage (temporary public access)
  if (req.method === 'POST' && subPath === '/generateImage') {
    try {
      const body = (await req.json()) as { prompt?: string; transcript?: string; previousImageUrl?: string };
      let prompt = String(body?.prompt ?? '').trim();
      const transcript = String(body?.transcript ?? '').trim();
      const previousImageUrl = String(body?.previousImageUrl ?? '').trim();

      if (!prompt && !transcript) {
        return new Response(JSON.stringify({ error: 'Missing prompt or transcript' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      // If we have a transcript but no prompt, generate the prompt first
      if (!prompt && transcript) {
        console.log('[api] /generateImage generating prompt from transcript');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const promptGenResult = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Generate a short, vivid, artistic image prompt (max 40 words) to visualize this dream. Do not include any other text.\nDream: ${transcript}` }] }],
        });
        prompt = promptGenResult.response.text().trim();
        console.log('[api] /generateImage generated prompt:', prompt);
      }

      const apiBase = resolveGeminiApiBase();
      const imageModel = resolveImageModel();
      const { imageBase64, raw: imgJson } = await generateImageFromPrompt({
        prompt,
        apiKey,
        model: imageModel,
        apiBase,
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
        (await optimizeImage(imageBase64, { maxWidth: 1024, maxHeight: 1024, quality: 68 }).catch(() => null)) ?? {
          base64: imageBase64,
          contentType: 'image/webp',
        };

      const storedImageUrl = await uploadImageToStorage(optimized.base64, optimized.contentType);
      const imageUrl = storedImageUrl ?? `data:${optimized.contentType};base64,${optimized.base64}`;

      if (previousImageUrl) {
        await deleteImageFromStorage(previousImageUrl, user?.id ?? undefined);
      }

      return new Response(JSON.stringify({ imageUrl, imageBytes: optimized.base64, prompt }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      console.error('[api] /generateImage error', e);
      return new Response(
        JSON.stringify({
          error: String((e as Error).message || e),
          ...(e as any)?.blockReason ? { blockReason: (e as any).blockReason } : {},
          ...(e as any)?.promptFeedback ? { promptFeedback: (e as any).promptFeedback } : {},
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
