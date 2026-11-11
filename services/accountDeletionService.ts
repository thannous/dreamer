import { forgetGuideReading } from '@/services/guideReadingStore';
import { forgetBadgeLedger } from '@/services/badgeLedgerStore';
import { forgetCaptureQuestion } from '@/services/captureQuestionStore';
import { toAccountScope } from '@/lib/accountScope';
import { requestAppleAuthorizationCode, signOut } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import { notificationDreamScope } from '@/lib/notificationDreamCapture';
import { forgetNotificationDreams } from '@/services/notificationDreamInbox';
import { removeAllForAccount as forgetDreamRecallDrafts } from '@/services/dreamRecallAssistantStorage';
import { clearRemoteDreamStorage, clearSavedTranscript } from '@/services/storageService';

export type AccountDeletionResponse = {
  deleted: boolean;
};

/** The server's answer for an Apple account whose sign-in token was never kept. */
const APPLE_AUTHORIZATION_REQUIRED = 'apple_authorization_required';

function deleteAccount(body?: { appleAuthorizationCode: string }): Promise<AccountDeletionResponse> {
  return fetchJSON<AccountDeletionResponse>(`${getApiBaseUrl()}/account`, {
    method: 'DELETE',
    ...(body ? { body } : {}),
    ...NETWORK_REQUEST_POLICIES.accountDeletion,
  });
}

/**
 * Asks the backend to permanently delete the authenticated account and all
 * associated personal data (dreams, chat history, quota usage, generated
 * images, subscription state). fetchJSON attaches the current session token;
 * the backend identifies the user from the JWT only.
 *
 * Apple requires the account's Sign in with Apple token to be revoked. When the
 * server kept none at sign-in, Apple is asked once more on this iPhone and the
 * server revokes the token from that fresh authorization before deleting.
 */
export async function requestAccountDeletion(): Promise<AccountDeletionResponse> {
  try {
    return await deleteAccount();
  } catch (error) {
    // fetchJSON's HttpError keeps the parsed answer in `body`.
    if ((error as { body?: { code?: unknown } } | null)?.body?.code !== APPLE_AUTHORIZATION_REQUIRED) throw error;
    const authorizationCode = await requestAppleAuthorizationCode();
    if (!authorizationCode) throw error;
    return deleteAccount({ appleAuthorizationCode: authorizationCode });
  }
}

/**
 * Local cleanup after a confirmed server-side deletion: drops cached dreams
 * and dreams dictated from a reminder that were still waiting on the device,
 * then signs the device out (AuthContext then routes back to the auth screen).
 * Cache clearing is best-effort; sign-out failures still surface.
 */
export async function finalizeAccountDeletion(deletedUserId: string): Promise<void> {
  try {
    // The cache, its checkpoint and the unsent queue are keyed per account:
    // without the scope only the legacy unscoped keys would be cleared.
    await clearRemoteDreamStorage(toAccountScope(deletedUserId));
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
  try {
    await forgetGuideReading(deletedUserId);
  } catch {
    // Like the other caches, this remains scoped to the deleted account.
  }
  try {
    // The unsaved capture draft holds the whole dream and the questions asked about it.
    await clearSavedTranscript(toAccountScope(deletedUserId));
  } catch {
    // Like the other caches, this remains scoped to the deleted account.
  }
  try {
    // The last capture question can quote the dream it was asked about.
    await forgetCaptureQuestion(toAccountScope(deletedUserId));
  } catch {
    // Like the other caches, this remains scoped to the deleted account.
  }
  try {
    // Each recall draft keeps a dream's transcript with its questions and answers.
    await forgetDreamRecallDrafts(deletedUserId);
  } catch {
    // Like the other caches, this remains scoped to the deleted account.
  }
  await signOut();
}
