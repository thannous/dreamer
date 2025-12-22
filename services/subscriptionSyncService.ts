import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';

export type SubscriptionSyncResponse = {
  ok: boolean;
  tier?: 'free' | 'plus';
  updated?: boolean;
  skipped?: boolean;
  currentTier?: 'free' | 'plus';
};

export async function syncSubscriptionFromServer(source: string = 'app_launch'): Promise<SubscriptionSyncResponse> {
  const base = getApiBaseUrl();
  return fetchJSON<SubscriptionSyncResponse>(`${base}/subscription/sync`, {
    method: 'POST',
    body: { source },
    timeoutMs: 10000,
    retries: 1,
  });
}
