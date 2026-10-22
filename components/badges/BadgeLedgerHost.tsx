import { useEffect } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useDreamsData } from '@/context/DreamsContext';
import { scheduleIdleTask } from '@/lib/scheduleIdleTask';
import { activateBadgeScope, settleBadges, useBadgeLedger, type BadgeScope } from '@/services/badgeLedgerStore';

/** Lets a burst of sync updates land before the journal is read again. */
const SETTLE_DELAY_MS = 1200;

/**
 * Keeps the badge ledger on the dreamer's own scope and folds the journal into it in idle
 * time, so tiers the journal alone earns (dreams, days, favourites, images) are stamped
 * wherever they were earned, without the collection being open.
 */
export function BadgeLedgerHost() {
  const { user, loading } = useAuth();
  const { dreams, loaded } = useDreamsData();
  const { scope: activeScope, ready } = useBadgeLedger();
  const scope: BadgeScope = user?.id ? `user:${user.id}` : 'guest';

  useEffect(() => {
    if (!loading) void activateBadgeScope(scope);
  }, [loading, scope]);

  useEffect(() => {
    // A journal still loading, or one belonging to the previous account, is not read.
    if (loading || !loaded || !ready || activeScope !== scope) return;
    let idle: { cancel: () => void } | null = null;
    const timer = setTimeout(() => {
      idle = scheduleIdleTask(() => settleBadges(dreams));
    }, SETTLE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      idle?.cancel();
    };
  }, [activeScope, dreams, loaded, loading, ready, scope]);

  return null;
}
