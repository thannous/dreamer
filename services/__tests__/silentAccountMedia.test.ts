import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchJSON } from '@/lib/http';
import { adoptSilentAccountGuestImages } from '@/services/silentAccountMedia';

jest.mock('@/lib/auth', () => ({ getAccessToken: jest.fn(async () => 'signed-in-user') }));
jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => 'http://localhost/api' }));
jest.mock('@/lib/guestSession', () => ({
  backendStorageKey: (base: string) => base,
  getGuestHeaders: jest.fn(async () => ({
    'x-guest-token': 'guest-device-proof',
    'x-guest-fingerprint': 'guest-device',
  })),
}));
jest.mock('@/lib/http', () => ({ fetchJSON: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { storage.set(key, value); }),
  };
});

it('retries adoption after the same account links an email, without switching the retry to another account', async () => {
  jest.mocked(fetchJSON).mockRejectedValueOnce(new Error('Temporary outage'));

  await expect(adoptSilentAccountGuestImages('original', true, () => true)).rejects.toThrow('Temporary outage');
  expect(await AsyncStorage.getItem('guest-images-adopted.original')).toBe('pending');
  await adoptSilentAccountGuestImages('another', false, () => true);
  expect(fetchJSON).toHaveBeenCalledTimes(1);

  await adoptSilentAccountGuestImages('original', false, () => true);
  expect(fetchJSON).toHaveBeenCalledTimes(2);
  expect(await AsyncStorage.getItem('guest-images-adopted.original')).toBe('1');
});
