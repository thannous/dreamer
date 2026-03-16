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

const releaseImageClaim = async (
  adminClient: ReturnType<typeof createAdminClient>,
  fingerprint: string | null
) => {
  if (!fingerprint) return true;
  try {
    await adminClient.rpc('release_guest_quota_claim', {
      p_fingerprint: fingerprint,
      p_quota_type: 'image',
    });
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
): Promise<void> => {
  if (!job.guest_fingerprint || job.quota_claimed) {
    return;
  }

  const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
    p_fingerprint: job.guest_fingerprint,
    p_quota_type: 'image',
    p_limit: GUEST_LIMITS.image,
  });

  if (quotaError) {
    throw Object.assign(new Error('Guest quota unavailable'), {
      code: 'QUOTA_UNAVAILABLE',
      message: 'Guest quota unavailable',
    });
  }

  if (!quotaResult?.allowed) {
    const isUpgraded = Boolean((quotaResult as Record<string, unknown>)?.is_upgraded);
    throw Object.assign(
      new Error(isUpgraded ? 'Login required' : 'Guest image limit reached'),
      {
        code: isUpgraded ? 'GUEST_DEVICE_UPGRADED' : 'QUOTA_EXCEEDED',
        message: isUpgraded ? 'Login required' : 'Guest image limit reached',
      }
    );
  }

  await updateJob(adminClient, job.id, {
    quota_claimed: true,
    quota_claimed_at: new Date().toISOString(),
  });
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

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey);
    const job = await claimSpecificJob(adminClient, jobId);

    if (!job) {
      return json({ ok: true, skipped: true, reason: 'not_found_or_already_claimed' });
    }

    if (job.status !== 'running') {
      return json({ ok: true, skipped: true, status: job.status });
    }

    const apiKey = getRequiredEnv('GEMINI_API_KEY');
    const requestPayload = (job.request_payload ?? {}) as {
      prompt?: string | null;
      transcript?: string | null;
      previousImageUrl?: string | null;
    };

    let startedUpstream = false;
    const hadQuotaClaim = job.quota_claimed;
    let claimedQuotaThisRun = false;

    try {
      await claimGuestImageQuota(adminClient, job);
      claimedQuotaThisRun = !hadQuotaClaim && Boolean(job.guest_fingerprint);

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
        supabaseUrl,
        supabaseServiceRoleKey: serviceRoleKey,
        storageBucket,
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

      return json({ ok: true, jobId: job.id, status: 'succeeded' });
    } catch (error) {
      const serialized = serializeImageJobError(error);
      let guestClaimCleared = false;
      if (claimedQuotaThisRun && !startedUpstream) {
        guestClaimCleared = await clearGuestImageClaim(adminClient, job);
      }

      if (serialized.retryable && job.attempt_count < job.max_attempts) {
        await requeueJob(adminClient, job, serialized.errorCode, serialized.errorMessage);
        return json({
          ok: true,
          jobId: job.id,
          status: 'queued',
          retryable: true,
        });
      }

      if (!guestClaimCleared && job.guest_fingerprint && (job.quota_claimed || claimedQuotaThisRun)) {
        await clearGuestImageClaim(adminClient, job);
      }

      await markTerminalFailure(adminClient, job, serialized.errorCode, serialized.errorMessage);
      return json({
        ok: true,
        jobId: job.id,
        status: 'failed',
        errorCode: serialized.errorCode,
      });
    }
  } catch (error) {
    console.error('[image-job-worker] Unhandled error', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
