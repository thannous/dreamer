import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  exchangeAppleAuthorizationCode,
  readAppleAuthConfig,
} from '../lib/appleTokenRevoke.ts';
import { corsHeaders } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

type Dependencies = {
  createAdminClient?: (url: string, key: string) => any;
  exchangeAuthorizationCode?: typeof exchangeAppleAuthorizationCode;
  readConfig?: typeof readAppleAuthConfig;
};

export async function handleStoreAppleAuthToken(
  ctx: ApiContext,
  dependencies: Dependencies = {}
): Promise<Response> {
  const { user, req, supabaseUrl, supabaseServiceRoleKey } = ctx;
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  if (!supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Service unavailable' }, 503);
  }

  const body = await req.json().catch(() => null) as { authorizationCode?: unknown } | null;
  const authorizationCode = typeof body?.authorizationCode === 'string' ? body.authorizationCode.trim() : '';
  if (!authorizationCode) {
    return jsonResponse({ error: 'Missing authorization code' }, 400);
  }

  const config = (dependencies.readConfig ?? readAppleAuthConfig)();
  if (!config) {
    return jsonResponse({ error: 'Apple token revocation is not configured' }, 503);
  }

  try {
    const refreshToken = await (dependencies.exchangeAuthorizationCode ?? exchangeAppleAuthorizationCode)(authorizationCode, config);
    const adminClient = dependencies.createAdminClient
      ? dependencies.createAdminClient(supabaseUrl, supabaseServiceRoleKey)
      : createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    const { error } = await adminClient.rpc('store_apple_refresh_token', {
      p_user_id: user.id,
      p_refresh_token: refreshToken,
    });
    if (error) {
      return jsonResponse({ error: 'Failed to store Apple token' }, 500);
    }
    return jsonResponse({ ok: true }, 200);
  } catch {
    // Provider/database error messages may contain credential material.
    console.warn('[api] /auth/apple-token failed');
    return jsonResponse({ error: 'Failed to store Apple token' }, 503);
  }
}
