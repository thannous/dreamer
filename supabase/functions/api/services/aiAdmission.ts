import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../lib/constants.ts';
import { claimGuestQaPaidCall } from '../lib/guestQa.ts';
import { sha256Hex } from '../lib/sha256.ts';
import type { ApiContext } from '../types.ts';

export type SynchronousAiCapability =
  | 'analyze_dream'
  | 'analyze_dream_full'
  | 'categorize_dream'
  | 'recall_question'
  | 'chat'
  | 'transcribe'
  | 'generate_image_legacy'
  | 'moon_letter'
  | 'analysis_preview';

type AdmissionActorClass = 'GUEST' | 'FREE' | 'PLUS';

type AdmissionDefaults = {
  guest: number;
  free: number;
  plus: number;
  global: number;
};

type AdmissionRpcResult = {
  allowed?: boolean;
  code?: 'AI_ACTOR_RATE_LIMIT' | 'AI_GLOBAL_RATE_LIMIT' | string;
  retry_after_seconds?: number;
  actor_count?: number | null;
  global_count?: number | null;
};

type AdmissionDependencies = {
  createAdminClient?: typeof createClient;
  readEnv?: (name: string) => string | undefined;
};

const DEFAULT_WINDOW_SECONDS = 600;

const DEFAULTS: Record<SynchronousAiCapability, AdmissionDefaults> = {
  analyze_dream: { guest: 2, free: 6, plus: 20, global: 300 },
  analyze_dream_full: { guest: 1, free: 2, plus: 8, global: 100 },
  categorize_dream: { guest: 4, free: 12, plus: 30, global: 600 },
  recall_question: { guest: 6, free: 18, plus: 40, global: 600 },
  chat: { guest: 12, free: 30, plus: 60, global: 1000 },
  transcribe: { guest: 3, free: 10, plus: 20, global: 200 },
  generate_image_legacy: { guest: 1, free: 2, plus: 8, global: 100 },
  // Signed-in accounts only, one letter per lunar cycle: room for a failed attempt or two.
  moon_letter: { guest: 1, free: 2, plus: 2, global: 100 },
  // Free accounts only, one prepared analysis per week: room for a failed attempt or two.
  analysis_preview: { guest: 1, free: 2, plus: 1, global: 100 },
};

/**
 * Rolling 24-hour anti-abuse budgets per account or guest device (Thanh,
 * 2026-10-21). Recording calls (transcription, recall questions, categorization)
 * stay far above a real dreamer's day. /analyzeDream, which guests still use,
 * counts each keyed analysis once across transport retries. Legacy unkeyed
 * requests still count individually; the same rule applies to the full route.
 * Chat keeps only its 10-minute window and per-dream ceiling.
 */
export const DAILY_DEFAULTS: Partial<Record<SynchronousAiCapability, number>> = {
  transcribe: 30,
  categorize_dream: 30,
  recall_question: 60,
  analyze_dream: 20,
  analyze_dream_full: 10,
  generate_image_legacy: 10,
  moon_letter: 4,
  analysis_preview: 3,
};

const envPrefix = (capability: SynchronousAiCapability): string =>
  capability.toUpperCase();

const readPositiveInteger = (
  readEnv: (name: string) => string | undefined,
  name: string,
  fallback: number,
  maximum: number
): number => {
  const parsed = Number(readEnv(name));
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
};

export const resolveSynchronousAiAdmissionPolicy = (
  capability: SynchronousAiCapability,
  actorClass: AdmissionActorClass,
  readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)
) => {
  const defaults = DEFAULTS[capability];
  const actorFallback = actorClass === 'GUEST'
    ? defaults.guest
    : actorClass === 'PLUS'
      ? defaults.plus
      : defaults.free;
  const prefix = envPrefix(capability);

  return {
    windowSeconds: readPositiveInteger(
      readEnv,
      'AI_SYNC_RATE_WINDOW_SECONDS',
      DEFAULT_WINDOW_SECONDS,
      86400
    ),
    actorLimit: readPositiveInteger(
      readEnv,
      `AI_${prefix}_MAX_PER_WINDOW_${actorClass}`,
      actorFallback,
      10000
    ),
    globalLimit: readPositiveInteger(
      readEnv,
      `AI_${prefix}_GLOBAL_MAX_PER_WINDOW`,
      defaults.global,
      100000
    ),
    dailyLimit: DAILY_DEFAULTS[capability] === undefined
      ? null
      : readPositiveInteger(readEnv, `AI_${prefix}_MAX_PER_DAY`, DAILY_DEFAULTS[capability]!, 10000),
  };
};

export const hashAiActor = (actorKey: string): Promise<string> => sha256Hex(actorKey);

const jsonResponse = (body: Record<string, unknown>, status: number, retryAfter?: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
      ...corsHeaders,
    },
  });

const unavailable = () =>
  jsonResponse({ error: 'AI service is temporarily unavailable', code: 'AI_ADMISSION_UNAVAILABLE' }, 503);

const normalizeTier = (tier: unknown): 'free' | 'plus' =>
  tier === 'plus' || tier === 'premium' ? 'plus' : 'free';

