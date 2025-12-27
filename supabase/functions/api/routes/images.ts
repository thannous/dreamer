import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { callGeminiWithFallback, classifyGeminiError } from '../services/gemini.ts';
import { generateImageFromPrompt, generateImageWithReferences } from '../services/geminiImages.ts';
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

export async function handleGenerateImage(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey, storageBucket } = ctx;

  try {
    const body = (await req.json()) as { prompt?: string; transcript?: string; previousImageUrl?: string };
    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const fingerprint = guestCheck.fingerprint;
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

    const guestImageLimit = GUEST_LIMITS.image;
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
        console.error('[api] /generateImage: quota status check failed', statusError);
      } else {
        const parsed = (status ?? {}) as GuestQuotaStatus;
        const used = toCount(parsed.image_count);
        const isUpgraded = !!parsed.is_upgraded;
        if (isUpgraded) {
          return new Response(
            JSON.stringify({
              error: 'Login required',
              code: 'GUEST_DEVICE_UPGRADED',
              isUpgraded: true,
              usage: { image: { used, limit: guestImageLimit } },
            }),
            { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        if (used >= guestImageLimit) {
          console.log('[api] /generateImage: guest image quota exceeded', { fingerprint: '[redacted]', used });
          return new Response(
            JSON.stringify({
              error: 'Guest image limit reached',
              code: 'QUOTA_EXCEEDED',
              usage: { image: { used, limit: guestImageLimit } },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    }

    if (!prompt && transcript) {
      console.log('[api] /generateImage generating prompt from transcript');
      const { text: generatedPrompt } = await callGeminiWithFallback(
        apiKey,
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-lite',
        [{ role: 'user', parts: [{ text: `Generate a short, vivid, artistic image prompt (max 40 words) to visualize this dream. Do not include any other text.\nDream: ${transcript}` }] }],
        'You are a creative image prompt generator. Output ONLY the prompt, nothing else.',
        { temperature: 0.8 }
      );
      prompt = generatedPrompt.trim();
      console.log('[api] /generateImage generated prompt:', prompt);
    }

    const { imageBase64, mimeType, raw: imgJson } = await generateImageFromPrompt({
      prompt,
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
        { maxWidth: 1024, maxHeight: 1024, quality: 78, aspectRatio: 9 / 16 }
      ).catch(() => null)) ?? {
        base64: imageBase64,
        contentType: mimeType ?? 'image/png',
      };

    const ownerId = user?.id ?? (fingerprint ? `guest_${fingerprint}` : 'guest');
    const { uploadImageToStorage, deleteImageFromStorage } = createStorageHelpers({
      supabaseUrl,
      supabaseServiceRoleKey,
      storageBucket,
      ownerId,
    });
    const storedImageUrl = await uploadImageToStorage(optimized.base64, optimized.contentType);
    const imageUrl = storedImageUrl ?? `data:${optimized.contentType};base64,${optimized.base64}`;

    if (previousImageUrl) {
      await deleteImageFromStorage(previousImageUrl, ownerId);
    }

    if (adminClient && fingerprint) {
      const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
        p_fingerprint: fingerprint,
        p_quota_type: 'image',
        p_limit: guestImageLimit,
      });

      if (quotaError) {
        console.error('[api] /generateImage: quota increment failed', quotaError);
      } else if (!quotaResult?.allowed) {
        const used = toCount((quotaResult as any)?.new_count);
        console.log('[api] /generateImage: guest image quota exceeded at commit', { fingerprint: '[redacted]', used });
        if (storedImageUrl) {
          await deleteImageFromStorage(storedImageUrl, ownerId);
        }
        return new Response(
          JSON.stringify({
            error: 'Guest image limit reached',
            code: 'QUOTA_EXCEEDED',
            usage: { image: { used, limit: guestImageLimit } },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    return new Response(JSON.stringify({ imageUrl, imageBytes: optimized.base64, prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[api] /generateImage error', e);
    const err = e as any;
    const errorInfo = classifyGeminiError(e);
    console.error('[api] /generateImage error details', {
      status: errorInfo.status,
      blockReason: err?.blockReason ?? null,
      finishReason: err?.finishReason ?? null,
      retryAttempts: err?.retryAttempts ?? null,
      isTransient: err?.isTransient ?? null,
      httpStatus: err?.httpStatus ?? null,
    });
    return new Response(
      JSON.stringify({
        error: errorInfo.userMessage,
        ...(err?.blockReason != null ? { blockReason: err.blockReason } : {}),
        ...(err?.finishReason != null ? { finishReason: err.finishReason } : {}),
        ...(err?.promptFeedback != null ? { promptFeedback: err.promptFeedback } : {}),
        ...(err?.retryAttempts != null ? { retryAttempts: err.retryAttempts } : {}),
        ...(err?.isTransient != null ? { isTransient: err.isTransient } : {}),
      }),
      {
        status: errorInfo.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

export async function handleGenerateImageWithReference(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey, storageBucket } = ctx;

  const authCheck = requireUser(user);
  if (authCheck) {
    return authCheck;
  }

  try {
    const body = (await req.json()) as {
      prompt?: string;
      transcript?: string;
      referenceImages?: { data: string; mimeType: string; type: string }[];
      previousImageUrl?: string;
    };

    let prompt = String(body?.prompt ?? '').trim();
    const transcript = String(body?.transcript ?? '').trim();
    const referenceImages = body?.referenceImages ?? [];
    const previousImageUrl = String(body?.previousImageUrl ?? '').trim();

    if (!prompt && !transcript) {
      return new Response(JSON.stringify({ error: 'Missing prompt or transcript' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!Array.isArray(referenceImages) || referenceImages.length === 0 || referenceImages.length > 2) {
      return new Response(JSON.stringify({ error: 'Must provide 1-2 reference images' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const MAX_REFERENCE_SIZE = 1.5 * 1024 * 1024;
    const MAX_TOTAL_PAYLOAD = 4 * 1024 * 1024;
    let totalSize = 0;

    for (const ref of referenceImages) {
      if (!ref.data || !ref.mimeType || !ref.type) {
        return new Response(JSON.stringify({ error: 'Invalid reference image format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(ref.mimeType)) {
        return new Response(JSON.stringify({ error: 'Invalid image mimeType. Must be jpeg, png, or webp' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (!['person', 'animal'].includes(ref.type)) {
        return new Response(JSON.stringify({ error: 'Invalid reference type. Must be person or animal' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const size = ref.data.length * 0.75;
      totalSize += size;

      if (size > MAX_REFERENCE_SIZE) {
        return new Response(JSON.stringify({ error: `Reference image too large (max ${MAX_REFERENCE_SIZE / 1024 / 1024}MB)` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (totalSize > MAX_TOTAL_PAYLOAD) {
      return new Response(JSON.stringify({ error: `Total payload too large (max ${MAX_TOTAL_PAYLOAD / 1024 / 1024}MB)` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    console.log('[api] /generateImageWithReference request', {
      userId: user.id,
      hasPrompt: !!prompt,
      hasTranscript: !!transcript,
      referenceCount: referenceImages.length,
      referenceTypes: referenceImages.map(r => r.type),
    });

    if (!prompt && transcript) {
      console.log('[api] /generateImageWithReference generating prompt from transcript');
      const { text: generatedPrompt } = await callGeminiWithFallback(
        apiKey,
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash-lite',
        [{ role: 'user', parts: [{ text: `Generate a short, vivid, artistic image prompt (max 40 words) to visualize this dream. Do not include any other text.\nDream: ${transcript}` }] }],
        'You are a creative image prompt generator. Output ONLY the prompt, nothing else.',
        { temperature: 0.8 }
      );
      prompt = generatedPrompt.trim();
      console.log('[api] /generateImageWithReference generated prompt:', prompt);
    }

    const { imageBase64, mimeType, raw: imgJson } = await generateImageWithReferences({
      prompt,
      apiKey,
      referenceImages,
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

    const { uploadImageToStorage, deleteImageFromStorage } = createStorageHelpers({
      supabaseUrl,
      supabaseServiceRoleKey,
      storageBucket,
      ownerId: user.id,
    });
    const storedImageUrl = await uploadImageToStorage(optimized.base64, optimized.contentType);
    const imageUrl = storedImageUrl ?? `data:${optimized.contentType};base64,${optimized.base64}`;

    if (previousImageUrl) {
      await deleteImageFromStorage(previousImageUrl, user.id);
    }

    console.log('[api] /generateImageWithReference success', {
      userId: user.id,
      imageUploaded: !!storedImageUrl,
      previousImageDeleted: !!previousImageUrl,
    });

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[api] /generateImageWithReference error', e);
    const err = e as any;
    const errorInfo = classifyGeminiError(e);
    console.error('[api] /generateImageWithReference error details', {
      status: errorInfo.status,
      blockReason: err?.blockReason ?? null,
      finishReason: err?.finishReason ?? null,
      retryAttempts: err?.retryAttempts ?? null,
      isTransient: err?.isTransient ?? null,
      httpStatus: err?.httpStatus ?? null,
    });
    return new Response(
      JSON.stringify({
        error: errorInfo.userMessage,
        ...(err?.blockReason != null ? { blockReason: err.blockReason } : {}),
        ...(err?.finishReason != null ? { finishReason: err.finishReason } : {}),
        ...(err?.promptFeedback != null ? { promptFeedback: err.promptFeedback } : {}),
        ...(err?.retryAttempts != null ? { retryAttempts: err.retryAttempts } : {}),
        ...(err?.isTransient != null ? { isTransient: err.isTransient } : {}),
      }),
      {
        status: errorInfo.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}
