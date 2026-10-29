import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasAiConsent, registerAiConsentPromptHandler, requestAiConsent, resetAiConsentCacheForTests, withdrawAiConsent,
} from '@/lib/aiConsent';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const t = (key: string) => key;
type Button = { text?: string; onPress?: () => void };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function answer(index: number) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as Button[];
  buttons[index]?.onPress?.();
}

describe('requestAiConsent', () => {
  beforeEach(async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    resetAiConsentCacheForTests();
    await AsyncStorage.clear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('withholds silent background work until permission is given', async () => {
    await expect(hasAiConsent()).resolves.toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('asks again a user who accepted the earlier text that named no provider', async () => {
    await AsyncStorage.setItem('noctalia.aiConsent.v1', 'granted');
    await expect(hasAiConsent()).resolves.toBe(false);
    const attempt = requestAiConsent(t);
    await flush();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    answer(0);
    await attempt;
  });

  it('never asks again a user who accepted the text naming the providers', async () => {
    await AsyncStorage.setItem('noctalia.aiConsent.v2', 'granted');
    await expect(hasAiConsent()).resolves.toBe(true);
    await expect(requestAiConsent(t)).resolves.toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does not send a dream before permission', async () => {
    const sendDream = jest.fn();
    const attempt = requestAiConsent(t).then((accepted) => {
      if (accepted) sendDream();
    });
    await flush();
    expect(sendDream).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    answer(0);
    await attempt;
    expect(sendDream).not.toHaveBeenCalled();
  });

  it('does not grant when the user declines, and asks again next time', async () => {
    const first = requestAiConsent(t);
    await flush();
    answer(0);
    await expect(first).resolves.toBe(false);

    const second = requestAiConsent(t);
    await flush();
    expect(Alert.alert).toHaveBeenCalledTimes(2);
    answer(0);
    await second;
  });

  it('asks once: concurrent requests share one prompt and later ones pass silently', async () => {
    const a = requestAiConsent(t);
    const b = requestAiConsent(t);
    await flush();
    answer(1);
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(Alert.alert).toHaveBeenCalledTimes(1);

    resetAiConsentCacheForTests();
    await expect(requestAiConsent(t)).resolves.toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it('stays withdrawn after a restart even when withdrawn right after accepting', async () => {
    const attempt = requestAiConsent(t);
    await flush();
    answer(1);
    await expect(attempt).resolves.toBe(true);
    // The grant's write may still be pending: the withdrawal must land after it.
    await withdrawAiConsent();
    await expect(hasAiConsent()).resolves.toBe(false);
    resetAiConsentCacheForTests();
    await expect(hasAiConsent()).resolves.toBe(false);
    await expect(AsyncStorage.getItem('noctalia.aiConsent.v2')).resolves.toBeNull();
  });

  it('grants nothing from a prompt answered after consent was withdrawn', async () => {
    const attempt = requestAiConsent(t);
    await flush();
    await withdrawAiConsent();
    answer(1);
    await expect(attempt).resolves.toBe(false);
    await expect(hasAiConsent()).resolves.toBe(false);
    await expect(AsyncStorage.getItem('noctalia.aiConsent.v2')).resolves.toBeNull();
  });
});

// Android needs no separate AI disclosure since 2026-10-29; iOS and the web keep the prompt.
describe('requestAiConsent on Android', () => {
  const os = Platform.OS;
  beforeEach(async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    resetAiConsentCacheForTests();
    await AsyncStorage.clear();
    Platform.OS = 'android';
  });

  afterEach(() => {
    Platform.OS = os;
    jest.restoreAllMocks();
  });

  it('grants and remembers the AI action without showing any prompt', async () => {
    const show = jest.fn(async () => false);
    const unregister = registerAiConsentPromptHandler({ show });
    await expect(requestAiConsent(t)).resolves.toBe(true);
    unregister();
    expect(show).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    await expect(AsyncStorage.getItem('noctalia.aiConsent.v2')).resolves.toBe('granted');
  });

  it('asks again after a withdrawal in Settings, so no automatic step turns AI back on', async () => {
    await requestAiConsent(t);
    await withdrawAiConsent();
    await expect(hasAiConsent()).resolves.toBe(false);
    const attempt = requestAiConsent(t);
    await flush();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    answer(0);
    await expect(attempt).resolves.toBe(false);
    await expect(hasAiConsent()).resolves.toBe(false);
  });

  it('remembers the withdrawal across launches until the user accepts again', async () => {
    await requestAiConsent(t);
    await withdrawAiConsent();
    resetAiConsentCacheForTests();
    const attempt = requestAiConsent(t);
    await flush();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    answer(1);
    await expect(attempt).resolves.toBe(true);
    // Accepted again: the next action grants without a prompt.
    resetAiConsentCacheForTests();
    await expect(requestAiConsent(t)).resolves.toBe(true);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });
});
