import { corsHeaders } from '../lib/constants.ts';
import { requireUser } from '../lib/guards.ts';
import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  isValidUuid,
  normalizeAiLanguage,
  validateBoundedText,
} from '../lib/aiRequestPolicy.ts';
import {
  createAnalysisAdminClient,
  triggerAnalysisWorkerAndLog,
  type AnalysisJobRow,
} from '../services/analysisJobs.ts';
import type { ApiContext } from '../types.ts';

type AnalysisJobAdmission = {
  allowed?: boolean;
  duplicate?: boolean;
  code?: string;
  retry_after_seconds?: number;
  tier?: string;
  limit?: number | null;
  new_count?: number | null;
  job?: AnalysisJobRow;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  retryAfter?: number
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
      ...corsHeaders,
    },
  });

const serviceUnavailable = () =>
  jsonResponse({ error: 'Analysis service is temporarily unavailable' }, 503);

const readPositiveEnv = (name: string, fallback: number, maximum: number): number => {
  const parsed = Number(Deno.env.get(name));
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export const resolveAnalysisJobAdmissionPolicy = (tier: 'free' | 'plus') => ({
  maxAttempts: readPositiveEnv('AI_ANALYSIS_MAX_ATTEMPTS', 3, 5),
  maxActive: readPositiveEnv(
    `AI_ANALYSIS_MAX_ACTIVE_${tier === 'plus' ? 'PLUS' : 'FREE'}`,
    tier === 'plus' ? 2 : 1,
    10
  ),
  windowSeconds: readPositiveEnv('AI_ANALYSIS_RATE_WINDOW_SECONDS', 600, 86400),
  maxPerWindow: readPositiveEnv(
    `AI_ANALYSIS_MAX_PER_WINDOW_${tier === 'plus' ? 'PLUS' : 'FREE'}`,
    tier === 'plus' ? 12 : 4,
    1000
  ),
  maxGlobalActive: readPositiveEnv('AI_ANALYSIS_MAX_GLOBAL_ACTIVE', 200, 10000),
});

const normalizeTier = (value: unknown): 'free' | 'plus' =>
  value === 'plus' || value === 'premium' ? 'plus' : 'free';

const blockedAdmissionResponse = (admission: AnalysisJobAdmission): Response => {
  if (admission.code === 'QUOTA_EXCEEDED') {
    const used = typeof admission.new_count === 'number' ? Math.max(0, admission.new_count) : 0;
    const limit = typeof admission.limit === 'number' ? admission.limit : null;
    return jsonResponse(
      {
        error: 'Analysis limit reached',
        code: 'QUOTA_EXCEEDED',
        usage: { analysis: { used, limit } },
      },
      429
    );
  }

  if (admission.code === 'DREAM_NOT_FOUND') {
    return jsonResponse({ error: 'Dream not found', code: admission.code }, 404);
  }

  if (
    admission.code === 'ANALYSIS_ALREADY_COMPLETE'
    || admission.code === 'ANALYSIS_REQUEST_CONFLICT'
    || admission.code === 'ANALYSIS_IDEMPOTENCY_KEY_REUSED'
  ) {
    return jsonResponse({ error: 'Analysis state conflict', code: admission.code }, 409);
  }

  const retryAfter = Number.isFinite(admission.retry_after_seconds)
    ? Math.max(1, Math.floor(admission.retry_after_seconds ?? 1))
    : 30;
  if (admission.code === 'AI_GLOBAL_BACKLOG_LIMIT') {
    return jsonResponse(
      { error: 'Analysis service is temporarily busy', code: admission.code, retryAfter },
      503,
      retryAfter
    );
  }

  return jsonResponse(
    { error: 'Too many analysis requests', code: admission.code ?? 'AI_ADMISSION_DENIED', retryAfter },
    429,
    retryAfter
  );
};

const parsePositiveDreamId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function handleCreateAnalysisJob(ctx: ApiContext): Promise<Response> {
  const authCheck = requireUser(ctx.user);
  if (authCheck) return authCheck;
  if (!ctx.supabaseServiceRoleKey) return serviceUnavailable();

  try {
    const body = (await ctx.req.json()) as {
      dreamId?: unknown;
      remoteDreamId?: unknown;
      analysisRequestId?: unknown;
      clientRequestId?: unknown;
      lang?: unknown;
      replaceExistingImage?: unknown;
    };
    const dreamId = parsePositiveDreamId(body.remoteDreamId ?? body.dreamId);
    if (!dreamId) {
      return aiInputErrorResponse({ ok: false, code: 'INVALID_INPUT', field: 'dreamId' });
    }

    const requestIdInput = validateBoundedText(
      body.analysisRequestId ?? body.clientRequestId,
      { field: 'analysisRequestId', maxChars: AI_REQUEST_LIMITS.clientRequestIdChars }
    );
    if (!requestIdInput.ok) return aiInputErrorResponse(requestIdInput);
    if (!isValidUuid(requestIdInput.value)) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'analysisRequestId',
      });
    }

    const langInput = validateBoundedText(body.lang, {
      field: 'lang',
      maxChars: AI_REQUEST_LIMITS.languageChars,
      required: false,
    });
    if (!langInput.ok) return aiInputErrorResponse(langInput);
    if (
      body.replaceExistingImage != null
      && typeof body.replaceExistingImage !== 'boolean'
    ) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'replaceExistingImage',
      });
    }

    const adminClient = createAnalysisAdminClient(
      ctx.supabaseUrl,
      ctx.supabaseServiceRoleKey
    );
    const { data: tierData, error: tierError } = await adminClient.rpc(
      'get_effective_subscription_tier',
      { p_user_id: ctx.user.id }
    );
    if (tierError) {
      console.warn('[api] /analysis-jobs tier lookup failed', {
        code: tierError?.code ?? null,
      });
      return serviceUnavailable();
    }
    const tier = normalizeTier(tierData);
    const policy = resolveAnalysisJobAdmissionPolicy(tier);
    const { data, error } = await adminClient.rpc('admit_authenticated_analysis_job', {
      p_job_id: crypto.randomUUID(),
      p_user_id: ctx.user.id,
      p_dream_id: dreamId,
      p_analysis_request_id: requestIdInput.value,
      p_lang: normalizeAiLanguage(langInput.value || 'en'),
      p_replace_existing_image: body.replaceExistingImage !== false,
      p_max_attempts: policy.maxAttempts,
      p_max_active_per_actor: policy.maxActive,
      p_window_seconds: policy.windowSeconds,
      p_max_created_in_window: policy.maxPerWindow,
      p_max_global_active: policy.maxGlobalActive,
    });

    if (error) {
      console.error('[api] /analysis-jobs admission failed', {
        code: error?.code ?? null,
      });
      return serviceUnavailable();
    }

    const admission = (data ?? {}) as AnalysisJobAdmission;
    if (!admission.allowed || !admission.job) {
      return blockedAdmissionResponse(admission);
    }

    triggerAnalysisWorkerAndLog({
      supabaseUrl: ctx.supabaseUrl,
      serviceRoleKey: ctx.supabaseServiceRoleKey,
      jobId: admission.job.id,
    });

    return jsonResponse(
      {
        jobId: admission.job.id,
        status: admission.job.status,
        clientRequestId: admission.job.client_request_id,
        duplicate: admission.duplicate === true,
        ...(typeof admission.new_count === 'number'
          ? { quotaUsed: { analysis: admission.new_count } }
          : {}),
      },
      202
    );
  } catch {
    console.error('[api] /analysis-jobs request failed');
    return jsonResponse({ error: 'Invalid analysis job request' }, 400);
  }
}

