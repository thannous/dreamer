import { useMemo } from 'react';

import { BADGE_FAMILIES, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';
import { useBadgeLedger } from '@/services/badgeLedgerStore';

/**
 * The cards held and those waiting to be turned over, from the ledger alone: cheap enough
 * for a door to the collection on a screen that stays mounted.
 */
export function useBadgeSummary(): BadgeSummary {
  const { ledger, ready } = useBadgeLedger();
  return useMemo(() => {
    let earnedCards = 0;
    let unrevealedCards = 0;
    let featured: BadgeSummary['featured'] = { id: BADGE_FAMILIES[0].id, tier: 0 };
    let featuredAt = -Infinity;
    for (const family of BADGE_FAMILIES) {
      const stamps = ledger.earned[family.id] ?? [];
      const earned = stamps.length as BadgeTierLevel;
      earnedCards += earned;
      unrevealedCards += Math.max(0, earned - (ledger.revealed[family.id] ?? 0));
      // The card shown at the door: the one earned last, at its tier.
      const at = stamps[earned - 1];
      if (earned > 0 && at >= featuredAt) {
        featured = { id: family.id, tier: earned };
        featuredAt = at;
      }
    }
    return { earnedCards, unrevealedCards, featured, ready };
  }, [ledger, ready]);
}

export type BadgeSummary = {
  earnedCards: number;
  unrevealedCards: number;
  featured: { id: BadgeFamilyId; tier: BadgeTierLevel };
  ready: boolean;
};
