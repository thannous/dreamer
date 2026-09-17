import type { createAdminClient } from './imageJobs.ts';

export type AnalysisImageAuthorization =
  | { allowed: true }
  | { allowed: false; errorCode: string; errorMessage: string; retryable: boolean };

/** Shared by admission and execution. Only a service-issued receipt grants access. */
export async function verifyAnalysisImageAuthorization(
  client: ReturnType<typeof createAdminClient>,
  input: { userId: string; dreamId: number | null; requestId: string; analysisComplete?: boolean },
): Promise<AnalysisImageAuthorization> {
  const required: AnalysisImageAuthorization = {
    allowed: false,
    errorCode: 'FREE_IMAGE_ANALYSIS_REQUIRED',
    errorMessage: 'Image generation must be linked to an authorized analysis',
    retryable: false,
  };
  const unavailable: AnalysisImageAuthorization = {
    allowed: false,
    errorCode: 'FREE_IMAGE_ANALYSIS_CLAIM_UNAVAILABLE',
    errorMessage: 'Analysis authorization unavailable',
    retryable: true,
  };
  if (input.dreamId == null) return required;
  try {
    const { data: claim, error } = await client.from('quota_usage').select('id')
      .eq('user_id', input.userId).eq('dream_id', input.dreamId).eq('quota_type', 'analysis')
      .contains('metadata', { analysis_request_id: input.requestId }).limit(1).maybeSingle();
    if (error) return unavailable;
    if (claim) return { allowed: true };
    if (input.analysisComplete) return required;

    // A running analysis may still be about to reserve its receipt. A completed,
    // absent or superseded analysis cannot repair a missing receipt by waiting.
    const { data: dream, error: dreamError } = await client.from('dreams')
      .select('analysis_status,analysis_request_id')
      .eq('user_id', input.userId).eq('id', input.dreamId).maybeSingle();
    if (dreamError) return unavailable;
    if (!dream || dream.analysis_status !== 'pending' || dream.analysis_request_id !== input.requestId) return required;
    return {
      allowed: false,
      errorCode: 'FREE_IMAGE_ANALYSIS_CLAIM_PENDING',
      errorMessage: 'Waiting for the authorized analysis claim',
      retryable: true,
    };
  } catch {
    return unavailable;
  }
}