export async function handleGetAnalysisJobStatus(ctx: ApiContext): Promise<Response> {
  const authCheck = requireUser(ctx.user);
  if (authCheck) return authCheck;
  if (!ctx.supabaseServiceRoleKey) return serviceUnavailable();

  try {
    const body = (await ctx.req.json()) as { jobId?: unknown };
    const jobIdInput = validateBoundedText(body.jobId, {
      field: 'jobId',
      maxChars: AI_REQUEST_LIMITS.clientRequestIdChars,
    });
    if (!jobIdInput.ok) return aiInputErrorResponse(jobIdInput);
    if (!isValidUuid(jobIdInput.value)) {
      return aiInputErrorResponse({ ok: false, code: 'INVALID_INPUT', field: 'jobId' });
    }

    const adminClient = createAnalysisAdminClient(
      ctx.supabaseUrl,
      ctx.supabaseServiceRoleKey
    );
    const { data, error } = await adminClient
      .from('ai_jobs')
      .select('*')
      .eq('id', jobIdInput.value)
      .eq('job_type', 'analyze_dream')
      .eq('user_id', ctx.user.id)
      .is('guest_fingerprint', null)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[api] /analysis-jobs/status lookup failed', {
        code: error?.code ?? null,
      });
      return serviceUnavailable();
    }
    const job = (data ?? null) as AnalysisJobRow | null;
    if (!job) return jsonResponse({ error: 'Analysis job not found' }, 404);

    if (job.status === 'queued') {
      triggerAnalysisWorkerAndLog({
        supabaseUrl: ctx.supabaseUrl,
        serviceRoleKey: ctx.supabaseServiceRoleKey,
        jobId: job.id,
      });
    }

    return jsonResponse({
      jobId: job.id,
      status: job.status,
      clientRequestId: job.client_request_id,
      resultPayload: job.result_payload,
      errorCode: job.error_code,
      errorMessage: job.error_message,
    }, 200);
  } catch {
    return jsonResponse({ error: 'Invalid analysis job status request' }, 400);
  }
}
