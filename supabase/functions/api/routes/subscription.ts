import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  corsHeaders,
  RECONCILE_DEFAULT_BATCH,
  RECONCILE_DEFAULT_MAX_TOTAL,
  RECONCILE_DEFAULT_MIN_AGE_HOURS,
  RECONCILE_MAX_BATCH,
  RECONCILE_MAX_DURATION_MS,
} from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';
import {
  fetchRevenueCatCustomer,
  getReconcileSecret,
  getRevenueCatApiKey,
  getRevenueCatEntitlementLookup,
  getRevenueCatProjectId,
  RevenueCatHttpError,
} from '../services/revenuecat.ts';
import {
  applySubscriptionStateUpdate,
  buildSubscriptionSnapshotFromCustomer,
  type ApplySubscriptionStateUpdateResult,
} from '../../../lib/subscriptionState.ts';

type SubscriptionStateRow = {
  user_id: string;
  updated_at: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function createAdminClient(supabaseUrl: string, supabaseServiceRoleKey: string) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function parseRefreshSource(body: { source?: string } | null | undefined): string {
  const rawSource = typeof body?.source === 'string' ? body.source.trim() : '';
  return rawSource || 'app_launch';
}

async function fetchCustomerSnapshot(
  userId: string,
  entitlementLookup?: Record<string, string>
): Promise<ReturnType<typeof buildSubscriptionSnapshotFromCustomer>> {
  const apiKey = getRevenueCatApiKey();
  const projectId = getRevenueCatProjectId();

  let customer = null;

  try {
    customer = await fetchRevenueCatCustomer(userId, apiKey, projectId);
  } catch (error) {
    if (error instanceof RevenueCatHttpError && error.status === 404) {
      customer = null;
    } else {
      throw error;
    }
  }

  return buildSubscriptionSnapshotFromCustomer(customer, Date.now(), entitlementLookup);
}

function mapRevenueCatErrorToResponse(error: unknown, route: string, userId?: string): Response {
  const isRevenueCatHttpError = error instanceof RevenueCatHttpError;
  const status = isRevenueCatHttpError ? error.status : null;
  const truncatedBodyText = isRevenueCatHttpError ? error.bodyText.slice(0, 500) : null;
  const upstreamStatus = !isRevenueCatHttpError
    ? 503
    : status === 401 || status === 403
      ? 500
      : status === 429 || (status !== null && status >= 500)
        ? 503
        : 502;

  console.error(`[api] ${route} RevenueCat lookup failed`, {
    userId: userId ?? null,
    message: (error as Error).message,
    status,
    bodyText: truncatedBodyText,
  });

  const clientError =
    upstreamStatus === 500
      ? 'RevenueCat authentication failed'
      : upstreamStatus === 503
        ? 'RevenueCat temporarily unavailable'
        : 'RevenueCat lookup failed';

  return jsonResponse({ error: clientError }, upstreamStatus);
}

async function applySnapshotForUser(
  adminClient: ReturnType<typeof createAdminClient>,
  input: {
    userId: string;
    source: string;
    sourceEventId?: string | null;
    sourceUpdatedAt: string;
    requestedSource?: string | null;
    entitlementLookup?: Record<string, string>;
  }
): Promise<ApplySubscriptionStateUpdateResult> {
  const snapshot = await fetchCustomerSnapshot(input.userId, input.entitlementLookup);

  return applySubscriptionStateUpdate(adminClient, {
    userId: input.userId,
    source: input.source,
    sourceEventId: input.sourceEventId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    tier: snapshot.tier,
    isActive: snapshot.isActive,
    productId: snapshot.productId,
    entitlementId: snapshot.entitlementId,
    revenueCatCustomerId: snapshot.revenueCatCustomerId,
    metadata: input.requestedSource ? { requestedSource: input.requestedSource } : undefined,
  });
}

export async function handleSubscriptionRefresh(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  if (!supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as { source?: string };
  const requestedSource = parseRefreshSource(body);

  try {
    getRevenueCatApiKey();
    getRevenueCatProjectId();
  } catch (error) {
    console.error('[api] /subscription/refresh RevenueCat not configured', {
      userId: user.id,
      message: (error as Error).message,
    });
    return jsonResponse({ error: 'RevenueCat not configured' }, 500);
  }

  const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

  let entitlementLookup: Record<string, string> | undefined;
  try {
    entitlementLookup = await getRevenueCatEntitlementLookup(getRevenueCatApiKey(), getRevenueCatProjectId());
  } catch (error) {
    console.warn('[api] /subscription/refresh entitlement lookup failed', {
      userId: user.id,
      message: (error as Error).message,
    });
    entitlementLookup = undefined;
  }

  try {
    const result = await applySnapshotForUser(adminClient, {
      userId: user.id,
      source: 'subscription_refresh',
      sourceUpdatedAt: new Date().toISOString(),
      requestedSource,
      entitlementLookup,
    });

    return jsonResponse({
      ...result,
      requestedSource,
    });
  } catch (error) {
    return mapRevenueCatErrorToResponse(error, '/subscription/refresh', user.id);
  }
}

export const handleSubscriptionSync = handleSubscriptionRefresh;

export async function handleSubscriptionReconcile(ctx: ApiContext): Promise<Response> {
  const { req, supabaseUrl, supabaseServiceRoleKey } = ctx;

  const secret = getReconcileSecret();
  if (!secret) {
    return jsonResponse({ error: 'Missing REVENUECAT_RECONCILE_SECRET' }, 500);
  }

  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || !timingSafeEqual(provided, secret)) {
    return jsonResponse({ error: 'Invalid reconcile authentication' }, 401);
  }

  if (!supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  try {
    getRevenueCatApiKey();
    getRevenueCatProjectId();
  } catch (error) {
    console.error('[api] /subscription/reconcile RevenueCat not configured', {
      message: (error as Error).message,
    });
    return jsonResponse({ error: 'RevenueCat not configured' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as {
    batchSize?: number;
    maxTotal?: number;
    minAgeHours?: number;
  };
  const batchSizeInput = Number(body?.batchSize);
  const maxTotalInput = Number(body?.maxTotal);
  const minAgeHoursInput = Number(body?.minAgeHours);
  const batchSize = Math.min(
    Math.max(Number.isFinite(batchSizeInput) ? batchSizeInput : RECONCILE_DEFAULT_BATCH, 1),
    RECONCILE_MAX_BATCH
  );
  const maxTotal = Math.min(
    Math.max(Number.isFinite(maxTotalInput) ? maxTotalInput : RECONCILE_DEFAULT_MAX_TOTAL, 1),
    RECONCILE_DEFAULT_MAX_TOTAL
  );
  const minAgeHours = Math.max(
    Number.isFinite(minAgeHoursInput) ? minAgeHoursInput : RECONCILE_DEFAULT_MIN_AGE_HOURS,
    0
  );
  const minAgeMs = minAgeHours * 60 * 60 * 1000;

  const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

  let entitlementLookup: Record<string, string> | undefined;
  try {
    entitlementLookup = await getRevenueCatEntitlementLookup(getRevenueCatApiKey(), getRevenueCatProjectId());
  } catch (error) {
    console.warn('[api] /subscription/reconcile entitlement lookup failed', {
      message: (error as Error).message,
    });
    entitlementLookup = undefined;
  }

  const startedAt = Date.now();
  let processed = 0;
  let updated = 0;
  let changed = 0;
  let skipped = 0;
  let errors = 0;
  let lastId: string | null = null;

  while (processed < maxTotal && Date.now() - startedAt < RECONCILE_MAX_DURATION_MS) {
    let query = adminClient
      .schema('auth')
      .from('users')
      .select('id')
      .order('id', { ascending: true })
      .limit(batchSize);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[api] /subscription/reconcile user fetch failed', error.message);
      break;
    }

    if (!data?.length) {
      break;
    }

    const ids = data.map((row) => row.id);
    const { data: stateRows, error: stateError } = await adminClient
      .from('subscription_state')
      .select('user_id,updated_at')
      .in('user_id', ids);

    if (stateError) {
      console.warn('[api] /subscription/reconcile state fetch failed', stateError.message);
    }

    const stateByUserId = new Map<string, SubscriptionStateRow>(
      (stateRows ?? []).map((row) => [row.user_id, row as SubscriptionStateRow])
    );

    for (const row of data) {
      processed += 1;
      lastId = row.id;

      const existingState = stateByUserId.get(row.id);
      const updatedAtMs = existingState?.updated_at ? new Date(existingState.updated_at).getTime() : null;
      if (updatedAtMs && Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < minAgeMs) {
        skipped += 1;
        continue;
      }

      try {
        const result = await applySnapshotForUser(adminClient, {
          userId: row.id,
          source: 'revenuecat_reconcile',
          sourceUpdatedAt: new Date().toISOString(),
          entitlementLookup,
        });

        if (result.updated) {
          updated += 1;
        }
        if (result.changed) {
          changed += 1;
        }
        if (result.skipped) {
          skipped += 1;
        }
      } catch (error) {
        errors += 1;

        if (error instanceof RevenueCatHttpError || error instanceof Error) {
          const response = mapRevenueCatErrorToResponse(error, '/subscription/reconcile', row.id);
          if (response.status >= 500) {
            console.warn('[api] /subscription/reconcile user sync failed', {
              userId: row.id,
              message: (error as Error).message,
            });
          }
        }
      }
    }
  }

  return jsonResponse({
    ok: true,
    processed,
    updated,
    changed,
    skipped,
    errors,
    lastId,
    durationMs: Date.now() - startedAt,
  });
}
