/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, jest } from '@jest/globals';

import { getSignatureSoundsEnabled } from '@/services/signatureSounds';
import { useSignatureSoundsPreference } from '../useSignatureSoundsPreference';

// The switch and the cues follow one choice. When flips cannot be stored, both go back to
// what storage still holds, not to a choice that failed too. The cases run in order on one
// launch, each starting from what the last one stored.

const mockStore = new Map<string, string>();
let mockWriteFails = false;
jest.mock('@/services/lucidKeyValueStorage', () => ({
  getLucidKeyValueStorage: () => ({
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (mockWriteFails) throw new Error('storage full');
      mockStore.set(key, value);
    },
  }),
}));
jest.mock('expo-haptics', () => ({}));
jest.mock('@/services/nativeSpeechRecognition', () => ({ isSpeechRecognitionIdle: async () => true }));

const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

beforeEach(() => {
  mockWriteFails = false;
});

it('shows what storage still holds when two flips in a row cannot be stored', async () => {
  const { result } = renderHook(() => useSignatureSoundsPreference());
  await settle();
  expect(result.current.enabled).toBe(true);

  mockWriteFails = true;
  act(() => {
    result.current.toggle(false);
    result.current.toggle(true);
  });
  await settle();
  await settle();

  expect(result.current.enabled).toBe(true);
  expect(await getSignatureSoundsEnabled()).toBe(true);
});

it('keeps the flip that was stored when a later one fails', async () => {
  const { result } = renderHook(() => useSignatureSoundsPreference());
  await settle();

  act(() => result.current.toggle(false));
  await settle();
  mockWriteFails = true;
  act(() => result.current.toggle(true));
  await settle();
  await settle();

  expect(result.current.enabled).toBe(false);
  expect(await getSignatureSoundsEnabled()).toBe(false);
});
