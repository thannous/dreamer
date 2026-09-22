/** @jest-environment jsdom */
import React from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useNetworkOnline } from '../useNetworkOnline';

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(), getNetworkStateAsync: jest.fn() }));
const addListener = jest.mocked(addNetworkStateListener);
const read = jest.mocked(getNetworkStateAsync);
let emit: (state: NetworkState) => void;
let finishRead: (state: NetworkState) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  addListener.mockImplementation(listener => {
    emit = listener;
    return { remove };
  });
  read.mockImplementation(() => new Promise(resolve => { finishRead = resolve; }));
});

it('shares a native subscription across mounted consumers and removes it after the last unmount', async () => {
  function Consumer() { useNetworkOnline(); return null; }
  const view = render(<>{Array.from({ length: 30 }, (_, i) => <Consumer key={i} />)}</>);
  await act(async () => finishRead({ isConnected: true }));
  expect(addListener).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  view.rerender(<><Consumer key={0} /></>);
  expect(remove).not.toHaveBeenCalled();
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

it('updates offline and reconnect states without rerendering for equivalent network events', async () => {
  let renders = 0;
  const hook = renderHook(() => { renders++; return useNetworkOnline(); });
  await act(async () => finishRead({ isConnected: true, isInternetReachable: true }));
  const before = renders;
  act(() => emit({ isConnected: true, isInternetReachable: true }));
  expect(renders).toBe(before);
  act(() => emit({ isConnected: true, isInternetReachable: false }));
  expect(hook.result.current).toBe(false);
  act(() => emit({ isConnected: true }));
  expect(hook.result.current).toBe(true);
  hook.unmount();
});

it('ignores a stale initial read after a more recent native event', async () => {
  const hook = renderHook(() => useNetworkOnline());
  act(() => emit({ isInternetReachable: false }));
  await act(async () => finishRead({ isInternetReachable: true }));
  expect(hook.result.current).toBe(false);
  hook.unmount();
});

it('ignores events and reads from a previous subscription after remounting', async () => {
  const first = renderHook(() => useNetworkOnline());
  const oldEmit = emit;
  const oldRead = finishRead;
  first.unmount();
  const second = renderHook(() => useNetworkOnline());
  await act(async () => finishRead({ isConnected: false }));
  await act(async () => { oldEmit({ isConnected: true }); oldRead({ isConnected: true }); });
  expect(second.result.current).toBe(false);
  second.unmount();
  expect(remove).toHaveBeenCalledTimes(2);
});

it('keeps native events working when the initial read fails', async () => {
  read.mockRejectedValueOnce(new Error('Unavailable'));
  const hook = renderHook(() => useNetworkOnline());
  await act(async () => {});
  act(() => emit({ isConnected: true }));
  expect(hook.result.current).toBe(true);
  hook.unmount();
});
