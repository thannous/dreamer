/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type Invocation = { id: string; name: string; params: Record<string, unknown>; createdAt: number };
type Handler = (pending: Invocation[], newIntent: Invocation | null) => Promise<void>;

let mockHandler: Handler | null = null;
const mockRemovePending = jest.fn();
const mockKeepDictatedDream = jest.fn();

jest.mock('expo-app-intents', () => ({
  useAppIntents: (handler: Handler) => {
    mockHandler = handler;
  },
  removePendingInvocationAsync: (id: string) => mockRemovePending(id),
}));

jest.mock('@/services/notificationDreamInbox', () => ({
  keepDictatedDream: (capture: unknown) => mockKeepDictatedDream(capture),
}));

const { useSiriDreamCapture } = require('../useSiriDreamCapture');

const dream = (id: string): Invocation => ({ id, name: 'noteDream', params: { text: 'A lighthouse' }, createdAt: 1 });

describe('useSiriDreamCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandler = null;
    mockRemovePending.mockResolvedValue(undefined);
  });

  it('leaves a dream in the Siri queue until it is stored on the device', async () => {
    mockKeepDictatedDream.mockRejectedValueOnce(new Error('storage full')).mockResolvedValueOnce(true);
    renderHook(() => useSiriDreamCapture());

    await mockHandler!([dream('retried'), dream('kept')], null);

    expect(mockKeepDictatedDream).toHaveBeenCalledTimes(2);
    expect(mockRemovePending.mock.calls).toEqual([['kept']]);
  });
});
