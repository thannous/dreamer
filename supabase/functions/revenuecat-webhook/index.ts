import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  inferTierFromEntitlementKeys,
  inferTierFromCustomer,
  mapEntitlementKeys,
  type RevenueCatEntitlementLookupById,
  type RevenueCatV2CustomerResponse,
} from '../api/lib/revenuecatSubscriber.ts';
import {
  applySubscriptionStateUpdate,
  buildSubscriptionSnapshotFromCustomer,
  buildSubscriptionSnapshotFromTier,
} from '../api/lib/subscriptionState.ts';
import {
  fetchRevenueCatCustomer,
  fetchRevenueCatCustomerAliases,
  getRevenueCatApiKey,
  getRevenueCatEntitlementLookup,
  getRevenueCatProjectId,
} from '../api/services/revenuecat.ts';
import { verifyRevenueCatWebhookAuthorization } from './auth.ts';
import { readLimitedBody } from './body.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

type Tier = 'free' | 'plus';
type InferredTier = Tier | null;

function isRevenueCatAnonymousId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:');
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

  const addValue = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) addValue(item);
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      add(record.app_user_id);
      add(record.appUserId);
      add(record.original_app_user_id);
      add(record.originalAppUserId);
      add(record.id);
      return;
    }
    add(value);
  };

  add(payload?.event?.app_user_id);
  add(payload?.app_user_id);
  add(payload?.event?.original_app_user_id);
  add(payload?.original_app_user_id);
  add(payload?.event?.customer_info?.original_app_user_id);
  add(payload?.event?.transferred_from_app_user_id);
  add(payload?.event?.transferred_to_app_user_id);
  addValue(payload?.event?.transferred_from);
  addValue(payload?.event?.transferred_to);
  addValue(payload?.event?.transferredFrom);
  addValue(payload?.event?.transferredTo);
  addValue(payload?.event?.transfer_from);
  addValue(payload?.event?.transfer_to);

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

