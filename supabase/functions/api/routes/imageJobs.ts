import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { requireGuestSession } from '../lib/guards.ts';
import { claimGuestQaPaidCall } from '../lib/guestQa.ts';
import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  isValidClientRequestId,
  validateBoundedText,
} from '../lib/aiRequestPolicy.ts';
import type { ApiContext } from '../types.ts';
import {
  buildImageJobActorFilter,
  createAdminClient,
  mapImageJobStatusResponse,
  triggerImageJobWorker,
  type ImageJobRow,
} from '../services/imageJobs.ts';

type GuestQuotaStatus = {
  image_count?: number;
  is_upgraded?: boolean;
};

type ImageJobAdmission = {
  allowed?: boolean;
  duplicate?: boolean;
  code?:
    | 'AI_GLOBAL_BACKLOG_LIMIT'
    | 'AI_ACTOR_CONCURRENCY_LIMIT'
    | 'AI_ACTOR_RATE_LIMIT'
    | 'AI_IDEMPOTENCY_KEY_REUSED';
  retry_after_seconds?: number;
  job?: ImageJobRow;
};

const readPositiveEnv = (name: string, fallback: number, maximum: number): number => {
  const parsed = Number(Deno.env.get(name));
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
};

export const resolveImageJobAdmissionPolicy = (
  tier: 'free' | 'plus',
  isGuest: boolean
) => {
  const actorClass = isGuest ? 'GUEST' : tier === 'plus' ? 'PLUS' : 'FREE';
  const defaults = isGuest
    ? { maxActive: 1, maxPerWindow: 2 }
    : tier === 'plus'
      ? { maxActive: 2, maxPerWindow: 12 }
      : { maxActive: 1, maxPerWindow: 4 };

  return {
    maxAttempts: readPositiveEnv('AI_IMAGE_MAX_ATTEMPTS', 3, 5),
    maxActive: readPositiveEnv(`AI_IMAGE_MAX_ACTIVE_${actorClass}`, defaults.maxActive, 10),
    windowSeconds: readPositiveEnv('AI_IMAGE_RATE_WINDOW_SECONDS', 600, 86400),
    maxPerWindow: readPositiveEnv(
      `AI_IMAGE_MAX_PER_WINDOW_${actorClass}`,
      defaults.maxPerWindow,
      1000
    ),
    maxGlobalActive: readPositiveEnv('AI_IMAGE_MAX_GLOBAL_ACTIVE', 200, 10000),
  };
};

