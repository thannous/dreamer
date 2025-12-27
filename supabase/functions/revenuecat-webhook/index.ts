import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  inferTierFromEntitlementKeys,
  inferTierFromCustomer,
  mapEntitlementKeys,
  type RevenueCatEntitlementLookupById,
  type RevenueCatV2CustomerResponse,
} from '../../lib/revenuecatSubscriber.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

type Tier = 'free' | 'plus';
type InferredTier = Tier | null;

type RevenueCatV2Entitlement = {
  id?: string | null;
  lookup_key?: string | null;
  display_name?: string | null;
};

type RevenueCatV2EntitlementsResponse = {
  items?: RevenueCatV2Entitlement[] | null;
  next_page?: string | null;
};

type RevenueCatEntitlementCache = {
  map: RevenueCatEntitlementLookupById;
  fetchedAt: number;
};

const ENTITLEMENT_CACHE_TTL_MS = 5 * 60 * 1000;
let entitlementCache: RevenueCatEntitlementCache | null = null;
let entitlementCachePromise: Promise<RevenueCatEntitlementLookupById> | null = null;

function normalizeTierForComparison(tier: string | null | undefined): Tier {
  if (tier === 'plus' || tier === 'premium') return 'plus';
  return 'free';
}

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
    throw new Error(
      'Missing REVENUECAT_SECRET_API_KEY (or REVENUECAT_API_KEY / REVENUECAT_SECRET_KEY)'
    );
  }
  return apiKey;
}

function getRevenueCatProjectId(): string {
  const projectId = getOptionalEnv('REVENUECAT_PROJECT_ID');
  if (!projectId) {
    throw new Error('Missing REVENUECAT_PROJECT_ID');
  }
  return projectId;
}

type RevenueCatV2AliasesResponse = {
  items?: Array<{ id?: string | null }> | null;
};

async function fetchCustomerV2(
  appUserId: string,
  apiKey: string,
  projectId: string
): Promise<RevenueCatV2CustomerResponse> {
  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(appUserId)}`;
  return rcFetchJson<RevenueCatV2CustomerResponse>(url, apiKey, 8000);
}

async function fetchCustomerAliasesV2(
  appUserId: string,
  apiKey: string,
  projectId: string
): Promise<string[]> {
  const url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(
    projectId
  )}/customers/${encodeURIComponent(appUserId)}/aliases`;
  const data = await rcFetchJson<RevenueCatV2AliasesResponse>(url, apiKey, 8000);
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((item) => (typeof item.id === 'string' ? item.id.trim() : ''))
    .filter(Boolean);
}

function normalizeEntitlementField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function fetchEntitlementLookupMap(
  apiKey: string,
  projectId: string
): Promise<RevenueCatEntitlementLookupById> {
  const map: RevenueCatEntitlementLookupById = {};
  let url = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/entitlements`;
  let pageCount = 0;

  while (url && pageCount < 10) {
    const data = await rcFetchJson<RevenueCatV2EntitlementsResponse>(url, apiKey, 8000);
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      const id = normalizeEntitlementField(item.id);
      const lookup =
        normalizeEntitlementField(item.lookup_key) ?? normalizeEntitlementField(item.display_name);
      if (id && lookup) {
        map[id] = lookup;
      }
    }

    pageCount += 1;
    const nextPage = normalizeEntitlementField(data.next_page);
    if (!nextPage) break;
    url = nextPage.startsWith('http') ? nextPage : `https://api.revenuecat.com${nextPage}`;
  }

  return map;
}

async function getEntitlementLookupMap(): Promise<RevenueCatEntitlementLookupById> {
  const now = Date.now();
  if (entitlementCache && now - entitlementCache.fetchedAt < ENTITLEMENT_CACHE_TTL_MS) {
    return entitlementCache.map;
  }

  if (entitlementCachePromise) {
    return entitlementCachePromise;
  }

  const apiKey = getRevenueCatApiKey();
  const projectId = getRevenueCatProjectId();
  entitlementCachePromise = fetchEntitlementLookupMap(apiKey, projectId)
    .then((map) => {
      entitlementCache = { map, fetchedAt: Date.now() };
      entitlementCachePromise = null;
      return map;
    })
    .catch((error) => {
      entitlementCachePromise = null;
      throw error;
    });

  return entitlementCachePromise;
}

