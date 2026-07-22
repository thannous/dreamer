import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders } from '../lib/constants.ts';
import { isValidUuid } from '../lib/aiRequestPolicy.ts';
import type { ApiContext } from '../types.ts';

type GuestQaDependencies = {
  createAdminClient?: typeof createClient;
  readEnv?: (name: string) => string | undefined;
};

type GuestQaDbResult = {
  active?: boolean;
  allowed?: boolean;
  code?: string;
  retryAfter?: number;
  [key: string]: unknown;
};

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const PASSPORT_VALID_HOURS = 24;
const DAILY_RESET_LIMIT = 3;
const DAILY_PAID_CALL_LIMIT = 10;

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

export const parseGuestQaOperatorIds = (value: string | undefined): Set<string> =>
  new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => isValidUuid(entry))
  );

const readFingerprint = async (req: Request): Promise<string | null> => {
  const body = (await req.json().catch(() => ({}))) as { fingerprint?: unknown };
  if (typeof body.fingerprint !== 'string') return null;
  const fingerprint = body.fingerprint.trim().toLowerCase();
  return FINGERPRINT_PATTERN.test(fingerprint) ? fingerprint : null;
};

const authorize = (
  ctx: ApiContext,
  dependencies: GuestQaDependencies
): Response | null => {
  if (!ctx.user?.id) {
    return jsonResponse({ error: 'Authentication required', code: 'QA_AUTH_REQUIRED' }, 401);
  }
  const readEnv = dependencies.readEnv ?? ((name: string) => Deno.env.get(name));
  const operators = parseGuestQaOperatorIds(readEnv('GUEST_QA_OPERATOR_USER_IDS'));
  if (!operators.has(String(ctx.user.id).toLowerCase())) {
    return jsonResponse({ error: 'QA access denied', code: 'QA_ACCESS_DENIED' }, 403);
  }
  if (!ctx.supabaseServiceRoleKey?.trim()) {
    return jsonResponse({ error: 'QA service unavailable', code: 'QA_SERVICE_UNAVAILABLE' }, 503);
  }
  return null;
};

const createAdmin = (ctx: ApiContext, dependencies: GuestQaDependencies) => {
  const clientFactory = dependencies.createAdminClient ?? createClient;
  return clientFactory(ctx.supabaseUrl, ctx.supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const rpcFailure = (route: string, code?: string): Response => {
  console.warn(`[api] ${route} failed`, { code: code ?? null });
  return jsonResponse({ error: 'QA service unavailable', code: 'QA_SERVICE_UNAVAILABLE' }, 503);
};

export async function handleGuestQaStatus(
  ctx: ApiContext,
  dependencies: GuestQaDependencies = {}
): Promise<Response> {
  const authError = authorize(ctx, dependencies);
  if (authError) return authError;
  const fingerprint = await readFingerprint(ctx.req);
  if (!fingerprint) {
    return jsonResponse({ error: 'Invalid device fingerprint', code: 'QA_INVALID_FINGERPRINT' }, 400);
  }

  const adminClient = createAdmin(ctx, dependencies);
  const { data, error } = await adminClient.rpc('get_guest_qa_operator_status', {
    p_operator_user_id: ctx.user.id,
    p_fingerprint: fingerprint,
  });
  if (error) return rpcFailure('/qa/guest-device/status', error.code);
  return jsonResponse((data ?? { active: false }) as Record<string, unknown>, 200);
}

export async function handleGuestQaEnroll(
  ctx: ApiContext,
  dependencies: GuestQaDependencies = {}
): Promise<Response> {
  const authError = authorize(ctx, dependencies);
  if (authError) return authError;
  const body = (await ctx.req.json().catch(() => ({}))) as {
    fingerprint?: unknown;
    requestId?: unknown;
  };
  const fingerprint = typeof body.fingerprint === 'string'
    ? body.fingerprint.trim().toLowerCase()
    : '';
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    return jsonResponse({ error: 'Invalid device fingerprint', code: 'QA_INVALID_FINGERPRINT' }, 400);
  }
  if (!isValidUuid(requestId)) {
    return jsonResponse({ error: 'Invalid QA request id', code: 'QA_INVALID_REQUEST_ID' }, 400);
  }

  const adminClient = createAdmin(ctx, dependencies);
  const { data, error } = await adminClient.rpc('enroll_guest_qa_passport', {
    p_operator_user_id: ctx.user.id,
    p_fingerprint: fingerprint,
    p_request_id: requestId,
    p_valid_hours: PASSPORT_VALID_HOURS,
    p_daily_reset_limit: DAILY_RESET_LIMIT,
    p_daily_paid_call_limit: DAILY_PAID_CALL_LIMIT,
  });
  if (error) return rpcFailure('/qa/guest-device/enroll', error.code);

  const result = (data ?? {}) as GuestQaDbResult;
  if (result.allowed === true) return jsonResponse(result, 200);
  const retryAfter = Number.isFinite(result.retryAfter)
    ? Math.max(1, Math.floor(result.retryAfter ?? 1))
    : undefined;
  const status = result.code === 'QA_DAILY_RESET_LIMIT'
    ? 429
    : result.code === 'QA_DEVICE_LIMIT'
      ? 409
      : 400;
  return jsonResponse(result, status, retryAfter);
}

export async function handleGuestQaRevoke(
  ctx: ApiContext,
  dependencies: GuestQaDependencies = {}
): Promise<Response> {
  const authError = authorize(ctx, dependencies);
  if (authError) return authError;
  const fingerprint = await readFingerprint(ctx.req);
  if (!fingerprint) {
    return jsonResponse({ error: 'Invalid device fingerprint', code: 'QA_INVALID_FINGERPRINT' }, 400);
  }

  const adminClient = createAdmin(ctx, dependencies);
  const { data, error } = await adminClient.rpc('revoke_guest_qa_passport', {
    p_operator_user_id: ctx.user.id,
    p_fingerprint: fingerprint,
  });
  if (error) return rpcFailure('/qa/guest-device/revoke', error.code);
  return jsonResponse((data ?? { revoked: false }) as Record<string, unknown>, 200);
}
