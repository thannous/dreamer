import { useSyncExternalStore } from 'react';

import { isMockModeEnabled } from '@/lib/env';

export type BadgeSyncState = 'pending' | 'synced' | 'unavailable';
let status: { userId: string | null; state: BadgeSyncState } = { userId: null, state: 'pending' };
const listeners = new Set<() => void>();
export function setBadgeSyncStatus(userId: string, state: BadgeSyncState): void {
  if (status.userId === userId && status.state === state) return;
  status = { userId, state };
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => status;
export function useBadgeSyncStatus(userId: string | undefined): BadgeSyncState | 'local' {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return !userId || isMockModeEnabled() ? 'local' : value.userId === userId ? value.state : 'pending';
}