function getWebhookEventId(payload: any): string | null {
  const candidates = [
    payload?.event?.id,
    payload?.event?.event_id,
    payload?.event?.eventId,
    payload?.event?.transaction_id,
    payload?.event?.transactionId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getWebhookEventTimestampIso(payload: any, fallbackMs: number): string {
  const raw =
    payload?.event?.event_timestamp_ms ??
    payload?.event?.purchased_at_ms ??
    payload?.event?.expiration_at_ms ??
    null;

  const timestampMs = typeof raw === 'number'
    ? raw
    : typeof raw === 'string'
      ? Number(raw)
      : null;

  if (timestampMs !== null && Number.isFinite(timestampMs)) {
    return new Date(timestampMs).toISOString();
  }

  return new Date(fallbackMs).toISOString();
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
      const customer = await fetchRevenueCatCustomer(id, apiKey, projectId);
      let aliasIds: string[] = [];
      try {
        aliasIds = await fetchRevenueCatCustomerAliases(id, apiKey, projectId);
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

  // The secret travels in a header: reject unauthenticated senders before reading any body.
  try {
    if (!verifyRevenueCatWebhookAuthorization(req, getWebhookSecret())) {
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
    // Security: keep error messages generic to avoid leaking configuration/state to attackers.
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = await readLimitedBody(req);
  if (!body.ok) {
    console.error('[revenuecat-webhook] Failed to read request body', {
      timestamp: new Date().toISOString(),
      reason: body.reason,
    });
    // Security: don't echo internal error details to callers (webhook sender doesn't need them).
    const tooLarge = body.reason === 'too_large';
    return new Response(JSON.stringify({ error: tooLarge ? 'Payload too large' : 'Failed to read request body' }), {
      status: tooLarge ? 413 : 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const rawBody = body.text;

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (e) {
    console.error('[revenuecat-webhook] Invalid JSON in request body', {
      timestamp: new Date().toISOString(),
      error: (e as Error).message,
      bodyLength: rawBody.length,
    });
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
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
    const eventType = payload?.event?.type;
    const logPayload = {
      timestamp: new Date().toISOString(),
      eventType,
      hasPayload: Boolean(payload),
    };
    if (eventType === 'TRANSFER') {
      console.warn('[revenuecat-webhook] Missing app_user_id in payload', logPayload);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'missing app_user_id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    console.error('[revenuecat-webhook] Missing app_user_id in payload', logPayload);
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
    // Security: avoid leaking which env vars are missing (service keys, URLs, etc.).
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
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
      entitlementLookupById = await getRevenueCatEntitlementLookup(getRevenueCatApiKey(), getRevenueCatProjectId());
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
      const hasOnlyAnonymous =
        allUserIdCandidates.length > 0 && allUserIdCandidates.every((id) => isRevenueCatAnonymousId(id));
      const logPayload = {
        timestamp: new Date().toISOString(),
        candidateCount: allUserIdCandidates.length,
        eventType: payload?.event?.type,
        appUserIdUsed,
        anonymousOnly: hasOnlyAnonymous,
      };
      if (hasOnlyAnonymous) {
        console.log('[revenuecat-webhook] Anonymous RevenueCat user, skipping update', logPayload);
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'anonymous_user' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      console.warn('[revenuecat-webhook] User not found for RevenueCat ids', logPayload);
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

    const tierFromCustomer = customerV2
      ? inferTierFromCustomer(customerV2, nowMs, entitlementLookupById ?? undefined)
      : null;
    const normalizedCurrentTier = currentTier === 'plus' || currentTier === 'premium' ? 'plus' : 'free';
    const normalizedNewTier = newTier === 'plus' ? 'plus' : 'free';

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

    const eventTimestampIso = getWebhookEventTimestampIso(payload, nowMs);
    const productId =
      (typeof payload?.event?.product_id === 'string' && payload.event.product_id.trim()
        ? payload.event.product_id.trim()
        : null) ??
      (typeof payload?.event?.product_identifier === 'string' && payload.event.product_identifier.trim()
        ? payload.event.product_identifier.trim()
        : null);
    const mappedEntitlementId = mappedEntitlementKeysForLog[0] ??
      (typeof payload?.event?.entitlement_id === 'string' && payload.event.entitlement_id.trim()
        ? payload.event.entitlement_id.trim()
        : null);
    const snapshot = customerV2
      ? (
          buildSubscriptionSnapshotFromCustomer(customerV2, nowMs, entitlementLookupById ?? undefined) ??
          buildSubscriptionSnapshotFromTier({
            tier: normalizedNewTier,
            isActive: normalizedNewTier === 'plus',
            productId,
            entitlementId: mappedEntitlementId,
            revenueCatCustomerId: appUserIdUsed,
          })
        )
      : buildSubscriptionSnapshotFromTier({
          tier: normalizedNewTier,
          isActive: normalizedNewTier === 'plus',
          productId,
          entitlementId: mappedEntitlementId,
          revenueCatCustomerId: appUserIdUsed,
        });

    const result = await applySubscriptionStateUpdate(supabase, {
      userId: resolvedUserId,
      source: 'revenuecat_webhook',
      sourceEventId: getWebhookEventId(payload),
      sourceUpdatedAt: eventTimestampIso,
      tier: snapshot.tier,
      isActive: snapshot.isActive,
      productId: snapshot.productId,
      entitlementId: snapshot.entitlementId,
      revenueCatCustomerId: snapshot.revenueCatCustomerId ?? appUserIdUsed,
      metadata: {
        eventType: payload?.event?.type ?? null,
        appUserId: appUserIdUsed,
        entitlementIds: entitlementIdsForLog,
        entitlementKeys: mappedEntitlementKeysForLog,
      },
    });

    console.log('[revenuecat-webhook] Subscription state converged', {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId,
      userEmail: userData.user.email,
      fromTier: currentTier ?? 'free',
      toTier: result.tier,
      version: result.version,
      outcome: result.outcome ?? null,
      changed: result.changed,
      skipped: result.skipped ?? false,
      eventType: payload?.event?.type,
      expiryDate: payload?.event?.expiration_date || null,
    });

    return new Response(JSON.stringify({
      ok: true,
      tier: result.tier,
      isActive: result.isActive,
      version: result.version,
      changed: result.changed,
      skipped: result.skipped ?? false,
      outcome: result.outcome ?? null,
    }), {
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
    // Security: generic response; details stay in logs.
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
