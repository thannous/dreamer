import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useSyncExternalStore } from 'react';

// Mounted media share one native listener. Only connectivity changes invalidate them.
let online = true;
let subscription: ReturnType<typeof addNetworkStateListener> | undefined;
let generation = 0;
const listeners = new Set<() => void>();

function publish(state: NetworkState) {
  const next = state.isInternetReachable ?? state.isConnected ?? true;
  if (next === online) return;
  online = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    const current = ++generation;
    let receivedEvent = false;
    subscription = addNetworkStateListener(state => {
      if (generation !== current) return;
      receivedEvent = true;
      publish(state);
    });
    void getNetworkStateAsync().then(state => {
      // An initial async read must not overwrite a newer event or a remounted store.
      if (generation === current && !receivedEvent) publish(state);
    }).catch(() => { /* Retain last known connectivity if the native read fails. */ });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      generation++;
      subscription?.remove();
      subscription = undefined;
    }
  };
}

const getSnapshot = () => online;
const getServerSnapshot = () => true;

export function useNetworkOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
