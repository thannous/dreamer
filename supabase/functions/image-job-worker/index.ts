import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { GUEST_LIMITS, corsHeaders } from '../api/lib/constants.ts';
import { ensureImagePrompt, generateAndStoreImage } from '../api/services/imagePipeline.ts';
import {
  createAdminClient,
  serializeImageJobError,
  type ImageJobRow,
} from '../api/services/imageJobs.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
};

const isAuthorized = (req: Request, serviceRoleKey: string): boolean => {
  const authorization = req.headers.get('authorization')?.trim();
  const apikey = req.headers.get('apikey')?.trim();
  return authorization === `Bearer ${serviceRoleKey}` || apikey === serviceRoleKey;
};

type JobGateDecision =
  | { allowed: true; claimed?: boolean }
  | { allowed: false; errorCode: string; errorMessage: string; retryable: boolean };

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: any; error: { message?: string } | null }>;
};

const asRpcClient = (adminClient: ReturnType<typeof createAdminClient>): RpcClient =>
  adminClient as unknown as RpcClient;

const normalizeEffectiveSubscriptionTier = (tier: unknown): 'free' | 'plus' =>
  tier === 'plus' ? 'plus' : 'free';

const requireAuthenticatedImageEntitlement = async (
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string | null
): Promise<JobGateDecision> => {
  if (!userId) {
    return { allowed: true };
  }

  try {
    const { data, error } = await asRpcClient(adminClient).rpc('get_effective_subscription_tier', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('[image-job-worker] Failed to resolve subscription tier for image gate', {
        userId,
        message: error?.message ?? String(error),
      });
      return {
        allowed: false,
        errorCode: 'SUBSCRIPTION_STATUS_UNAVAILABLE',
        errorMessage: 'Subscription status unavailable',
        retryable: true,
      };
    }

    const effectiveTier = normalizeEffectiveSubscriptionTier(data);
    if (effectiveTier !== 'plus') {
      console.log('[image-job-worker] Blocked non-plus image job', {
        userId,
        effectiveTier,
      });
      return {
        allowed: false,
        errorCode: 'IMAGE_GENERATION_PLUS_REQUIRED',
        errorMessage: 'Image generation requires Noctalia Plus',
        retryable: false,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.warn('[image-job-worker] Subscription tier check threw', {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      allowed: false,
      errorCode: 'SUBSCRIPTION_STATUS_UNAVAILABLE',
      errorMessage: 'Subscription status unavailable',
      retryable: true,
    };
  }
};

const releaseImageClaim = async (
  adminClient: ReturnType<typeof createAdminClient>,
  fingerprint: string | null
) => {
  if (!fingerprint) return true;
  try {
    const { error } = await asRpcClient(adminClient).rpc('release_guest_quota_claim', {
      p_fingerprint: fingerprint,
      p_quota_type: 'image',
    });
    if (error) {
      console.warn('[image-job-worker] Failed to release guest image claim', {
        error: error?.message ?? String(error),
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[image-job-worker] Failed to release guest image claim', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

const clearGuestImageClaim = async (
  adminClient: ReturnType<typeof createAdminClient>,
  job: ImageJobRow
) => {
  const released = await releaseImageClaim(adminClient, job.guest_fingerprint);
  if (!released) {
    return false;
  }

  await updateJob(adminClient, job.id, {
    quota_claimed: false,
    quota_claimed_at: null,
  });
  return true;
};

const claimSpecificJob = async (
  adminClient: ReturnType<typeof createAdminClient>,
  jobId: string
): Promise<ImageJobRow | null> => {
  const { data: currentJob, error: currentError } = await adminClient
    .from('ai_jobs')
    .select('*')
    .eq('id', jobId)
    .limit(1)
    .maybeSingle();

  const normalizedCurrentJob = (currentJob ?? null) as ImageJobRow | null;

  if (currentError) {
    throw currentError;
  }

  if (
    !normalizedCurrentJob ||
    normalizedCurrentJob.status !== 'queued' ||
    normalizedCurrentJob.attempt_count >= normalizedCurrentJob.max_attempts
  ) {
    return normalizedCurrentJob ?? null;
  }

  const { data: claimedJob, error: claimError } = await adminClient
    .from('ai_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      finished_at: null,
      error_code: null,
      error_message: null,
      attempt_count: normalizedCurrentJob.attempt_count + 1,
    })
    .eq('id', normalizedCurrentJob.id)
    .eq('status', 'queued')
    .eq('attempt_count', normalizedCurrentJob.attempt_count)
    .select('*')
    .limit(1)
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  return (claimedJob ?? null) as ImageJobRow | null;
};

const updateJob = async (
  adminClient: ReturnType<typeof createAdminClient>,
  jobId: string,
  values: Partial<ImageJobRow>
) => {
  const { error } = await adminClient.from('ai_jobs').update(values).eq('id', jobId);
  if (error) {
    throw error;
  }
};

const persistDreamImageResult = async (
  adminClient: ReturnType<typeof createAdminClient>,
  job: ImageJobRow,
  imageUrl: string
) => {
  if (job.dream_id == null) {
    return;
  }

  const { error } = await adminClient
    .from('dreams')
    .update({
      image_url: imageUrl,
      image_generation_failed: false,
    })
    .eq('id', job.dream_id);

  if (error) {
    throw error;
  }
};

const markTerminalFailure = async (
  adminClient: ReturnType<typeof createAdminClient>,
  job: ImageJobRow,
  errorCode: string,
  errorMessage: string
) => {
  await updateJob(adminClient, job.id, {
    status: 'failed',
    error_code: errorCode,
    error_message: errorMessage,
    finished_at: new Date().toISOString(),
  });
};

const requeueJob = async (
  adminClient: ReturnType<typeof createAdminClient>,
  job: ImageJobRow,
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

const claimGuestImageQuota = async (
  adminClient: ReturnType<typeof createAdminClient>,
  job: ImageJobRow
): Promise<JobGateDecision> => {
  if (!job.guest_fingerprint || job.quota_claimed) {
    return { allowed: true, claimed: false };
  }

  const { data: quotaResult, error: quotaError } = await asRpcClient(adminClient).rpc(
    'increment_guest_quota',
    {
      p_fingerprint: job.guest_fingerprint,
      p_quota_type: 'image',
      p_limit: GUEST_LIMITS.image,
    }
  );

  if (quotaError) {
    console.warn('[image-job-worker] Guest image quota claim failed', {
      jobId: job.id,
      message: quotaError?.message ?? String(quotaError),
    });
    return {
      allowed: false,
      errorCode: 'GUEST_QUOTA_UNAVAILABLE',
      errorMessage: 'Guest quota unavailable',
      retryable: true,
    };
  }

  const parsed = (quotaResult ?? null) as Record<string, unknown> | null;
  if (!parsed || typeof parsed.allowed !== 'boolean') {
    console.warn('[image-job-worker] Guest image quota claim returned invalid payload', {
      jobId: job.id,
      hasPayload: !!parsed,
    });
    return {
      allowed: false,
      errorCode: 'GUEST_QUOTA_UNAVAILABLE',
      errorMessage: 'Guest quota unavailable',
      retryable: true,
    };
  }

  if (!parsed.allowed) {
    const isUpgraded = Boolean(parsed.is_upgraded);
    return {
      allowed: false,
      errorCode: isUpgraded ? 'GUEST_DEVICE_UPGRADED' : 'QUOTA_EXCEEDED',
      errorMessage: isUpgraded ? 'Login required' : 'Guest image limit reached',
      retryable: false,
    };
  }

  try {
    await updateJob(adminClient, job.id, {
      quota_claimed: true,
      quota_claimed_at: new Date().toISOString(),
    });
  } catch (error) {
    await releaseImageClaim(adminClient, job.guest_fingerprint);
    throw error;
  }

  return { allowed: true, claimed: true };
};

const processImageJob = async (input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  storageBucket: string;
  jobId: string;
}) => {
  try {
    const adminClient = createAdminClient(input.supabaseUrl, input.serviceRoleKey);
    const job = await claimSpecificJob(adminClient, input.jobId);

    if (!job || job.status !== 'running') {
      return;
    }

    const requestPayload = (job.request_payload ?? {}) as {
      prompt?: string | null;
      transcript?: string | null;
      previousImageUrl?: string | null;
    };

    const entitlementDecision = await requireAuthenticatedImageEntitlement(adminClient, job.user_id);
    if (!entitlementDecision.allowed) {
      if (entitlementDecision.retryable && job.attempt_count < job.max_attempts) {
        await requeueJob(
          adminClient,
          job,
          entitlementDecision.errorCode,
          entitlementDecision.errorMessage
        );
        return;
      }

      await markTerminalFailure(
        adminClient,
        job,
        entitlementDecision.errorCode,
        entitlementDecision.errorMessage
      );
      return;
    }

    const apiKey = getRequiredEnv('GEMINI_API_KEY');
    let startedUpstream = false;
    let claimedQuotaThisRun = false;

    try {
      const quotaDecision = await claimGuestImageQuota(adminClient, job);
      if (!quotaDecision.allowed) {
        if (quotaDecision.retryable && job.attempt_count < job.max_attempts) {
          await requeueJob(adminClient, job, quotaDecision.errorCode, quotaDecision.errorMessage);
          return;
        }

        await markTerminalFailure(adminClient, job, quotaDecision.errorCode, quotaDecision.errorMessage);
        return;
      }
      claimedQuotaThisRun = quotaDecision.claimed === true;

      let prompt = String(requestPayload.prompt ?? '').trim();
      if (!prompt) {
        startedUpstream = true;
        prompt = await ensureImagePrompt({
          apiKey,
          prompt: requestPayload.prompt,
          transcript: requestPayload.transcript,
        });
      }

      startedUpstream = true;
      const ownerId = job.user_id ?? `guest_${job.guest_fingerprint ?? 'guest'}`;
      const result = await generateAndStoreImage({
        apiKey,
        prompt,
        previousImageUrl: requestPayload.previousImageUrl,
        supabaseUrl: input.supabaseUrl,
        supabaseServiceRoleKey: input.serviceRoleKey,
        storageBucket: input.storageBucket,
        ownerId,
      });

      await persistDreamImageResult(adminClient, job, result.imageUrl);
      await updateJob(adminClient, job.id, {
        status: 'succeeded',
        result_payload: {
          imageUrl: result.imageUrl,
          imageBytes: result.imageBytes,
          prompt: result.prompt,
        },
        error_code: null,
        error_message: null,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      const serialized = serializeImageJobError(error);
      let guestClaimCleared = false;
      if (claimedQuotaThisRun && !startedUpstream) {
        guestClaimCleared = await clearGuestImageClaim(adminClient, job);
      }

      if (serialized.retryable && job.attempt_count < job.max_attempts) {
        await requeueJob(adminClient, job, serialized.errorCode, serialized.errorMessage);
        return;
      }

      if (!guestClaimCleared && job.guest_fingerprint && (job.quota_claimed || claimedQuotaThisRun)) {
        await clearGuestImageClaim(adminClient, job);
      }

      await markTerminalFailure(adminClient, job, serialized.errorCode, serialized.errorMessage);
    }
  } catch (error) {
    console.error('[image-job-worker] Unhandled background error', error);
  }
};

const runInBackground = (task: Promise<void>): boolean => {
  const edgeRuntime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil !== 'function') {
    return false;
  }
  edgeRuntime.waitUntil(task);
  return true;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const storageBucket = Deno.env.get('SUPABASE_STORAGE_BUCKET')?.trim() || 'dream-images';

    if (!isAuthorized(req, serviceRoleKey)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = String(body?.jobId ?? '').trim();
    if (!jobId) {
      return json({ error: 'Missing jobId' }, 400);
    }

    const task = processImageJob({ supabaseUrl, serviceRoleKey, storageBucket, jobId });
    if (runInBackground(task)) {
      return json({ ok: true, jobId, status: 'accepted' }, 202);
    }

    await task;
    return json({ ok: true, jobId, status: 'processed' });
  } catch (error) {
    console.error('[image-job-worker] Unhandled error', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
