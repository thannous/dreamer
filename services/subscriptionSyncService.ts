import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

export type SubscriptionSyncResponse = {
  ok: boolean;
  tier: 'free' | 'plus';
  isActive: boolean;
  version: number;
  updated?: boolean;
  skipped?: boolean;
  changed: boolean;
  outcome?: string;
  sourceUpdatedAt?: string | null;
  requestedSource?: string;
};

export async function syncSubscriptionFromServer(source: string = 'app_launch'): Promise<SubscriptionSyncResponse> {
  const base = getApiBaseUrl();
  return fetchJSON<SubscriptionSyncResponse>(`${base}/subscription/refresh`, {
    method: 'POST',
    body: { source },
    ...NETWORK_REQUEST_POLICIES.subscriptionRefresh,
  });
}
