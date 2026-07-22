import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders } from './constants.ts';

type AdminClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};

type GuestQaPassportResolution = {
  active?: boolean;
  quotaSubject?: string;
  validUntil?: string;
};

type GuestQaPaidCallClaim = {
  qa?: boolean;
  allowed?: boolean;
  code?: string;
  retryAfter?: number;
  used?: number;
  limit?: number;
  duplicate?: boolean;
};

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  retryAfter?: number
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
      ...corsHeaders,
    },
  });

export const isGuestQaQuotaSubject = (value: string | null): value is string =>
  typeof value === 'string'
  && /^qa:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function resolveGuestQaPassport(
  fingerprint: string,
  dependencies: {
    supabaseUrl?: string | null;
    serviceRoleKey?: string | null;
    createAdminClient?: typeof createClient;
  } = {}
): Promise<GuestQaPassportResolution | null> {
  const supabaseUrl = dependencies.supabaseUrl ?? Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = dependencies.serviceRoleKey
    ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) return null;

  const clientFactory = dependencies.createAdminClient ?? createClient;
  const adminClient = clientFactory(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as AdminClient;
  const { data, error } = await adminClient.rpc('resolve_guest_qa_passport', {
    p_fingerprint: fingerprint,
  });
  if (error) {
    console.warn('[api] guest QA passport lookup failed', {
      code: error.code ?? null,
    });
    return null;
  }

  const resolution = (data ?? {}) as GuestQaPassportResolution;
  if (
    resolution.active !== true
    || !isGuestQaQuotaSubject(resolution.quotaSubject ?? null)
    || typeof resolution.validUntil !== 'string'
  ) {
    return null;
  }
  return resolution;
}

export async function claimGuestQaPaidCall(options: {
  adminClient: AdminClient;
  capability: string;
  quotaSubject: string | null;
  requestKey?: string;
}): Promise<Response | null> {
  if (!isGuestQaQuotaSubject(options.quotaSubject)) return null;

  const { data, error } = await options.adminClient.rpc('claim_guest_qa_paid_call', {
    p_quota_subject: options.quotaSubject,
    p_capability: options.capability,
    p_request_key: options.requestKey ?? crypto.randomUUID(),
  });
  if (error) {
    console.warn('[api] guest QA paid-call claim failed', {
      capability: options.capability,
      code: error.code ?? null,
    });
    return jsonResponse(
      { error: 'QA budget service unavailable', code: 'QA_BUDGET_UNAVAILABLE' },
      503
    );
  }

  const claim = (data ?? {}) as GuestQaPaidCallClaim;
  if (claim.allowed === true) return null;

  const retryAfter = Number.isFinite(claim.retryAfter)
    ? Math.max(1, Math.floor(claim.retryAfter ?? 1))
    : undefined;
  const expired = claim.code === 'QA_PASSPORT_EXPIRED';
  return jsonResponse(
    {
      error: expired ? 'QA guest passport expired' : 'QA daily AI budget reached',
      code: claim.code ?? 'QA_DAILY_BUDGET_EXCEEDED',
      ...(typeof claim.used === 'number' ? { used: claim.used } : {}),
      ...(typeof claim.limit === 'number' ? { limit: claim.limit } : {}),
      ...(retryAfter ? { retryAfter } : {}),
    },
    expired ? 401 : 429,
    retryAfter
  );
}
