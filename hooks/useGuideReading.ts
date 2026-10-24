import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import type { GuideReadingScope } from '@/lib/guideReading';
import { syncGuideReading, useGuideReadingSnapshot } from '@/services/guideReadingStore';

/** Screens observe the permanent host's account scope; they do not own authentication. */
export function useGuideReading() {
  const { user, loading } = useAuth();
  const scope: GuideReadingScope = user?.id ? `user:${user.id}` : 'guest';
  const state = useGuideReadingSnapshot();
  const ready = !loading && state.scope === scope && state.ready;
  useFocusEffect(useCallback(() => {
    if (!ready) return;
    void syncGuideReading(scope);
    return () => { void syncGuideReading(scope); };
  }, [ready, scope]));
  return { ...state, scope, ready, entries: ready ? state.entries : {} };
}
