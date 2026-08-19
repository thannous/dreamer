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

export async function handleStoreAppleAuthToken(ctx: ApiContext): Promise<Response> {
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

  const config = readAppleAuthConfig();
  if (!config) {
    return jsonResponse({ error: 'Apple token revocation is not configured' }, 503);
  }

  try {
    const refreshToken = await exchangeAppleAuthorizationCode(authorizationCode, config);
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: existing, error: getUserError } = await adminClient.auth.admin.getUserById(user.id);
    if (getUserError || !existing?.user) {
      return jsonResponse({ error: 'Failed to store Apple token' }, 500);
    }
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(existing.user.app_metadata ?? {}),
        apple_refresh_token: refreshToken,
      },
    });
    if (updateError) {
      return jsonResponse({ error: 'Failed to store Apple token' }, 500);
    }
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.warn('[api] /auth/apple-token failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return jsonResponse({ error: 'Failed to store Apple token' }, 503);
  }
}
