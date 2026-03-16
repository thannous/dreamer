import { createClient } from 'jsr:@supabase/supabase-js@2';
import { classifyGeminiError } from './gemini.ts';

export type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type ImageJobRequestPayload = {
  prompt?: string | null;
  transcript?: string | null;
  previousImageUrl?: string | null;
};

export type ImageJobResultPayload = {
  imageUrl?: string;
  imageBytes?: string;
  prompt?: string;
};

export type ImageJobRow = {
  id: string;
  user_id: string | null;
  guest_fingerprint: string | null;
  dream_id: number | null;
  job_type: 'generate_image';
  status: ImageJobStatus;
  request_payload: ImageJobRequestPayload;
  result_payload: ImageJobResultPayload | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  client_request_id: string;
  quota_claimed: boolean;
  quota_claimed_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type Actor = {
  userId: string | null;
  guestFingerprint: string | null;
};

const WORKER_FUNCTION_NAME = 'image-job-worker';

export const createAdminClient = (supabaseUrl: string, serviceRoleKey: string) =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export const buildImageJobActorFilter = (
  query: any,
  actor: Actor
) => {
  if (actor.userId) {
    return query.eq('user_id', actor.userId).is('guest_fingerprint', null);
  }
  return query.is('user_id', null).eq('guest_fingerprint', actor.guestFingerprint ?? '');
};

export const serializeImageJobError = (error: unknown): {
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
} => {
  const candidate = error as Record<string, unknown> | null;
  const explicitCode = typeof candidate?.code === 'string' ? candidate.code : null;

  if (explicitCode === 'QUOTA_EXCEEDED' || explicitCode === 'GUEST_DEVICE_UPGRADED') {
    return {
      errorCode: explicitCode,
      errorMessage:
        typeof candidate?.message === 'string' ? candidate.message : 'Quota check failed',
      retryable: false,
    };
  }

  const classified = classifyGeminiError(error);
  const retryable = Boolean(candidate?.isTransient) || classified.canRetry;

  if (classified.status === 429) {
    return {
      errorCode: 'IMAGE_TRANSIENT',
      errorMessage: 'The image service is temporarily busy. Please retry shortly.',
      retryable: true,
    };
  }

  if (classified.status >= 500) {
    return {
      errorCode: 'IMAGE_TRANSIENT',
      errorMessage: classified.userMessage,
      retryable: true,
    };
  }

  const lowerMessage = String(candidate?.message ?? '').toLowerCase();
  if (lowerMessage.includes('blockreason') || lowerMessage.includes('content blocked')) {
    return {
      errorCode: 'IMAGE_BLOCKED',
      errorMessage: 'This dream imagery could not be generated due to content guidelines.',
      retryable: false,
    };
  }

  return {
    errorCode: explicitCode ?? 'IMAGE_JOB_FAILED',
    errorMessage: classified.userMessage,
    retryable,
  };
};

export const triggerImageJobWorker = async (options: {
  supabaseUrl: string;
  serviceRoleKey: string | null;
  jobId: string;
}): Promise<boolean> => {
  if (!options.serviceRoleKey) {
    return false;
  }

  try {
    const response = await fetch(`${options.supabaseUrl}/functions/v1/${WORKER_FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.serviceRoleKey}`,
        apikey: options.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId: options.jobId }),
    });

    if (!response.ok) {
      console.warn('[api] Failed to trigger image job worker', {
        jobId: options.jobId,
        status: response.status,
      });
    }

    return response.ok;
  } catch (error) {
    console.warn('[api] Failed to trigger image job worker', {
      jobId: options.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const mapImageJobStatusResponse = (job: ImageJobRow) => ({
  jobId: job.id,
  status: job.status,
  resultPayload: job.result_payload,
  errorCode: job.error_code,
  errorMessage: job.error_message,
  clientRequestId: job.client_request_id,
});