function inferTierFromWebhookPayload(
  payload: any,
  entitlementLookupById?: RevenueCatEntitlementLookupById
): InferredTier {
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
    const mappedKeys = mapEntitlementKeys(entitlementIds, entitlementLookupById);
    return inferTierFromEntitlementKeys(mappedKeys);
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

async function fetchCustomerFromAnyCandidate(
  appUserIdCandidates: string[],
): Promise<{ appUserIdUsed: string; customer: RevenueCatV2CustomerResponse; aliasIds: string[] }> {
  const apiKey = getRevenueCatApiKey();
  const projectId = getRevenueCatProjectId();
  let lastError: unknown = null;

  for (const id of appUserIdCandidates) {
    try {
      const customer = await fetchCustomerV2(id, apiKey, projectId);
      let aliasIds: string[] = [];
      try {
        aliasIds = await fetchCustomerAliasesV2(id, apiKey, projectId);
      } catch {
        aliasIds = [];
      }
      return { appUserIdUsed: id, customer, aliasIds };
    } catch (e) {
      lastError = e;
    }
  }

  throw (lastError as Error) ?? new Error('RevenueCat customer lookup failed');
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
    // RevenueCat official recommendation: normalize using GET /customers after receiving a webhook.
    // This also lets us resolve Supabase userId from RevenueCat aliases, even if the webhook itself
    // does not include the UUID.
    let entitlementLookupById: RevenueCatEntitlementLookupById | null = null;
    try {
      entitlementLookupById = await getEntitlementLookupMap();
      console.log('[revenuecat-webhook] Entitlement lookup loaded', {
        timestamp: new Date().toISOString(),
        count: Object.keys(entitlementLookupById).length,
      });
    } catch (e) {
      console.warn('[revenuecat-webhook] Failed to load entitlement lookup', {
        timestamp: new Date().toISOString(),
        error: (e as Error).message,
      });
      entitlementLookupById = null;
    }

    let customerV2: RevenueCatV2CustomerResponse | null = null;
    let customerAliasIds: string[] = [];
    let appUserIdUsed = primaryAppUserId;
    try {
      const result = await fetchCustomerFromAnyCandidate(revenueCatLookupCandidates);
      customerV2 = result.customer;
      customerAliasIds = result.aliasIds;
      appUserIdUsed = result.appUserIdUsed;
      console.log('[revenuecat-webhook] RevenueCat customer fetched successfully', {
        timestamp: new Date().toISOString(),
        appUserIdUsed: result.appUserIdUsed,
        candidatesCount: revenueCatLookupCandidates.length,
      });
    } catch (e) {
      console.warn('[revenuecat-webhook] RevenueCat customer lookup failed, falling back to webhook parsing', {
        timestamp: new Date().toISOString(),
        message: (e as Error)?.message ?? String(e),
        candidatesCount: revenueCatLookupCandidates.length,
      });
      customerV2 = null;
      customerAliasIds = [];
    }

    const allUserIdCandidates = Array.from(
      new Set([...candidateIds, appUserIdUsed, ...customerAliasIds])
    ).filter(Boolean);

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

    const nowMs = Date.now();
    let newTier: InferredTier = null;
    if (customerV2) {
      newTier = inferTierFromCustomer(customerV2, nowMs, entitlementLookupById ?? undefined);
    } else {
      newTier = inferTierFromWebhookPayload(payload, entitlementLookupById ?? undefined);
    }

    const entitlementIdsForLog: string[] = [];
    const entitlementIdsRaw = payload?.event?.entitlement_ids;
    if (Array.isArray(entitlementIdsRaw)) {
      for (const item of entitlementIdsRaw) {
        if (typeof item === 'string' && item.trim()) entitlementIdsForLog.push(item.trim());
      }
    }
    const mappedEntitlementKeysForLog = mapEntitlementKeys(
      entitlementIdsForLog,
      entitlementLookupById ?? undefined
    );

    console.log('[revenuecat-webhook] Tier inference', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      inferredTier: newTier,
      usedCustomerData: Boolean(customerV2),
      entitlementIds: entitlementIdsForLog,
      entitlementKeys: mappedEntitlementKeysForLog,
    });

    // Protection order-based: Pour CANCELLATION, vérifier si l'expiration est passée
    const eventType = payload?.event?.type;
    const expirationAtMs = payload?.event?.expiration_at_ms;

    if (eventType === 'CANCELLATION' && typeof expirationAtMs === 'number' && nowMs > expirationAtMs) {
      console.log('[revenuecat-webhook] CANCELLATION received after expiration, forcing tier to free', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        expirationAtMs,
        nowMs,
        deltaMs: nowMs - expirationAtMs,
        originalInferredTier: newTier,
      });
      newTier = 'free';
    }

    if (newTier === null) {
      console.warn('[revenuecat-webhook] Tier is null, skipping update', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        eventType: payload?.event?.type,
        reason: 'Could not infer tier from webhook or customer data',
      });
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const currentTier = userData.user.app_metadata?.tier as string | undefined;
    const currentAppMeta = (userData.user.app_metadata ?? {}) as Record<string, unknown>;

    // Cache tier from customer (calculé une seule fois)
    const tierFromCustomer = customerV2
      ? inferTierFromCustomer(customerV2, nowMs, entitlementLookupById ?? undefined)
      : null;
    const normalizedCurrentTier = normalizeTierForComparison(currentTier);
    const normalizedNewTier = normalizeTierForComparison(newTier);

    // Protection supplémentaire: Empêcher CANCELLATION d'upgrader un utilisateur déjà 'free'
    // Ceci couvre le cas où EXPIRATION a déjà été traité mais CANCELLATION arrive après
    const isUpgrade = normalizedNewTier === 'plus' && normalizedCurrentTier === 'free';
    if (isUpgrade && eventType === 'CANCELLATION') {
      const hasActiveEntitlement = tierFromCustomer === 'plus';
      if (!hasActiveEntitlement) {
        console.warn('[revenuecat-webhook] Blocking CANCELLATION from upgrading expired user', {
          timestamp: new Date().toISOString(),
          userId: resolvedUserId,
          currentTier: normalizedCurrentTier,
          attemptedTier: newTier,
          eventType,
          tierFromCustomer,
        });
        return new Response(JSON.stringify({
          ok: true,
          blocked: true,
          reason: 'CANCELLATION cannot upgrade without active entitlement',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      console.log('[revenuecat-webhook] Allowing CANCELLATION upgrade due to active entitlement', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        tierFromCustomer,
      });
    }

    const rawEventTimestampMs = payload?.event?.event_timestamp_ms;
    const eventTimestampMs = typeof rawEventTimestampMs === 'number'
      ? rawEventTimestampMs
      : typeof rawEventTimestampMs === 'string'
        ? Number(rawEventTimestampMs)
        : null;
    const validEventTimestampMs = eventTimestampMs !== null && Number.isFinite(eventTimestampMs)
      ? eventTimestampMs
      : null;
    const rawLastEventTimestampMs = currentAppMeta.last_tier_event_timestamp_ms;
    const lastEventTimestampMs = typeof rawLastEventTimestampMs === 'number'
      ? rawLastEventTimestampMs
      : typeof rawLastEventTimestampMs === 'string'
        ? Number(rawLastEventTimestampMs)
        : undefined;
    const validLastEventTimestampMs = Number.isFinite(lastEventTimestampMs)
      ? lastEventTimestampMs
      : undefined;

    if (
      validEventTimestampMs !== null &&
      typeof validLastEventTimestampMs === 'number' &&
      validEventTimestampMs < validLastEventTimestampMs
    ) {
      console.log('[revenuecat-webhook] Ignoring older event', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        eventTimestampMs: validEventTimestampMs,
        lastEventTimestampMs: validLastEventTimestampMs,
        deltaMs: validLastEventTimestampMs - validEventTimestampMs,
      });
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'event older than last processed',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const shouldUpdateTimestamp = validEventTimestampMs !== null &&
      (validLastEventTimestampMs === undefined || validEventTimestampMs > validLastEventTimestampMs);

    if (normalizedCurrentTier === normalizedNewTier) {
      if (shouldUpdateTimestamp) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(resolvedUserId, {
          app_metadata: {
            ...currentAppMeta,
            last_tier_event_timestamp_ms: validEventTimestampMs,
          },
        });
        if (updateError) {
          console.warn('[revenuecat-webhook] Failed to update timestamp', { error: updateError.message });
        }
      }
      console.log('[revenuecat-webhook] Tier unchanged', {
        timestamp: new Date().toISOString(),
        userId: resolvedUserId,
        tier: newTier,
        eventType: payload?.event?.type,
      });
      return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        reason: 'tier unchanged',
        timestampUpdated: shouldUpdateTimestamp,
      }), {
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

    const updatedAppMeta = {
      ...currentAppMeta,
      tier: newTier,
      tier_updated_at: new Date().toISOString(),
      tier_source: 'revenuecat_webhook',
      ...(validEventTimestampMs !== null && { last_tier_event_timestamp_ms: validEventTimestampMs }),
    };

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
