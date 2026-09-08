/** @jest-environment jsdom */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { resolveDreamMedia } from '@/services/dreamMediaService';
import { useDreamMedia } from '../useDreamMedia';
import type { DreamAnalysis } from '@/lib/types';

jest.mock('@/context/AuthContext', () => ({ AuthContext: require('react').createContext(null) }));
jest.mock('@/services/dreamMediaService', () => ({ resolveDreamMedia: jest.fn(), getDirectDreamMediaUrl: () => undefined }));
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));
const resolve = jest.mocked(resolveDreamMedia);
const pending = () => {
  let finish!: (value: any) => void;
  const promise = new Promise<any>(r => { finish = r; });
  return { promise, finish };
};
const result = (imageUrl: string) => ({ imageUrl, imageStatus: 'ready', thumbnailStatus: 'missing' });
const dream = (imageUrl: string) => ({ id: 1, imageUrl }) as DreamAnalysis;
let userId = 'A';
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthContext.Provider value={{ user: { id: userId } } as any}>{children}</AuthContext.Provider>
);
beforeEach(() => { resolve.mockReset(); userId = 'A'; mockNetwork.isInternetReachable = true; });
it('keeps unresolved media empty and ignores the previous account response', async () => {
  const a = pending(); const b = pending();
  resolve.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { result: state, rerender } = renderHook(() => useDreamMedia(dream('supabase-storage://dream-images/A/image')), { wrapper });
  expect(state.current.loading).toBe(true);
  expect(state.current.imageUrl).toBe('');
  userId = 'B'; rerender();
  await act(async () => a.finish(result('https://signed/A')));
  expect(state.current.imageUrl).toBe('');
  await act(async () => b.finish(result('https://signed/B')));
  expect(state.current.imageUrl).toBe('https://signed/B');
});
it('hides already resolved media immediately after replacement and ignores obsolete requests', async () => {
  const a = pending(); const b = pending();
  resolve.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { result: state, rerender } = renderHook(({ source }) => useDreamMedia(dream(source)), { wrapper, initialProps: { source: 'old' } });
  await act(async () => a.finish(result('https://signed/old')));
  expect(state.current.imageUrl).toBe('https://signed/old');
  rerender({ source: 'new' });
  expect(state.current.imageUrl).toBe('');
  await act(async () => b.finish(result('https://signed/new')));
  expect(state.current.imageUrl).toBe('https://signed/new');
});
it('reports resource failure without throwing into the journal', async () => {
  resolve.mockRejectedValue(new Error('offline'));
  const { result: state } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
  await act(async () => {});
  expect(state.current.error).toBe(true);
  expect(state.current.loading).toBe(false);
  expect(state.current.imageUrl).toBe('');
});

it('ignores a late request for an image replaced before resolution', async () => {
  const old = pending(); const replacement = pending();
  resolve.mockReturnValueOnce(old.promise).mockReturnValueOnce(replacement.promise);
  const { result: state, rerender } = renderHook(({ source }) => useDreamMedia(dream(source)), { wrapper, initialProps: { source: 'old' } });
  rerender({ source: 'replacement' });
  await act(async () => replacement.finish(result('https://signed/replacement')));
  await act(async () => old.finish(result('https://signed/old')));
  expect(state.current.imageUrl).toBe('https://signed/replacement');
});

it('renews a mounted private URL at its cache expiry and hides the expired source', async () => {
  jest.useFakeTimers();
  try {
    const renewal = pending();
    resolve.mockResolvedValueOnce({ ...result('https://signed/old'), expiresAt: Date.now() + 100 } as any)
      .mockReturnValueOnce(renewal.promise);
    const { result: state, unmount } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
    await act(async () => {});
    expect(state.current.imageUrl).toBe('https://signed/old');
    await act(async () => { jest.advanceTimersByTime(101); });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(state.current.imageUrl).toBe('');
    await act(async () => renewal.finish(result('https://signed/new')));
    expect(state.current.imageUrl).toBe('https://signed/new');
    unmount();
  } finally { jest.useRealTimers(); }
});

it('retries the same media identity when connectivity returns', async () => {
  resolve.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result('https://signed/recovered') as any);
  const { result: state, rerender } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
  await act(async () => {});
  expect(state.current.error).toBe(true);
  mockNetwork.isInternetReachable = false; rerender();
  expect(resolve).toHaveBeenCalledTimes(1);
  mockNetwork.isInternetReachable = true; rerender();
  await act(async () => {});
  expect(state.current.imageUrl).toBe('https://signed/recovered');
  expect(resolve).toHaveBeenCalledTimes(2);
});

it('hides an expired private URL offline without starting a network request', async () => {
  jest.useFakeTimers();
  try {
    resolve.mockResolvedValueOnce({ ...result('https://signed/old'), expiresAt: Date.now() + 100 } as any);
    const { result: state, rerender, unmount } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
    await act(async () => {});
    mockNetwork.isInternetReachable = false; rerender();
    await act(async () => { jest.advanceTimersByTime(101); });
    expect(state.current.imageUrl).toBe('');
    expect(resolve).toHaveBeenCalledTimes(1);
    unmount();
  } finally { jest.useRealTimers(); }
});


it('recovers a transient online signing failure with bounded backoff', async () => {
  jest.useFakeTimers();
  try {
    resolve.mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(result('https://signed/recovered') as any);
    const { result: state, unmount } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(state.current.imageUrl).toBe('https://signed/recovered');
    expect(resolve).toHaveBeenCalledTimes(2);
    unmount();
  } finally { jest.useRealTimers(); }
});

it('stops after two automatic retries and permits an explicit retry', async () => {
  jest.useFakeTimers();
  try {
    resolve.mockRejectedValue(new Error('temporary'));
    const { result: state, unmount } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(1000); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(resolve).toHaveBeenCalledTimes(3);
    resolve.mockResolvedValue(result('https://signed/recovered') as any);
    await act(async () => { state.current.retry(); });
    expect(state.current.imageUrl).toBe('https://signed/recovered');
    unmount();
  } finally { jest.useRealTimers(); }
});

it('cancels scheduled retries when offline or unmounted', async () => {
  jest.useFakeTimers();
  try {
    resolve.mockRejectedValue(new Error('temporary'));
    const { rerender, unmount } = renderHook(() => useDreamMedia(dream('private')), { wrapper });
    await act(async () => {});
    mockNetwork.isInternetReachable = false; rerender();
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(resolve).toHaveBeenCalledTimes(1);
    mockNetwork.isInternetReachable = true; rerender();
    await act(async () => {});
    unmount();
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(resolve).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});


it('does not overflow a long guest expiry timer or hide unexpired media offline', async () => {
  jest.useFakeTimers();
  try {
    resolve.mockResolvedValueOnce({ ...result('https://signed/guest'), expiresAt: Date.now() + 365 * 86400000 } as any);
    const { result: state, rerender, unmount } = renderHook(() => useDreamMedia(dream('guest')), { wrapper });
    await act(async () => {});
    mockNetwork.isInternetReachable = false; rerender();
    await act(async () => { jest.advanceTimersByTime(2_147_483_648); });
    expect(state.current.imageUrl).toBe('https://signed/guest');
    expect(resolve).toHaveBeenCalledTimes(1);
    unmount();
  } finally { jest.useRealTimers(); }
});
