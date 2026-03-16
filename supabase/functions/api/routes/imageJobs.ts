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

const serviceUnavailable = (message = 'Service unavailable') =>
  new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

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
    if (requestedDreamId != null && user) {
      const { data: dream, error: dreamError } = await supabase
        .from('dreams')
        .select('id')
        .eq('id', requestedDreamId)
        .single();

      if (dreamError || !dream) {
        return new Response(JSON.stringify({ error: 'Dream not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      dreamId = dream.id;
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
      void triggerImageJobWorker({
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
        void triggerImageJobWorker({
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

    void triggerImageJobWorker({
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
      void triggerImageJobWorker({
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
