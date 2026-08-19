import { createClient } from 'jsr:@supabase/supabase-js@2';

import { revokeAppleTokens } from '../lib/appleTokenRevoke.ts';
import { corsHeaders } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_LIST_MAX_PAGES = 100;

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

const defaultAdminClientFactory: AdminClientFactory = (url, serviceRoleKey) =>
  createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

/**
 * Removes every Storage object owned by the user. Generated dream images are
 * uploaded under the `<userId>/` prefix (see services/storage.ts), so a
 * prefix-scoped listing covers all of them.
 */
async function deleteUserStorageObjects(
  // SupabaseClient generics vary by jsr version; ApiContext already treats clients as `any`.
  adminClient: any,
  bucket: string,
  userId: string
): Promise<boolean> {
  const prefix = `${userId}/`;
  for (let page = 0; page < STORAGE_LIST_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.storage.from(bucket).list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
    });
    if (error) {
      console.warn('[api] /account: storage list failed', { message: error.message ?? 'unknown' });
      return false;
    }
    const entries = (data ?? []) as StorageEntry[];
    // Folder placeholders have a null id and cannot be removed directly.
    const paths = entries.filter((entry) => entry.id && entry.name).map((entry) => `${prefix}${entry.name}`);
    if (paths.length === 0) return true;
    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
    if (removeError) {
      console.warn('[api] /account: storage removal failed', { message: removeError.message ?? 'unknown' });
      return false;
    }
  }
  console.warn('[api] /account: storage cleanup hit the pagination cap');
  return false;
}

function userHasAppleIdentity(user: { identities?: Array<{ provider?: string }> | null } | null): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === 'apple'));
}

function appleRefreshTokenFromUser(user: { app_metadata?: { apple_refresh_token?: unknown } } | null): string | null {
  const token = user?.app_metadata?.apple_refresh_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function handleDeleteAccount(
  ctx: ApiContext,
  createAdminClient: AdminClientFactory = defaultAdminClientFactory,
  revokeAppleUserTokens: AppleRevokeFn = revokeAppleTokens
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

  // 1. Generated dream images in Storage (not covered by any FK cascade).
  const storageCleared = await deleteUserStorageObjects(adminClient, storageBucket, userId);
  if (!storageCleared) {
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }

  // 2. public.quota_usage keeps user_id WITHOUT a foreign key to auth.users
  //    (see 20251220000000_unify_quota_tables.sql), so it never cascades.
  const { error: quotaError } = await adminClient
    .from('quota_usage')
    .delete()
    .eq('user_id', userId);
  if (quotaError) {
    console.warn('[api] /account: quota_usage deletion failed', { code: quotaError.code ?? 'unknown' });
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }

  // 3. Sign in with Apple requires token revocation before the account is
  //    destroyed (App Store guideline). Missing Apple REST credentials fail
  //    the delete instead of skipping revoke.
  const { data: authUserData, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
  if (getUserError || !authUserData?.user) {
    console.warn('[api] /account: failed to load auth user before delete', {
      message: getUserError?.message ?? 'missing user',
    });
    return jsonResponse({ error: 'Deletion failed' }, 500);
  }
  if (userHasAppleIdentity(authUserData.user)) {
    try {
      await revokeAppleUserTokens({
        refreshToken: appleRefreshTokenFromUser(authUserData.user),
      });
    } catch (error) {
      console.warn('[api] /account: Apple token revoke failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      return jsonResponse({ error: 'Apple token revocation failed' }, 503);
    }
  }

  // 4. Deleting the Auth user cascades to every table holding an
  //    ON DELETE CASCADE FK to auth.users: dreams (20251222115718_remote_schema.sql),
  //    dream_chat_turns / dream_chat_messages (20260722134500), ai_jobs (20260316120000),
  //    dream_sync_receipts (20260316130000), subscription_state / subscription_events
  //    (20260316140000) and device_account_links (20260722151231).
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
