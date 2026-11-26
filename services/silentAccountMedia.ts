import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { backendStorageKey, getGuestHeaders } from '@/lib/guestSession';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

const inFlight = new Map<string, Promise<void>>();

/** A failed adoption is retried when this silent account returns to the foreground. */
export function adoptSilentAccountGuestImages(userId: string, isCurrent: () => boolean): Promise<void> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const run = (async () => {
    const storageKey = backendStorageKey('guest-images-adopted.' + userId);
    if (await AsyncStorage.getItem(storageKey) || !isCurrent()) return;
    const headers = await getGuestHeaders({ forImageAdoption: true });
    const fingerprint = headers['x-guest-fingerprint'];
    const token = await getAccessToken();
    if (!headers['x-guest-token'] || !fingerprint || !token || !isCurrent()) return;
    await fetchJSON(getApiBaseUrl() + '/auth/adopt-guest-images', {
      method: 'POST',
      headers: { ...headers, Authorization: 'Bearer ' + token },
      body: { fingerprint },
      ...NETWORK_REQUEST_POLICIES.authMarkUpgrade,
      idempotent: true,
    });
    await AsyncStorage.setItem(storageKey, '1');
  })().finally(() => inFlight.delete(userId));
  inFlight.set(userId, run);
  return run;
}
