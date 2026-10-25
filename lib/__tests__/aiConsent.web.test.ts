/** @jest-environment jsdom */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AI_CONSENT_STORAGE_KEY, hasAiConsent, registerAiConsentPromptHandler,
  requestAiConsent, resetAiConsentCacheForTests, subscribeAiConsent, withdrawAiConsent,
} from '@/lib/aiConsent';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const externalDecision = (newValue: string | null, key: string | null = AI_CONSENT_STORAGE_KEY) => {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: window.localStorage }));
};

beforeEach(async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  resetAiConsentCacheForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => { resetAiConsentCacheForTests(); jest.restoreAllMocks(); });

it('applies another tab withdrawal and grant to the cached permission and setting', async () => {
  await AsyncStorage.setItem(AI_CONSENT_STORAGE_KEY, 'granted');
  expect(await hasAiConsent()).toBe(true);
  const changed = jest.fn();
  subscribeAiConsent(changed);
  externalDecision(null, 'unrelated');
  expect(await hasAiConsent()).toBe(true);
  externalDecision(null);
  expect(await hasAiConsent()).toBe(false);
  externalDecision('granted');
  expect(await hasAiConsent()).toBe(true);
  externalDecision(null, null); // localStorage.clear() in another tab
  expect(await hasAiConsent()).toBe(false);
  expect(changed).toHaveBeenCalledTimes(3);
  // Applying an external decision must not echo a write back to other tabs.
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

it('a cross-tab withdrawal wins over a pending prompt without changing local write order', async () => {
  let answer!: (value: boolean) => void;
  const unregister = registerAiConsentPromptHandler({ show: () => new Promise(resolve => { answer = resolve; }) });
  const request = requestAiConsent(key => key);
  await new Promise(resolve => setTimeout(resolve, 0));
  externalDecision(null);
  answer(true);
  expect(await request).toBe(false);
  expect(await hasAiConsent()).toBe(false);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  unregister();
  const accept = registerAiConsentPromptHandler({ show: async () => true });
  expect(await requestAiConsent(key => key)).toBe(true);
  await withdrawAiConsent();
  expect(await AsyncStorage.getItem(AI_CONSENT_STORAGE_KEY)).toBeNull();
  accept();
});

it('does not subscribe to web storage events on native platforms', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await AsyncStorage.setItem(AI_CONSENT_STORAGE_KEY, 'granted');
  expect(await hasAiConsent()).toBe(true);
  externalDecision(null);
  expect(await hasAiConsent()).toBe(true);
});
