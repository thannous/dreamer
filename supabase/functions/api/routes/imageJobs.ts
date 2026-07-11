import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { requireGuestSession } from '../lib/guards.ts';
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
      userId,
      message: error?.message ?? String(error),
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

    const prompt = String(body?.prompt ?? '').trim();
    const transcript = String(body?.transcript ?? '').trim();
    const previousImageUrl = String(body?.previousImageUrl ?? '').trim();
    const clientRequestId = String(body?.clientRequestId ?? '').trim();
    const requestedDreamId =
      typeof body?.dreamId === 'number' && Number.isFinite(body.dreamId)
        ? Math.trunc(body.dreamId)
        : null;

    if (!clientRequestId) {
      return new Response(JSON.stringify({ error: 'Missing clientRequestId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
        userId: user?.id ?? null,
        dreamId,
      });
      return freeImageAnalysisRequiredResponse();
    }

    const actor = {
      userId: user?.id ?? null,
      guestFingerprint: guestCheck.fingerprint,
    };

    const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

    if (!user && guestCheck.fingerprint) {
      const { data: status, error: statusError } = await adminClient.rpc('get_guest_quota_status', {
        p_fingerprint: guestCheck.fingerprint,
      });

      if (statusError) {
        console.error('[api] /image-jobs: guest quota status check failed', statusError);
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

    const existingQuery = buildImageJobActorFilter(
      adminClient
        .from('ai_jobs')
        .select('*')
        .eq('job_type', 'generate_image')
        .eq('client_request_id', clientRequestId)
        .limit(1),
      actor
    );
    const { data: existingJobData } = await existingQuery.maybeSingle();
    const existingJob = (existingJobData ?? null) as ImageJobRow | null;

    if (existingJob) {
      await triggerWorkerAndLog({
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
        jobId: existingJob.id,
      });

      return new Response(
        JSON.stringify({
          jobId: existingJob.id,
          status: existingJob.status,
          clientRequestId: existingJob.client_request_id,
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const nextJob = {
      id: crypto.randomUUID(),
      user_id: user?.id ?? null,
      guest_fingerprint: user ? null : guestCheck.fingerprint,
      dream_id: dreamId,
      job_type: 'generate_image',
      status: 'queued',
      request_payload: {
        prompt: prompt || null,
        transcript: transcript || null,
        previousImageUrl: previousImageUrl || null,
      },
      client_request_id: clientRequestId,
      max_attempts: 3,
    };

    const { data: insertedJob, error: insertError } = await adminClient
      .from('ai_jobs')
      .insert(nextJob)
      .select('*')
      .single();

    const normalizedInsertedJob = (insertedJob ?? null) as ImageJobRow | null;

    if (insertError || !normalizedInsertedJob) {
      const { data: duplicatedJob } = await buildImageJobActorFilter(
        adminClient
          .from('ai_jobs')
          .select('*')
          .eq('job_type', 'generate_image')
          .eq('client_request_id', clientRequestId)
          .limit(1),
        actor
      ).maybeSingle();

      const normalizedDuplicatedJob = (duplicatedJob ?? null) as ImageJobRow | null;

      if (normalizedDuplicatedJob) {
        await triggerWorkerAndLog({
          supabaseUrl,
          serviceRoleKey: supabaseServiceRoleKey,
          jobId: normalizedDuplicatedJob.id,
        });

        return new Response(
          JSON.stringify({
            jobId: normalizedDuplicatedJob.id,
            status: normalizedDuplicatedJob.status,
            clientRequestId: normalizedDuplicatedJob.client_request_id,
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      console.error('[api] /image-jobs insert failed', insertError);
      return serviceUnavailable();
    }

    await triggerWorkerAndLog({
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
      jobId: normalizedInsertedJob.id,
    });

    return new Response(
      JSON.stringify({
        jobId: normalizedInsertedJob.id,
        status: normalizedInsertedJob.status,
        clientRequestId: normalizedInsertedJob.client_request_id,
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('[api] /image-jobs error', error);
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

    const jobId = String(body?.jobId ?? '').trim();
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Missing jobId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
  } catch (error) {
    console.error('[api] /image-jobs/status error', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
