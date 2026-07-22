import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../lib/constants.ts';
import { claimGuestQaPaidCall } from '../lib/guestQa.ts';
import type { ApiContext } from '../types.ts';

export type SynchronousAiCapability =
  | 'analyze_dream'
  | 'analyze_dream_full'
  | 'categorize_dream'
  | 'chat'
  | 'transcribe'
  | 'generate_image_legacy';

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
  chat: { guest: 12, free: 30, plus: 60, global: 1000 },
  transcribe: { guest: 3, free: 10, plus: 20, global: 200 },
  generate_image_legacy: { guest: 1, free: 2, plus: 8, global: 100 },
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
  };
};

export const hashAiActor = async (actorKey: string): Promise<string> => {
  const encoded = new TextEncoder().encode(actorKey);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

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
  const { data, error } = await adminClient.rpc('claim_ai_request_window', {
    p_actor_hash: actorHash,
    p_capability: capability,
    p_window_seconds: policy.windowSeconds,
    p_actor_limit: policy.actorLimit,
    p_global_limit: policy.globalLimit,
  });

  if (error) {
    console.warn('[api] AI admission claim failed', {
      capability,
      code: error?.code ?? null,
    });
    return unavailable();
  }

  const claim = (data ?? {}) as AdmissionRpcResult;
  if (claim.allowed !== true) {
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

  const qaBudgetResponse = await claimGuestQaPaidCall({
    adminClient,
    capability,
    quotaSubject: guestFingerprint,
  });
  if (qaBudgetResponse) return qaBudgetResponse;

  return { tier, actorClass };
};
