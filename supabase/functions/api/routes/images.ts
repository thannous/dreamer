import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { classifyGeminiError } from '../services/gemini.ts';
import { resolveImageModel } from '../services/geminiImages.ts';
import { ensureImagePrompt, generateAndStoreImage } from '../services/imagePipeline.ts';
import { requireGuestSession } from '../lib/guards.ts';
import { jsonResponse } from '../lib/http.ts';
import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  parseLegacyImageTranscriptInput,
  validateBoundedText,
} from '../lib/aiRequestPolicy.ts';
import { admitSynchronousAiRequest } from '../services/aiAdmission.ts';
import type { ApiContext } from '../types.ts';

type RpcResult<T = unknown> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

type AdminClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult<any>>;
};

const toCount = (value: unknown): number => {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const normalizeEffectiveSubscriptionTier = (tier: unknown): 'free' | 'plus' =>
  tier === 'plus' ? 'plus' : 'free';

const imageGenerationPlusRequiredResponse = () =>
  jsonResponse(
    {
      error: 'Image generation requires Noctalia Plus',
      code: 'IMAGE_GENERATION_PLUS_REQUIRED',
      userMessage: 'Upgrade to Noctalia Plus to generate dream images.',
    },
    402
  );

const serviceUnavailable = (message = 'Service unavailable') =>
  jsonResponse({ error: message }, 503);

const requireImageGenerationEntitlement = async (
  supabase: ApiContext['supabase'],
  userId: string | null | undefined,
  route: string
): Promise<Response | null> => {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_effective_subscription_tier', {
    p_user_id: userId,
  });

  if (error) {
    console.warn(`[api] ${route}: failed to resolve subscription tier for image gate`, {
      code: error?.code ?? null,
    });
    return serviceUnavailable('Subscription status unavailable');
  }

  const effectiveTier = normalizeEffectiveSubscriptionTier(data);
  if (effectiveTier !== 'plus') {
    console.log(`[api] ${route}: blocked non-plus image generation`, {
      effectiveTier,
    });
    return imageGenerationPlusRequiredResponse();
  }

  return null;
};

const releaseGuestImageQuotaClaim = async (
  adminClient: AdminClient,
  fingerprint: string,
  route: string
) => {
  const { error } = await adminClient.rpc('release_guest_quota_claim', {
    p_fingerprint: fingerprint,
    p_quota_type: 'image',
  });

  if (error) {
    console.warn(`[api] ${route}: failed to release guest image quota claim`, {
      code: error?.code ?? null,
    });
  }
};

const claimGuestImageQuota = async (
  adminClient: AdminClient,
  fingerprint: string,
  limit: number,
  route: string
): Promise<Response | null> => {
  const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
    p_fingerprint: fingerprint,
    p_quota_type: 'image',
    p_limit: limit,
  });

  if (quotaError) {
    console.error(`[api] ${route}: guest image quota claim failed`, {
      code: quotaError?.code ?? null,
    });
    return serviceUnavailable('Guest quota unavailable');
  }

  const parsed = (quotaResult ?? null) as Record<string, unknown> | null;
  if (!parsed || typeof parsed.allowed !== 'boolean') {
    console.error(`[api] ${route}: guest image quota claim returned invalid payload`, {
      hasPayload: !!parsed,
    });
    return serviceUnavailable('Guest quota unavailable');
  }

  if (!parsed.allowed) {
    const used = toCount(parsed.new_count);
    const isUpgraded = Boolean(parsed.is_upgraded);
    console.log(`[api] ${route}: guest image quota denied`, {
      fingerprint: '[redacted]',
      used,
      isUpgraded,
    });

    return jsonResponse(
      isUpgraded
        ? {
            error: 'Login required',
            code: 'GUEST_DEVICE_UPGRADED',
            isUpgraded: true,
            usage: { image: { used, limit } },
          }
        : {
            error: 'Guest image limit reached',
            code: 'QUOTA_EXCEEDED',
            usage: { image: { used, limit } },
          },
      isUpgraded ? 403 : 429
    );
  }

  return null;
};

export async function handleGenerateImage(ctx: ApiContext): Promise<Response> {
  const { req, supabase, user, supabaseUrl, supabaseServiceRoleKey, storageBucket } = ctx;
  let guestQuotaClaim: { adminClient: AdminClient; fingerprint: string } | null = null;

  try {
    const body = (await req.json()) as { prompt?: string; transcript?: string; previousImageUrl?: string };
    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const fingerprint = guestCheck.fingerprint;
    const promptInput = validateBoundedText(body?.prompt, {
      field: 'prompt',
      maxChars: AI_REQUEST_LIMITS.imagePromptChars,
      required: false,
    });
    if (!promptInput.ok) return aiInputErrorResponse(promptInput);
    const parsedTranscript = parseLegacyImageTranscriptInput(body?.transcript);
    if (parsedTranscript instanceof Response) return parsedTranscript;
    const previousImageInput = validateBoundedText(body?.previousImageUrl, {
      field: 'previousImageUrl',
      maxChars: AI_REQUEST_LIMITS.previousImageUrlChars,
      required: false,
    });
    if (!previousImageInput.ok) return aiInputErrorResponse(previousImageInput);

    let prompt = promptInput.value;
    const transcript = parsedTranscript.promptTranscript;
    const previousImageUrl = previousImageInput.value;

    if (!prompt && !transcript) {
      return new Response(JSON.stringify({ error: 'Missing prompt or transcript' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const entitlementCheck = await requireImageGenerationEntitlement(
      supabase,
      user?.id ?? null,
      '/generateImage'
    );
    if (entitlementCheck) {
      return entitlementCheck;
    }

    const admission = await admitSynchronousAiRequest({
      ctx,
      capability: 'generate_image_legacy',
      guestFingerprint: fingerprint,
    });
    if (admission instanceof Response) return admission;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const guestImageLimit = GUEST_LIMITS.image;
    const adminClient =
      !user && fingerprint
        ? supabaseServiceRoleKey
          ? createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            }) as unknown as AdminClient
          : null
        : null;

    if (!user && fingerprint) {
      if (!adminClient) {
        return serviceUnavailable('Guest quota unavailable');
      }

      const quotaCheck = await claimGuestImageQuota(adminClient, fingerprint, guestImageLimit, '/generateImage');
      if (quotaCheck) {
        return quotaCheck;
      }
      guestQuotaClaim = { adminClient, fingerprint };
    }

    prompt = await ensureImagePrompt({ apiKey, prompt, transcript });
    const ownerId = user?.id ?? (fingerprint ? `guest_${fingerprint}` : 'guest');
    const imageModel = resolveImageModel(user ? 'plus' : 'free');
    const { imageUrl, imageBytes } = await generateAndStoreImage({
      apiKey,
      model: imageModel,
      prompt,
      previousImageUrl,
      supabaseUrl,
      supabaseServiceRoleKey,
      storageBucket,
      ownerId,
    });

    guestQuotaClaim = null;
    console.log('[ai-spend] image', {
      route: '/generateImage',
      provider: 'gemini',
      model: imageModel,
    });
    return new Response(JSON.stringify({ imageUrl, imageBytes, prompt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    if (guestQuotaClaim) {
      await releaseGuestImageQuotaClaim(guestQuotaClaim.adminClient, guestQuotaClaim.fingerprint, '/generateImage');
      guestQuotaClaim = null;
    }

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
