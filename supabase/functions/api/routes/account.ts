import { createClient } from 'jsr:@supabase/supabase-js@2';

import { PREVIEW_OBJECT_PREFIX } from '../lib/analysisPreview.ts';
import {
  AppleTokenRevokeError,
  exchangeAppleAuthorizationCode,
  readAppleAuthConfig,
  revokeAppleTokens,
} from '../lib/appleTokenRevoke.ts';
import { corsHeaders } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_LIST_MAX_PAGES = 100;
// Storage policies accept any path under `<userId>/`, so nested folders are walked.
const STORAGE_MAX_FOLDER_DEPTH = 8;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

type StorageEntry = { id: string | null; name: string };

// Injectable for tests; the default builds the real service-role client.
type AdminClientFactory = (url: string, serviceRoleKey: string) => any;
type AppleRevokeFn = typeof revokeAppleTokens;
type AppleCodeExchangeFn = (authorizationCode: string) => Promise<string>;

/** The app answers this by asking Apple for a fresh authorization code (services/accountDeletionService.ts). */
export const APPLE_AUTHORIZATION_REQUIRED = 'apple_authorization_required';

const exchangeAppleCode: AppleCodeExchangeFn = (authorizationCode) => {
  const config = readAppleAuthConfig();
  if (!config) return Promise.reject(new AppleTokenRevokeError('Apple token revocation is not configured'));
  return exchangeAppleAuthorizationCode(authorizationCode, config);
};

async function readAppleAuthorizationCode(req: Request): Promise<string> {
  const body = await req.json().catch(() => null) as { appleAuthorizationCode?: unknown } | null;
  return typeof body?.appleAuthorizationCode === 'string' ? body.appleAuthorizationCode.trim() : '';
}

const defaultAdminClientFactory: AdminClientFactory = (url, serviceRoleKey) =>
  createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/**
 * Removes every Storage object owned by the user. Generated dream images are
 * uploaded under the `<userId>/` prefix (see services/storage.ts), and the
 * paintings of prepared analyses under `previews/<userId>/`
 * (services/previewIllustration.ts), so two prefix-scoped walks cover all of them,
 * including any nested path the Storage policies allow under the user's folder.
 */
async function deleteUserStorageObjects(
  // SupabaseClient generics vary by jsr version; ApiContext already treats clients as `any`.
  adminClient: any,
  bucket: string,
  userId: string
): Promise<boolean> {
  for (const prefix of [`${userId}/`, `${PREVIEW_OBJECT_PREFIX}/${userId}/`]) {
    if (!await deleteStorageObjectsUnder(adminClient, bucket, prefix)) return false;
  }
  return true;
}

async function deleteStorageObjectsUnder(
  adminClient: any,
  bucket: string,
  prefix: string,
  depth = 0
): Promise<boolean> {
  if (depth > STORAGE_MAX_FOLDER_DEPTH) {
    console.warn('[api] /account: storage cleanup hit the folder depth cap');
    return false;
  }
  for (let page = 0; page < STORAGE_LIST_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
    });
    if (error) {
      console.warn('[api] /account: storage list failed', { message: error.message ?? 'unknown' });
      return false;
    }
    const entries = ((data ?? []) as StorageEntry[]).filter((entry) => entry.name);
    if (entries.length === 0) return true;
    const paths = entries.filter((entry) => entry.id).map((entry) => `${prefix}${entry.name}`);
    if (paths.length > 0) {
      const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
      if (removeError) {
        console.warn('[api] /account: storage removal failed', { message: removeError.message ?? 'unknown' });
        return false;
      }
    }
    // Folders have a null id: they cannot be removed directly and disappear once
    // emptied, so a later listing of this prefix no longer returns them.
    for (const folder of entries.filter((entry) => !entry.id)) {
      if (!await deleteStorageObjectsUnder(adminClient, bucket, `${prefix}${folder.name}/`, depth + 1)) {
        return false;
      }
    }
  }
  console.warn('[api] /account: storage cleanup hit the pagination cap');
  return false;
}

