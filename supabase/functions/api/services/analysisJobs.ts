import { createClient } from 'jsr:@supabase/supabase-js@2';

export type AnalysisJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type AnalysisJobRequestPayload = {
  lang?: string;
  replaceExistingImage?: boolean;
};

export type AnalysisJobResultPayload = {
  dreamId?: number;
  imageJob?: {
    id: string;
    status: AnalysisJobStatus;
    client_request_id: string;
    dream_id?: number | null;
  } | null;
  imageJobErrorCode?: string;
};

export type AnalysisJobRow = {
  id: string;
  user_id: string;
  guest_fingerprint: null;
  dream_id: number;
  job_type: 'analyze_dream';
  status: AnalysisJobStatus;
  request_payload: AnalysisJobRequestPayload;
  result_payload: AnalysisJobResultPayload | null;
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

const WORKER_FUNCTION_NAME = 'analysis-job-worker';
export const ANALYSIS_JOB_WORKER_AUTH_HEADER = 'x-analysis-job-worker-secret';

export const createAnalysisAdminClient = (supabaseUrl: string, serviceRoleKey: string) =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export const triggerAnalysisWorker = async (options: {
  supabaseUrl: string;
  serviceRoleKey: string;
  jobId: string;
}) => {
  const response = await fetch(`${options.supabaseUrl}/functions/v1/${WORKER_FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: options.serviceRoleKey,
      [ANALYSIS_JOB_WORKER_AUTH_HEADER]: options.serviceRoleKey,
    },
    body: JSON.stringify({ jobId: options.jobId }),
  });

  if (!response.ok) {
    throw new Error(`Analysis worker trigger failed with ${response.status}`);
  }
};

export const triggerAnalysisWorkerAndLog = (options: {
  supabaseUrl: string;
  serviceRoleKey: string;
  jobId: string;
}) => {
  void triggerAnalysisWorker(options).catch(() => {
    console.warn('[api] analysis worker trigger failed', {
      jobId: options.jobId,
      reason: 'network_or_worker_error',
    });
  });
};
