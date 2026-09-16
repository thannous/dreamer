import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIllustrationResolution, saveIllustrationResolution } from '../illustrationPreferences';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const originalFlag = process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED;
beforeEach(async () => { process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED = 'true'; await AsyncStorage.clear(); });
afterAll(() => {
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED;
  else process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED = originalFlag;
});

it('ignores a saved HD choice while the feature is disabled without deleting it', async () => {
  await saveIllustrationResolution('a', '4K');
  delete process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED;
  expect(await getIllustrationResolution('a')).toBe('1K');
  process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED = 'false';
  expect(await getIllustrationResolution('a')).toBe('1K');
  process.env.EXPO_PUBLIC_HD_ILLUSTRATIONS_ENABLED = 'true';
  expect(await getIllustrationResolution('a')).toBe('4K');
});

it('defaults to standard and isolates the explicit choice by account', async () => {
  expect(await getIllustrationResolution()).toBe('1K');
  expect(await getIllustrationResolution('a')).toBe('1K');
  await saveIllustrationResolution('a', '4K');
  expect(await getIllustrationResolution('a')).toBe('4K');
  expect(await getIllustrationResolution('b')).toBe('1K');
  await saveIllustrationResolution('a', '1K');
  expect(await getIllustrationResolution('a')).toBe('1K');
});

it('falls back for malformed stored values but does not hide storage failures', async () => {
  await AsyncStorage.setItem('noctalia:illustration-resolution:a', '8K');
  expect(await getIllustrationResolution('a')).toBe('1K');
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage failure'));
  await expect(getIllustrationResolution('a')).rejects.toThrow('storage failure');
});
