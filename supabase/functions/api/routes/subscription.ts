import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, RECONCILE_DEFAULT_BATCH, RECONCILE_DEFAULT_MAX_TOTAL, RECONCILE_DEFAULT_MIN_AGE_HOURS, RECONCILE_MAX_BATCH, RECONCILE_MAX_DURATION_MS } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';
import {
  buildUpdatedMetadata,
  fetchRevenueCatCustomer,
  getRevenueCatEntitlementLookup,
  getReconcileSecret,
  getRevenueCatApiKey,
  getRevenueCatProjectId,
  getTierUpdatedAt,
  normalizeTier,
  RevenueCatHttpError,
} from '../services/revenuecat.ts';
import { inferTierFromCustomer } from '../../../lib/revenuecatSubscriber.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function handleSubscriptionSync(ctx: ApiContext): Promise<Response> {
  const { req, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const body = (await req.json().catch(() => ({}))) as { source?: string };
  const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim() : 'app_launch';

  let apiKey: string;
  let projectId: string;
  try {
    apiKey = getRevenueCatApiKey();
    projectId = getRevenueCatProjectId();
  } catch (error) {
    console.error('[api] /subscription/sync RevenueCat not configured', {
      userId: user.id,
      message: (error as Error).message,
    });
    return new Response(JSON.stringify({ error: 'RevenueCat not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let customer;
  try {
    customer = await fetchRevenueCatCustomer(user.id, apiKey, projectId);
  } catch (error) {
    const isRevenueCatHttpError = error instanceof RevenueCatHttpError;
    const status = isRevenueCatHttpError ? error.status : null;

    const truncatedBodyText = isRevenueCatHttpError ? error.bodyText.slice(0, 500) : null;
    const upstreamStatus = !isRevenueCatHttpError
      ? 503
      : status === 401 || status === 403
        ? 500
        : status === 404
          ? 200
          : status === 429 || status >= 500
            ? 503
            : 502;

    console.error('[api] /subscription/sync RevenueCat lookup failed', {
      userId: user.id,
      message: (error as Error).message,
      status,
      bodyText: truncatedBodyText,
    });

    if (upstreamStatus === 200) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const clientError =
      upstreamStatus === 500
        ? 'RevenueCat authentication failed'
        : upstreamStatus === 503
          ? 'RevenueCat temporarily unavailable'
          : 'RevenueCat lookup failed';

    return new Response(JSON.stringify({ error: clientError }), {
      status: upstreamStatus,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let entitlementLookup: Record<string, string> | null = null;
  try {
    entitlementLookup = await getRevenueCatEntitlementLookup(apiKey, projectId);
  } catch (error) {
    console.warn('[api] /subscription/sync entitlement lookup failed', {
      userId: user.id,
      message: (error as Error).message,
    });
    entitlementLookup = null;
  }

  const inferredTier = inferTierFromCustomer(customer, Date.now(), entitlementLookup ?? undefined);
  if (inferredTier === null) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const currentMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const currentTier = normalizeTier(currentMeta.tier ?? user.user_metadata?.tier);
  const tierUpdatedAt = getTierUpdatedAt(currentMeta);
  const shouldUpdate = currentTier !== inferredTier || !tierUpdatedAt;

  if (shouldUpdate) {
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const updatedMeta = buildUpdatedMetadata(currentMeta, inferredTier, source);
    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: updatedMeta,
    });
    if (error) {
      console.error('[api] /subscription/sync metadata update failed', {
        userId: user.id,
        message: error.message,
      });
      return new Response(JSON.stringify({ error: 'Failed to update user metadata' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      tier: inferredTier,
      updated: shouldUpdate,
      currentTier,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

export async function handleSubscriptionReconcile(ctx: ApiContext): Promise<Response> {
  const { req, supabaseUrl, supabaseServiceRoleKey } = ctx;

  const secret = getReconcileSecret();
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Missing REVENUECAT_RECONCILE_SECRET' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!provided || !timingSafeEqual(provided, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid reconcile authentication' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let apiKey: string;
  let projectId: string;
  try {
    apiKey = getRevenueCatApiKey();
    projectId = getRevenueCatProjectId();
  } catch (error) {
    console.error('[api] /subscription/reconcile RevenueCat not configured', {
      message: (error as Error).message,
    });
    return new Response(JSON.stringify({ error: 'RevenueCat not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let entitlementLookup: Record<string, string> | null = null;
  try {
    entitlementLookup = await getRevenueCatEntitlementLookup(apiKey, projectId);
    console.log('[api] /subscription/reconcile entitlement lookup loaded', {
      count: Object.keys(entitlementLookup).length,
    });
  } catch (error) {
    console.warn('[api] /subscription/reconcile entitlement lookup failed', {
      message: (error as Error).message,
    });
    entitlementLookup = null;
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

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
      .select('id, raw_app_meta_data')
      .or('raw_app_meta_data->>tier.eq.plus,raw_app_meta_data->>tier.eq.premium')
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
    if (!data?.length) break;

    for (const row of data) {
      processed += 1;
      lastId = row.id;

      const meta = (row.raw_app_meta_data ?? {}) as Record<string, unknown>;
      const currentTier = normalizeTier(meta.tier);
      const lastSyncedAt = getTierUpdatedAt(meta);
      const lastSyncedMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : null;
      if (lastSyncedMs && Number.isFinite(lastSyncedMs) && Date.now() - lastSyncedMs < minAgeMs) {
        skipped += 1;
        continue;
      }

      let customer;
      try {
        customer = await fetchRevenueCatCustomer(row.id, apiKey, projectId);
      } catch (error) {
        const isRevenueCatHttpError = error instanceof RevenueCatHttpError;
        errors += 1;
        console.warn('[api] /subscription/reconcile RevenueCat lookup failed', {
          userId: row.id,
          message: (error as Error).message,
          status: isRevenueCatHttpError ? error.status : null,
          bodyText: isRevenueCatHttpError ? error.bodyText.slice(0, 200) : null,
        });
        continue;
      }

      const inferredTier = inferTierFromCustomer(customer, Date.now(), entitlementLookup ?? undefined);
      if (inferredTier === null) {
        skipped += 1;
        continue;
      }

      if (inferredTier !== currentTier) {
        changed += 1;
      }

      const updatedMeta = buildUpdatedMetadata(meta, inferredTier, 'revenuecat_reconcile');
      const { error: updateError } = await adminClient.auth.admin.updateUserById(row.id, {
        app_metadata: updatedMeta,
      });

      if (updateError) {
        errors += 1;
        console.warn('[api] /subscription/reconcile metadata update failed', {
          userId: row.id,
          message: updateError.message,
        });
        continue;
      }

      updated += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed,
      updated,
      changed,
      skipped,
      errors,
      lastId,
      durationMs: Date.now() - startedAt,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}
