import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import type { GuideReadingScope } from '@/lib/guideReading';
import { activateGuideReadingScope, syncGuideReading, suspendGuideReadingScope, useGuideReadingSnapshot } from '@/services/guideReadingStore';
import { recordBadgeEvent, useBadgeLedger } from '@/services/badgeLedgerStore';

export function useGuideReading() {
  const { user, loading } = useAuth();
  const scope: GuideReadingScope = user?.id ? `user:${user.id}` : 'guest';
  const state = useGuideReadingSnapshot();
  const badges = useBadgeLedger();
  useEffect(() => {
    if (loading) suspendGuideReadingScope();
    else void activateGuideReadingScope(scope);
  }, [loading, scope]);
  useFocusEffect(useCallback(() => {
    if (loading) return;
    void activateGuideReadingScope(scope).then(() => syncGuideReading(scope));
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active') void syncGuideReading(scope);
    });
    return () => { listener.remove(); void syncGuideReading(scope); };
  }, [loading, scope]));
  const ready = !loading && state.scope === scope && state.ready;
  useEffect(() => {
    if (!ready || !badges.ready || badges.scope !== scope) return;
    // Existing awards are untouched. Only explicit completions (including restored ones) produce new events.
    for (const [guideId, entry] of Object.entries(state.entries)) {
      if (entry?.completedAt) recordBadgeEvent({ type: 'guide_viewed', guideId });
    }
  }, [badges.ready, badges.scope, ready, scope, state.entries]);
  return { ...state, scope, ready, entries: ready ? state.entries : {} };
}
