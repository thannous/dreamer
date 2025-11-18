import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const encoder = new TextEncoder();

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

function isPremiumFromPayload(payload: any): boolean {
  const activeEntitlements = payload?.event?.customer_info?.entitlements?.active ?? {};
  if (!activeEntitlements || typeof activeEntitlements !== 'object') {
    return false;
  }
  return Object.keys(activeEntitlements).length > 0;
}

function getAppUserId(payload: any): string | null {
  const fromRoot = payload?.app_user_id;
  const fromEvent = payload?.event?.app_user_id;
  const id = fromEvent || fromRoot;
  if (!id || typeof id !== 'string') {
    return null;
  }
  return id;
}

function getWebhookSecret(): string {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
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
    const isValid = await verifySignature(req, rawBody);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (e) {
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

  const appUserId = getAppUserId(payload);
  if (!appUserId) {
    return new Response(JSON.stringify({ error: 'Missing app_user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let supabase;
  try {
    supabase = getSupabaseAdminClient();
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const premium = isPremiumFromPayload(payload);
  const newTier = premium ? 'premium' : 'free';

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(appUserId);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'User not found', details: userError?.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const currentMeta = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    const updatedMeta = { ...currentMeta, tier: newTier };

    const { error: updateError } = await supabase.auth.admin.updateUserById(appUserId, {
      user_metadata: updatedMeta,
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
