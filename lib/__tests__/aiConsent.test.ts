import { Alert } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { requestAiConsent, resetAiConsentCacheForTests } from '@/lib/aiConsent';

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

  it('does not send a guest dream before permission', async () => {
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
});
