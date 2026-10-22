import { useDeferredValue, useMemo } from 'react';

import { useDreamsData } from '@/context/DreamsContext';
import { buildBadgeCollection, computeBadgeProgress, type BadgeCollection } from '@/lib/badges/ledger';
import { useBadgeLedger } from '@/services/badgeLedgerStore';

/** The whole collection, with each family's progress read from the journal as it is now. */
export function useBadgeCollection(): { collection: BadgeCollection; ready: boolean } {
  const { dreams, loaded } = useDreamsData();
  const { ledger, ready } = useBadgeLedger();
  // A large journal is read again after a save without holding up the tap that caused it.
  const deferredDreams = useDeferredValue(dreams);
  const progress = useMemo(() => computeBadgeProgress(ledger, deferredDreams), [deferredDreams, ledger]);
  const collection = useMemo(() => buildBadgeCollection(ledger, progress), [ledger, progress]);
  return { collection, ready: ready && loaded };
}
