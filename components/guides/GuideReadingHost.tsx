import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { toAccountScope } from '@/lib/accountScope';
import type { GuideReadingScope } from '@/lib/guideReading';
import { recordBadgeEvent, useBadgeLedger } from '@/services/badgeLedgerStore';
import { activateGuideReadingScope, suspendGuideReadingScope, syncGuideReading, useGuideReadingSnapshot } from '@/services/guideReadingStore';

/** Follows authentication even while no guide screen is mounted. */
export function GuideReadingHost() {
  const { user, loading } = useAuth();
  const scope: GuideReadingScope = toAccountScope(user?.id);
  const previousScope = useRef<GuideReadingScope | null>(null);
  const reading = useGuideReadingSnapshot();
  const badges = useBadgeLedger();
  useEffect(() => {
    if (loading) { suspendGuideReadingScope(); return; }
    const transferGuest = previousScope.current === 'guest' && scope !== 'guest';
    previousScope.current = scope;
    void activateGuideReadingScope(scope, { transferGuest }).then(() => syncGuideReading(scope));
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active') void syncGuideReading(scope);
    });
    return () => listener.remove();
  }, [loading, scope]);
  useEffect(() => {
    if (loading || !reading.ready || reading.scope !== scope || !badges.ready || badges.scope !== scope) return;
    // Restored explicit completions count too. Historical badge events never imply a completed guide.
    for (const [guideId, entry] of Object.entries(reading.entries)) {
      if (entry?.completedAt) recordBadgeEvent({ type: 'guide_completed', guideId });
    }
  }, [badges.ready, badges.scope, loading, reading.entries, reading.ready, reading.scope, scope]);
  return null;
}
