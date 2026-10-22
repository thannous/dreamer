import { forgetBadgeLedger } from '@/services/badgeLedgerStore';
import { signOut } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import { notificationDreamScope } from '@/lib/notificationDreamCapture';
import { forgetNotificationDreams } from '@/services/notificationDreamInbox';
import { clearRemoteDreamStorage } from '@/services/storageService';

export type AccountDeletionResponse = {
  deleted: boolean;
};

/**
 * Asks the backend to permanently delete the authenticated account and all
 * associated personal data (dreams, chat history, quota usage, generated
 * images, subscription state). fetchJSON attaches the current session token;
 * the backend identifies the user from the JWT only.
 */
export async function requestAccountDeletion(): Promise<AccountDeletionResponse> {
  const base = getApiBaseUrl();
  return fetchJSON<AccountDeletionResponse>(`${base}/account`, {
    method: 'DELETE',
    ...NETWORK_REQUEST_POLICIES.accountDeletion,
  });
}

/**
 * Local cleanup after a confirmed server-side deletion: drops cached dreams
 * and dreams dictated from a reminder that were still waiting on the device,
 * then signs the device out (AuthContext then routes back to the auth screen).
 * Cache clearing is best-effort; sign-out failures still surface.
 */
export async function finalizeAccountDeletion(deletedUserId: string): Promise<void> {
  try {
    await clearRemoteDreamStorage();
  } catch {
    // Best-effort: the remote cache is keyed per user and becomes unreachable
    // once the session is gone.
  }
  try {
    // Auth may already be invalidated by the server-side deletion. Use the
    // identity captured by the caller before it submitted the request.
    await forgetNotificationDreams(notificationDreamScope(deletedUserId));
  } catch {
    // Best-effort: a waiting reply stays tied to the deleted account and is
    // never imported into another journal.
  }
  try {
    await forgetBadgeLedger(deletedUserId);
  } catch {
    // Account-scoped cache remains unreachable after sign-out; never transferred to a guest.
  }
  await signOut();
}
