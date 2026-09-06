import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { WORLD_BY_ID, type WorldId } from '@/constants/worlds';
import * as purchases from '@/services/worldPurchaseService';

export const WORLD_PURCHASE_REQUEST_TIMEOUT_MS = 2_000;

export type WorldPurchaseResourceStatus = 'loading' | 'ready' | 'error';
export type WorldAccess = 'free' | 'owned' | 'not-owned' | 'unknown';

type WorldPurchaseContextValue = {
  /** Compatibility signal for commercial surfaces. App startup does not wait for it. */
  loaded: boolean;
  ownershipStatus: WorldPurchaseResourceStatus;
  offersStatus: WorldPurchaseResourceStatus;
  offers: readonly purchases.WorldOffer[];
  isWorldOwned: (worldId: WorldId) => boolean;
  worldAccess: (worldId: WorldId) => WorldAccess;
  offerForWorld: (worldId: WorldId) => purchases.WorldOffer | undefined;
  retryOwnership: () => Promise<void>;
  retryOffers: () => Promise<void>;
  purchaseWorld: (worldId: WorldId) => Promise<boolean>;
  restoreWorlds: () => Promise<readonly WorldId[]>;
};

const WorldPurchaseContext = createContext<WorldPurchaseContextValue | null>(null);

class WorldPurchaseTimeoutError extends Error {
  constructor() {
    super('World purchase request timed out');
    this.name = 'WorldPurchaseTimeoutError';
  }
}

function bounded<T>(request: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new WorldPurchaseTimeoutError()),
      WORLD_PURCHASE_REQUEST_TIMEOUT_MS
    );
    request.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

