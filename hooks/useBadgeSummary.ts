import { useMemo } from 'react';

import { BADGE_FAMILIES, type BadgeFamilyId, type BadgeTierLevel } from '@/lib/badges/catalog';
import { useBadgeLedger } from '@/services/badgeLedgerStore';

/**
 * The cards held and those waiting to be turned over, from the ledger alone: cheap enough
 * for a door to the collection on a screen that stays mounted. A guest holds none: what it
 * did already reaches the cards waiting for its account.
 */
export function useBadgeSummary(): BadgeSummary {
  const { scope, ledger, ready } = useBadgeLedger();
  const guest = scope === 'guest';
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
    if (guest) {
      return { earnedCards: 0, unrevealedCards: 0, waitingCards: earnedCards, featured: { id: BADGE_FAMILIES[0].id, tier: 0 }, guest, ready };
    }
    return { earnedCards, unrevealedCards, waitingCards: 0, featured, guest, ready };
  }, [guest, ledger, ready]);
}

export type BadgeSummary = {
  earnedCards: number;
  unrevealedCards: number;
  /** A guest's cards, given to its account as soon as it opens; 0 once signed in. */
  waitingCards: number;
  guest: boolean;
  featured: { id: BadgeFamilyId; tier: BadgeTierLevel };
  ready: boolean;
};
