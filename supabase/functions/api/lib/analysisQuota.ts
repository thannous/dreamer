import { corsHeaders } from './constants.ts';

type AuthenticatedAnalysisQuotaClaim = {
  code?: string;
};

export type GuestAnalysisQuotaClaim = {
  allowed?: boolean;
  new_count?: number;
  is_upgraded?: boolean;
  claimed?: boolean;
  duplicate?: boolean;
};

export const isAuthenticatedAnalysisQuotaRetry = (
  claim: Pick<AuthenticatedAnalysisQuotaClaim, 'code'>
): boolean => claim.code === 'ANALYSIS_ALREADY_CLAIMED';

const serviceUnavailable = () =>
  new Response(JSON.stringify({ error: 'Guest quota unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

export async function claimGuestAnalysisQuota({
  adminClient,
  analysisRequestId,
  fingerprint,
  limit,
}: {
  adminClient: {
    rpc: (
      name: string,
      params: Record<string, unknown>
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  analysisRequestId: string | null;
  fingerprint: string;
  limit: number;
}): Promise<{ claim?: GuestAnalysisQuotaClaim; response?: Response }> {
  if (!analysisRequestId) {
    return {
      response: new Response(
        JSON.stringify({
          error: 'Analysis request id is required',
          code: 'ANALYSIS_CLAIM_REQUIRED',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      ),
    };
  }

  const { data, error } = await adminClient.rpc('claim_guest_analysis_quota', {
    p_fingerprint: fingerprint,
    p_analysis_request_id: analysisRequestId,
    p_limit: limit,
  });

  if (error) {
    console.error('[api] /analyzeDream: guest quota claim failed before provider work', error);
    return { response: serviceUnavailable() };
  }

  return { claim: (data ?? {}) as GuestAnalysisQuotaClaim };
}
