import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

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

  let payload: any;
  try {
    const rawBody = await req.text();
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