function userHasAppleIdentity(user: { identities?: { provider?: string }[] | null } | null): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === 'apple'));
}

export async function handleDeleteAccount(
  ctx: ApiContext,
  createAdminClient: AdminClientFactory = defaultAdminClientFactory,
  revokeAppleUserTokens: AppleRevokeFn = revokeAppleTokens,
  exchangeAppleAuthorization: AppleCodeExchangeFn = exchangeAppleCode
): Promise<Response> {
  const { user, supabaseUrl, supabaseServiceRoleKey, storageBucket } = ctx;

  // The user id always comes from the verified JWT, never from the request body.
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  if (!supabaseServiceRoleKey) {
    console.warn('[api] /account: missing service role key');
    return jsonResponse({ error: 'Service unavailable' }, 503);
  }

  const userId = user.id as string;
  const adminClient = createAdminClient(supabaseUrl, supabaseServiceRoleKey);

  // 1. Sign in with Apple requires token revocation when the account is deleted
  //    (App Store guideline 5.1.1(v)). It comes first, so a refusal deletes
  //    nothing. Missing Apple REST credentials fail the delete instead of
  //    skipping revoke.
  const { data: authUserData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
  if (getUserError || !authUserData?.user) {
    console.warn('[api] /account: failed to load auth user before delete', {
      message: getUserError?.message ?? 'missing user',
    });
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }
  if (userHasAppleIdentity(authUserData.user)) {
    try {
      const { data: storedToken, error } = await adminClient.rpc('read_apple_refresh_token', {
        p_user_id: userId,
      });
      if (error) {
        throw new Error('Private Apple credential unavailable');
      }
      let refreshToken = typeof storedToken === 'string' ? storedToken : '';
      if (!refreshToken) {
        // No token was kept at sign-in: the app asks Apple for a fresh code and sends it.
        const authorizationCode = await readAppleAuthorizationCode(ctx.req);
        if (!authorizationCode) {
          return jsonResponse({ error: 'Apple authorization required', code: APPLE_AUTHORIZATION_REQUIRED }, 409);
        }
        refreshToken = await exchangeAppleAuthorization(authorizationCode);
      }
      await revokeAppleUserTokens({ refreshToken });
    } catch {
      // Never log provider or database errors that could echo a credential.
      console.warn('[api] /account: Apple token revoke failed');
      return jsonResponse({ error: 'Apple token revocation failed' }, 503);
    }
  }

  // 2. Generated dream images in Storage (not covered by any FK cascade).
  const storageCleared = await deleteUserStorageObjects(adminClient, storageBucket, userId);
  if (!storageCleared) {
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }

  // 3. public.quota_usage keeps user_id WITHOUT a foreign key to auth.users
  //    (see 20251220000000_unify_quota_tables.sql), so it never cascades.
  const { error: quotaError } = await adminClient
    .from('quota_usage')
    .delete()
    .eq('user_id', userId);
  if (quotaError) {
    console.warn('[api] /account: quota_usage deletion failed', { code: quotaError.code ?? 'unknown' });
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }

  // 4. Deleting the Auth user cascades to every table holding an
  //    ON DELETE CASCADE FK to auth.users: dreams (20251222115718_remote_schema.sql),
  //    dream_chat_turns / dream_chat_messages (20260722134500), ai_jobs (20260316120000),
  //    dream_sync_receipts (20260316130000), subscription_state / subscription_events
  //    (20260316140000), device_account_links (20260722151231) and private Apple
  //    refresh tokens (20261020001047).
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('[api] /account: auth user deletion failed', {
      message: deleteError.message ?? 'unknown',
    });
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }

  console.log('[api] /account: account deleted', { userId });
  return jsonResponse({ deleted: true }, 200);
}
