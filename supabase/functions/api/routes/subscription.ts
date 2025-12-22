import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, RECONCILE_DEFAULT_BATCH, RECONCILE_DEFAULT_MAX_TOTAL, RECONCILE_DEFAULT_MIN_AGE_HOURS, RECONCILE_MAX_BATCH, RECONCILE_MAX_DURATION_MS } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';
import {
  buildUpdatedMetadata,
  fetchRevenueCatSubscriber,
  getReconcileSecret,
  getRevenueCatApiKey,
  getTierUpdatedAt,
  normalizeTier,
} from '../services/revenuecat.ts';
import { inferTierFromSubscriber } from '../../../lib/revenuecatSubscriber.ts';

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

  let subscriber;
  try {
    subscriber = await fetchRevenueCatSubscriber(user.id, getRevenueCatApiKey());
  } catch (error) {
    console.error('[api] /subscription/sync RevenueCat lookup failed', {
      userId: user.id,
      message: (error as Error).message,
    });
    return new Response(JSON.stringify({ error: 'RevenueCat lookup failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const inferredTier = inferTierFromSubscriber(subscriber);
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

  const apiKey = getRevenueCatApiKey();
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

      let subscriber;
      try {
        subscriber = await fetchRevenueCatSubscriber(row.id, apiKey);
      } catch (error) {
        errors += 1;
        console.warn('[api] /subscription/reconcile RevenueCat lookup failed', {
          userId: row.id,
          message: (error as Error).message,
        });
        continue;
      }

      const inferredTier = inferTierFromSubscriber(subscriber);
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
