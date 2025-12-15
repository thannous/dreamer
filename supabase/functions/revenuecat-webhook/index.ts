import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

type Tier = 'free' | 'plus' | 'premium';
type InferredTier = Tier | null;

const PREMIUM_ENTITLEMENT_KEYS = [
  'premium',
  'noctalia_premium',
  'noctalia-premium',
  'noctaliaPremium',
  'Noctalia Premium',
];

const PLUS_ENTITLEMENT_KEYS = [
  'plus',
  'noctalia_plus',
  'noctalia-plus',
  'noctaliaPlus',
  'Noctalia Plus',
];

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function getOptionalEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) return null;
  return value.trim();
}

function getSupabaseAdminClient() {
  const supabaseUrl = getOptionalEnv('SUPABASE_URL') ?? getOptionalEnv('EXPO_PUBLIC_SUPABASE_URL');
  const serviceKey =
    getOptionalEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    getOptionalEnv('SUPABASE_SERVICE_KEY') ??
    getOptionalEnv('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.error('[revenuecat-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', {
      timestamp: new Date().toISOString(),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceKey),
    });
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

function getWebhookSecret(): string {
  return (
    getOptionalEnv('REVENUECAT_WEBHOOK_SECRET') ??
    getOptionalEnv('REVENUECAT_WEBHOOK_AUTH') ??
    getOptionalEnv('REVENUECAT_WEBHOOK_AUTHORIZATION') ??
    ''
  ).trim();
}

function verifyWebhookAuthorization(req: Request): boolean {
  const secret = getWebhookSecret();
  if (!secret) {
    throw new Error('Missing REVENUECAT_WEBHOOK_SECRET');
  }

  // Option A (recommended): RevenueCat sends `Authorization: Bearer <secret>`.
  const provided = req.headers.get('authorization')?.trim();
  if (provided && (timingSafeEqual(provided, secret) || timingSafeEqual(provided, `Bearer ${secret}`))) {
    return true;
  }

  // Option B: if the function requires JWT verification, RevenueCat may need to use the Supabase
  // anon key as Authorization. In that case, also allow a secret passed as query param.
  const url = new URL(req.url);
  const qp =
    url.searchParams.get('rc_webhook_secret') ??
    url.searchParams.get('revenuecat_webhook_secret') ??
    url.searchParams.get('rc_secret') ??
    null;

  return typeof qp === 'string' && qp.trim() ? timingSafeEqual(qp.trim(), secret) : false;
}

function looksLikeUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getAppUserIdCandidates(payload: any): string[] {
  const ids = new Set<string>();

  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    ids.add(trimmed);
  };

  add(payload?.event?.app_user_id);
  add(payload?.app_user_id);
  add(payload?.event?.original_app_user_id);
  add(payload?.original_app_user_id);
  add(payload?.event?.customer_info?.original_app_user_id);

  const aliases =
    payload?.event?.aliases ??
    payload?.event?.customer_info?.aliases ??
    payload?.event?.customer_info?.subscriber?.aliases ??
    payload?.aliases;

  if (Array.isArray(aliases)) {
    for (const alias of aliases) add(alias);
  }

  return Array.from(ids);
}

function tierFromEntitlementKey(key: string): InferredTier {
  if (PREMIUM_ENTITLEMENT_KEYS.includes(key)) return 'premium';
  if (PLUS_ENTITLEMENT_KEYS.includes(key)) return 'plus';
  return null;
}

function inferTierFromEntitlementKeys(keys: string[]): InferredTier {
  let inferred: InferredTier = null;

  for (const key of keys) {
    const mapped = tierFromEntitlementKey(key);
    if (!mapped) continue;
    if (mapped === 'premium') return 'premium';
    if (!inferred) inferred = mapped;
  }

  if (inferred) return inferred;
  return keys.length > 0 ? null : 'free';
}