export const WorldPurchaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [ownershipStatus, setOwnershipStatus] =
    useState<WorldPurchaseResourceStatus>('loading');
  const [offersStatus, setOffersStatus] = useState<WorldPurchaseResourceStatus>('loading');
  const [offers, setOffers] = useState<readonly purchases.WorldOffer[]>([]);
  const [ownedWorldIds, setOwnedWorldIds] = useState<readonly WorldId[]>([]);
  const [hasVerifiedOwnership, setHasVerifiedOwnership] = useState(false);
  const mountedRef = useRef(true);
  const ownershipRequestRef = useRef(0);
  const offersRequestRef = useRef(0);

  const loadOwnership = useCallback(async (configureFirst: boolean, bootstrapRequestId?: number) => {
    const requestId = bootstrapRequestId ?? ++ownershipRequestRef.current;
    if (requestId !== ownershipRequestRef.current) return;
    if (mountedRef.current) setOwnershipStatus('loading');

    try {
      const nextOwned = await bounded(
        (async () => {
          if (configureFirst) await purchases.configure();
          return purchases.currentOwnership();
        })()
      );
      if (!mountedRef.current || requestId !== ownershipRequestRef.current) return;
      setOwnedWorldIds(nextOwned);
      setHasVerifiedOwnership(true);
      setOwnershipStatus('ready');
    } catch {
      if (!mountedRef.current || requestId !== ownershipRequestRef.current) return;
      // Keep the last service-verified snapshot. A refresh error is not a revocation.
      setOwnershipStatus('error');
    }
  }, []);

  const loadOffers = useCallback(async (configureFirst: boolean, bootstrapRequestId?: number) => {
    const requestId = bootstrapRequestId ?? ++offersRequestRef.current;
    if (requestId !== offersRequestRef.current) return;
    if (mountedRef.current) setOffersStatus('loading');

    try {
      const nextOffers = await bounded(
        (async () => {
          if (configureFirst) await purchases.configure();
          return purchases.listOffers();
        })()
      );
      if (!mountedRef.current || requestId !== offersRequestRef.current) return;
      setOffers(nextOffers);
      setOffersStatus('ready');
    } catch {
      if (!mountedRef.current || requestId !== offersRequestRef.current) return;
      // Preserve a previously published catalog while allowing an explicit retry.
      setOffersStatus('error');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const bootstrapOwnershipRequestId = ++ownershipRequestRef.current;
    const bootstrapOffersRequestId = ++offersRequestRef.current;

    bounded(purchases.configure())
      .then(() => {
        if (cancelled) return;
        // The two resources settle and publish independently after SDK setup.
        void loadOwnership(false, bootstrapOwnershipRequestId);
        void loadOffers(false, bootstrapOffersRequestId);
      })
      .catch(() => {
        if (cancelled) return;
        if (bootstrapOwnershipRequestId === ownershipRequestRef.current) {
          setOwnershipStatus('error');
        }
        if (bootstrapOffersRequestId === offersRequestRef.current) setOffersStatus('error');
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      ownershipRequestRef.current += 1;
      offersRequestRef.current += 1;
    };
  }, [loadOffers, loadOwnership]);

  const offerForWorld = useCallback(
    (worldId: WorldId) => offers.find((offer) => offer.worldId === worldId),
    [offers]
  );

  const worldAccess = useCallback(
    (worldId: WorldId): WorldAccess => {
      if (WORLD_BY_ID[worldId].access === 'free') return 'free';
      if (!hasVerifiedOwnership) return 'unknown';
      return ownedWorldIds.includes(worldId) ? 'owned' : 'not-owned';
    },
    [hasVerifiedOwnership, ownedWorldIds]
  );

  const isWorldOwned = useCallback(
    (worldId: WorldId) => {
      const access = worldAccess(worldId);
      return access === 'free' || access === 'owned';
    },
    [worldAccess]
  );

  const retryOwnership = useCallback(() => loadOwnership(true), [loadOwnership]);
  const retryOffers = useCallback(() => loadOffers(true), [loadOffers]);

  const purchaseWorld = useCallback(
    async (worldId: WorldId) => {
      const offer = offerForWorld(worldId);
      if (!offer) return false;
      const requestId = ++ownershipRequestRef.current;
      setOwnershipStatus('loading');
      try {
        const nextOwned = await purchases.purchase(offer);
        if (mountedRef.current && requestId === ownershipRequestRef.current) {
          setOwnedWorldIds(nextOwned);
          setHasVerifiedOwnership(true);
          setOwnershipStatus('ready');
        }
        return nextOwned.includes(worldId);
      } catch (error) {
        if (mountedRef.current && requestId === ownershipRequestRef.current) {
          setOwnershipStatus('error');
        }
        throw error;
      }
    },
    [offerForWorld]
  );

  const restoreWorlds = useCallback(async () => {
    const requestId = ++ownershipRequestRef.current;
    setOwnershipStatus('loading');
    try {
      const nextOwned = await purchases.restore();
      if (mountedRef.current && requestId === ownershipRequestRef.current) {
        setOwnedWorldIds(nextOwned);
        setHasVerifiedOwnership(true);
        setOwnershipStatus('ready');
      }
      return nextOwned;
    } catch (error) {
      if (mountedRef.current && requestId === ownershipRequestRef.current) {
        setOwnershipStatus('error');
      }
      throw error;
    }
  }, []);

  const loaded = ownershipStatus !== 'loading' && offersStatus !== 'loading';

  const value = useMemo<WorldPurchaseContextValue>(
    () => ({
      loaded,
      ownershipStatus,
      offersStatus,
      offers,
      isWorldOwned,
      worldAccess,
      offerForWorld,
      retryOwnership,
      retryOffers,
      purchaseWorld,
      restoreWorlds,
    }),
    [
      loaded,
      ownershipStatus,
      offersStatus,
      offers,
      isWorldOwned,
      worldAccess,
      offerForWorld,
      retryOwnership,
      retryOffers,
      purchaseWorld,
      restoreWorlds,
    ]
  );

  return <WorldPurchaseContext.Provider value={value}>{children}</WorldPurchaseContext.Provider>;
};

const FALLBACK: WorldPurchaseContextValue = {
  loaded: false,
  ownershipStatus: 'loading',
  offersStatus: 'loading',
  offers: [],
  isWorldOwned: (worldId) => WORLD_BY_ID[worldId].access === 'free',
  worldAccess: (worldId) => (WORLD_BY_ID[worldId].access === 'free' ? 'free' : 'unknown'),
  offerForWorld: () => undefined,
  retryOwnership: async () => {},
  retryOffers: async () => {},
  purchaseWorld: async () => false,
  restoreWorlds: async () => [],
};

export const useWorldPurchases = (): WorldPurchaseContextValue =>
  useContext(WorldPurchaseContext) ?? FALLBACK;
