import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const encoder = new TextEncoder();

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_KEY') ??
    Deno.env.get('SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[revenuecat-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceKey),
    });
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

type InferredTier = 'free' | 'plus' | 'premium' | null;

const PREMIUM_ENTITLEMENT_IDS = [
  'premium',
  'noctalia_premium',
  'noctalia-premium',
  'noctaliaPremium',
  'Noctalia Premium',
];

const PLUS_ENTITLEMENT_IDS = [
  'plus',
  'noctalia_plus',
  'noctalia-plus',
  'noctaliaPlus',
  'Noctalia Plus',
];

function tierFromEntitlementId(entitlementId: string): Exclude<InferredTier, 'free' | null> {
  if (PREMIUM_ENTITLEMENT_IDS.includes(entitlementId)) return 'premium';
  if (PLUS_ENTITLEMENT_IDS.includes(entitlementId)) return 'plus';
  // If an entitlement exists but isn't mapped yet, grant the lowest paid tier.
  return 'plus';
}

/**
 * Infer tier from webhook payload.
 *
 * Best practice per RevenueCat docs is to follow up webhooks with a subscribers API call to
 * normalize all events. We avoid accidental downgrades here by returning `null` when the
 * payload doesn't include entitlement state we can trust.
 */
function inferTierFromPayload(payload: any): InferredTier {
  const eventType = payload?.event?.type;
  // Explicit non-active events should never grant premium
  if (eventType === 'EXPIRATION' || eventType === 'CANCELLATION') {
    return 'free';
  }

  const now = Date.now();

  const isEntitlementActive = (ent: any): boolean => {
    if (!ent) return false;

    // Prefer expires_at (RC webhook field), fallback to expires_date (legacy)
    const expires = ent.expires_at ?? ent.expires_date ?? null;
    const expiresAtMs =
      typeof expires === 'string' && expires ? new Date(expires).getTime() : null;

    // Grace period (Play Store billing issue) keeps access until grace expires
    const graceMs =
      typeof ent.grace_period_expires_at_ms === 'number'
        ? ent.grace_period_expires_at_ms
        : null;

    if (graceMs !== null) {
      return graceMs > now;
    }

    if (expiresAtMs !== null) {
      return expiresAtMs > now;
    }

    // No expiration field -> not enough signal to consider it active
    return false;
  };

  const entitlementsRaw = payload?.event?.entitlements;

  const entitlementsFromEvent: Array<{ id?: string; ent: any }> = Array.isArray(entitlementsRaw)
    ? (entitlementsRaw as any[]).map((ent) => ({ ent }))
    : (entitlementsRaw && typeof entitlementsRaw === 'object')
      ? Object.entries(entitlementsRaw as Record<string, any>).map(([id, ent]) => ({ id, ent }))
      : [];

  // 1) Preferred: event.entitlements
  if (entitlementsFromEvent.length > 0) {
    let hasAnyActive = false;
    const activeEntitlementIds: string[] = [];

    for (const entry of entitlementsFromEvent) {
      const ent = entry.ent;
      if (isEntitlementActive(ent)) {
        hasAnyActive = true;
        const entId =
          entry.id ??
          ent?.entitlement_identifier ??
          ent?.entitlement_id ??
          ent?.entitlement ??
          ent?.identifier;
        if (typeof entId === 'string' && entId.trim()) {
          activeEntitlementIds.push(entId.trim());
        }
      }
    }

    if (!hasAnyActive) return 'free';

    // If we can map entitlements, pick the highest tier.
    if (activeEntitlementIds.some((id) => PREMIUM_ENTITLEMENT_IDS.includes(id))) {
      return 'premium';
    }
    if (activeEntitlementIds.length > 0) {
      // If any active entitlement is known as plus/premium, map it. Otherwise default to plus.
      return activeEntitlementIds.reduce<Exclude<InferredTier, 'free' | null>>((acc, id) => {
        const mapped = tierFromEntitlementId(id);
        return acc === 'premium' ? 'premium' : mapped;
      }, 'plus');
    }

    // Active entitlement present but no identifier -> grant lowest paid tier
    return 'plus';
  }

  // 2) Fallback: event.customer_info.entitlements.active.* (legacy)
  const activeEntitlements = payload?.event?.customer_info?.entitlements?.active;
  if (activeEntitlements && typeof activeEntitlements === 'object') {
    const keys = Object.keys(activeEntitlements);
    const activeIds: string[] = [];
    for (const key of keys) {
      if (isEntitlementActive((activeEntitlements as any)[key])) {
        activeIds.push(key);
      }
    }

    if (activeIds.length === 0) {
      // If the payload explicitly includes entitlements.active (even empty), treat that as authoritative.
      return 'free';
    }

    if (activeIds.some((id) => PREMIUM_ENTITLEMENT_IDS.includes(id))) {
      return 'premium';
    }
    return activeIds.some((id) => PLUS_ENTITLEMENT_IDS.includes(id)) ? 'plus' : 'plus';
  }

  // No entitlement state in payload -> don't change anything (avoid accidental downgrade)
  return null;
}

