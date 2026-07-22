import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../api/lib/constants.ts';
import { isValidUuid } from '../api/lib/aiRequestPolicy.ts';
import {
  ANALYSIS_JOB_WORKER_AUTH_HEADER,
  createAnalysisAdminClient,
  triggerAnalysisWorker,
  type AnalysisJobRow,
} from '../api/services/analysisJobs.ts';
import { runDreamAnalysis } from '../api/services/dreamAnalysis.ts';
import { classifyGeminiError } from '../api/services/gemini.ts';
import { triggerImageJobWorker } from '../api/services/imageJobs.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const readPositiveEnv = (name: string, fallback: number, maximum: number): number => {
  const parsed = Number(Deno.env.get(name));
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

const isAuthorized = (req: Request, serviceRoleKey: string): boolean => {
  const apikey = req.headers.get('apikey')?.trim();
  const workerSecret = req.headers.get(ANALYSIS_JOB_WORKER_AUTH_HEADER)?.trim();
  return apikey === serviceRoleKey || workerSecret === serviceRoleKey;
};

const claimSpecificJob = async (
  adminClient: ReturnType<typeof createAnalysisAdminClient>,
  jobId: string
): Promise<AnalysisJobRow | null> => {
  const { data: current, error: currentError } = await adminClient
    .from('ai_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('job_type', 'analyze_dream')
    .limit(1)
    .maybeSingle();
  if (currentError) throw currentError;

  const job = (current ?? null) as AnalysisJobRow | null;
  if (!job || job.status !== 'queued' || job.attempt_count >= job.max_attempts) {
    return job;
  }

  const { data: claimed, error: claimError } = await adminClient
    .from('ai_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      finished_at: null,
      error_code: null,
      error_message: null,
      attempt_count: job.attempt_count + 1,
    })
    .eq('id', job.id)
    .eq('job_type', 'analyze_dream')
    .eq('status', 'queued')
    .eq('attempt_count', job.attempt_count)
    .select('*')
    .limit(1)
    .maybeSingle();
  if (claimError) throw claimError;
  return (claimed ?? null) as AnalysisJobRow | null;
};

const updateJob = async (
  adminClient: ReturnType<typeof createAnalysisAdminClient>,
  jobId: string,
  values: Partial<AnalysisJobRow>
) => {
  const { error } = await adminClient.from('ai_jobs').update(values).eq('id', jobId);
  if (error) throw error;
};