export const admitSynchronousAiRequest = async (
  options: {
    ctx: ApiContext;
    capability: SynchronousAiCapability;
    guestFingerprint: string | null;
    analysisRequestId?: string | null;
  },
  dependencies: AdmissionDependencies = {}
): Promise<{ tier: 'free' | 'plus'; actorClass: AdmissionActorClass } | Response> => {
  const { ctx, capability, guestFingerprint } = options;
  const serviceRoleKey = ctx.supabaseServiceRoleKey?.trim();
  if (!serviceRoleKey) {
    console.error('[api] AI admission unavailable', { capability, reason: 'missing_service_role' });
    return unavailable();
  }

  const actorKey = ctx.user?.id
    ? `user:${ctx.user.id}`
    : guestFingerprint
      ? `guest:${guestFingerprint}`
      : null;
  if (!actorKey) {
    console.error('[api] AI admission unavailable', { capability, reason: 'missing_actor' });
    return unavailable();
  }

  const clientFactory = dependencies.createAdminClient ?? createClient;
  const adminClient = clientFactory(ctx.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let tier: 'free' | 'plus' = 'free';
  if (ctx.user?.id) {
    const { data, error } = await adminClient.rpc('get_effective_subscription_tier', {
      p_user_id: ctx.user.id,
    });
    if (error) {
      console.warn('[api] AI admission tier lookup failed', {
        capability,
        code: error?.code ?? null,
      });
      return unavailable();
    }
    tier = normalizeTier(data);
  }

  const actorClass: AdmissionActorClass = ctx.user?.id
    ? tier === 'plus' ? 'PLUS' : 'FREE'
    : 'GUEST';
  const policy = resolveSynchronousAiAdmissionPolicy(
    capability,
    actorClass,
    dependencies.readEnv ?? ((name) => Deno.env.get(name))
  );
  const actorHash = await hashAiActor(actorKey);
  const keyedAnalysis = (capability === 'analyze_dream' || capability === 'analyze_dream_full')
    && Boolean(options.analysisRequestId);
  const { data, error } = await adminClient.rpc(keyedAnalysis ? 'claim_ai_analysis_admission' : 'claim_ai_request_window', {
    p_actor_hash: actorHash,
    p_capability: capability,
    p_window_seconds: policy.windowSeconds,
    p_actor_limit: policy.actorLimit,
    p_global_limit: policy.globalLimit,
    ...(keyedAnalysis ? { p_request_id: options.analysisRequestId, p_daily_limit: policy.dailyLimit } : {}),
  });

  if (error) {
    console.warn('[api] AI admission claim failed', {
      capability,
      code: error?.code ?? null,
    });
    return unavailable();
  }

  const claim = (data ?? {}) as AdmissionRpcResult;
  if (typeof claim.allowed !== 'boolean') return unavailable();
  if (claim.allowed !== true) {
    if (claim.code === 'AI_DAILY_LIMIT') {
      const retryAfter = Number.isFinite(claim.retry_after_seconds)
        ? Math.min(90000, Math.max(1, Math.ceil(claim.retry_after_seconds ?? 1))) : 90000;
      return jsonResponse({ error: 'Daily AI limit reached', code: 'AI_DAILY_LIMIT', dailyLimit: policy.dailyLimit, retryAfter }, 429, retryAfter);
    }
    const retryAfter = Number.isFinite(claim.retry_after_seconds)
      ? Math.max(1, Math.floor(claim.retry_after_seconds ?? 1))
      : policy.windowSeconds;
    const globalBlocked = claim.code === 'AI_GLOBAL_RATE_LIMIT';
    return jsonResponse(
      {
        error: globalBlocked ? 'AI service is temporarily busy' : 'Too many AI requests',
        code: claim.code ?? 'AI_ADMISSION_DENIED',
        retryAfter,
      },
      globalBlocked ? 503 : 429,
      retryAfter
    );
  }

  if (policy.dailyLimit !== null && !keyedAnalysis) {
    const { data: dailyData, error: dailyError } = await adminClient.rpc('claim_ai_daily_budget', {
      p_actor_hash: actorHash,
      p_capability: capability,
      p_daily_limit: policy.dailyLimit,
    });
    const daily = (dailyData ?? null) as AdmissionRpcResult | null;
    // A missing answer is an outage, not a spent budget: never a 24 h wait for nothing.
    if (dailyError || typeof daily?.allowed !== 'boolean') {
      console.warn('[api] AI daily budget claim failed', {
        capability,
        code: dailyError?.code ?? null,
      });
      return unavailable();
    }
    if (!daily.allowed) {
      // The window is the current hour and the 24 before it: at most 25 hours.
      const retryAfter = Number.isFinite(daily.retry_after_seconds)
        ? Math.min(90000, Math.max(1, Math.ceil(daily.retry_after_seconds ?? 1)))
        : 90000;
      return jsonResponse(
        {
          error: 'Daily AI limit reached',
          code: 'AI_DAILY_LIMIT',
          dailyLimit: policy.dailyLimit,
          retryAfter,
        },
        429,
        retryAfter
      );
    }
  }

  const qaBudgetResponse = await claimGuestQaPaidCall({
    adminClient,
    capability,
    quotaSubject: guestFingerprint,
  });
  if (qaBudgetResponse) return qaBudgetResponse;

  return { tier, actorClass };
};
