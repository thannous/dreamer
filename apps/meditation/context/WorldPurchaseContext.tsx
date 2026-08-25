import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { WORLD_BY_ID, type WorldId } from '@/constants/worlds';
import * as purchases from '@/services/worldPurchaseService';

type WorldPurchaseContextValue = {
  loaded: boolean;
  offers: readonly purchases.WorldOffer[];
  isWorldOwned: (worldId: WorldId) => boolean;
  offerForWorld: (worldId: WorldId) => purchases.WorldOffer | undefined;
  purchaseWorld: (worldId: WorldId) => Promise<boolean>;
  restoreWorlds: () => Promise<readonly WorldId[]>;
};

const WorldPurchaseContext = createContext<WorldPurchaseContextValue | null>(null);

export const WorldPurchaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loaded, setLoaded] = useState(false);
  const [offers, setOffers] = useState<readonly purchases.WorldOffer[]>([]);
  const [ownedWorldIds, setOwnedWorldIds] = useState<readonly WorldId[]>([]);

  useEffect(() => {
    let mounted = true;

    purchases
      .configure()
      .then(async () => Promise.all([purchases.listOffers(), purchases.currentOwnership()]))
      .then(([nextOffers, nextOwned]) => {
        if (!mounted) return;
        setOffers(nextOffers);
        setOwnedWorldIds(nextOwned);
      })
      .catch(() => {
        // The preview still renders if the store is temporarily unavailable.
        // The CTA remains disabled until a real offer can be loaded.
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const offerForWorld = useCallback(
    (worldId: WorldId) => offers.find((offer) => offer.worldId === worldId),
    [offers]
  );

  const isWorldOwned = useCallback(
    (worldId: WorldId) => WORLD_BY_ID[worldId].access === 'free' || ownedWorldIds.includes(worldId),
    [ownedWorldIds]
  );

  const purchaseWorld = useCallback(
    async (worldId: WorldId) => {
      const offer = offerForWorld(worldId);
      if (!offer) return false;
      const nextOwned = await purchases.purchase(offer);
      setOwnedWorldIds(nextOwned);
      return nextOwned.includes(worldId);
    },
    [offerForWorld]
  );

  const restoreWorlds = useCallback(async () => {
    const nextOwned = await purchases.restore();
    setOwnedWorldIds(nextOwned);
    return nextOwned;
  }, []);

  const value = useMemo<WorldPurchaseContextValue>(
    () => ({
      loaded,
      offers,
      isWorldOwned,
      offerForWorld,
      purchaseWorld,
      restoreWorlds,
    }),
    [loaded, offers, isWorldOwned, offerForWorld, purchaseWorld, restoreWorlds]
  );

  return <WorldPurchaseContext.Provider value={value}>{children}</WorldPurchaseContext.Provider>;
};

const FALLBACK: WorldPurchaseContextValue = {
  loaded: false,
  offers: [],
  isWorldOwned: (worldId) => WORLD_BY_ID[worldId].access === 'free',
  offerForWorld: () => undefined,
  purchaseWorld: async () => false,
  restoreWorlds: async () => [],
};

export const useWorldPurchases = (): WorldPurchaseContextValue =>
  useContext(WorldPurchaseContext) ?? FALLBACK;