const markDreamAnalysisFailed = async (
  adminClient: ReturnType<typeof createAnalysisAdminClient>,
  job: AnalysisJobRow
) => {
  const { error } = await adminClient
    .from('dreams')
    .update({
      analysis_status: 'failed',
      revision_id: crypto.randomUUID(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.dream_id)
    .eq('user_id', job.user_id)
    .eq('analysis_request_id', job.client_request_id)
    .eq('analysis_status', 'pending');
  if (error) {
    console.warn('[analysis-job-worker] Failed to persist terminal dream state', {
      jobId: job.id,
      code: error?.code ?? null,
    });
  }
};

const failJob = async (
  adminClient: ReturnType<typeof createAnalysisAdminClient>,
  job: AnalysisJobRow,
  errorCode: string,
  errorMessage: string
) => {
  await updateJob(adminClient, job.id, {
    status: 'failed',
    error_code: errorCode,
    error_message: errorMessage,
    finished_at: new Date().toISOString(),
  });
  await markDreamAnalysisFailed(adminClient, job);
};

const requeueJob = async (
  adminClient: ReturnType<typeof createAnalysisAdminClient>,
  job: AnalysisJobRow,
  errorCode: string,
  errorMessage: string
) => {
  await updateJob(adminClient, job.id, {
    status: 'queued',
    error_code: errorCode,
    error_message: errorMessage,
    finished_at: null,
  });
};

export const serializeAnalysisJobError = (error: unknown) => {
  const classified = classifyGeminiError(error);
  const candidate = error as Record<string, unknown> | null;
  const retryable = classified.canRetry
    || classified.status === 429
    || classified.status >= 500
    || candidate?.isTransient === true;
  return {
    errorCode: retryable ? 'ANALYSIS_TRANSIENT' : 'ANALYSIS_JOB_FAILED',
    errorMessage: classified.userMessage,
    retryable,
  };
};

const processAnalysisJob = async (input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  jobId: string;
}) => {
  const adminClient = createAnalysisAdminClient(input.supabaseUrl, input.serviceRoleKey);
  let job: AnalysisJobRow | null = null;

  try {
    job = await claimSpecificJob(adminClient, input.jobId);
    if (!job || job.status !== 'running') return;

    const { data: dream, error: dreamError } = await adminClient
      .from('dreams')
      .select('id,user_id,transcript,analysis_status,analysis_request_id,is_analyzed')
      .eq('id', job.dream_id)
      .eq('user_id', job.user_id)
      .limit(1)
      .maybeSingle();

    if (dreamError) throw dreamError;
    if (!dream) {
      await failJob(adminClient, job, 'DREAM_NOT_FOUND', 'Dream not found');
      return;
    }
    if (String((dream as any).analysis_request_id ?? '') !== job.client_request_id) {
      await failJob(adminClient, job, 'ANALYSIS_REQUEST_STALE', 'Analysis request is stale');
      return;
    }
    if ((dream as any).analysis_status !== 'pending' || (dream as any).is_analyzed === true) {
      await failJob(adminClient, job, 'ANALYSIS_STATE_CONFLICT', 'Dream analysis state changed');
      return;
    }

    const transcript = String((dream as any).transcript ?? '').trim();
    if (!transcript || transcript.length > 600) {
      await failJob(adminClient, job, 'INVALID_TRANSCRIPT', 'Dream transcript is invalid');
      return;
    }

    const apiKey = getRequiredEnv('GEMINI_API_KEY');
    const { data: tierData, error: tierError } = await adminClient.rpc(
      'get_effective_subscription_tier',
      { p_user_id: job.user_id }
    );
    if (tierError) throw tierError;
    const imageTier = tierData === 'plus' || tierData === 'premium' ? 'PLUS' : 'FREE';
    const lang = String(job.request_payload?.lang ?? 'en');
    const analysis = await runDreamAnalysis({
      apiKey,
      transcript,
      lang,
      route: '/analysis-job-worker',
    });

    const { data: completionData, error: completionError } = await adminClient.rpc(
      'complete_authenticated_analysis_job',
      {
        p_job_id: job.id,
        p_analysis_result: analysis,
        p_image_job_id: crypto.randomUUID(),
        p_image_max_attempts: readPositiveEnv('AI_IMAGE_MAX_ATTEMPTS', 3, 5),
        p_image_max_active_per_actor: readPositiveEnv(
          `AI_IMAGE_MAX_ACTIVE_${imageTier}`,
          imageTier === 'PLUS' ? 2 : 1,
          10
        ),
        p_image_window_seconds: readPositiveEnv('AI_IMAGE_RATE_WINDOW_SECONDS', 600, 86400),
        p_image_max_created_in_window: readPositiveEnv(
          `AI_IMAGE_MAX_PER_WINDOW_${imageTier}`,
          imageTier === 'PLUS' ? 12 : 4,
          1000
        ),
        p_max_global_active: readPositiveEnv('AI_IMAGE_MAX_GLOBAL_ACTIVE', 200, 10000),
      }
    );
    if (completionError) throw completionError;

    const completion = (completionData ?? {}) as Record<string, any>;
    if (completion.completed !== true) {
      await failJob(
        adminClient,
        job,
        String(completion.code ?? 'ANALYSIS_COMPLETION_FAILED'),
        'Analysis completion failed'
      );
      return;
    }

    const imageJobId = typeof completion.image_job?.id === 'string'
      ? completion.image_job.id
      : null;
    if (imageJobId) {
      await triggerImageJobWorker({
        supabaseUrl: input.supabaseUrl,
        serviceRoleKey: input.serviceRoleKey,
        jobId: imageJobId,
      });
    }
  } catch (error) {
    console.warn('[analysis-job-worker] Job attempt failed', {
      jobId: input.jobId,
      attempt: job?.attempt_count ?? null,
    });
    if (!job || job.status !== 'running') return;

    const serialized = serializeAnalysisJobError(error);
    if (serialized.retryable && job.attempt_count < job.max_attempts) {
      await requeueJob(adminClient, job, serialized.errorCode, serialized.errorMessage);
      try {
        await triggerAnalysisWorker({
          supabaseUrl: input.supabaseUrl,
          serviceRoleKey: input.serviceRoleKey,
          jobId: job.id,
        });
      } catch {
        // The durable queued row remains recoverable through status polling or
        // a later scheduler invocation; never turn trigger failure into a
        // terminal analysis failure.
        console.warn('[analysis-job-worker] Retry trigger failed', { jobId: job.id });
      }
      return;
    }
    await failJob(adminClient, job, serialized.errorCode, serialized.errorMessage);
  }
};

const runInBackground = (task: Promise<void>): boolean => {
  const edgeRuntime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil !== 'function') return false;
  edgeRuntime.waitUntil(task);
  return true;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!isAuthorized(req, serviceRoleKey)) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as { jobId?: unknown };
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    if (!isValidUuid(jobId)) return json({ error: 'Invalid jobId' }, 400);

    const task = processAnalysisJob({ supabaseUrl, serviceRoleKey, jobId });
    if (runInBackground(task)) {
      return json({ ok: true, jobId, status: 'accepted' }, 202);
    }
    await task;
    return json({ ok: true, jobId, status: 'processed' });
  } catch {
    console.error('[analysis-job-worker] Unhandled worker request error');
    return json({ error: 'Internal server error' }, 500);
  }
});