function getAppUserIdCandidates(payload: any): string[] {
  const ids = new Set<string>();

  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    ids.add(trimmed);
  };

  // Common locations
  add(payload?.event?.app_user_id);
  add(payload?.app_user_id);

  // Alias/original fields (present after Purchases.logIn linking)
  add(payload?.event?.original_app_user_id);
  add(payload?.original_app_user_id);
  add(payload?.event?.customer_info?.original_app_user_id);

  const aliases =
    payload?.event?.aliases ??
    payload?.event?.customer_info?.aliases ??
    payload?.event?.customer_info?.subscriber?.aliases ??
    payload?.aliases;

  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      add(alias);
    }
  }

  return Array.from(ids);
}

function looksLikeUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getWebhookSecret(): string {
  const secret =
    Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ??
    Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ??
    Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
  if (!secret) {
    console.error('[revenuecat-webhook] Missing REVENUECAT_WEBHOOK_SECRET');
    throw new Error('Missing REVENUECAT_WEBHOOK_SECRET');
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

type ParsedSignature = {
  signature: string;
  algorithm?: string;
};

function parseSignatureHeader(value: string | null): ParsedSignature | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex > 0) {
    return {
      algorithm: trimmed.slice(0, eqIndex).toLowerCase(),
      signature: trimmed.slice(eqIndex + 1),
    };
  }
  return { signature: trimmed };
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const parsed = parseSignatureHeader(req.headers.get('x-signature'));
  if (!parsed?.signature) {
    return false;
  }
  const secret = getWebhookSecret();
  const algorithmHeader =
    parsed.algorithm || req.headers.get('x-signature-algorithm') || req.headers.get('x-signature-alg');
  const normalizedAlg = (algorithmHeader ?? 'sha256').toLowerCase();
  const hashName = normalizedAlg === 'sha1' ? 'SHA-1' : 'SHA-256';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: { name: hashName },
    },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expectedHex = toHex(signature);
  const expectedBase64 = toBase64(signature);
  const normalizedProvided = parsed.signature.trim();
  return (
    timingSafeEqual(normalizedProvided.toLowerCase(), expectedHex) ||
    timingSafeEqual(normalizedProvided, expectedBase64)
  );
}

function verifyAuthorizationHeader(req: Request): boolean {
  const secret = getWebhookSecret().trim();
  const provided = req.headers.get('authorization')?.trim();
  if (!provided) return false;

  // Support both exact value and common "Bearer <token>" format.
  const expectedBearer = `Bearer ${secret}`;

  return timingSafeEqual(provided, secret) || timingSafeEqual(provided, expectedBearer);
}

async function verifyWebhookAuth(req: Request, rawBody: string): Promise<boolean> {
  // Best practice per RevenueCat docs: configure a static Authorization header value in the dashboard.
  // Keep signature verification as an optional fallback.
  if (verifyAuthorizationHeader(req)) {
    return true;
  }
  return verifySignature(req, rawBody);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch (e) {
    return new Response(JSON.stringify({ error: `Failed to read body: ${(e as Error).message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const isValid = await verifyWebhookAuth(req, rawBody);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (e) {
    console.error('[revenuecat-webhook] Auth verification error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (e) {
    return new Response(JSON.stringify({ error: `Invalid JSON: ${(e as Error).message}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const candidateIds = getAppUserIdCandidates(payload);
  if (!candidateIds.length) {
    return new Response(JSON.stringify({ error: 'Missing app_user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (e) {
    console.error('[revenuecat-webhook] Failed to create Supabase admin client', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const inferredTier = inferTierFromPayload(payload);
  if (inferredTier === null) {
    return new Response(JSON.stringify({ ok: true, skipped: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const newTier = inferredTier;

  try {
    let resolvedUserId: string | null = null;
    let userData: { user: any } | null = null;
    let lastErrorMessage: string | undefined;

    for (const id of candidateIds) {
      if (!looksLikeUuid(id)) {
        continue;
      }
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (!error && data?.user) {
          resolvedUserId = id;
          userData = data as any;
          break;
        }
        lastErrorMessage = error?.message ?? lastErrorMessage;
      } catch (e) {
        lastErrorMessage = (e as Error)?.message ?? lastErrorMessage;
      }
    }

    if (!resolvedUserId || !userData?.user) {
      console.warn('[revenuecat-webhook] User not found for RevenueCat app_user_id candidates', {
        candidateCount: candidateIds.length,
        lastErrorMessage,
      });
      return new Response(JSON.stringify({ error: 'User not found', details: lastErrorMessage ?? 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ✅ CRITICAL FIX: Write to app_metadata (admin-only) instead of user_metadata (client-modifiable)
    const currentAppMeta = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
    const updatedAppMeta = { ...currentAppMeta, tier: newTier };

    const { error: updateError } = await supabase.auth.admin.updateUserById(resolvedUserId, {
      app_metadata: updatedAppMeta,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update user metadata', details: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true, tier: newTier }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