async function rcFetchJson<T>(url: string, apiKey: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new Error(`RevenueCat API failed: HTTP ${res.status} ${res.statusText}: ${bodyText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function getRevenueCatApiKey(): string {
  const apiKey =
    getOptionalEnv('REVENUECAT_SECRET_API_KEY') ??
    getOptionalEnv('REVENUECAT_API_KEY') ??
    getOptionalEnv('REVENUECAT_SECRET_KEY');
  if (!apiKey) {
    throw new Error('Missing REVENUECAT_SECRET_API_KEY');
  }
  return apiKey;
}

type RevenueCatV1Entitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
};

type RevenueCatV1SubscriberResponse = {
  subscriber?: {
    original_app_user_id?: string | null;
    aliases?: string[] | null;
    entitlements?: Record<string, RevenueCatV1Entitlement>;
  };
};

function isActiveEntitlementV1(ent: RevenueCatV1Entitlement, nowMs: number): boolean {
  const grace = ent.grace_period_expires_date;
  if (typeof grace === 'string' && grace.trim()) {
    const graceMs = new Date(grace).getTime();
    if (Number.isFinite(graceMs) && graceMs > nowMs) return true;
  }

  const expires = ent.expires_date;
  if (expires === null || expires === undefined) {
    // No expiration typically means lifetime/non-expiring entitlement.
    return true;
  }

  if (typeof expires === 'string' && expires.trim()) {
    const expiresMs = new Date(expires).getTime();
    return Number.isFinite(expiresMs) && expiresMs > nowMs;
  }

  return false;
}

function inferTierFromSubscriberV1(subscriber: RevenueCatV1SubscriberResponse): InferredTier {
  const entitlements = subscriber?.subscriber?.entitlements ?? {};
  const nowMs = Date.now();

  const activeEntitlementKeys = Object.entries(entitlements)
    .filter(([_, ent]) => isActiveEntitlementV1(ent, nowMs))
    .map(([key]) => key);

  return inferTierFromEntitlementKeys(activeEntitlementKeys);
}

function getSubscriberIdsFromRevenueCat(subscriber: RevenueCatV1SubscriberResponse): string[] {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== 'string') return;
    const t = v.trim();
    if (!t) return;
    ids.add(t);
  };

  add(subscriber?.subscriber?.original_app_user_id);
  const aliases = subscriber?.subscriber?.aliases;
  if (Array.isArray(aliases)) {
    aliases.forEach(add);
  }

  return Array.from(ids);
}

async function fetchSubscriberV1(appUserId: string, apiKey: string): Promise<RevenueCatV1SubscriberResponse> {
  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  return rcFetchJson<RevenueCatV1SubscriberResponse>(url, apiKey, 8000);
}

function inferTierFromWebhookPayload(payload: any): InferredTier {
  const eventType = payload?.event?.type;
  if (eventType === 'EXPIRATION') return 'free';

  const entitlementIdsRaw =
    payload?.event?.entitlement_ids ??
    payload?.event?.entitlementIds ??
    payload?.event?.entitlements_ids ??
    null;

  const entitlementIds: string[] = [];
  if (Array.isArray(entitlementIdsRaw)) {
    for (const item of entitlementIdsRaw) {
      if (typeof item === 'string' && item.trim()) entitlementIds.push(item.trim());
    }
  }
  const singleEntitlementId = payload?.event?.entitlement_id ?? payload?.event?.entitlementId ?? null;
  if (typeof singleEntitlementId === 'string' && singleEntitlementId.trim()) {
    entitlementIds.push(singleEntitlementId.trim());
  }

  if (entitlementIds.length > 0) {
    return inferTierFromEntitlementKeys(entitlementIds);
  }

  // No reliable entitlement state -> avoid accidental downgrade.
  return null;
}

async function resolveSupabaseUserByCandidates(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  candidates: string[],
): Promise<{ userId: string; userData: { user: any } } | null> {
  for (const id of candidates) {
    if (!looksLikeUuid(id)) continue;
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (!error && data?.user) {
      return { userId: id, userData: data as any };
    }
  }
  return null;
}

async function fetchSubscriberFromAnyCandidate(
  appUserIdCandidates: string[],
): Promise<{ appUserIdUsed: string; subscriber: RevenueCatV1SubscriberResponse }> {
  const apiKey = getRevenueCatApiKey();
  let lastError: unknown = null;

  for (const id of appUserIdCandidates) {
    try {
      const subscriber = await fetchSubscriberV1(id, apiKey);
      return { appUserIdUsed: id, subscriber };
    } catch (e) {
      lastError = e;
    }
  }

  throw (lastError as Error) ?? new Error('RevenueCat subscriber lookup failed');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.warn('[revenuecat-webhook] Invalid request method', {
      timestamp: new Date().toISOString(),
      method: req.method,
    });
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error('[revenuecat-webhook] Failed to read request body', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
    });
    return new Response(JSON.stringify({ error: `Failed to read body: ${(e as Error).message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    if (!verifyWebhookAuthorization(req)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (e) {
    console.error('[revenuecat-webhook] Auth verification error', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (e) {
    console.error('[revenuecat-webhook] Invalid JSON in request body', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
      bodyLength: rawBody.length,
    });
    return new Response(JSON.stringify({ error: `Invalid JSON: ${(e as Error).message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  console.log('[revenuecat-webhook] Webhook received', {
    timestamp: new Date().toISOString(),
    eventType: payload?.event?.type,
    hasEventData: Boolean(payload?.event),
  });

  const candidateIds = getAppUserIdCandidates(payload);
  if (!candidateIds.length) {
    console.error('[revenuecat-webhook] Missing app_user_id in payload', {
      timestamp: new Date().toISOString(),
      eventType: payload?.event?.type,
      hasPayload: Boolean(payload),
    });
    return new Response(JSON.stringify({ error: 'Missing app_user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Prefer the canonical event id first, then fall back to any discovered ids/aliases.
  const primaryAppUserId =
    (typeof payload?.event?.app_user_id === 'string' && payload.event.app_user_id.trim()
      ? payload.event.app_user_id.trim()
      : null) ??
    (typeof payload?.app_user_id === 'string' && payload.app_user_id.trim() ? payload.app_user_id.trim() : null) ??
    candidateIds[0]!;

  const revenueCatLookupCandidates = Array.from(new Set([primaryAppUserId, ...candidateIds])).filter(Boolean);

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (e) {
    console.error('[revenuecat-webhook] Failed to create Supabase admin client', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // RevenueCat official recommendation: normalize using GET /subscribers after receiving a webhook.
    // This also lets us resolve Supabase userId from RevenueCat aliases, even if the webhook itself
    // does not include the UUID.
    let subscriberV1: RevenueCatV1SubscriberResponse | null = null;
    let appUserIdUsed = primaryAppUserId;
    try {
      const result = await fetchSubscriberFromAnyCandidate(revenueCatLookupCandidates);
      subscriberV1 = result.subscriber;
      appUserIdUsed = result.appUserIdUsed;
      console.log('[revenuecat-webhook] RevenueCat subscriber fetched successfully', {
        timestamp: new Date().toISOString(),
        appUserIdUsed: result.appUserIdUsed,
        candidatesCount: revenueCatLookupCandidates.length,
      });
    } catch (e) {
      console.warn('[revenuecat-webhook] RevenueCat subscriber lookup failed, falling back to webhook parsing', {
        timestamp: new Date().toISOString(),
        message: (e as Error)?.message ?? String(e),
        candidatesCount: revenueCatLookupCandidates.length,
      });
      subscriberV1 = null;
    }

    const subscriberIds = subscriberV1 ? getSubscriberIdsFromRevenueCat(subscriberV1) : [];
    const allUserIdCandidates = Array.from(new Set([...candidateIds, appUserIdUsed, ...subscriberIds])).filter(Boolean);

    const resolved = await resolveSupabaseUserByCandidates(supabase, allUserIdCandidates);
    if (!resolved) {
      console.warn('[revenuecat-webhook] User not found for RevenueCat ids', {
        timestamp: new Date().toISOString(),
        candidateCount: allUserIdCandidates.length,
        eventType: payload?.event?.type,
        appUserIdUsed,
      });
      return new Response(JSON.stringify({ error: 'User not found', details: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const resolvedUserId = resolved.userId;
    const userData = resolved.userData;

    console.log('[revenuecat-webhook] User resolved successfully', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      userEmail: userData.user.email,
      eventType: payload?.event?.type,
      appUserId: appUserIdUsed,
    });

    let newTier: InferredTier = null;
    if (subscriberV1) {
      newTier = inferTierFromSubscriberV1(subscriberV1);
    } else {
      newTier = inferTierFromWebhookPayload(payload);
    }

    console.log('[revenuecat-webhook] Tier inference', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      inferredTier: newTier,
      usedSubscriberV1Data: Boolean(subscriberV1),
      entitlementIds: payload?.event?.entitlement_ids ?? [],
    });

    if (newTier === null) {
      console.warn('[revenuecat-webhook] Tier is null, skipping update', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        eventType: payload?.event?.type,
        reason: 'Could not infer tier from webhook or subscriber data',
      });
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const currentTier = userData.user.app_metadata?.tier as Tier | undefined;
    if (currentTier === newTier) {
      console.log('[revenuecat-webhook] Tier unchanged', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        tier: newTier,
        eventType: payload?.event?.type,
      });
      return new Response(JSON.stringify({ ok: true, tier: newTier, unchanged: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[revenuecat-webhook] Tier change detected', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      fromTier: currentTier,
      toTier: newTier,
      eventType: payload?.event?.type,
    });

    const currentAppMeta = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
    const updatedAppMeta = { ...currentAppMeta, tier: newTier };

    const { error: updateError } = await supabase.auth.admin.updateUserById(resolvedUserId, {
      app_metadata: updatedAppMeta,
    });

    if (updateError) {
      console.error('[revenuecat-webhook] Failed to update user metadata', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        fromTier: currentTier,
        toTier: newTier,
        error: updateError.message,
        eventType: payload?.event?.type,
      });
      return new Response(JSON.stringify({ error: 'Failed to update user metadata', details: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[revenuecat-webhook] User tier updated successfully', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      userEmail: userData.user.email,
      fromTier: currentTier,
      toTier: newTier,
      eventType: payload?.event?.type,
      expiryDate: payload?.event?.expiration_date || null,
    });

    return new Response(JSON.stringify({ ok: true, tier: newTier }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[revenuecat-webhook] Unhandled error in webhook handler', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
      eventType: payload?.event?.type,
      appUserIds: candidateIds.slice(0, 1), // Log first candidate only to avoid over-logging
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
