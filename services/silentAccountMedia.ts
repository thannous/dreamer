import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAccessToken } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/config';
import { backendStorageKey, getGuestHeaders } from '@/lib/guestSession';
import { fetchJSON } from '@/lib/http';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';

const inFlight = new Map<string, Promise<void>>();

/** A failed adoption is retried for the same account, including after it adds a login. */
export function adoptSilentAccountGuestImages(userId: string, silentAccount: boolean, isCurrent: () => boolean): Promise<void> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const run = (async () => {
    const storageKey = backendStorageKey('guest-images-adopted.' + userId);
    const state = await AsyncStorage.getItem(storageKey);
    if (!isCurrent() || state === '1' || (!silentAccount && state !== 'pending')) return;
    // The UUID survives adding a login. Save the retry before obtaining proof or calling the API.
    if (state !== 'pending') await AsyncStorage.setItem(storageKey, 'pending');
    if (!isCurrent()) return;
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
