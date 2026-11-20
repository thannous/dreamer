import { getApiBaseUrl } from '@/lib/config';
import { isLocalDevelopmentBackend } from '@/lib/devLocalBackend';
import { assertGuestQaLocalStateReady, prepareGuestQaLocalState } from '@/lib/guestQaLocalState';
import { getGuestHeaders } from '@/lib/guestSession';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

/**
 * « Nouvel invité » on the local development backend: the server forgets what
 * this guest device used (analyses, exchanges, illustrations, AI windows), then
 * the device clears its own guest counters, session and onboarding. The guest
 * journal must already be empty, so no dream is lost (the QA passport's rule).
 */
export async function startNewLocalGuest(): Promise<void> {
  if (!isLocalDevelopmentBackend()) {
    throw new Error('The guest reset exists only on the local development backend');
  }
  await assertGuestQaLocalStateReady();
  const headers = await getGuestHeaders({ requireSession: true });
  await fetchJSON(`${getApiBaseUrl()}/dev-local/guest-reset`, {
    method: 'POST',
    headers,
    body: {},
    ...NETWORK_REQUEST_POLICIES.guestQaCommand,
  });
  await prepareGuestQaLocalState();
}
