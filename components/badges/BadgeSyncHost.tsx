import { addNetworkStateListener } from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { isMockModeEnabled } from '@/lib/env';
import { getBadgeLedgerSnapshot, mergeRemoteBadgeLedger, useBadgeLedger } from '@/services/badgeLedgerStore';
import { setBadgeSyncStatus } from '@/services/badgeSyncStatus';
import { synchronizeBadgeLedger } from '@/services/badgeLedgerSync';

/** One account-bound worker; local changes, foreground and connectivity all retry safely. */
export function BadgeSyncHost() {
  const { user, loading } = useAuth();
  const { scope, ready, ledger } = useBadgeLedger();

  useEffect(() => {
    if (isMockModeEnabled() || loading || !user?.id || !ready || scope !== `user:${user.id}`) return;
    setBadgeSyncStatus(user.id, 'pending');
    let cancelled = false;
    let running = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const expectedScope = scope;
    const current = () => !cancelled && getBadgeLedgerSnapshot().scope === expectedScope;
    const run = async () => {
      if (!current() || running || AppState.currentState === 'background') return;
      running = true;
      try {
        const merged = await synchronizeBadgeLedger(user.id, getBadgeLedgerSnapshot().ledger, undefined, current);
        if (merged && current()) {
          mergeRemoteBadgeLedger(expectedScope, merged);
          setBadgeSyncStatus(user.id, 'synced');
        }
      } catch {
        // Local progress stays available, including when the migration is not deployed yet.
        if (current()) setBadgeSyncStatus(user.id, 'unavailable');
      } finally {
        running = false;
        if (current()) retry = setTimeout(() => { void run(); }, 30_000);
      }
    };
    const start = setTimeout(() => { void run(); }, 1_500);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') { clearTimeout(retry); void run(); }
    });
    const network = addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) { clearTimeout(retry); void run(); }
    });
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(retry);
      foreground.remove();
      network.remove();
    };
  }, [user?.id, loading, scope, ready, ledger]);
  return null;
}