const imageAdmissionBlockedResponse = (admission: ImageJobAdmission): Response => {
  if (admission.code === 'AI_IDEMPOTENCY_KEY_REUSED') {
    return new Response(
      JSON.stringify({
        error: 'Image request id is already bound to different input',
        code: admission.code,
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
  const retryAfter = Number.isFinite(admission.retry_after_seconds)
    ? Math.max(1, Math.floor(admission.retry_after_seconds ?? 1))
    : 30;
  const globalBacklog = admission.code === 'AI_GLOBAL_BACKLOG_LIMIT';
  return new Response(
    JSON.stringify({
      error: globalBacklog ? 'AI service is temporarily busy' : 'Too many image requests',
      code: admission.code ?? 'AI_ADMISSION_DENIED',
      retryAfter,
    }),
    {
      status: globalBacklog ? 503 : 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        ...corsHeaders,
      },
    }
  );
};

const toCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const normalizeEffectiveSubscriptionTier = (tier: unknown): 'free' | 'plus' =>
  tier === 'plus' ? 'plus' : 'free';

type DreamImageAuthorizationContext = {
  id: number;
  analysis_request_id?: string | null;
  analysis_status?: string | null;
  is_analyzed?: boolean | null;
};

export const canCreateImageJobForTier = (input: {
  tier: 'free' | 'plus';
  userId?: string | null;
  dream?: DreamImageAuthorizationContext | null;
  clientRequestId: string;
}): boolean => {
  if (!input.userId || input.tier === 'plus') {
    return true;
  }

  return Boolean(
    input.dream &&
      input.dream.analysis_request_id === input.clientRequestId &&
      input.dream.analysis_status === 'pending' &&
      input.dream.is_analyzed !== true
  );
};

const serviceUnavailable = (message = 'Service unavailable') =>
  new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const freeImageAnalysisRequiredResponse = () =>
  new Response(
    JSON.stringify({
      error: 'Free image generation must be linked to an authorized analysis',
      code: 'FREE_IMAGE_ANALYSIS_REQUIRED',
      userMessage: 'Start a new dream analysis to generate its image.',
    }),
    {
      status: 402,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );

const resolveImageGenerationTier = async (
  supabase: ApiContext['supabase'],
  userId: string | null | undefined,
  route: string
): Promise<{ tier: 'free' | 'plus' } | { response: Response }> => {
  if (!userId) {
    return { tier: 'free' };
  }

  const { data, error } = await supabase.rpc('get_effective_subscription_tier', {
    p_user_id: userId,
  });

  if (error) {
    console.warn(`[api] ${route}: failed to resolve subscription tier for image routing`, {
      code: error?.code ?? null,
    });
    return { response: serviceUnavailable('Subscription status unavailable') };
  }

  return { tier: normalizeEffectiveSubscriptionTier(data) };
};

const triggerWorkerAndLog = async (options: {
  supabaseUrl: string;
  serviceRoleKey: string;
  jobId: string;
}) => {
  const triggered = await triggerImageJobWorker(options);
  if (!triggered) {
    console.warn('[api] /image-jobs worker trigger returned false', { jobId: options.jobId });
  }
};

export async function handleCreateImageJob(ctx: ApiContext): Promise<Response> {
  const { req, user, supabase, supabaseUrl, supabaseServiceRoleKey } = ctx;

  if (!supabaseServiceRoleKey) {
    return serviceUnavailable();
  }

  try {
    const body = (await req.json()) as {
      prompt?: string;
      transcript?: string;
      previousImageUrl?: string;
      clientRequestId?: string;
      dreamId?: number | null;
    };

    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }

    const promptInput = validateBoundedText(body?.prompt, {
      field: 'prompt',
      maxChars: AI_REQUEST_LIMITS.imagePromptChars,
      required: false,
    });
    if (!promptInput.ok) return aiInputErrorResponse(promptInput);
    const transcriptInput = validateBoundedText(body?.transcript, {
      field: 'transcript',
      maxChars: AI_REQUEST_LIMITS.transcriptChars,
      required: false,
    });
    if (!transcriptInput.ok) return aiInputErrorResponse(transcriptInput);
    const previousImageInput = validateBoundedText(body?.previousImageUrl, {
      field: 'previousImageUrl',
      maxChars: AI_REQUEST_LIMITS.previousImageUrlChars,
      required: false,
    });
    if (!previousImageInput.ok) return aiInputErrorResponse(previousImageInput);
    const clientRequestInput = validateBoundedText(body?.clientRequestId, {
      field: 'clientRequestId',
      maxChars: AI_REQUEST_LIMITS.clientRequestIdChars,
    });
    if (!clientRequestInput.ok) return aiInputErrorResponse(clientRequestInput);

    const prompt = promptInput.value;
    const transcript = transcriptInput.value;
    const previousImageUrl = previousImageInput.value;
    const clientRequestId = clientRequestInput.value;
    const requestedDreamId =
      typeof body?.dreamId === 'number'
        && Number.isSafeInteger(body.dreamId)
        && body.dreamId > 0
        ? Math.trunc(body.dreamId)
        : null;

    if (!isValidClientRequestId(clientRequestId)) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'clientRequestId',
      });
    }

    if (body.dreamId != null && requestedDreamId == null) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'dreamId',
      });
    }

    if (!prompt && !transcript) {
      return new Response(JSON.stringify({ error: 'Missing prompt or transcript' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let dreamId: number | null = null;
    let dreamAuthorizationContext: DreamImageAuthorizationContext | null = null;
    if (requestedDreamId != null && user) {
      const { data: dream, error: dreamError } = await supabase
        .from('dreams')
        .select('id, analysis_request_id, analysis_status, is_analyzed')
        .eq('id', requestedDreamId)
        .single();

      if (dreamError || !dream) {
        return new Response(JSON.stringify({ error: 'Dream not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      dreamId = dream.id;
      dreamAuthorizationContext = dream as DreamImageAuthorizationContext;
    }

    const tierResolution = await resolveImageGenerationTier(
      supabase,
      user?.id ?? null,
      '/image-jobs'
    );
    if ('response' in tierResolution) {
      return tierResolution.response;
    }

    if (!canCreateImageJobForTier({
      tier: tierResolution.tier,
      userId: user?.id ?? null,
      dream: dreamAuthorizationContext,
      clientRequestId,
    })) {
      console.log('[api] /image-jobs: blocked unlinked free image generation', {
        hasDream: dreamId != null,
      });
      return freeImageAnalysisRequiredResponse();
    }

    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    if (!user && guestCheck.fingerprint) {
      const { data: status, error: statusError } = await adminClient.rpc('get_guest_quota_status', {
        p_fingerprint: guestCheck.fingerprint,
      });

      if (statusError) {
        console.error('[api] /image-jobs: guest quota status check failed', {
          code: statusError?.code ?? null,
        });
        return serviceUnavailable('Guest quota unavailable');
      }

      const parsed = (status ?? {}) as GuestQuotaStatus;
      const used = toCount(parsed.image_count);
      const isUpgraded = Boolean(parsed.is_upgraded);

      if (isUpgraded) {
        return new Response(
          JSON.stringify({
            error: 'Login required',
            code: 'GUEST_DEVICE_UPGRADED',
            isUpgraded: true,
            usage: { image: { used, limit: GUEST_LIMITS.image } },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      if (used >= GUEST_LIMITS.image) {
        return new Response(
          JSON.stringify({
            error: 'Guest image limit reached',
            code: 'QUOTA_EXCEEDED',
            usage: { image: { used, limit: GUEST_LIMITS.image } },
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    const admissionPolicy = resolveImageJobAdmissionPolicy(tierResolution.tier, !user);
    const qaBudgetResponse = await claimGuestQaPaidCall({
      adminClient,
      capability: 'image_job',
      quotaSubject: user ? null : guestCheck.fingerprint,
      requestKey: clientRequestId,
    });
    if (qaBudgetResponse) return qaBudgetResponse;

    const { data: admissionData, error: admissionError } = await adminClient.rpc('admit_ai_job', {
      p_job_id: crypto.randomUUID(),
      p_user_id: user?.id ?? null,
      p_guest_fingerprint: user ? null : guestCheck.fingerprint,
      p_dream_id: dreamId,
      p_job_type: 'generate_image',
      p_request_payload: {
        prompt: prompt || null,
        transcript: transcript || null,
        previousImageUrl: previousImageUrl || null,
      },
      p_client_request_id: clientRequestId,
      p_max_attempts: admissionPolicy.maxAttempts,
      p_max_active_per_actor: admissionPolicy.maxActive,
      p_window_seconds: admissionPolicy.windowSeconds,
      p_max_created_in_window: admissionPolicy.maxPerWindow,
      p_max_global_active: admissionPolicy.maxGlobalActive,
    });

    if (admissionError) {
      console.error('[api] /image-jobs admission failed', {
        code: admissionError?.code ?? null,
      });
      return serviceUnavailable();
    }

    const admission = (admissionData ?? {}) as ImageJobAdmission;
    if (!admission.allowed) {
      return imageAdmissionBlockedResponse(admission);
    }

    const admittedJob = admission.job;
    if (!admittedJob?.id || !admittedJob.client_request_id || !admittedJob.status) {
      console.error('[api] /image-jobs admission returned invalid job payload');
      return serviceUnavailable();
    }

    await triggerWorkerAndLog({
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      jobId: admittedJob.id,
    });

    return new Response(
      JSON.stringify({
        jobId: admittedJob.id,
        status: admittedJob.status,
        clientRequestId: admittedJob.client_request_id,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch {
    console.error('[api] /image-jobs request failed');
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function handleGetImageJobStatus(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  if (!supabaseServiceRoleKey) {
    return serviceUnavailable();
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const guestCheck = await requireGuestSession(req, null, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }

    const jobIdInput = validateBoundedText(body?.jobId, {
      field: 'jobId',
      maxChars: AI_REQUEST_LIMITS.clientRequestIdChars,
    });
    if (!jobIdInput.ok) return aiInputErrorResponse(jobIdInput);
    const jobId = jobIdInput.value;
    if (!isValidClientRequestId(jobId)) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'jobId',
      });
    }

    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);
    const actor = {
      userId: user?.id ?? null,
      guestFingerprint: guestCheck.fingerprint,
    };

    const { data: job } = await buildImageJobActorFilter(
      adminClient.from('ai_jobs').select('*').eq('id', jobId).limit(1),
      actor
    ).maybeSingle();

    const normalizedJob = (job ?? null) as ImageJobRow | null;

    if (!normalizedJob) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (normalizedJob.status === 'queued') {
      await triggerWorkerAndLog({
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        jobId: normalizedJob.id,
      });
    }

    return new Response(JSON.stringify(mapImageJobStatusResponse(normalizedJob)), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch {
    console.error('[api] /image-jobs/status request failed');
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
